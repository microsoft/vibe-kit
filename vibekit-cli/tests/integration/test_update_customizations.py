from pathlib import Path


def test_update_refreshes_customizations(run_cli, tmp_path: Path):
    # Initial source kit
    repo = tmp_path / "innovation-kit-repository" / "c-kit"
    (repo / "customizations").mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: c-kit\n  version: 1.0.0\n")
    (repo / "customizations" / "alpha.prompt.md").write_text("Alpha V1")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "c-kit")

    state_dir = tmp_path / ".vibe-kit"
    alpha_file = state_dir / "prompts" / "alpha.prompt.md"
    assert alpha_file.exists()
    assert alpha_file.read_text(encoding="utf-8") == "Alpha V1"

    # Modify source customizations and bump version
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: c-kit\n  version: 1.1.0\n")
    (repo / "customizations" / "alpha.prompt.md").write_text("Alpha V2")
    (repo / "customizations" / "beta.prompt.md").write_text("Beta V2")

    result = run_cli(tmp_path, "update", "c-kit")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "updated c-kit from 1.0.0 to 1.1.0" in result.stdout.lower()
    assert "refreshed" in result.stdout.lower()

    assert alpha_file.read_text(encoding="utf-8") == "Alpha V2"
    beta_file = state_dir / "prompts" / "beta.prompt.md"
    assert beta_file.exists()
    assert beta_file.read_text(encoding="utf-8") == "Beta V2"
