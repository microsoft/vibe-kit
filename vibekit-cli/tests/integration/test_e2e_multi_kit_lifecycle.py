import json
from pathlib import Path


def _write_kit(repo_root: Path, kit_name: str, version: str) -> None:
    kit_root = repo_root / kit_name
    (kit_root / "docs").mkdir(parents=True)
    (kit_root / "customizations").mkdir(parents=True)

    (kit_root / "MANIFEST.yml").write_text(
        (
            "kit_info:\n"
            f"  name: {kit_name}\n"
            f"  version: {version}\n"
            f"  description: {kit_name} test kit\n"
        ),
        encoding="utf-8",
    )

    (kit_root / "docs" / "quick-start.md").write_text(
        f"# {kit_name} Quick Start\n",
        encoding="utf-8",
    )
    (kit_root / "docs" / "usage.md").write_text(
        f"# {kit_name} Usage\n",
        encoding="utf-8",
    )

    (kit_root / "customizations" / f"{kit_name}.agent.md").write_text(
        f"---\nname: {kit_name}\ndescription: {kit_name} agent\n---\n",
        encoding="utf-8",
    )
    (kit_root / "customizations" / f"{kit_name}.prompt.md").write_text(
        f"/{kit_name}\n",
        encoding="utf-8",
    )
    (kit_root / "customizations" / f"{kit_name}.instructions.md").write_text(
        f"{kit_name} instructions\n",
        encoding="utf-8",
    )


def _installed_ids(run_cli, cwd: Path) -> list[str]:
    result = run_cli(cwd, "list", "-i", "--json")
    assert result.returncode == 0, result.stdout + result.stderr
    payload = json.loads(result.stdout)
    return sorted(entry["id"] for entry in payload)


def test_e2e_multi_kit_install_uninstall_lifecycle(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    _write_kit(repo_root, "kit-alpha", "1.0.0")
    _write_kit(repo_root, "kit-beta", "1.1.0")
    _write_kit(repo_root, "kit-gamma", "1.2.0")
    (tmp_path / ".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n", encoding="utf-8")

    run_cli(tmp_path, "init", check=True)

    assert _installed_ids(run_cli, tmp_path) == []

    install_alpha = run_cli(tmp_path, "install", "kit-alpha")
    assert install_alpha.returncode == 0, install_alpha.stdout + install_alpha.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-alpha"]

    install_beta = run_cli(tmp_path, "install", "kit-beta")
    assert install_beta.returncode == 0, install_beta.stdout + install_beta.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-alpha", "kit-beta"]

    install_gamma = run_cli(tmp_path, "install", "kit-gamma")
    assert install_gamma.returncode == 0, install_gamma.stdout + install_gamma.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-alpha", "kit-beta", "kit-gamma"]

    state_dir = tmp_path / ".vibe-kit"
    for kit_name in ("kit-alpha", "kit-beta", "kit-gamma"):
        assert (state_dir / "innovation-kits" / kit_name / "docs" / "quick-start.md").exists()
        assert (state_dir / "innovation-kits" / kit_name / "docs" / "usage.md").exists()
        assert (state_dir / "agents" / f"{kit_name}.agent.md").exists()
        assert (state_dir / "prompts" / f"{kit_name}.prompt.md").exists()
        assert (state_dir / "instructions" / f"{kit_name}.instructions.md").exists()

    reinstall_beta = run_cli(tmp_path, "install", "kit-beta")
    assert reinstall_beta.returncode == 0, reinstall_beta.stdout + reinstall_beta.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-alpha", "kit-beta", "kit-gamma"]
    assert len(list((state_dir / "agents").glob("kit-beta.agent.md"))) == 1

    uninstall_beta = run_cli(tmp_path, "uninstall", "--yes", "kit-beta")
    assert uninstall_beta.returncode == 0, uninstall_beta.stdout + uninstall_beta.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-alpha", "kit-gamma"]

    assert not (state_dir / "innovation-kits" / "kit-beta").exists()
    assert not (state_dir / "agents" / "kit-beta.agent.md").exists()
    assert not (state_dir / "prompts" / "kit-beta.prompt.md").exists()
    assert not (state_dir / "instructions" / "kit-beta.instructions.md").exists()

    assert (state_dir / "innovation-kits" / "kit-alpha" / "docs" / "quick-start.md").exists()
    assert (state_dir / "innovation-kits" / "kit-gamma" / "docs" / "quick-start.md").exists()
    assert (state_dir / "agents" / "kit-alpha.agent.md").exists()
    assert (state_dir / "agents" / "kit-gamma.agent.md").exists()

    uninstall_alpha = run_cli(tmp_path, "uninstall", "--yes", "kit-alpha")
    assert uninstall_alpha.returncode == 0, uninstall_alpha.stdout + uninstall_alpha.stderr
    assert _installed_ids(run_cli, tmp_path) == ["kit-gamma"]

    uninstall_gamma = run_cli(tmp_path, "uninstall", "--yes", "kit-gamma")
    assert uninstall_gamma.returncode == 0, uninstall_gamma.stdout + uninstall_gamma.stderr
    assert _installed_ids(run_cli, tmp_path) == []

    assert not (state_dir / "innovation-kits" / "kit-alpha").exists()
    assert not (state_dir / "innovation-kits" / "kit-gamma").exists()
    assert not (state_dir / "agents" / "kit-alpha.agent.md").exists()
    assert not (state_dir / "agents" / "kit-gamma.agent.md").exists()
    assert not (state_dir / "prompts" / "kit-alpha.prompt.md").exists()
    assert not (state_dir / "prompts" / "kit-gamma.prompt.md").exists()
    assert not (state_dir / "instructions" / "kit-alpha.instructions.md").exists()
    assert not (state_dir / "instructions" / "kit-gamma.instructions.md").exists()

    custom_index = json.loads((state_dir / "customizations-index.json").read_text(encoding="utf-8"))
    assert custom_index["kits"] == {}
