from __future__ import annotations
from pathlib import Path
from typing import Optional

import typer

ASSET_SUFFIX_GROUPS = {
    "chatmodes": [".chatmode.md"],
    "prompts": [".prompt.md"],
    "instructions": [".instructions.md"],
}


def extract_manifest_metadata(manifest_path: Path) -> Optional[dict]:
    if not manifest_path.exists():
        return None
    try:
        import yaml  # type: ignore
    except ImportError:  # pragma: no cover
        typer.echo("PyYAML not installed; cannot parse MANIFEST.yml", err=True)
        return None
    try:
        data = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    except Exception as e:  # pragma: no cover
        typer.echo(f"Failed to parse manifest {manifest_path}: {e}", err=True)
        return None
    kit_info = data.get("kit_info", {}) or {}
    post_install = data.get("post_install", {}) or {}
    meta = {
        "id": kit_info.get("name"),
        "name": kit_info.get("name"),
        "display_name": kit_info.get("display_name"),
        "version": kit_info.get("version"),
        "description": kit_info.get("description"),
        "created_date": kit_info.get("created_date"),
        "last_updated": kit_info.get("last_updated"),
        "post_install_instructions": post_install.get("instructions_markdown"),
    }
    return {k: v for k, v in meta.items() if v is not None}


def prefer_manifest_file(target: Path) -> Path:
    candidates = [
        target / "MANIFEST.yml",
        target / "manifest.yml",
        target / "manifest.yaml",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]
