from __future__ import annotations
from pathlib import Path
from typing import List, Optional
import shutil
import typer
from state import state_dir, load_installed_kits, record_install, resolve_state_root
from repo import resolve_repo_root
from manifests import extract_manifest_metadata, prefer_manifest_file
from assets import copy_kit_content_assets
from commands.common import emit_repo_source, ensure_minimal_kit_yaml
import versioning as _versioning


def run_update(kit_name: str, dry_run: bool):
    root = resolve_state_root(Path.cwd())
    kits_dir = state_dir(root) / "innovation-kits"
    installed_meta = {k.get("id"): k for k in load_installed_kits(root)}
    repo_root, source_kind = resolve_repo_root(root)
    source_dirs: List[Path] = []

    if repo_root is not None:
        emit_repo_source(repo_root, source_kind)

    source_dirs: List[Path] = [
        repo / kit_name for repo in repo_root or [] if (repo / kit_name).is_dir()
    ]

    # First verify that all source dirs exist
    for source_dir in source_dirs:
        if source_dir is None:
            typer.echo(f"Package '{kit_name}' not found in local repository")
            raise typer.Exit(code=2)

    if kit_name not in installed_meta:
        typer.echo(f"Package '{kit_name}' is not installed. Run 'vibekit install {kit_name}' first")
        return

    for source_dir in source_dirs:
        installed_version = installed_meta[kit_name].get("version") or "0.0.0"
        manifest_meta = extract_manifest_metadata(prefer_manifest_file(source_dir)) or {}
        source_version = manifest_meta.get("version") or "0.0.0"
        try:
            cmp = _versioning.compare(installed_version, source_version)
        except Exception:  # pragma: no cover
            cmp = 0
        if dry_run:
            if cmp < 0:
                typer.echo(
                    f"DRY-RUN: update available for {kit_name} (installed: {installed_version}, available: {source_version})"
                )
            else:
                typer.echo(
                    f"DRY-RUN: no update needed for {kit_name} (installed: {installed_version}, available: {source_version})"
                )
            return
        if cmp >= 0:
            typer.echo(
                f"No newer version for {kit_name} (installed: {installed_version}, available: {source_version})"
            )
            return
        target_dir = kits_dir / kit_name
        if target_dir.exists():
            try:
                shutil.rmtree(target_dir)
            except Exception as e:
                typer.echo(f"Failed to remove existing installation: {e}")
                raise typer.Exit(code=6)
        try:
            shutil.copytree(source_dir, target_dir)
        except Exception as e:
            typer.echo(f"Failed to copy new version from {source_dir}: {e}")
            raise typer.Exit(code=6)
        new_meta = extract_manifest_metadata(prefer_manifest_file(target_dir)) or {
            "id": kit_name,
            "name": kit_name,
            "version": source_version,
        }
        if "version" not in new_meta:
            new_meta["version"] = source_version
        record_install(root, new_meta, target_dir, source_kind="env-repository-update")
        ensure_minimal_kit_yaml(target_dir, kit_name, new_meta)
        assets_copied = copy_kit_content_assets(source_dir, state_dir(root), kit_name)
        custom_dir_installed = target_dir / "customizations"
        if custom_dir_installed.exists():
            try:
                shutil.rmtree(custom_dir_installed)
            except Exception as e:  # pragma: no cover
                typer.echo(
                    f"Warning: failed to remove customizations directory after update: {e}",
                    err=True,
                )
        if assets_copied:
            typer.echo(f"Refreshed {len(assets_copied)} customization file(s) for {kit_name}")
        typer.echo(
            f"Updated {kit_name} from {installed_version} to {new_meta.get('version', source_version)}"
        )
