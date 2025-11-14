from pathlib import Path

def test_update_dry_run_available(run_cli, tmp_path: Path):
    repo = tmp_path / "innovation-kit-repository" / "d-kit"; repo.mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: d-kit\n  version: 1.0.0\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "d-kit")
    # bump version
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: d-kit\n  version: 1.1.0\n")
    result = run_cli(tmp_path, "update", "d-kit", "--dry-run")
    assert result.returncode == 0
    assert "dry-run: update available" in result.stdout.lower()
    # ensure installation not changed yet
    state_manifest = tmp_path/".vibe-kit"/"innovation-kits"/"d-kit"/"MANIFEST.yml"
    installed_content = state_manifest.read_text(encoding="utf-8")
    assert "1.0.0" in installed_content


def test_update_dry_run_no_update(run_cli, tmp_path: Path):
    repo = tmp_path / "innovation-kit-repository" / "d-kit"; repo.mkdir(parents=True)
    (repo / "MANIFEST.yml").write_text("kit_info:\n  name: d-kit\n  version: 2.0.0\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "d-kit")
    result = run_cli(tmp_path, "update", "d-kit", "--dry-run")

    print(result.stdout)
    assert result.returncode == 0
    assert "dry-run: up to date" in result.stdout.lower()
    assert "no update needed for d-kit" in result.stdout.lower()
