from __future__ import annotations
from pathlib import Path
from typing import List, Optional
import os
import shutil
import tempfile
import typer
from state import state_dir, load_installed_kits, record_install, resolve_state_root
from repo import resolve_repo_root, is_git_url, download_remote_kit, load_repo_env
from manifests import extract_manifest_metadata, prefer_manifest_file
from assets import copy_kit_content_assets, detect_customization_conflicts
from commands.common import emit_repo_source, ensure_minimal_kit_yaml


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
        typer.echo(f"Warning: Could not fix permissions for {directory}: {e.stderr}", err=True)
    except Exception as e:
        typer.echo(f"Warning: Error fixing directory permissions: {e}", err=True)


def run_install(kit_name: str):
    root = resolve_state_root(Path.cwd())
    load_repo_env(root)
    installed = {k.get("id"): k for k in load_installed_kits(root)}
    if kit_name in installed:
        typer.echo(f"{kit_name} already installed (recorded in innovation-kits.json)")
        raise typer.Exit(code=0)

    kits_dir = state_dir(root) / "innovation-kits"
    kits_dir.mkdir(parents=True, exist_ok=True)
    target = kits_dir / kit_name
    if target.exists():
        typer.echo(
            f"{kit_name} directory already exists; recording metadata (drift reconciliation)"
        )
        manifest_meta = extract_manifest_metadata(prefer_manifest_file(target)) or {
            "id": kit_name,
            "name": kit_name,
            "version": "0.0.0",
        }
        record_install(root, manifest_meta, target, source_kind="existing-directory")
        raise typer.Exit(code=0)

    configured_repo = (os.getenv("VIBEKIT_BASE_PATH") or "").strip()
    implicit_src: Optional[Path] = None
    source_kind = "env-repository"
    remote_manifest_meta: Optional[dict] = None
    temp_dir_ctx: Optional[tempfile.TemporaryDirectory] = None

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
                typer.echo(f"Repository source: env-remote -> {configured_repo}")
            except (ValueError, NotImplementedError) as exc:
                typer.echo(str(exc))
                raise typer.Exit(code=2)
            except RuntimeError as exc:
                typer.echo(str(exc))
                raise typer.Exit(code=6)
        else:
            repo_roots, resolved_kind = resolve_repo_root(root)
            if repo_roots is not None:
                emit_repo_source(repo_roots, resolved_kind)
                for repo_root in repo_roots:
                    candidate = repo_root / kit_name
                    if candidate.is_dir():
                        implicit_srcs.append(candidate)
            if implicit_srcs == []:
                typer.echo(f"Unknown kit name: {kit_name}")
                raise typer.Exit(code=2)
        for implicit_src in implicit_srcs:
            custom_dir = implicit_src / "customizations"
            if custom_dir.is_dir():
                all_custom_files = [p for p in custom_dir.rglob("*") if p.is_file()]
                conflicts = detect_customization_conflicts(
                    state_dir(root), kit_name, all_custom_files, custom_dir
                )
                if conflicts:
                    for msg in conflicts:
                        typer.echo(msg)
                    typer.echo(
                        "Continuing installation; conflicting customization files will be skipped."
                    )
            try:
                shutil.copytree(implicit_src, target)
                # Fix permissions to ensure copied files are writable (handles root-owned sources)
                fix_directory_permissions(target)
            except Exception as e:
                typer.echo(f"Failed to copy local repository kit from {implicit_src}: {e}")
                raise typer.Exit(code=6)
            manifest_meta = (
                remote_manifest_meta
                or extract_manifest_metadata(prefer_manifest_file(target))
                or {
                    "id": kit_name,
                    "name": kit_name,
                    "version": "0.0.0",
                }
            )
            record_install(root, manifest_meta, target, source_kind=source_kind)
            ensure_minimal_kit_yaml(target, kit_name, manifest_meta)
            assets_copied = copy_kit_content_assets(implicit_src, state_dir(root), kit_name)
            custom_dir_installed = target / "customizations"
            if custom_dir_installed.exists():
                try:
                    shutil.rmtree(custom_dir_installed)
                except Exception as e:  # pragma: no cover
                    typer.echo(
                        f"Warning: failed to remove customizations directory from installed kit: {e}",
                        err=True,
                    )
            if assets_copied:
                typer.echo(f"Copied {len(assets_copied)} customization file(s) for {kit_name}")
            typer.echo(f"Installed kit {kit_name} -> {target}")
    finally:
        if temp_dir_ctx is not None:
            temp_dir_ctx.cleanup()
