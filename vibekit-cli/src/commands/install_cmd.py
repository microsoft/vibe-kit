from __future__ import annotations

from pathlib import Path
from typing import List, Optional
import os
import shutil
import tempfile

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from state import state_dir, load_installed_kits, record_install, resolve_state_root
from repo import resolve_repo_root, is_git_url, download_remote_kit, load_repo_env
from manifests import extract_manifest_metadata, prefer_manifest_file
from assets import copy_kit_content_assets, detect_customization_conflicts
from commands.common import emit_repo_source, ensure_minimal_kit_yaml

console = Console()
err_console = Console(stderr=True)

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


def run_install(kit_name: str):
    root = resolve_state_root(Path.cwd())
    load_repo_env(root)
    installed = {k.get("id"): k for k in load_installed_kits(root)}
    if kit_name in installed:
        _emit_status_and_exit(
            [
                f"[yellow]{kit_name} already installed (recorded in innovation-kits.json)[/]"
            ],
            is_error=False,
            exit_code=0,
        )

    kits_dir = state_dir(root) / "innovation-kits"
    kits_dir.mkdir(parents=True, exist_ok=True)
    target = kits_dir / kit_name
    if target.exists():
        manifest_meta = extract_manifest_metadata(prefer_manifest_file(target)) or {
            "id": kit_name,
            "name": kit_name,
            "version": "0.0.0",
        }
        record_install(root, manifest_meta, target, source_kind="existing-directory")
        _emit_status_and_exit(
            [
                f"[yellow]{kit_name} directory already exists; recording metadata (drift reconciliation)[/]"
            ],
            is_error=False,
            exit_code=0,
        )

    configured_repo = (os.getenv("VIBEKIT_BASE_PATH") or "").strip()
    implicit_src: Optional[Path] = None
    source_kind = "env-repository"
    remote_manifest_meta: Optional[dict] = None
    temp_dir_ctx: Optional[tempfile.TemporaryDirectory] = None
    status_lines: list[str] = []
    is_error = False

    try:
        implicit_srcs: List[Path] = []

        if configured_repo and is_git_url(configured_repo):
            try:
                temp_dir_ctx = tempfile.TemporaryDirectory(prefix="vibekit-remote-")
                temp_dir = Path(temp_dir_ctx.name)
                implicit_src, remote_manifest_meta = download_remote_kit(
                    configured_repo, kit_name, temp_dir
                )
                source_kind = "env-remote"
                console.print(f"[dim]Repository source: env-remote -> {configured_repo}[/]")
            except (ValueError, NotImplementedError) as exc:
                err_console.print(f"[red]{exc}[/]")
                _emit_status_and_exit([f"[red]{exc}[/]"], True, 2)
            except RuntimeError as exc:
                err_console.print(f"[red]{exc}[/]")
                _emit_status_and_exit([f"[red]{exc}[/]"], True, 6)
        else:
            repo_roots, resolved_kind = resolve_repo_root(root)
            if repo_roots is not None:
                emit_repo_source(repo_roots, resolved_kind)
                for repo_root in repo_roots:
                    candidate = repo_root / kit_name
                    if candidate.is_dir():
                        implicit_srcs.append(candidate)

            if len(implicit_srcs) == 0:
                err_console.print(f"[red]Unknown kit name: {kit_name}[/]")
                _emit_status_and_exit([f"[red]Unknown kit name: {kit_name}[/]"], True, 3)

        assert implicit_srcs is not None  # for type checkers
        for implicit_src in implicit_srcs:
            custom_dir = implicit_src / "customizations"
            if custom_dir.is_dir():
                all_custom_files = [p for p in custom_dir.rglob("*") if p.is_file()]
                conflicts = detect_customization_conflicts(
                    state_dir(root), kit_name, all_custom_files, custom_dir
                )
                if conflicts:
                    status_lines.extend(f"[yellow]{msg}[/]" for msg in conflicts)
                    status_lines.append(
                        "[yellow]Continuing installation; conflicting customization files will be skipped.[/]"
                    )
            try:
                shutil.copytree(implicit_src, target)
                fix_directory_permissions(target)
            except Exception as e:
                err_console.print(
                    f"[red]Failed to copy local repository kit from {implicit_src}: {e}[/]"
                )
                _emit_status_and_exit(
                    [f"[red]Failed to copy local repository kit from {implicit_src}: {e}[/]"],
                    True,
                    6,
                )
            manifest_meta = remote_manifest_meta or extract_manifest_metadata(prefer_manifest_file(target)) or {
                "id": kit_name,
                "name": kit_name,
                "version": "0.0.0",
            }

            record_install(root, manifest_meta, target, source_kind=source_kind)
            ensure_minimal_kit_yaml(target, kit_name, manifest_meta)
            assets_copied = copy_kit_content_assets(implicit_src, state_dir(root), kit_name)
            custom_dir_installed = target / "customizations"
            if custom_dir_installed.exists():
                try:
                    shutil.rmtree(custom_dir_installed)
                except Exception as e:  # pragma: no cover
                    err_console.print(
                        f"[yellow]Warning: failed to remove customizations directory from installed kit: {e}[/]"
                    )
                    status_lines.append(
                        f"[yellow]Warning: failed to remove customizations directory from installed kit: {e}[/]"
                    )
            if assets_copied:
                status_lines.append(
                    f"[green]Copied {len(assets_copied)} customization file(s) for {kit_name}[/]"
                )
            status_lines.append(f"[green]Installed kit {kit_name} -> {target}[/]")
            console.print(_render_status_panel(status_lines, is_error))
            post_install = manifest_meta.get("post_install_instructions")
            if post_install:
                console.print(
                    Panel(
                        Markdown(post_install),
                        title="Next Steps",
                        title_align="left",
                        border_style="cyan",
                    )
                )
    except typer.Exit:
        raise
    except Exception as exc:  # pragma: no cover
        status_lines.append(f"[red]Installation failed: {exc}[/]")
        _emit_status_and_exit(status_lines, True, 7)
    finally:
        if temp_dir_ctx is not None:
            temp_dir_ctx.cleanup()


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
