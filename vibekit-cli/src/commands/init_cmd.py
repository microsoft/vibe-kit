from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List

import typer
from rich.console import Console
from rich.panel import Panel

from repo import load_repo_env


console = Console()
err_console = Console(stderr=True)


def _render_status_panel(
    messages: list[str],
    variant: str = "info",
    title: str | None = None,
) -> Panel:
    palette = {
        "success": ("Init Complete", "green"),
        "warning": ("Init Status", "yellow"),
        "error": ("Init Error", "red"),
        "info": ("Init Status", "cyan"),
    }
    default_title, border = palette.get(variant, ("Init Status", "cyan"))
    content = "\n".join(messages) if messages else "No status available."
    return Panel(content, title=title or default_title, title_align="left", border_style=border)


def _emit_status_and_exit(
    messages: list[str],
    variant: str = "success",
    exit_code: int = 0,
    title: str | None = None,
) -> None:
    # Always print to stdout (tests inspect stdout); errors can also echo to stderr if needed
    console.print(_render_status_panel(messages, variant, title))
    raise typer.Exit(code=exit_code)

DEFAULT_TEMPLATE_URL = "https://dev.azure.com/msresearch/MSR-CreativeTech/_git/vibe-kit-base"

# Preferred order when looking for a Personal Access Token (if the template repo is private)
TOKEN_ENV_VARS: tuple[str, ...] = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")


def _resolve_pat(verbose: bool) -> tuple[str | None, str | None]:
    for env_name in TOKEN_ENV_VARS:
        if verbose:
            console.print(f"[dim]Checking env var for PAT: {env_name}[/]")
        value = os.getenv(env_name)
        if value:
            if verbose:
                console.print(f"[dim]Using token from {env_name}[/]")
            return env_name, value
    if verbose:
        console.print("[dim]No Personal Access Token found in environment (proceeding unauthenticated).[/]")
    return None, None


def _mask(url: str) -> str:
    # Hide password/PAT in log output
    return re.sub(r":([^@/]+)@", r":****@", url)


def run_init(project_dir: str | None, verbose: bool = False) -> None:
    """Scaffold a new Vibe Kit project.

    If project_dir is provided, a new folder is created (must be empty or non-existent).
    If omitted (None), contents are merged into the current working directory
    without creating a new folder.
    """

    baseline_dir: Path | None = None
    status_lines: list[str] = []
    variant = "success"

    load_repo_env(Path(os.getcwd()))  # TODO: replace with proper dotenv handling elsewhere

    if project_dir:
        target_dir = (Path.cwd() / project_dir).resolve()
        if target_dir.exists() and any(target_dir.iterdir()):
            _emit_status_and_exit([
                f"Target directory '{target_dir}' already exists and is not empty."
            ], "error", 2)
        target_dir.mkdir(parents=True, exist_ok=True)
        in_place = False
    else:
        target_dir = Path.cwd().resolve()
        in_place = True
        status_lines.append(
            "Initializing project in current directory (no new folder created)..."
        )
        if any(target_dir.iterdir()):
            status_lines.append(
                "Current directory is not empty; existing files may be overwritten."
            )
            variant = "warning"

    # If baseline state already exists (second init), emit a helpful message
    baseline_dir = target_dir / ".vibe-kit"
    if baseline_dir.exists():
        status_lines.append("Baseline already present (.vibe-kit) - reusing existing state")

    source_url = os.environ.get("VIBEKIT_INIT_REPO_URL", DEFAULT_TEMPLATE_URL)

    if verbose:
            status_lines.append(f"Cloning template from {_mask(source_url)}...")
    with tempfile.TemporaryDirectory(prefix="vibekit-init-") as tmpdir:

        template_path = Path(tmpdir) / "template"
        error_lines = _clone_template_repo(source_url, template_path, verbose)
        if error_lines:
            _emit_status_and_exit(status_lines + error_lines, "error", 1, title="Clone Failed")
        if verbose:
            status_lines.append("Source repository cloned successfully. Applying template ...")

        for entry in template_path.iterdir():
            if entry.name == ".git":
                continue
            dest = target_dir / entry.name
            if entry.is_dir():
                shutil.copytree(entry, dest, dirs_exist_ok=True)
                if verbose:
                    status_lines.append(f"\t- copied directory: {entry.name}/")
            else:
                shutil.copy2(entry, dest)
                if verbose:
                    status_lines.append(f"\t- copied file: {entry.name}")

    # Always show a concise final outcome summary (independent of verbose)
    if in_place:
        status_lines.append("Template applied in current directory.")
    else:
        status_lines.append(f"Project created at {target_dir}")

    _emit_status_and_exit(status_lines, variant)

def _clone_template_repo(source_url, target_path, verbose: bool) -> List[str]:
    token_env, pat = _resolve_pat(verbose)

    # Construct the `git clone` command:
    # - disable credential helper (-c credential.helper=)
    # - optionally add Basic Authorization header with PAT
    clone_cmd = ["git", "-c", "credential.helper=", "clone", "--depth", "1"]

    if pat and source_url.startswith("https://"):
        b64 = base64.b64encode(f"msresearch:{pat}".encode()).decode("ascii")
        clone_cmd += ["-c", f"http.extraheader=Authorization: Basic {b64}"]

    clone_cmd += [source_url, str(target_path)]

    # No interactive prompts
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    try:
        completed = subprocess.run(
            clone_cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )
        if verbose:
            stdout = (completed.stdout or '').strip()
            if stdout:
                console.print(Panel(stdout, title="git clone output", title_align="left", border_style="dim"))
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr or exc.stdout or ""
        if pat is None:
            return [
                    "Failed to clone template repository. The repository may require authentication.",
                    "Set one of the following environment variables and try again: " + ", ".join(TOKEN_ENV_VARS) + "."
            ]
        else:
            return [
                    f"Failed to clone template repository using {token_env}: {stderr}"
                ]

    return []