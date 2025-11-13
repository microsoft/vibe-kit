from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import typer

DEFAULT_TEMPLATE_URL = "https://dev.azure.com/msresearch/MSR-CreativeTech/_git/vibe-kit-base"

# Preferred order when looking for a Personal Access Token (if the template repo is private)
TOKEN_ENV_VARS: tuple[str, ...] = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")


def _resolve_pat() -> tuple[str | None, str | None]:
    for env_name in TOKEN_ENV_VARS:
        value = os.environ.get(env_name)
        if value:
            return env_name, value
    return None, None


def _mask(url: str) -> str:
    # Hide password/PAT in log output
    return re.sub(r":([^@/]+)@", r":****@", url)


def run_init(project_dir: str | None):
    """Scaffold a new Vibe Kit project.

    If project_dir is provided, a new folder is created (must be empty or non-existent).
    If omitted (None), contents are merged into the current working directory without creating a new folder.
    """

    baseline_dir: Path | None = None

    if project_dir:
        target_dir = (Path.cwd() / project_dir).resolve()
        if target_dir.exists() and any(target_dir.iterdir()):
            raise typer.BadParameter(
                f"Target directory '{target_dir}' already exists and is not empty."
            )
        target_dir.mkdir(parents=True, exist_ok=True)
        in_place = False
    else:
        target_dir = Path.cwd().resolve()
        in_place = True
        if any(target_dir.iterdir()):
            typer.echo(
                "[warning] Current directory is not empty; existing files may be overwritten.",
                err=True,
            )
        typer.echo("Initializing project in current directory (no new folder created)...")

    # If baseline state already exists (second init), emit a helpful message
    baseline_dir = target_dir / ".vibe-kit"
    if baseline_dir.exists():
        typer.echo("Baseline already present (.vibe-kit) - reusing existing state")

    source_url = os.environ.get("VIBEKIT_INIT_REPO_URL", DEFAULT_TEMPLATE_URL)
    token_env, pat = _resolve_pat()

    typer.echo(f"Cloning template from {_mask(source_url)}...")
    with tempfile.TemporaryDirectory(prefix="vibekit-init-") as tmpdir:
        repo_path = Path(tmpdir) / "template"

        # Construct the `git clone` command:
        # - disable credential helper (-c credential.helper=)
        # - optionally add Basic Authorization header with PAT
        clone_cmd = ["git", "-c", "credential.helper=", "clone", "--depth", "1"]

        if pat and source_url.startswith("https://"):
            b64 = base64.b64encode(f"msresearch:{pat}".encode()).decode("ascii")
            clone_cmd += ["-c", f"http.extraheader=Authorization: Basic {b64}"]

        clone_cmd += [source_url, str(repo_path)]

        # No interactive prompts
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"

        try:
            subprocess.run(
                clone_cmd,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
            )
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr or exc.stdout or ""
            if pat is None:
                hint = (
                    "Failed to clone template repository. The repository may require authentication.\n"
                    "Set one of the following environment variables and try again: "
                    + ", ".join(TOKEN_ENV_VARS)
                    + "."
                )
                typer.echo(hint, err=True)
                if stderr:
                    typer.echo(f"Details: {stderr}", err=True)
            else:
                typer.echo(f"Failed to clone template repository using {token_env}: {stderr}", err=True)
            raise typer.Exit(code=1)

        for entry in repo_path.iterdir():
            if entry.name == ".git":
                continue
            dest = target_dir / entry.name
            if entry.is_dir():
                shutil.copytree(entry, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(entry, dest)

    if in_place:
        typer.echo("Template applied in current directory.")
    else:
        typer.echo(f"Project created at {target_dir}")