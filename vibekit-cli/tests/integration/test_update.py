from pathlib import Path

from constants import OperationExitCode
import json


def test_update_missing_source(run_cli, tmp_path: Path):
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "update", "no-such-kit")
    assert result.returncode == OperationExitCode.NOT_INSTALLED
    combined_output = (result.stdout + result.stderr).lower()
    assert "package 'no-such-kit' is not installed" in combined_output


def test_update_not_installed(run_cli, tmp_path: Path):
    # create source repo but do not install
    src = tmp_path / "innovation-kit-repository" / "demo-up"; src.mkdir(parents=True)
    (src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-up\n  version: 0.0.2\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    result = run_cli(tmp_path, "update", "--yes", "demo-up")
    assert result.returncode == OperationExitCode.NOT_INSTALLED
    assert "package 'demo-up' is not installed" in result.stdout.lower()


def test_update_no_newer(run_cli, tmp_path: Path):
    src = tmp_path / "innovation-kit-repository" / "demo-up"; src.mkdir(parents=True)
    (src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-up\n  version: 1.0.0\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "demo-up")
    # source still 1.0.0
    result = run_cli(tmp_path, "update", "--yes", "demo-up")
    assert result.returncode == OperationExitCode.SUCCESS
    assert "no newer version" in result.stdout.lower()


def test_update_success(run_cli, tmp_path: Path):
    src = tmp_path / "innovation-kit-repository" / "demo-up"; src.mkdir(parents=True)
    (src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-up\n  version: 1.0.0\n")
    (tmp_path/".env").write_text("VIBEKIT_BASE_PATH=./innovation-kit-repository\n")
    run_cli(tmp_path, "init", check=True)
    run_cli(tmp_path, "install", "demo-up")
    # bump version in source
    (src/"MANIFEST.yml").write_text("kit_info:\n  name: demo-up\n  version: 1.1.0\n")
    result = run_cli(tmp_path, "update", "--yes", "demo-up")
    assert result.returncode == OperationExitCode.SUCCESS
    assert "updated demo-up from 1.0.0 to 1.1.0".lower() in result.stdout.lower()
