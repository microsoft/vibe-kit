from __future__ import annotations

import os
from pathlib import Path
from typing import List
from urllib.parse import urlparse

from env import get_repo_sources, load_repo_env, resolve_local_source
from constants import REMOTE_SOURCE, LOCAL_SOURCE

from .github_repository import GithubKitRepository
from .local_repository import LocalKitRepository, resolve_repo_root
from .repository_interface import KitRepositoryInterface


class RepositoryContext:
    """Metadata wrapper describing the detected repository."""

    def __init__(
        self,
        repository: KitRepositoryInterface,
        *,
        kind: str,
        roots: tuple[Path, ...] | None = None,
        remote_url: str | None = None,
    ) -> None:
        self.repository = repository
        self.kind = kind
        self.roots = roots or ()
        self.remote_url = remote_url


def detect_repositories(root: Path) -> List[RepositoryContext]:
    """Detect repositories defined in env or via auto-discovery."""

    load_repo_env(root)

    contexts: List[RepositoryContext] = []
    sources = get_repo_sources()

    for index, source in enumerate(sources):
        if not source:
            continue
        if is_git_url(source):
            repo_id = f"{REMOTE_SOURCE}-{index}"
            repository = GithubKitRepository(repo_id, source)
            contexts.append(RepositoryContext(repository, kind="github", remote_url=source))
            continue

        resolved = resolve_local_source(source, base_dir=root)
        if resolved.is_dir():
            repo_id = f"{LOCAL_SOURCE}-{index}:{resolved}"
            local_repo = LocalKitRepository(repo_id, [resolved], source_kind=LOCAL_SOURCE)
            contexts.append(RepositoryContext(local_repo, kind="local", roots=(resolved,)))

    if contexts:
        return contexts

    repo_roots, source_kind = resolve_repo_root(root)
    if repo_roots is None:
        return []

    repository_id = f"{source_kind or 'local'}:{','.join(str(p) for p in repo_roots)}"
    repository = LocalKitRepository(repository_id, repo_roots, source_kind=source_kind)
    return [
        RepositoryContext(
            repository,
            kind="local",
            roots=tuple(repo_roots),
        )
    ]


def detect_repository(root: Path) -> RepositoryContext | None:
    contexts = detect_repositories(root)
    return contexts[0] if contexts else None


def is_git_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme and parsed.netloc:
        return True
    return value.startswith("git@")
