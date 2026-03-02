from __future__ import annotations

import os
from pathlib import Path
from typing import List

VIBEKIT_CLI_PATH = Path(__file__).parent.parent.resolve()

BASE_ENV_VAR = (
    "VIBEKIT_BASE_PATH"  # Now interpreted as the direct path to innovation-kit-repository
)
_DOTENV_LOADED = False


def load_repo_env(cwd: Path) -> None:
    _load_dotenv_if_present(cwd)


def get_repo_sources() -> List[str]:
    raw = os.getenv(BASE_ENV_VAR, "")
    if not raw:
        return []
    entries: List[str] = []
    for part in raw.replace(";", ",").split(','):
        candidate = part.strip()
        if not candidate:
            continue
        if candidate.startswith(("'", '"')) and candidate.endswith(("'", '"')):
            candidate = candidate[1:-1].strip()
        if candidate:
            entries.append(candidate)
    return entries


def resolve_local_source(value: str, base_dir: Path) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate.resolve()
    return (base_dir / candidate).resolve()


def _load_dotenv_if_present(cwd: Path) -> None:
    global _DOTENV_LOADED
    if _DOTENV_LOADED:
        return
    _DOTENV_LOADED = True

    env_file_candidates = [cwd / ".env", VIBEKIT_CLI_PATH / ".env", Path.home() / ".vibekit" / ".env"]
    for env_file in env_file_candidates:
        if env_file.exists() and _apply_env_file(env_file):
            break


def _apply_env_file(env_file: Path) -> bool:
    try:
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in os.environ:
                continue
            os.environ[key] = value.strip()
        return True
    except Exception:  # pragma: no cover
        return False
