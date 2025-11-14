from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List

from rich.console import Console
from rich.table import Table

from manifests import extract_manifest_metadata, prefer_manifest_file
from repo import is_git_url, list_remote_repo_kits, load_repo_env, resolve_repo_root
from state import load_installed_kits, resolve_state_root
from commands.common import emit_repo_source

console = Console()


def run_list(installed_mode: bool, json_out: bool) -> None:
    root = resolve_state_root(Path.cwd())
    load_repo_env(root)

    # 1) Installed kits stored in local state
    if installed_mode:
        _emit_installed_kits(root, json_out)
        return

    # 2) Repository specified by VIBEKIT_BASE_PATH (remote GitHub or local directory)
    configured_repo = (os.getenv("VIBEKIT_BASE_PATH") or "").strip()
    if configured_repo and is_git_url(configured_repo):
        try:
            entries = list_remote_repo_kits(configured_repo)
        except (ValueError, NotImplementedError, RuntimeError) as exc:
            if json_out:
                print("[]")
            else:
                console.print(f"[red]{exc}[/]")
            return
        _emit_entries(entries, json_out, f"Available Innovation Kits: {configured_repo} [ENV]")
        return

    # 3) Auto-discovered innovation-kit-repository in ancestor directories
    repo_root, source_kind = resolve_repo_root(root)
    if repo_root is None:
        if json_out:
            print("[]")
        else:
            console.print("[yellow]No local innovation-kit-repository found[/]")
        return

    if not json_out:
        emit_repo_source(repo_root, source_kind)
    entries = _collect_repo_entries(repo_root)

    roots_str = ", ".join(str(r) for r in repo_root)
    source_str = f"[{source_kind}]" if source_kind else "<unknown>"
    title = f"Available Innovation Kits: {roots_str} {source_str}"
    _emit_entries(entries, json_out, title)


def _emit_installed_kits(root: Path, json_out: bool) -> None:
    installed = load_installed_kits(root)
    if json_out:
        print(json.dumps(installed, ensure_ascii=False, indent=2))
        return
    if not installed:
        console.print(f"[yellow]No kits installed under: {root}[/]")
        return

    table = Table(
        title=f"Installed Innovation Kits under: {root}",
        header_style="bold cyan",
        title_justify="left",
    )
    table.add_column("Kit ID", style="bold", justify="left")
    table.add_column("Version", justify="left")
    table.add_column("Source", overflow="fold", justify="left")
    table.add_column("Path", overflow="fold", justify="left")
    for kit in sorted(installed, key=lambda x: x.get("id", "")):
        table.add_row(
            kit.get("id", ""),
            kit.get("version", ""),
            kit.get("source", ""),
            kit.get("path", ""),
        )
    console.print(table)


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
    entries.sort(key=lambda entry: entry.get("id", ""))
    return entries


def _emit_entries(entries: List[Dict[str, str]], json_out: bool, title: str) -> None:
    if json_out:
        print(json.dumps(entries, ensure_ascii=False, indent=2))
        return
    if not entries:
        console.print("[yellow]No available kits found[/]")
        return

    table = Table(title=title, header_style="bold cyan", title_justify="left")
    table.add_column("Kit ID", style="bold", justify="left")
    table.add_column("Version", justify="left")
    table.add_column("Location", overflow="fold", justify="left")
    for entry in entries:
        table.add_row(
            entry.get("id", ""),
            entry.get("version", ""),
            entry.get("path", ""),
        )
    console.print(table)


def _resolve_explicit_repo_path(root: Path, repo_location: str) -> Path | None:
    path = Path(repo_location)
    if not path.is_absolute():
        path = (root / repo_location).resolve()
    if path.is_dir():
        return path
    return None
