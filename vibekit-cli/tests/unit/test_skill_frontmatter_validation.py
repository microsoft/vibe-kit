from pathlib import Path

from manifests import extract_skill_file_metadata, validate_skill_frontmatter


def _write_skill_file(kit_dir: Path, content: str) -> None:
    (kit_dir / "SKILL.md").write_text(content, encoding="utf-8")


def test_validate_skill_frontmatter_accepts_valid_payload(tmp_path: Path) -> None:
    kit_dir = tmp_path / "valid-kit"
    kit_dir.mkdir(parents=True)

    payload = {
        "name": "valid-kit",
        "description": "Valid descriptor",
    }

    assert validate_skill_frontmatter(kit_dir, payload) == []


def test_validate_skill_frontmatter_reports_missing_description(tmp_path: Path) -> None:
    kit_dir = tmp_path / "missing-description"
    kit_dir.mkdir(parents=True)

    payload = {
        "name": "missing-description",
    }

    errors = validate_skill_frontmatter(kit_dir, payload)
    assert "Missing required frontmatter key: description" in errors


def test_extract_skill_file_metadata_flags_invalid_name_format(tmp_path: Path) -> None:
    kit_dir = tmp_path / "valid-slug"
    kit_dir.mkdir(parents=True)
    _write_skill_file(
        kit_dir,
        "---\n"
        "name: Invalid Name\n"
        "description: Example\n"
        "---\n"
        "# Skill\n",
    )

    metadata = extract_skill_file_metadata(kit_dir)
    assert metadata is not None
    validation_errors = metadata.get("validation_errors") or []
    assert "Frontmatter name must be lowercase, hyphenated, and alphanumeric" in validation_errors


def test_extract_skill_file_metadata_flags_directory_name_mismatch(tmp_path: Path) -> None:
    kit_dir = tmp_path / "expected-slug"
    kit_dir.mkdir(parents=True)
    _write_skill_file(
        kit_dir,
        "---\n"
        "name: wrong-slug\n"
        "description: Example\n"
        "---\n"
        "# Skill\n",
    )

    metadata = extract_skill_file_metadata(kit_dir)
    assert metadata is not None
    validation_errors = metadata.get("validation_errors") or []
    assert (
        "Frontmatter name 'wrong-slug' must match directory name 'expected-slug'"
        in validation_errors
    )
