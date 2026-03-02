import json
from pathlib import Path

from constants import OperationExitCode


def _write_skill_kit(repo_root: Path, kit_name: str, version: str) -> None:
    kit_root = repo_root / kit_name
    kit_root.mkdir(parents=True)
    (kit_root / "MANIFEST.yml").write_text(
        (
            "kit_info:\n"
            f"  name: {kit_name}\n"
            f"  version: {version}\n"
            f"  description: {kit_name} skill kit\n"
        ),
        encoding="utf-8",
    )
    (kit_root / "SKILL.md").write_text(
        (
            "---\n"
            f"name: {kit_name}\n"
            f"description: {kit_name} skill\n"
            "license: MIT\n"
            "---\n"
            "# Skill\n"
        ),
        encoding="utf-8",
    )
    (kit_root / "docs").mkdir(parents=True, exist_ok=True)
    (kit_root / "docs" / "quick-start.md").write_text(
        "# Quick Start\n",
        encoding="utf-8",
    )
    (kit_root / "assets").mkdir(parents=True, exist_ok=True)
    (kit_root / "assets" / "sample.txt").write_text(
        "sample\n",
        encoding="utf-8",
    )
    (kit_root / "examples").mkdir(parents=True, exist_ok=True)
    (kit_root / "examples" / "example.md").write_text(
        "# Example\n",
        encoding="utf-8",
    )
    (kit_root / "templates").mkdir(parents=True, exist_ok=True)
    (kit_root / "templates" / "template.md").write_text(
        "# Template\n",
        encoding="utf-8",
    )


def _installed_ids(tmp_path: Path) -> list[str]:
    metadata_path = tmp_path / ".vibe-kit" / "innovation-kits.json"
    payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    return [entry["id"] for entry in payload]


def test_single_kit_install_installs_base_skill_first_and_is_idempotent(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    _write_skill_kit(repo_root, "vibe-kit-core", "1.0.0")
    _write_skill_kit(repo_root, "domain-skill-kit", "2.0.0")
    (tmp_path / ".env").write_text(
        "VIBEKIT_BASE_PATH=./innovation-kit-repository\n",
        encoding="utf-8",
    )

    run_cli(tmp_path, "init", check=True)

    install_result = run_cli(tmp_path, "install", "domain-skill-kit")
    assert install_result.returncode == OperationExitCode.SUCCESS

    state_root = tmp_path / ".vibe-kit"
    skills_root = tmp_path / ".agents" / "skills"
    assert (state_root / "innovation-kits" / "vibe-kit-core").exists()
    assert (state_root / "innovation-kits" / "domain-skill-kit").exists()
    assert (skills_root / "vibe-kit-core" / "SKILL.md").exists()
    assert (skills_root / "domain-skill-kit" / "SKILL.md").exists()
    assert (skills_root / "domain-skill-kit" / "docs" / "quick-start.md").exists()
    assert (skills_root / "domain-skill-kit" / "assets" / "sample.txt").exists()
    assert (skills_root / "domain-skill-kit" / "examples" / "example.md").exists()
    assert (skills_root / "domain-skill-kit" / "templates" / "template.md").exists()
    assert _installed_ids(tmp_path) == ["vibe-kit-core", "domain-skill-kit"]

    reinstall_result = run_cli(tmp_path, "install", "domain-skill-kit")
    assert reinstall_result.returncode == OperationExitCode.SUCCESS
    installed_ids = _installed_ids(tmp_path)
    assert installed_ids.count("vibe-kit-core") == 1
    assert installed_ids.count("domain-skill-kit") == 1


def test_install_can_skip_base_skills_with_override_flag(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    _write_skill_kit(repo_root, "vibe-kit-core", "1.0.0")
    _write_skill_kit(repo_root, "domain-skill-kit", "2.0.0")
    (tmp_path / ".env").write_text(
        "VIBEKIT_BASE_PATH=./innovation-kit-repository\n",
        encoding="utf-8",
    )

    run_cli(tmp_path, "init", check=True)

    install_result = run_cli(tmp_path, "install", "--skip-base-skills", "domain-skill-kit")
    assert install_result.returncode == OperationExitCode.SUCCESS

    state_root = tmp_path / ".vibe-kit"
    skills_root = tmp_path / ".agents" / "skills"
    assert not (state_root / "innovation-kits" / "vibe-kit-core").exists()
    assert (state_root / "innovation-kits" / "domain-skill-kit").exists()
    assert not (skills_root / "vibe-kit-core").exists()
    assert (skills_root / "domain-skill-kit" / "SKILL.md").exists()
    assert _installed_ids(tmp_path) == ["domain-skill-kit"]


def test_uninstall_keeps_shared_base_skill_until_dependents_removed(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    _write_skill_kit(repo_root, "vibe-kit-core", "1.0.0")
    _write_skill_kit(repo_root, "domain-skill-kit", "2.0.0")
    (tmp_path / ".env").write_text(
        "VIBEKIT_BASE_PATH=./innovation-kit-repository\n",
        encoding="utf-8",
    )

    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "domain-skill-kit", check=True)

    blocked_uninstall = run_cli(tmp_path, "uninstall", "--yes", "vibe-kit-core")
    assert blocked_uninstall.returncode == OperationExitCode.INVALID_INPUT
    assert "Cannot uninstall shared base skill" in blocked_uninstall.stdout

    uninstall_domain = run_cli(tmp_path, "uninstall", "--yes", "domain-skill-kit")
    assert uninstall_domain.returncode == OperationExitCode.SUCCESS

    second_uninstall_domain = run_cli(tmp_path, "uninstall", "--yes", "domain-skill-kit")
    assert second_uninstall_domain.returncode == OperationExitCode.NOT_INSTALLED

    state_root = tmp_path / ".vibe-kit"
    skills_root = tmp_path / ".agents" / "skills"
    assert (state_root / "innovation-kits" / "vibe-kit-core").exists()
    assert (skills_root / "vibe-kit-core" / "SKILL.md").exists()
    assert not (skills_root / "domain-skill-kit").exists()

    uninstall_base = run_cli(tmp_path, "uninstall", "--yes", "vibe-kit-core")
    assert uninstall_base.returncode == OperationExitCode.SUCCESS
    assert not (state_root / "innovation-kits" / "vibe-kit-core").exists()
    assert not (skills_root / "vibe-kit-core").exists()
