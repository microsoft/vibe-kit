from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any
import json
from datetime import datetime, timezone
from manifests import ASSET_SUFFIX_GROUPS
import typer

CUSTOM_INDEX_FILENAME = "customizations-index.json"


def _index_path(state_dir: Path) -> Path:
    return state_dir / CUSTOM_INDEX_FILENAME


def _load_index(state_dir: Path) -> Dict[str, Any]:
    p = _index_path(state_dir)
    if not p.exists():
        return {
            "schema_version": 1,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "kits": {},
        }
    try:
        raw = p.read_text(encoding="utf-8")
        data = json.loads(raw) if raw.strip() else {}
    except Exception:  # pragma: no cover
        # Corrupt index: start fresh (preserves original behavior of not blocking core commands)
        return {
            "schema_version": 1,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "kits": {},
        }
    # Ensure minimal shape
    if "kits" not in data or not isinstance(data.get("kits"), dict):  # pragma: no cover
        data["kits"] = {}
    if "schema_version" not in data:
        data["schema_version"] = 1
    return data


def _write_index(state_dir: Path, data: Dict[str, Any]) -> None:
    data["generated_at"] = datetime.now(timezone.utc).isoformat()
    p = _index_path(state_dir)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(p)


def remove_kit_from_custom_index(state_dir: Path, kit_name: str) -> None:
    """Remove a kit's entry from the global customizations index (if present).
    Returns list of bundle paths removed."""
    data = _load_index(state_dir)
    kits = data.get("kits", {})
    removed = []
    entry = kits.pop(kit_name, None)
    if entry:
        for cat, payload in (entry or {}).items():
            for fname, info in payload.items():
                bundle = info.get("bundle")
                if bundle:
                    removed.append(bundle)
        _write_index(state_dir, data)
    return removed


def detect_customization_conflicts(
    state_dir: Path, kit_name: str, source_files: List[Path], custom_dir: Path
) -> List[str]:
    """Return list of human-readable conflict messages if any customization file basenames
    are already claimed by another kit.

    Conflict rule (simple): a basename (e.g., 'aurora.prompt.md') may appear in only one kit across all
    recorded sources for that category. Paths are ignored; we only look at the filename.
    This keeps logic minimal and matches requested behavior.
    """
    if not source_files:
        return []
    index = _load_index(state_dir)
    existing = {}
    for existing_kit, cats in index.get("kits", {}).items():
        if existing_kit == kit_name:
            continue
        for cat_payload in cats.values():
            if not isinstance(cat_payload, dict):
                continue
            for info in cat_payload.values():
                if not isinstance(info, dict):
                    continue
                for rel in info.get("sources", []):
                    base = Path(rel).name
                    existing.setdefault(base, set()).add(existing_kit)
                bundle = info.get("bundle")
                if isinstance(bundle, str):
                    existing.setdefault(Path(bundle).name, set()).add(existing_kit)
    conflicts: List[str] = []
    seen = set()
    for p in source_files:
        base = p.name
        if base in seen:
            continue
        seen.add(base)
        owners = existing.get(base)
        if owners:
            conflicts.append(
                f"Customization file name conflict: '{base}' already provided by kit(s): {', '.join(sorted(owners))}"
            )
    return conflicts


def copy_kit_content_assets(src_dir: Path, state_dir: Path, kit_name: str) -> List[str]:
    """Copy customization files preserving filenames; skip conflicting names."""
    custom_dir = src_dir / "customizations"
    if not custom_dir.is_dir():
        return []

    data = _load_index(state_dir)
    kits = data.setdefault("kits", {})

    # Remove any previously recorded assets for this kit
    previous_entry = kits.pop(kit_name, None)
    if isinstance(previous_entry, dict):
        for cat_payload in previous_entry.values():
            if isinstance(cat_payload, dict):
                for info in cat_payload.values():
                    bundle = info.get("bundle") if isinstance(info, dict) else None
                    if bundle:
                        bundle_path = state_dir / bundle
                        if bundle_path.exists():
                            try:
                                bundle_path.unlink()
                            except Exception:  # pragma: no cover
                                pass

    new_entry: Dict[str, Dict[str, Any]] = {}
    written: List[str] = []

    for path in sorted(custom_dir.rglob("*"), key=lambda p: p.relative_to(custom_dir).as_posix()):
        if not path.is_file():
            continue
        name = path.name
        category = next(
            (
                c
                for c, sufs in ASSET_SUFFIX_GROUPS.items()
                if any(name.endswith(suf) for suf in sufs)
            ),
            None,
        )
        if not category:
            continue

        dest_root = state_dir / category
        dest_root.mkdir(parents=True, exist_ok=True)
        dest_file = dest_root / name
        rel_path = dest_file.relative_to(state_dir).as_posix()

        # Check for conflicts with other kits
        conflict_owner = None
        for existing_kit, cats in kits.items():
            if existing_kit == kit_name:
                continue
            cat_entry = cats.get(category)
            if isinstance(cat_entry, dict) and name in cat_entry:
                conflict_owner = existing_kit
                break

        if conflict_owner:
            typer.echo(
                f"Skipping customization '{name}' in '{category}'; already provided by kit '{conflict_owner}'."
            )
            continue

        if dest_file.exists():
            typer.echo(
                f"Skipping customization '{name}' in '{category}'; file already exists in state directory."
            )
            continue

        try:
            dest_file.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        except Exception as e:  # pragma: no cover
            typer.echo(f"Warning: failed to copy customization '{name}': {e}", err=True)
            continue

        new_entry.setdefault(category, {})[name] = {
            "bundle": rel_path,
            "sources": [f"customizations/{path.relative_to(custom_dir).as_posix()}"],
        }
        written.append(rel_path)

    if new_entry:
        kits[kit_name] = new_entry
    _write_index(state_dir, data)
    return written
