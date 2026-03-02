from __future__ import annotations

from pathlib import Path
import re
from typing import Optional

import typer

SKILL_FILE_NAME = "SKILL.md"
LEGACY_INNOVATION_KIT_FILE_NAME = "INNOVATION_KIT.md"
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

ASSET_SUFFIX_GROUPS = {
    "agents": [".agent.md"],
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


def _extract_frontmatter_yaml(markdown_path: Path) -> Optional[dict]:
    if not markdown_path.exists():
        return None
    text = markdown_path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return None

    closing_index = text.find("\n---", 4)
    if closing_index == -1:
        return None

    frontmatter_content = text[4:closing_index]
    try:
        import yaml  # type: ignore
    except ImportError:  # pragma: no cover
        typer.echo("PyYAML not installed; cannot parse skill frontmatter", err=True)
        return None

    try:
        payload = yaml.safe_load(frontmatter_content) or {}
    except Exception:  # pragma: no cover
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def validate_skill_frontmatter(kit_dir: Path, payload: dict) -> list[str]:
    errors: list[str] = []

    raw_name = payload.get("name")
    if not isinstance(raw_name, str) or not raw_name.strip():
        errors.append("Missing required frontmatter key: name")
    else:
        normalized_name = raw_name.strip()
        if not SKILL_NAME_PATTERN.fullmatch(normalized_name):
            errors.append(
                "Frontmatter name must be lowercase, hyphenated, and alphanumeric"
            )
        expected_name = kit_dir.name
        if normalized_name != expected_name:
            errors.append(
                f"Frontmatter name '{normalized_name}' must match directory name '{expected_name}'"
            )

    raw_description = payload.get("description")
    if not isinstance(raw_description, str) or not raw_description.strip():
        errors.append("Missing required frontmatter key: description")

    return errors


def extract_skill_file_metadata(kit_dir: Path) -> Optional[dict]:
    skill_path = kit_dir / SKILL_FILE_NAME
    legacy_path = kit_dir / LEGACY_INNOVATION_KIT_FILE_NAME

    descriptor_format: Optional[str] = None
    selected_path: Optional[Path] = None
    if skill_path.exists():
        descriptor_format = "skill"
        selected_path = skill_path
    elif legacy_path.exists():
        descriptor_format = "innovation_kit"
        selected_path = legacy_path

    if selected_path is None:
        return None

    payload = _extract_frontmatter_yaml(selected_path) or {}
    normalized_payload = {str(key).strip().lower(): value for key, value in payload.items()}
    validation_errors: list[str] = []
    if descriptor_format == "skill":
        validation_errors = validate_skill_frontmatter(kit_dir, normalized_payload)

    descriptor_name = normalized_payload.get("name")
    descriptor_description = normalized_payload.get("description")

    metadata = {
        "id": descriptor_name,
        "name": descriptor_name,
        "description": descriptor_description,
        "descriptor_format": descriptor_format,
        "legacy_descriptor": descriptor_format == "innovation_kit",
        "validation_errors": validation_errors,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def extract_kit_metadata(kit_dir: Path, fallback_id: str) -> dict:
    manifest_metadata = extract_manifest_metadata(prefer_manifest_file(kit_dir)) or {}
    descriptor_metadata = extract_skill_file_metadata(kit_dir) or {}

    metadata = {
        "id": manifest_metadata.get("id") or descriptor_metadata.get("id") or fallback_id,
        "name": manifest_metadata.get("name") or descriptor_metadata.get("name") or fallback_id,
        "version": manifest_metadata.get("version") or "0.0.0",
        "description": manifest_metadata.get("description") or descriptor_metadata.get("description"),
        "display_name": manifest_metadata.get("display_name"),
        "created_date": manifest_metadata.get("created_date"),
        "last_updated": manifest_metadata.get("last_updated"),
        "post_install_instructions": manifest_metadata.get("post_install_instructions"),
        "descriptor_format": descriptor_metadata.get("descriptor_format") or "none",
        "legacy_descriptor": bool(descriptor_metadata.get("legacy_descriptor", False)),
        "validation_errors": descriptor_metadata.get("validation_errors") or [],
    }
    return metadata


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
