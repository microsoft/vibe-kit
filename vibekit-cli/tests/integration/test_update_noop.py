from pathlib import Path

def test_update_requires_installed(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    src = tmp_path/"innovation-kit-repository"/"u-demo"; src.mkdir(parents=True)
    (src/"MANIFEST.yml").write_text("kit_info:\n  name: u-demo\n  version: 0.1.0\n")
    result = run_cli(tmp_path, "update", "u-demo")

    assert result.returncode == 2
    assert "package 'u-demo' is not installed" in result.stdout.lower()
    assert "install with: vibekit install u-demo" in result.stdout.lower()
