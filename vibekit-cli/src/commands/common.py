"""Shared helpers for vibekit CLI commands (extracted from cli.py)."""

from __future__ import annotations
from pathlib import Path
from typing import List, Optional
import os
import typer


def emit_repo_source(repo_root: Optional[List[Path]], source_kind: str):
    if source_kind == "none":
        return
    typer.echo(f"Repository source: {source_kind} -> {repo_root}")


def baseline_source(override: Optional[str]) -> str:
    """Return the baseline source string.

    Priority: explicit override > env var > 'unspecified'.
    (Removed hard-coded DEFAULT_BASELINE_REPO constant for neutrality.)
    """
    if override:
        return override
    env_val = os.getenv("VIBEKIT_BASELINE_SOURCE")
    if env_val:
        return env_val
    return "unspecified"


def ensure_minimal_kit_yaml(target: Path, kit_name: str, meta: dict) -> None:
    kit_yaml = target / "kit.yaml"
    if kit_yaml.exists():
        return
    name = meta.get("name", kit_name)
    version = meta.get("version", "0.0.0")
    kit_yaml.write_text(f"id: {kit_name}\nname: {name}\nversion: {version}\n", encoding="utf-8")
