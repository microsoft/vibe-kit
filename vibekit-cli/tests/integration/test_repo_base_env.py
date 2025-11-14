from pathlib import Path


def test_list_uses_env_path_direct(run_cli, tmp_path: Path):
    # env now points directly to innovation-kit-repository
    repo_root = tmp_path / "innovation-kit-repository"
    repo = repo_root / "rk"
    repo.mkdir(parents=True)
    (repo/"MANIFEST.yml").write_text("kit_info:\n  name: rk\n  version: 0.2.0\n")
    (tmp_path/".env").write_text(f"VIBEKIT_BASE_PATH={repo_root}\n")
    run_cli(tmp_path, "init", check=True)
    res = run_cli(tmp_path, "list")

    # strip newlines for easier matching
    output = res.stdout.replace("\n", "")
    assert res.returncode == 0
    print(output)
    assert "Repository source: env" in output
    assert "Available Innovation Kits:" in output
    assert "│ rk     │ 0.2.0   │ " in output


def test_install_uses_env_repo_only(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    repo = repo_root / "ik"
    repo.mkdir(parents=True)
    (repo/"MANIFEST.yml").write_text("kit_info:\n  name: ik\n  version: 1.0.1\n")
    (tmp_path/".env").write_text(f"VIBEKIT_BASE_PATH={repo_root}\n")
    run_cli(tmp_path, "init", check=True)
    res = run_cli(tmp_path, "install", "ik")
    assert res.returncode == 0, res.stderr
    assert "Repository source: env" in res.stdout
    # installed metadata should reflect 1.0.1
    meta_file = tmp_path/".vibe-kit"/"innovation-kits.json"
    txt = meta_file.read_text(encoding="utf-8")
    assert "1.0.1" in txt


def test_missing_env_repo_reports_none(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./does-not-exist\n")
    run_cli(tmp_path, "init", check=True)
    res = run_cli(tmp_path, "list")
    assert res.returncode == 0
    assert "Repository source" not in res.stdout  # none means no message


def test_update_uses_env_repo(run_cli, tmp_path: Path):
    repo_root = tmp_path / "innovation-kit-repository"
    repo = repo_root / "upkit"
    repo.mkdir(parents=True)
    (repo/"MANIFEST.yml").write_text("kit_info:\n  name: upkit\n  version: 1.0.0\n")
    (tmp_path/".env").write_text(f"VIBEKIT_BASE_PATH={repo_root}\n")

    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "upkit")
    # bump version in base
    (repo/"MANIFEST.yml").write_text("kit_info:\n  name: upkit\n  version: 1.1.0\n")
    res = run_cli(tmp_path, "update", "upkit", "--dry-run")
    assert res.returncode == 0
    assert "Repository source: env" in res.stdout
    assert "dry-run: update available" in res.stdout.lower()
