from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence


@dataclass(frozen=True)
class KitSummary:
    """Minimal information required to describe a kit inside a repository."""

    identifier: str
    name: str
    version: Optional[str] = None
    description: Optional[str] = None
    source_hint: Optional[str] = None
    legacy_descriptor: bool = False


@dataclass
class InstallResult:
    """Details produced after a repository installs or updates a kit."""

    kit_name: str
    location: Path
    metadata: Dict[str, str]
    source_path: Optional[Path] = None
    notes: Sequence[str] = ()
    post_install: Optional[str] = None


class KitRepositoryInterface(ABC):
    """Main abstraction for repositories capable of managing kits."""

    def __init__(self, repository_id: str) -> None:
        self.repository_id = repository_id

    @abstractmethod
    def list_kits(self) -> Sequence[KitSummary]:
        """Return kits that are currently available from this repository."""

    @abstractmethod
    def install(self, kit_name: str, destination: Path) -> InstallResult:
        """Install *kit_name* into *destination* and return the installation result."""

    @abstractmethod
    def uninstall(self, kit_name: str, destination: Path) -> bool:
        """Remove the specified kit from *destination*; return True if something was removed."""

    @abstractmethod
    def update(self, kit_name: str, destination: Path) -> InstallResult:
        """Refresh the given kit inside *destination* and return the update result."""
