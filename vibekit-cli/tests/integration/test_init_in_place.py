import os
from pathlib import Path
from typer.testing import CliRunner
import cli


def test_init_no_project_dir_in_place(monkeypatch, tmp_path):
    """Ensure `vibekit init` works without a project name (in-place init).

    We monkeypatch the git clone subprocess to avoid network calls and fabricate
    a minimal template structure that the init logic will copy.
    """

    # Switch to temporary working directory
    cwd_before = Path.cwd()
    os.chdir(tmp_path)

    # Provide required environment var
    monkeypatch.setenv("GIT_PAT", "dummy-pat-for-tests")

    # Fake subprocess.run to simulate successful `git clone` and create the template dir
    def fake_run(cmd, check, stdout, stderr, text, env):  # noqa: D401 - matching signature subset
        # The last argument in cmd should be the destination path
        repo_path = Path(cmd[-1])
        repo_path.mkdir(parents=True, exist_ok=True)
        # Create minimal template content
        (repo_path / "README.md").write_text("# Template README\n")
        return type("Result", (), {"stdout": "", "stderr": ""})()

    monkeypatch.setattr("subprocess.run", fake_run)

    runner = CliRunner()
    result = runner.invoke(cli.app, ["init"])  # no project_dir argument

    # Restore cwd
    os.chdir(cwd_before)

    assert result.exit_code == 0, result.output
    # The README.md should now be present in the tmp_path root
    assert (tmp_path / "README.md").exists(), "Template file was not copied into current directory"