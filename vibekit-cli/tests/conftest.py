import os
import shutil
import subprocess
import warnings
import pytest
from pathlib import Path

CLI_EXECUTABLE = shutil.which("vibekit") or "vibekit"

_TOKEN_ENV_NAMES = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")
DUMMY_GIT_PAT = "dummy-pat-for-tests"
_DUMMY_WARNING_SHOWN = False


def _prepare_local_template_repo(base: Path) -> Path:
    repo_dir = base / "local_template_repo"
    if (repo_dir / ".git").exists():
        return repo_dir
    repo_dir.mkdir(parents=True, exist_ok=True)
    # Minimal template content
    (repo_dir / "README.md").write_text("# Local Test Template\n")
    (repo_dir / "config.yml").write_text("name: test-template\n")
    # Baseline state directory expected by integration tests
    (repo_dir / ".vibe-kit").mkdir()
    (repo_dir / ".vibe-kit" / "README.md").write_text("# Baseline README\nsource: unspecified\n")
    # Initialize git repository with one commit so clone works
    subprocess.run(["git", "init", "-q"], cwd=repo_dir, check=True)
    subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=repo_dir, check=True)
    return repo_dir


def _inject_dummy_token(environment: dict[str, str]) -> None:
    global _DUMMY_WARNING_SHOWN
    has_token = any((environment.get(name) or "").strip() for name in _TOKEN_ENV_NAMES)
    if has_token:
        return
    if not _DUMMY_WARNING_SHOWN:
        warnings.warn(
            "No GitHub token env vars set; using dummy token for CLI subprocesses "
            f"({', '.join(_TOKEN_ENV_NAMES)}).",
            RuntimeWarning,
            stacklevel=2,
        )
        _DUMMY_WARNING_SHOWN = True
    environment["GIT_PAT"] = DUMMY_GIT_PAT


@pytest.fixture
def run_cli(tmp_path: Path):
    template_repo = _prepare_local_template_repo(tmp_path)

    def _run(cwd: Path, *args: str, env: dict | None = None, check: bool = False):
        e = os.environ.copy()
        if env:
            e.update(env)
        _inject_dummy_token(e)
        # Point clone URL to local test template to avoid network/PAT usage
        e.setdefault("VIBEKIT_INIT_REPO_URL", str(template_repo))
        result = subprocess.run([CLI_EXECUTABLE, *args], cwd=cwd, capture_output=True, text=True, env=e)
        if check and result.returncode != 0:
            raise AssertionError(
                f"Command failed: {' '.join(args)}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
            )
        return result
    return _run


@pytest.fixture
def ensure_baseline(run_cli, tmp_path: Path):
    # Initialize baseline state directory
    run_cli(tmp_path, "init", check=True)
    return tmp_path / ".vibe-kit"
