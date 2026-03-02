import os
from pathlib import Path
from typer.testing import CliRunner
import cli


def test_init_verbose_outputs_debug(monkeypatch, tmp_path):
    """`vibekit init -v` should emit extra debug lines (e.g., PAT env checks, clone status)."""
    cwd_before = Path.cwd()
    os.chdir(tmp_path)

    # Provide environment var for PAT
    monkeypatch.setenv("GITHUB_PAT", "dummy")

    # Capture commands invoked and simulate clone
    def fake_run(cmd, check, stdout, stderr, text, env):  # matches subset of subprocess.run
        repo_path = Path(cmd[-1])
        repo_path.mkdir(parents=True, exist_ok=True)
        (repo_path / "README.md").write_text("# Template README\n")
        return type("Result", (), {"stdout": "", "stderr": ""})()

    monkeypatch.setattr("subprocess.run", fake_run)

    runner = CliRunner()
    result = runner.invoke(cli.app, ["init", "-v"])  # verbose flag
    os.chdir(cwd_before)

    assert result.exit_code == 0, result.output
    output = result.output
    # Expect verbose-only markers
    assert "Cloning template" in output or "Checking env var for PAT" in output
    assert "Project created" in output or "Template applied" in output


def test_init_non_verbose_minimal(monkeypatch, tmp_path):
    """Without -v, omit detailed lines like 'Cloning template'."""
    cwd_before = Path.cwd()
    os.chdir(tmp_path)

    monkeypatch.setenv("GIT_PAT", "dummy")

    def fake_run(cmd, check, stdout, stderr, text, env):
        repo_path = Path(cmd[-1])
        repo_path.mkdir(parents=True, exist_ok=True)
        (repo_path / "README.md").write_text("# Template README\n")
        return type("Result", (), {"stdout": "", "stderr": ""})()

    monkeypatch.setattr("subprocess.run", fake_run)

    runner = CliRunner()
    result = runner.invoke(cli.app, ["init"])  # no -v
    os.chdir(cwd_before)

    assert result.exit_code == 0, result.output
    output = result.output
    # Detailed debug lines should be absent
    assert "Cloning template" not in output
    assert "Checking env var for PAT" not in output
    # Summary line should always be present
    assert "Template applied" in output or "Project created" in output
