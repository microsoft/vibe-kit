from __future__ import annotations
from pathlib import Path
import json
import os
from typing import Dict, List
import typer
from state import load_installed_kits, resolve_state_root
from repo import resolve_repo_root, is_git_url, list_remote_repo_kits, load_repo_env
from manifests import extract_manifest_metadata, prefer_manifest_file
from commands.common import emit_repo_source


def run_list(installed_mode: bool, json_out: bool):
    root = resolve_state_root(Path.cwd())
    load_repo_env(root)
    # 1) Installed kits stored in local state
    if installed_mode:
        installed = load_installed_kits(root)
        if json_out:
            typer.echo(json.dumps(installed, ensure_ascii=False, indent=2))
            return
        if not installed:
            typer.echo("No kits installed")
            return
        for k in sorted(installed, key=lambda x: x.get("id", "")):
            typer.echo(f"{k.get('id', '')} {k.get('version', '')}")
        return

    # 2) Repository specified by VIBEKIT_BASE_PATH (remote GitHub or local directory)
    configured_repo = (os.getenv("VIBEKIT_BASE_PATH") or "").strip()
    if configured_repo:
        if is_git_url(configured_repo):
            try:
                entries = list_remote_repo_kits(configured_repo)
            except (ValueError, NotImplementedError, RuntimeError) as exc:
                typer.echo("[]" if json_out else str(exc))
                return
            typer.echo(f"Repository source: env-remote -> {configured_repo}")
            _emit_entries(entries, json_out)
            return
        # Resolve explicit local path (relative or absolute) and list kits if it exists
        explicit_root = _resolve_explicit_repo_path(root, configured_repo)
        if explicit_root:
            emit_repo_source(explicit_root, "env")
            entries = _collect_repo_entries(explicit_root)
            _emit_entries(entries, json_out)
            return

    # 3) Auto-discovered innovation-kit-repository in ancestor directories
    repo_root, source_kind = resolve_repo_root(root)
    if repo_root is None:
        if json_out:
            typer.echo("[]")
        else:
            typer.echo("No local innovation-kit-repository found")
        return
    emit_repo_source(repo_root, source_kind)
    entries = _collect_repo_entries(repo_root)
    _emit_entries(entries, json_out)


def _collect_repo_entries(repo_roots: List[Path]) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for repo_root in repo_roots:
        for child in sorted(repo_root.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            manifest = extract_manifest_metadata(prefer_manifest_file(child)) or {}
            kit_name = manifest.get("id") or child.name
            version = manifest.get("version") or "0.0.0"
            entries.append({"id": kit_name, "version": version, "path": str(child)})
    return entries


def _emit_entries(entries: List[Dict[str, str]], json_out: bool) -> None:
    if json_out:
        typer.echo(json.dumps(entries, ensure_ascii=False, indent=2))
        return
    if not entries:
        typer.echo("No available kits found")
        return
    for entry in entries:
        typer.echo(f"{entry['id']} {entry['version']}")


def _resolve_explicit_repo_path(root: Path, repo_location: str) -> Path | None:
    path = Path(repo_location)
    if not path.is_absolute():
        path = (root / repo_location).resolve()
    if path.is_dir():
        return path
    return None
