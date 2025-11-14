from __future__ import annotations
from pathlib import Path
import os
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from github_repo import (
    download_github_kit,
    is_github_host,
    list_github_repository,
    parse_github_url,
)
# vibe-kit-base/vibekit-cli/src/repo.py
VIBEKIT_CLI_PATH = Path(__file__).parent.parent.resolve()

BASE_ENV_VAR = (
    "VIBEKIT_BASE_PATH"  # Now interpreted as the direct path to innovation-kit-repository
)
_DOTENV_LOADED = False


def is_git_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        return True
    return value.startswith("git@")


def list_remote_repo_kits(remote_url: str) -> List[Dict[str, str]]:
    return fetch_remote_repo_listing(remote_url)


def load_repo_env(cwd: Path) -> None:
    _load_dotenv_if_present(cwd)


def download_remote_kit(
    remote_url: str, kit_name: str, dest_root: Path
) -> Tuple[Path, Dict[str, str]]:
    if remote_url.startswith("git@"):
        raise NotImplementedError(
            "SSH Git URLs are not supported yet; use an HTTPS repository URL."
        )
    dest_root.mkdir(parents=True, exist_ok=True)
    parsed = urlparse(remote_url)
    host = (parsed.netloc.split(":", 1)[0] or "").lower()
    if not host:
        raise ValueError("Remote repository URL is invalid.")
    if is_github_host(host):
        owner, repo, ref, subdir = parse_github_url(remote_url)
        return download_github_kit(owner, repo, ref, subdir, kit_name, dest_root)
    if host in {"gitlab.com", "www.gitlab.com"}:
        raise NotImplementedError("GitLab remote repositories are not supported yet.")
    if host in {"bitbucket.org", "www.bitbucket.org"}:
        raise NotImplementedError("Bitbucket remote repositories are not supported yet.")
    raise NotImplementedError(
        f"Remote repository host '{host or parsed.netloc}' is not supported yet."
    )


def fetch_remote_repo_listing(remote_url: str) -> List[Dict[str, str]]:
    if remote_url.startswith("git@"):
        raise NotImplementedError(
            "SSH Git URLs are not supported yet; use an HTTPS repository URL."
        )
    parsed = urlparse(remote_url)
    host = (parsed.netloc.split(":", 1)[0] or "").lower()
    if not host:
        raise ValueError("Remote repository URL is invalid.")
    if is_github_host(host):
        owner, repo, ref, subdir = parse_github_url(remote_url)
        return list_github_repository(owner, repo, ref, subdir)
    if host in {"gitlab.com", "www.gitlab.com"}:
        raise NotImplementedError("GitLab remote repositories are not supported yet.")
    if host in {"bitbucket.org", "www.bitbucket.org"}:
        raise NotImplementedError("Bitbucket remote repositories are not supported yet.")
    raise NotImplementedError(
        f"Remote repository host '{host or parsed.netloc}' is not supported yet."
    )


def _load_dotenv_if_present(cwd: Path) -> None:
    global _DOTENV_LOADED
    if _DOTENV_LOADED:
        return
    _DOTENV_LOADED = True

    env_file_candidates = [cwd / ".env", VIBEKIT_CLI_PATH / ".env", Path.home() / ".vibekit" / ".env"]
    for env_file in env_file_candidates:
        if not env_file.exists():
            continue
        try:
            for raw in env_file.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                if not k or k in os.environ:
                    continue
                os.environ[k] = v.strip()
            break  # stop after first found
        except Exception:  # pragma: no cover
            pass


def resolve_repo_root(cwd: Path) -> Tuple[Optional[List[Path]], str]:
    """Return (repo_root, source_kind) with env var or auto-discovery.

    Resolution order:
    1. Environment variable VIBEKIT_BASE_PATH (interpreted as direct path) -> source_kind "env".
    2. Upward search from cwd for a directory named exactly "innovation-kit-repository" -> source_kind "auto".
    3. If not found -> (None, "none").
    """
    _load_dotenv_if_present(cwd)
    env_repo = os.getenv(BASE_ENV_VAR)
    if env_repo:
        repo_paths = [
            (VIBEKIT_CLI_PATH / p).resolve() if not os.path.isabs(p) else Path(p).resolve()
            for p in env_repo.split(";")
        ]

        repo_paths_that_are_directories = [p for p in repo_paths if p.is_dir()]

        if repo_paths_that_are_directories:
            return repo_paths_that_are_directories, "env"

    # Auto-discovery: walk upward looking for innovation-kit-repository
    marker = "innovation-kit-repository"
    current = cwd.resolve()
    for ancestor in [current, *current.parents]:
        candidate = ancestor / marker
        if candidate.is_dir():
            return [candidate], "auto"
    return None, "none"
