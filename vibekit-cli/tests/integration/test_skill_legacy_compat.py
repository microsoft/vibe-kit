from pathlib import Path


def _write_repo_env(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(
        "VIBEKIT_BASE_PATH=./innovation-kit-repository\n",
        encoding="utf-8",
    )


def test_list_prefers_skill_descriptor_without_manifest(run_cli, tmp_path: Path):
    _write_repo_env(tmp_path)
    run_cli(tmp_path, "init", check=True)

    skill_kit = tmp_path / "innovation-kit-repository" / "skill-only-kit"
    skill_kit.mkdir(parents=True)
    (skill_kit / "SKILL.md").write_text(
        "---\n"
        "name: skill-only-kit\n"
        "description: Skill-first metadata only\n"
        "license: MIT\n"
        "---\n"
        "# Skill\n",
        encoding="utf-8",
    )

    result = run_cli(tmp_path, "list")
    assert result.returncode == 0
    assert "skill-only-kit" in result.stdout
    assert "0.0.0" in result.stdout
    assert "Deprecation:" not in result.stdout


def test_list_warns_for_legacy_innovation_kit_descriptor(run_cli, tmp_path: Path):
    _write_repo_env(tmp_path)
    run_cli(tmp_path, "init", check=True)

    legacy_kit = tmp_path / "innovation-kit-repository" / "legacy-only-kit"
    legacy_kit.mkdir(parents=True)
    (legacy_kit / "INNOVATION_KIT.md").write_text(
        "---\n"
        "Name: legacy-only-kit\n"
        "Description: Legacy descriptor only\n"
        "---\n"
        "# Legacy\n",
        encoding="utf-8",
    )

    result = run_cli(tmp_path, "list")
    assert result.returncode == 0
    assert "legacy-only-kit" in result.stdout
    assert "Deprecation:" in result.stdout
    assert "INNOVATION_KIT.md" in result.stdout


def test_install_warns_but_succeeds_for_legacy_descriptor(run_cli, tmp_path: Path):
    _write_repo_env(tmp_path)
    run_cli(tmp_path, "init", check=True)

    legacy_kit = tmp_path / "innovation-kit-repository" / "legacy-install-kit"
    legacy_kit.mkdir(parents=True)
    (legacy_kit / "INNOVATION_KIT.md").write_text(
        "---\n"
        "Name: legacy-install-kit\n"
        "Description: Legacy install compatibility\n"
        "---\n"
        "# Legacy\n",
        encoding="utf-8",
    )

    result = run_cli(tmp_path, "install", "legacy-install-kit")
    assert result.returncode == 0
    assert "Installed kit legacy-install-kit" in result.stdout
    assert "Deprecation:" in result.stdout
    assert "INNOVATION_KIT.md" in result.stdout
