from __future__ import annotations
from pathlib import Path
import json
import os
from typing import Optional, List, Dict, Any
import typer

BASELINE_README = "README.md"
STATE_DIR_NAME = ".vibe-kit"


def state_dir(root: Path) -> Path:
    return root / STATE_DIR_NAME


def resolve_state_root(start: Path) -> Path:
    """Return the project root whose .vibe-kit directory should be used.

    Strategy:
    1. Walk upward from `start` looking for an existing .vibe-kit directory.
       The first directory encountered that already contains .vibe-kit wins.
    2. If none found, fall back to the original `start` directory.

    This ensures commands executed from nested subdirectories still operate
    on the canonical root state if it already exists higher in the tree.
    """
    current = start.resolve()
    for ancestor in [current, *current.parents]:
        candidate = ancestor / STATE_DIR_NAME
        if candidate.is_dir():
            return ancestor
    return start


def ensure_state_dir(root: Path) -> Path:
    d = state_dir(root)
    d.mkdir(parents=True, exist_ok=True)
    return d


def installed_kits_file(root: Path) -> Path:
    return state_dir(root) / "innovation-kits.json"


def load_installed_kits(root: Path) -> List[Dict[str, Any]]:
    f = installed_kits_file(root)
    if not f.exists():
        return []
    try:
        raw = f.read_text(encoding="utf-8").strip()
        if not raw:
            return []
        return json.loads(raw)
    except Exception:  # pragma: no cover
        typer.echo("Warning: failed to parse innovation-kits.json; starting fresh", err=True)
        return []


def write_installed_kits(root: Path, data: list) -> None:
    installed_kits_file(root).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def record_install(root: Path, metadata: dict, target: Path, source_kind: str) -> None:
    if not metadata.get("id"):
        return
    installed = load_installed_kits(root)
    installed = [x for x in installed if x.get("id") != metadata["id"]]
    from datetime import datetime, timezone
    entry = {**metadata, "installed_at": datetime.now(timezone.utc).isoformat(), "path": str(target.relative_to(root)), "source": source_kind}
    installed.append(entry)
    write_installed_kits(root, installed)


def ensure_state_readme(state_dir_path: Path, source_url: str) -> bool:
    readme_path = state_dir_path / BASELINE_README
    if readme_path.exists():
        return False
    readme_path.write_text(
        (
            "Innovation Kit State (source: {src})\n\n"
            "This directory stores installed kits (innovation-kits/) and metadata (innovation-kits.json).\n"
        ).format(src=source_url),
        encoding="utf-8",
    )
    return True
