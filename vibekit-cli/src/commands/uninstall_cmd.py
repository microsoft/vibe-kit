from __future__ import annotations

from pathlib import Path
from typing import List
import shutil

import typer
from rich.console import Console
from rich.panel import Panel

from assets import remove_kit_from_custom_index
from state import load_installed_kits, resolve_state_root, state_dir, write_installed_kits


console = Console()
err_console = Console(stderr=True)


def _render_status_panel(
    messages: List[str],
    variant: str = "info",
    title: str | None = None,
) -> Panel:
    palette = {
        "success": ("Uninstall Complete", "green"),
        "warning": ("Uninstall Notice", "yellow"),
        "error": ("Uninstall Error", "red"),
        "info": ("Uninstall Status", "cyan"),
    }
    default_title, border = palette.get(variant, ("Uninstall Status", "cyan"))
    return Panel(
        "\n".join(messages) if messages else "No status available.",
        title=title or default_title,
        title_align="left",
        border_style=border,
    )


def _emit_and_exit(messages: List[str], variant: str = "success", exit_code: int = 0):
    (err_console if variant == "error" else console).print(
        _render_status_panel(messages, variant)
    )
    raise typer.Exit(code=exit_code)


def run_uninstall(kit_name: str):

    root = resolve_state_root(Path.cwd())
    installed = load_installed_kits(root)
    before_len = len(installed)
    remaining = [k for k in installed if k.get("id") != kit_name]
    was_installed = len(remaining) != before_len
    kit_dir = state_dir(root) / "innovation-kits" / kit_name

    status_lines: List[str] = []
    variant = "success"
    if not was_installed:
        _emit_and_exit([
            f"[yellow]Kit '{kit_name}' is not installed[/]"
        ], "warning", 1)

    if kit_dir.exists():
        try:
            shutil.rmtree(kit_dir)
            status_lines.append(
                f"[green]Removed kit directory[/] [bold]{kit_dir}[/]"
            )
        except Exception as e:
            _emit_and_exit(
                [f"[red]Failed to remove kit directory {kit_dir}: {e}[/]"],
                variant="error",
                exit_code=2,
            )
    else:
        status_lines.extend(
            [
                f"[yellow]Directory missing[/] (path: {kit_dir})",
                "[yellow]Continuing with cleaning metadata ...[/]"
            ]
        )
        variant = "warning"

    removed_assets: List[str] = []
    write_installed_kits(root, remaining)

    try:
        bundles = remove_kit_from_custom_index(state_dir(root), kit_name)
    except Exception:  # pragma: no cover
        bundles = []
    for rel in bundles or []:
        dest = state_dir(root) / rel
        if dest.exists():
            try:
                dest.unlink()
                removed_assets.append(rel.replace("\\", "/"))
            except Exception as e:  # pragma: no cover
                status_lines.append(
                    f"[yellow]Failed to remove asset {dest}: {e}[/]"
                )
                variant = "warning"
    if removed_assets:
        status_lines.append(
            f"[green]Removed customization {len(removed_assets)} assets[/]:"
        )
        status_lines.extend([f"\t- [green]{asset}[/]" for asset in removed_assets])

    status_lines.append(f"[bold green]Uninstalled {kit_name}[/]")
    _emit_and_exit(status_lines, variant)
