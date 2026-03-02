from __future__ import annotations

import shutil
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from assets import (
    copy_kit_content_assets,
    detect_customization_conflicts,
    sync_kit_skill_assets,
)
from commands.common import emit_repo_source, ensure_minimal_kit_yaml
from constants import AUTODETECT_SOURCE, OperationExitCode, REMOTE_SOURCE
from env import load_repo_env
from manifests import extract_manifest_metadata, prefer_manifest_file
from repositories import RepositoryContext, detect_repositories
from state import load_installed_kits, record_install, resolve_state_root, state_dir

console = Console()
err_console = Console(stderr=True)

BASE_SKILL_KIT_IDS: tuple[str, ...] = ("vibe-kit-core",)

def _locate_repository(
    contexts: List[RepositoryContext], kit_name: str
) -> tuple[Optional[RepositoryContext], Optional[str], Optional[Exception]]:
    last_error: Exception | None = None
    for candidate in contexts:
        repository = candidate.repository
        try:
            summaries = {summary.identifier: summary for summary in repository.list_kits()}
        except (ValueError, RuntimeError) as exc:
            last_error = exc
            continue

        summary = summaries.get(kit_name)
        if summary is not None:
            return candidate, summary.version or "0.0.0", None

    return None, None, last_error


def _resolve_context(root: Path, kit_name: str) -> tuple[RepositoryContext, str]:
    contexts = detect_repositories(root)
    if not contexts:
        err_console.print(f"[red]Unknown kit name: {kit_name}[/]")
        _emit_status_and_exit(
            [f"[red]Unknown kit name: {kit_name}[/]"],
            True,
            OperationExitCode.INVALID_INPUT,
        )

    context, available_version, last_error = _locate_repository(contexts, kit_name)
    if context is None:
        if last_error is not None:
            err_console.print(f"[red]{last_error}[/]")
            _emit_status_and_exit(
                [f"[red]{last_error}[/]"],
                True,
                OperationExitCode.REPOSITORY_ERROR,
            )
        err_console.print(f"[red]Unknown kit name: {kit_name}[/]")
        _emit_status_and_exit(
            [f"[red]Unknown kit name: {kit_name}[/]"],
            True,
            OperationExitCode.INVALID_INPUT,
        )

    return context, available_version or "0.0.0"


def _describe_context(context: RepositoryContext) -> str:
    repository = context.repository
    if context.kind == "local" and context.roots:
        emit_repo_source(list(context.roots), getattr(repository, "source_kind", None))
        return getattr(repository, "source_kind", None) or AUTODETECT_SOURCE
    if context.kind == "github":
        console.print(f"[dim]Repository source: {REMOTE_SOURCE} -> {context.remote_url}[/]")
        return REMOTE_SOURCE
    return AUTODETECT_SOURCE


def _perform_install(repository, kit_name: str, target: Path):
    try:
        return repository.install(kit_name, target)
    except FileNotFoundError:
        err_console.print(f"[red]Unknown kit name: {kit_name}[/]")
        _emit_status_and_exit(
            [f"[red]Unknown kit name: {kit_name}[/]"],
            True,
            OperationExitCode.INVALID_INPUT,
        )
    except FileExistsError as exc:
        err_console.print(f"[red]{exc}[/]")
        _emit_status_and_exit(
            [f"[red]{exc}[/]"],
            True,
            OperationExitCode.REPOSITORY_ERROR,
        )
    except (ValueError, RuntimeError) as exc:
        err_console.print(f"[red]{exc}[/]")
        _emit_status_and_exit(
            [f"[red]{exc}[/]"],
            True,
            OperationExitCode.REPOSITORY_ERROR,
        )

    raise typer.Exit(code=OperationExitCode.REPOSITORY_ERROR)


def _abort_if_already_installed(installed: dict[str, dict], kit_name: str) -> None:
    if kit_name in installed:
        _emit_status_and_exit(
            [f"[yellow]{kit_name} already installed (recorded in innovation-kits.json)[/]"],
            is_error=False,
            exit_code=OperationExitCode.SUCCESS,
        )


def _prepare_install_target(root: Path, kit_name: str) -> tuple[Path, Path, list[str], bool]:
    state_root = state_dir(root)
    kits_dir = state_root / "innovation-kits"
    kits_dir.mkdir(parents=True, exist_ok=True)
    target = kits_dir / kit_name
    if target.exists():
        manifest_meta = extract_manifest_metadata(prefer_manifest_file(target)) or {
            "id": kit_name,
            "name": kit_name,
            "version": "0.0.0",
        }
        record_install(root, manifest_meta, target, source_kind="existing-directory")
        return (
            state_root,
            target,
            [
                f"[yellow]{kit_name} directory already exists; recording metadata "
                "(drift reconciliation)[/]"
            ],
            False,
        )
    return state_root, target, [], True


def _process_customizations(
    source_path: Path,
    state_root: Path,
    kit_name: str,
    target: Path,
    status_lines: list[str],
) -> list[str]:
    custom_dir = source_path / "customizations"
    if custom_dir.is_dir():
        all_custom_files = [p for p in custom_dir.rglob("*") if p.is_file()]
        conflicts = detect_customization_conflicts(
            state_root,
            kit_name,
            all_custom_files,
            custom_dir,
        )
        if conflicts:
            status_lines.extend(f"[yellow]{msg}[/]" for msg in conflicts)
            status_lines.append(
                "[yellow]Continuing installation; conflicting customization files "
                "will be skipped.[/]"
            )

    assets_copied = copy_kit_content_assets(source_path, state_root, kit_name)

    custom_dir_installed = target / "customizations"
    if custom_dir_installed.exists():
        try:
            shutil.rmtree(custom_dir_installed)
        except Exception as exc:  # pragma: no cover
            err_console.print(
                "[yellow]Warning: failed to remove customizations directory "
                f"from installed kit: {exc}[/]"
            )
            status_lines.append(
                "[yellow]Warning: failed to remove customizations directory "
                f"from installed kit: {exc}[/]"
            )

    return assets_copied

def fix_directory_permissions(directory: Path) -> None:
    """
    Recursively fix permissions on copied directories to ensure they're writable.
    This is needed when source files are owned by root or have restrictive permissions.
    Uses subprocess for speed and reliability.
    """
    import subprocess

    try:
        # Use chmod -R for speed and reliability
        # u+rwX: user gets read+write, execute for dirs/executables
        subprocess.run(
            ["chmod", "-R", "u+rwX", str(directory)], check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as e:
        err_console.print(f"Warning: Could not fix permissions for {directory}: {e.stderr}")
    except Exception as e:
        err_console.print(f"Warning: Error fixing directory permissions: {e}")


def _install_single_kit(
    root: Path,
    kit_name: str,
    *,
    exit_on_already_installed: bool,
) -> tuple[list[str], str | None, bool]:
    installed = {k.get("id"): k for k in load_installed_kits(root)}
    if kit_name in installed:
        status_lines = [
            f"[yellow]{kit_name} already installed (recorded in innovation-kits.json)[/]"
        ]
        if exit_on_already_installed:
            _emit_status_and_exit(
                status_lines,
                is_error=False,
                exit_code=OperationExitCode.SUCCESS,
            )
        return status_lines, None, False

    state_root, target, preflight_messages, should_install = _prepare_install_target(
        root,
        kit_name,
    )
    if not should_install:
        return preflight_messages, None, False

    source_kind = AUTODETECT_SOURCE
    status_lines: list[str] = []

    try:
        context, available_version = _resolve_context(root, kit_name)
        repository = context.repository
        source_kind = _describe_context(context)
        install_result = _perform_install(repository, kit_name, target)

        fix_directory_permissions(target)

        manifest_meta = install_result.metadata or {
            "id": kit_name,
            "name": kit_name,
            "version": available_version or "0.0.0",
        }
        manifest_meta.setdefault("id", kit_name)
        manifest_meta.setdefault("name", kit_name)
        manifest_meta.setdefault("version", "0.0.0")

        source_path = install_result.source_path or target

        record_install(root, manifest_meta, target, source_kind=source_kind)
        ensure_minimal_kit_yaml(target, kit_name, manifest_meta)
        assets_copied = _process_customizations(
            source_path,
            state_root,
            kit_name,
            target,
            status_lines,
        )
        skill_assets_copied = sync_kit_skill_assets(root, target, kit_name)

        if assets_copied:
            status_lines.append(
                f"[green]Copied {len(assets_copied)} customization file(s) for {kit_name}[/]"
            )
        if skill_assets_copied:
            status_lines.append(
                f"[green]Installed skill assets for {kit_name} -> {skill_assets_copied[0]}[/]"
            )

        if install_result.notes:
            status_lines.extend(install_result.notes)

        if bool(manifest_meta.get("legacy_descriptor", False)):
            status_lines.append(
                "[yellow]Deprecation:[/] "
                f"Kit '[bold]{kit_name}[/]' uses legacy INNOVATION_KIT.md metadata. "
                "Prefer SKILL.md."
            )

        status_lines.append(f"[green]Installed kit {kit_name} -> {target}[/]")

        post_install = install_result.post_install or manifest_meta.get("post_install_instructions")
        return status_lines, post_install, True
    except typer.Exit:
        raise
    except Exception as exc:  # pragma: no cover
        status_lines.append(f"[red]Installation failed: {exc}[/]")
        _emit_status_and_exit(
            status_lines,
            True,
            OperationExitCode.GENERAL_FAILURE,
        )


def _base_skills_available(root: Path) -> list[str]:
    contexts = detect_repositories(root)
    available_base_skills: list[str] = []
    for base_skill_id in BASE_SKILL_KIT_IDS:
        context, _, _ = _locate_repository(contexts, base_skill_id)
        if context is not None:
            available_base_skills.append(base_skill_id)
    return available_base_skills


def run_install(kit_name: str, skip_base_skills: bool = False):
    root = resolve_state_root(Path.cwd())
    load_repo_env(root)

    status_lines: list[str] = []

    if not skip_base_skills and kit_name not in BASE_SKILL_KIT_IDS:
        for base_skill_id in _base_skills_available(root):
            base_lines, _, base_installed = _install_single_kit(
                root,
                base_skill_id,
                exit_on_already_installed=False,
            )
            if base_installed:
                status_lines.extend(base_lines)

    kit_status_lines, post_install, _ = _install_single_kit(
        root,
        kit_name,
        exit_on_already_installed=False,
    )
    status_lines.extend(kit_status_lines)

    console.print(_render_status_panel(status_lines, is_error=False))

    if post_install:
        console.print(
            Panel(
                Markdown(post_install),
                title="Next Steps",
                title_align="left",
                border_style="cyan",
            )
        )


def _render_status_panel(status_lines: list[str], is_error: bool) -> Panel:
    border_style = "red" if is_error else "green"
    title = "Installation Error" if is_error else "Installation Complete"
    if not status_lines:
        status_lines = ["No status available."]
    return Panel(
        "\n".join(status_lines),
        title=title,
        title_align="left",
        border_style=border_style,
    )


def _emit_status_and_exit(messages: list[str], is_error: bool, exit_code: int) -> None:
    console.print(_render_status_panel(messages, is_error))
    raise typer.Exit(code=exit_code)
