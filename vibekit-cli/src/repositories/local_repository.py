from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from .repository_interface import InstallResult, KitRepositoryInterface, KitSummary
from manifests import extract_kit_metadata
from env import BASE_ENV_VAR, VIBEKIT_CLI_PATH, load_repo_env
from constants import LOCAL_SOURCE


class LocalKitRepository(KitRepositoryInterface):
    """Repository implementation backed by one or more local directories."""

    def __init__(
        self,
        repository_id: str,
        roots: Iterable[Path],
        *,
        source_kind: str | None = None,
    ) -> None:
        super().__init__(repository_id)
        self.roots = tuple(Path(root).resolve() for root in roots)
        self.source_kind = source_kind

    def list_kits(self) -> tuple[KitSummary, ...]:
        entries: List[KitSummary] = []
        for root in self.roots:
            if not root.is_dir():
                continue
            for child in sorted(root.iterdir()):
                if not child.is_dir() or child.name.startswith('.'):
                    continue
                metadata = extract_kit_metadata(child, child.name)
                kit_id = metadata.get("id") or child.name
                entries.append(
                    KitSummary(
                        identifier=kit_id,
                        name=metadata.get("name") or kit_id,
                        version=metadata.get("version"),
                        description=metadata.get("description"),
                        source_hint=str(child),
                        legacy_descriptor=bool(metadata.get("legacy_descriptor", False)),
                    )
                )
        entries.sort(key=lambda summary: summary.identifier)
        return tuple(entries)

    def install(self, kit_name: str, destination: Path) -> InstallResult:
        source_dir = self._find_source_dir(kit_name)
        if source_dir is None:
            raise FileNotFoundError(f"Kit '{kit_name}' not found in local repositories")

        if destination.exists():
            raise FileExistsError(f"Destination already exists: {destination}")

        shutil.copytree(source_dir, destination)

        manifest_meta = extract_kit_metadata(destination, kit_name)

        post_install = manifest_meta.get("post_install_instructions") if isinstance(manifest_meta, dict) else None

        return InstallResult(
            kit_name=kit_name,
            location=destination,
            metadata=manifest_meta,
            source_path=destination,
            post_install=post_install,
        )

    def uninstall(self, kit_name: str, destination: Path) -> bool:
        if not destination.exists():
            return False
        shutil.rmtree(destination)
        return True

    def update(self, kit_name: str, destination: Path) -> InstallResult:
        source_dir = self._find_source_dir(kit_name)
        if source_dir is None:
            raise FileNotFoundError(f"Kit '{kit_name}' not found in local repositories")

        if destination.exists():
            shutil.rmtree(destination)

        shutil.copytree(source_dir, destination)

        manifest_meta = extract_kit_metadata(destination, kit_name)

        post_install = manifest_meta.get("post_install_instructions") if isinstance(manifest_meta, dict) else None

        return InstallResult(
            kit_name=kit_name,
            location=destination,
            metadata=manifest_meta,
            source_path=destination,
            post_install=post_install,
        )

    def _find_source_dir(self, kit_name: str) -> Optional[Path]:
        for root in self.roots:
            candidate = root / kit_name
            if candidate.is_dir():
                return candidate
        return None


def resolve_repo_root(cwd: Path) -> Tuple[Optional[List[Path]], str]:
    """Resolve local repository roots based on env var or auto-discovery."""

    load_repo_env(cwd)
    env_repo = os.getenv(BASE_ENV_VAR)
    if env_repo:
        repo_paths = [
            (VIBEKIT_CLI_PATH / p).resolve() if not os.path.isabs(p) else Path(p).resolve()
            for p in env_repo.split(";")
        ]

        repo_paths_that_are_directories = [p for p in repo_paths if p.is_dir()]

        if repo_paths_that_are_directories:
            return repo_paths_that_are_directories, LOCAL_SOURCE

    marker = "innovation-kit-repository"
    current = cwd.resolve()
    for ancestor in [current, *current.parents]:
        candidate = ancestor / marker
        if candidate.is_dir():
            return [candidate], "auto"
    return None, "none"

