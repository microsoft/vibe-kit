from pathlib import Path

def test_install_autodiscover_without_env(run_cli, tmp_path: Path):
    # Create repository at root (auto-discovery should find it)
    repo = tmp_path / "innovation-kit-repository" / "auto-kit"
    repo.mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: auto-kit\n  version: 1.2.3\n  description: auto kit\n")

    # No .env created intentionally
    run_cli(tmp_path, "init", check=True)  # init should not require repo
    result = run_cli(tmp_path, "install", "auto-kit")
    assert result.returncode == 0, result.stderr
    kit_dir = tmp_path / ".vibe-kit" / "innovation-kits" / "auto-kit"
    assert kit_dir.is_dir()
    assert (kit_dir / "kit.yaml").exists()
