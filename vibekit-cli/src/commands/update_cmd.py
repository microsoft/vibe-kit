from __future__ import annotations

from pathlib import Path
from typing import List, Optional
import shutil

import typer
from rich.console import Console
from rich.panel import Panel

from assets import copy_kit_content_assets
from commands.common import emit_repo_source, ensure_minimal_kit_yaml
from manifests import extract_manifest_metadata, prefer_manifest_file
from repo import resolve_repo_root
from state import load_installed_kits, record_install, resolve_state_root, state_dir
import versioning as _versioning


console = Console()
err_console = Console(stderr=True)


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


def run_update(kit_name: str, dry_run: bool):
    root = resolve_state_root(Path.cwd())

    repo_root, source_kind = resolve_repo_root(root)
    source_dirs: List[Path] = []

    if repo_root is not None:
        emit_repo_source(repo_root, source_kind)

    source_dirs: List[Path] = [
        repo / kit_name for repo in repo_root or [] if (repo / kit_name).is_dir()
    ]

    # First verify that all source dirs exist
    if len(source_dirs) == 0:
        _emit_status_and_exit([
            f"[red]Package '{kit_name}' not found in local repository[/]"
            ], "error", 1)

    source_dir: Path = source_dirs[0]

    installed_meta = {k.get("id"): k for k in load_installed_kits(root)}

    if kit_name not in installed_meta:
        _emit_status_and_exit([
            (
                f"[yellow]Package '{kit_name}' is not installed.[/] "
                f"Install with: [cyan]vibekit install {kit_name}[/]"
            )
        ], "warning", 2)

    installed_version = installed_meta[kit_name].get("version") or "0.0.0"
    manifest_meta = extract_manifest_metadata(prefer_manifest_file(source_dir)) or {}
    source_version = manifest_meta.get("version") or "0.0.0"
    try:
        cmp = _versioning.compare(installed_version, source_version)
    except Exception:  # pragma: no cover
        cmp = 0

    if dry_run:
        if cmp < 0:
            _emit_status_and_exit([
                    f"[bold green]Update available for {kit_name}[/] ",
                    f"Installed: [yellow]{installed_version}[/], Available: [bold green]{source_version}[/]"
                ], "success", 0, title="Dry-Run: Update Available")
        else:
            _emit_status_and_exit([
                    f"[bold]No update needed for {kit_name}[/] ",
                    f"Installed: [green]{installed_version}[/], Available: [green]{source_version}[/]"
                ], "info", 0, title="Dry-Run: Up To Date")
        return  # already exited above

    if cmp >= 0:
        _emit_status_and_exit([
                f"[bold]No newer version for {kit_name}[/] ",
                f"Installed: [green]{installed_version}[/], Available: [green]{source_version}[/]"
            ], "info", 0)
        return  # already exited

    kits_dir = state_dir(root) / "innovation-kits"
    target_dir = kits_dir / kit_name
    if target_dir.exists():
        try:
            shutil.rmtree(target_dir)
        except Exception as e:
            _emit_status_and_exit(
                [f"[red]Failed to remove existing installation: {e}[/]"],
                variant="error",
                exit_code=6
            )

    try:
        shutil.copytree(source_dir, target_dir)
    except Exception as e:
        _emit_status_and_exit([
            f"[red]Failed to copy new version from {source_dir}: {e}[/]"
        ], "error", 6)

    new_meta = extract_manifest_metadata(prefer_manifest_file(target_dir)) or {
        "id": kit_name,
        "name": kit_name,
        "version": source_version,
    }
    if "version" not in new_meta:
        new_meta["version"] = source_version

    panel_variant = "success"
    status_lines: list[str] = []

    record_install(root, new_meta, target_dir, source_kind="env-repository-update")
    ensure_minimal_kit_yaml(target_dir, kit_name, new_meta)
    assets_copied = copy_kit_content_assets(source_dir, state_dir(root), kit_name)
    if assets_copied:
        status_lines.append(
            f"[green]Refreshed {len(assets_copied)} customization file(s) for {kit_name}[/]"
        )

    custom_dir_installed = target_dir / "customizations"
    if custom_dir_installed.exists():
        try:
            shutil.rmtree(custom_dir_installed)
        except Exception as e:   # pragma: no cover
            warning_message = f"[yellow]Warning: failed to remove customizations directory after update: {e}[/]"
            status_lines.append(warning_message)
            panel_variant = "warning"

    status_lines.append(
        f"[bold green]Updated {kit_name} from [yellow]{installed_version}[/] to [bold green]{source_version}[/]"
    )
    _emit_status_and_exit(status_lines, panel_variant, 0)
