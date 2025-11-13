from __future__ import annotations
from pathlib import Path
from typing import List
import shutil
import typer
from state import state_dir, load_installed_kits, write_installed_kits, resolve_state_root
from assets import remove_kit_from_custom_index


def run_uninstall(kit_name: str):
    root = resolve_state_root(Path.cwd())
    installed = load_installed_kits(root)
    before_len = len(installed)
    remaining = [k for k in installed if k.get("id") != kit_name]
    was_installed = len(remaining) != before_len
    kit_dir = state_dir(root) / "innovation-kits" / kit_name
    if not was_installed:
        typer.echo(f"Kit '{kit_name}' is not installed")
        return
    if kit_dir.exists():
        try:
            shutil.rmtree(kit_dir)
        except Exception as e:
            typer.echo(f"Failed to remove kit directory {kit_dir}: {e}")
            raise typer.Exit(code=6)
    else:
        typer.echo(f"Warning: kit directory {kit_dir} missing; cleaning metadata only")
    removed_assets: List[str] = []
    write_installed_kits(root, remaining)
    try:
        bundles = remove_kit_from_custom_index(state_dir(root), kit_name)
    except Exception:  # pragma: no cover
        bundles = []
    for rel in bundles:
        dest = state_dir(root) / rel
        if dest.exists():
            try:
                dest.unlink()
                removed_assets.append(rel.replace("\\", "/"))
            except Exception as e:  # pragma: no cover
                typer.echo(f"Warning: failed to remove {dest}: {e}", err=True)
    if removed_assets:
        typer.echo(f"Removed customization assets: {', '.join(removed_assets)}")
    typer.echo(f"Uninstalled {kit_name}")
