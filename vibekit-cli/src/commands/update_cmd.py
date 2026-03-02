from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel

from assets import copy_kit_content_assets, list_custom_assets_for_kit, sync_kit_skill_assets
from commands.common import emit_repo_source, ensure_minimal_kit_yaml
from state import load_installed_kits, record_install, resolve_state_root, state_dir
from repositories import KitSummary, RepositoryContext, detect_repositories
from constants import (
    REMOTE_SOURCE,
    REMOTE_UPDATE,
    AUTODETECT_UPDATE,
    OperationExitCode,
)
import versioning as _versioning


console = Console()
err_console = Console(stderr=True)


def _ensure_installed(installed_meta: dict[str, dict], kit_name: str) -> str:
    if kit_name not in installed_meta:
        _emit_status_and_exit(
            [
                (
                    f"[yellow]Package '{kit_name}' is not installed.[/] "
                    f"Install with: [cyan]vibekit install {kit_name}[/]"
                )
            ],
            "warning",
            OperationExitCode.NOT_INSTALLED,
        )
    return installed_meta[kit_name].get("version") or "0.0.0"


def _select_update_context(root: Path, kit_name: str) -> tuple[RepositoryContext, KitSummary]:
    contexts = detect_repositories(root)
    if not contexts:
        _emit_status_and_exit(
            [f"[red]Package '{kit_name}' not found in available repositories[/]"],
            "error",
            OperationExitCode.NOT_FOUND,
        )

    last_error: Exception | None = None
    for candidate in contexts:
        repository = candidate.repository
        try:
            summaries = {item.identifier: item for item in repository.list_kits()}
        except (ValueError, RuntimeError) as exc:
            last_error = exc
            continue

        summary = summaries.get(kit_name)
        if summary is not None:
            return candidate, summary

    if last_error is not None:
        _emit_status_and_exit([f"[red]{last_error}[/]"], "error", OperationExitCode.REPOSITORY_ERROR)

    _emit_status_and_exit(
        [f"[red]Package '{kit_name}' not found in available repositories[/]"],
        "error",
        OperationExitCode.NOT_FOUND,
    )

    raise typer.Exit(code=OperationExitCode.NOT_FOUND)


def _emit_context_source(context: RepositoryContext) -> None:
    repository = context.repository
    if context.kind == "local" and context.roots:
        emit_repo_source(list(context.roots), getattr(repository, "source_kind", None))
    elif context.kind == "github":
        console.print(f"[dim]Repository source: {REMOTE_SOURCE} -> {context.remote_url}[/]")


def _should_update(kit_name: str, installed_version: str, available_version: str, dry_run: bool) -> int:
    try:
        cmp = _versioning.compare(installed_version, available_version)
    except Exception:  # pragma: no cover
        cmp = 0

    if dry_run:
        if cmp < 0:
            _emit_status_and_exit(
                [
                    f"[bold green]Update available for {kit_name}[/] ",
                    f"Installed: [yellow]{installed_version}[/], Available: [bold green]{available_version}[/]",
                ],
                "success",
                OperationExitCode.SUCCESS,
                title="Dry-Run: Update Available",
            )
        _emit_status_and_exit(
            [
                f"[bold]No update needed for {kit_name}[/] ",
                f"Installed: [green]{installed_version}[/], Available: [green]{available_version}[/]",
            ],
            "info",
            OperationExitCode.SUCCESS,
            title="Dry-Run: Up To Date",
        )

    if cmp >= 0:
        _emit_status_and_exit(
            [
                f"[bold]No newer version for {kit_name}[/] ",
                f"Installed: [green]{installed_version}[/], Available: [green]{available_version}[/]",
            ],
            "info",
            OperationExitCode.SUCCESS,
        )

    return cmp


def _perform_update(repository, kit_name: str, target_dir: Path):
    try:
        return repository.update(kit_name, target_dir)
    except FileNotFoundError:
        _emit_status_and_exit(
            [f"[red]Package '{kit_name}' not found in detected repository[/]"],
            "error",
            OperationExitCode.NOT_FOUND,
        )
    except FileExistsError as exc:
        _emit_status_and_exit([f"[red]{exc}[/]"], "error", OperationExitCode.REPOSITORY_ERROR)
    except (ValueError, RuntimeError) as exc:
        _emit_status_and_exit([f"[red]{exc}[/]"], "error", OperationExitCode.REPOSITORY_ERROR)

    raise typer.Exit(code=OperationExitCode.REPOSITORY_ERROR)


def _process_update_artifacts(
    update_result,
    root: Path,
    state_root: Path,
    target_dir: Path,
    kit_name: str,
    status_lines: list[str],
) -> str:
    source_path = update_result.source_path or target_dir
    assets_copied = copy_kit_content_assets(source_path, state_root, kit_name)
    skill_assets_copied = sync_kit_skill_assets(root, target_dir, kit_name)
    if assets_copied:
        status_lines.append(
            f"[green]Refreshed {len(assets_copied)} customization file(s) for {kit_name}[/]"
        )
    if skill_assets_copied:
        status_lines.append(
            f"[green]Refreshed skill assets for {kit_name} -> {skill_assets_copied[0]}[/]"
        )

    panel_variant = "success"
    custom_dir_installed = target_dir / "customizations"
    if custom_dir_installed.exists():
        try:
            shutil.rmtree(custom_dir_installed)
        except Exception as exc:  # pragma: no cover
            warning_message = (
                f"[yellow]Warning: failed to remove customizations directory after update: {exc}[/]"
            )
            status_lines.append(warning_message)
            panel_variant = "warning"

    if update_result.notes:
        status_lines.extend(update_result.notes)

    return panel_variant


def _render_status_panel(
    messages: list[str],
    variant: str = "info",
    title: Optional[str] = None,
) -> Panel:
    palette = {
        "success": ("Update Complete", "green"),
        "warning": ("Update Notice", "yellow"),
        "error": ("Update Error", "red"),
        "info": ("Update Status", "cyan"),
    }
    default_title, border = palette.get(variant, ("Update Status", "cyan"))
    content = "\n".join(messages) if messages else "No status available."
    return Panel(
        content,
        title=title or default_title,
        title_align="left",
        border_style=border,
    )


def _emit_status_and_exit(
    messages: list[str],
    variant: str,
    exit_code: int,
    title: Optional[str] = None,
) -> None:
    target_console = err_console if variant == "error" else console
    target_console.print(_render_status_panel(messages, variant, title))
    raise typer.Exit(code=exit_code)


def run_update(kit_name: str, dry_run: bool, assume_yes: bool = False):
    root = resolve_state_root(Path.cwd())
    state_root = state_dir(root)
    target_dir = state_root / "innovation-kits" / kit_name

    installed_meta = {k.get("id"): k for k in load_installed_kits(root)}
    installed_version = _ensure_installed(installed_meta, kit_name)

    context, summary = _select_update_context(root, kit_name)
    repository = context.repository
    _emit_context_source(context)

    available_version = summary.version or "0.0.0"
    cmp = _should_update(kit_name, installed_version, available_version, dry_run)

    recorded_assets: list[str] = []
    if cmp < 0:
        recorded_assets = list_custom_assets_for_kit(state_root, kit_name)
        if not assume_yes:
            prompt_lines = [
                f"Preparing to update '{kit_name}' from {installed_version} to {available_version}.",
                f"Kit directory: {target_dir}",
                "Existing kit files will be replaced with the new version.",
            ]
            if recorded_assets:
                prompt_lines.append("")
                prompt_lines.append("Customization assets will be refreshed (current copies will be deleted):")
                for asset in recorded_assets:
                    prompt_lines.append(f"  - {asset}")
            prompt_lines.append("")
            prompt_lines.append("Proceed with update? (default: No)")
            prompt = "\n".join(prompt_lines)
            if not typer.confirm(prompt, default=False):
                _emit_status_and_exit([
                    f"[yellow]Update cancelled; '{kit_name}' remains at version {installed_version}.[/]"
                ], "warning", OperationExitCode.SUCCESS)

    update_result = _perform_update(repository, kit_name, target_dir)

    manifest_meta = update_result.metadata or {
        "id": kit_name,
        "name": kit_name,
        "version": available_version,
    }
    manifest_meta.setdefault("id", kit_name)
    manifest_meta.setdefault("name", kit_name)
    manifest_meta.setdefault("version", available_version)

    source_kind_value = (
        REMOTE_UPDATE if context.kind == "github" else AUTODETECT_UPDATE
    )

    status_lines: list[str] = []

    record_install(root, manifest_meta, target_dir, source_kind=source_kind_value)
    ensure_minimal_kit_yaml(target_dir, kit_name, manifest_meta)

    panel_variant = _process_update_artifacts(
        update_result,
        root,
        state_root,
        target_dir,
        kit_name,
        status_lines,
    )

    status_lines.append(
        f"[bold green]Updated {kit_name} from [yellow]{installed_version}[/] to [bold green]{manifest_meta.get('version')}[/]"
    )
    _emit_status_and_exit(status_lines, panel_variant, OperationExitCode.SUCCESS)
