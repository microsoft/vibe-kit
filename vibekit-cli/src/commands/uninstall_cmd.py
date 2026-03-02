from __future__ import annotations

import shutil
from pathlib import Path
from typing import List

import typer
from rich.console import Console
from rich.panel import Panel

from assets import (
    list_custom_assets_for_kit,
    remove_kit_from_custom_index,
    remove_kit_skill_assets,
)
from constants import OperationExitCode
from repositories import detect_repository
from state import load_installed_kits, resolve_state_root, state_dir, write_installed_kits


console = Console()
err_console = Console(stderr=True)

BASE_SKILL_KIT_IDS: tuple[str, ...] = ("vibe-kit-core",)


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


def _emit_and_exit(
    messages: List[str],
    variant: str = "success",
    exit_code: int = OperationExitCode.SUCCESS,
):
    (err_console if variant == "error" else console).print(
        _render_status_panel(messages, variant)
    )
    raise typer.Exit(code=exit_code)


def run_uninstall(kit_name: str, assume_yes: bool = False):

    root = resolve_state_root(Path.cwd())
    installed = load_installed_kits(root)
    installed_ids = {entry.get("id") for entry in installed if entry.get("id")}

    if kit_name in BASE_SKILL_KIT_IDS:
        dependent_kit_ids = sorted(
            installed_id
            for installed_id in installed_ids
            if installed_id not in BASE_SKILL_KIT_IDS
        )
        if dependent_kit_ids:
            _emit_and_exit(
                [
                    "[yellow]Cannot uninstall shared base skill "
                    f"'{kit_name}' while dependent kits are installed.[/]",
                    f"[yellow]Dependent kits:[/] {', '.join(dependent_kit_ids)}",
                ],
                "warning",
                OperationExitCode.INVALID_INPUT,
            )

    before_len = len(installed)
    remaining = [k for k in installed if k.get("id") != kit_name]
    was_installed = len(remaining) != before_len
    state_root = state_dir(root)
    kit_dir = state_root / "innovation-kits" / kit_name

    status_lines: List[str] = []
    variant = "success"
    if not was_installed:
        _emit_and_exit([
            f"[yellow]Kit '{kit_name}' is not installed[/]"
        ], "warning", OperationExitCode.NOT_INSTALLED)

    recorded_assets = list_custom_assets_for_kit(state_root, kit_name)

    if not assume_yes:
        kit_path_display = str(kit_dir.resolve())
        prompt_lines = [
            f"Preparing to uninstall '{kit_name}'.",
            f"Kit directory: {kit_path_display}",
            "[bold]Any local changes stored there will be lost[/bold]",
        ]
        if recorded_assets:
            prompt_lines.append("")
            prompt_lines.append("Customization assets queued for removal:")
            for asset in recorded_assets:
                prompt_lines.append(f"  - {asset}")
        # Print a Rich-styled panel first; Typer confirm is plain text
        console.print(
            _render_status_panel(
                prompt_lines,
                variant="warning",
                title="Uninstall Prompt",
            )
        )
        if not typer.confirm("Proceed with uninstall?", default=False):
            _emit_and_exit([
                f"[yellow]Uninstall cancelled; '{kit_name}' remains installed.[/]"
            ], "warning", OperationExitCode.SUCCESS)

    context = detect_repository(root)
    repository = context.repository if context else None

    removed = False
    if repository is not None:
        try:
            removed = repository.uninstall(kit_name, kit_dir)
        except Exception as e:  # pragma: no cover
            _emit_and_exit(
                [f"[red]Failed to remove kit directory {kit_dir}: {e}[/]"],
                variant="error",
                exit_code=OperationExitCode.IO_OR_STATE_ERROR,
            )

    if not removed and kit_dir.exists():
        try:
            shutil.rmtree(kit_dir)
            removed = True
        except Exception as e:
            _emit_and_exit(
                [f"[red]Failed to remove kit directory {kit_dir}: {e}[/]"],
                variant="error",
                exit_code=OperationExitCode.IO_OR_STATE_ERROR,
            )

    if removed:
        status_lines.append(
            f"[green]Removed kit directory[/] [bold]{kit_dir}[/]"
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
        bundles = remove_kit_from_custom_index(state_root, kit_name)
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
            f"[green]Removed {len(removed_assets)} customization assets[/]:"
        )
        status_lines.extend([f"\t- [green]{asset}[/]" for asset in removed_assets])

    removed_skill_assets = remove_kit_skill_assets(root, kit_name)
    if removed_skill_assets:
        status_lines.append(
            f"[green]Removed skill assets[/]: {', '.join(removed_skill_assets)}"
        )

    status_lines.append(f"[bold green]Uninstalled {kit_name}[/]")
    _emit_and_exit(status_lines, variant)
