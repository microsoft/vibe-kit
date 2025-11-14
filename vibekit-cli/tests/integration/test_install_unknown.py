from pathlib import Path


def test_install_unknown(run_cli, tmp_path: Path):
    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "install", "does-not-exist")

    assert result.returncode == 3
    assert "Unknown kit name" in result.stdout
