"""Shared literal values for repository source identification."""

from enum import IntEnum


REMOTE_SOURCE = "remote"  # Explicit Git URL defined via VIBEKIT_BASE_PATH
LOCAL_SOURCE = "local"  # Explicit local path defined via VIBEKIT_BASE_PATH
AUTODETECT_SOURCE = "autodetect"  # Auto-detected repo (e.g., innovation-kit-repository nearby)
REMOTE_UPDATE = "remote-update"  # Update pulled from remote Git source
AUTODETECT_UPDATE = "autodetect-update"  # Update pulled from auto/local repository


class OperationExitCode(IntEnum):
	"""Shared CLI exit semantics for install/update/uninstall/init commands."""

	SUCCESS = 0  # install/update/uninstall/init completed (or was cancelled safely)
	NOT_FOUND = 1  # update/install: kit missing in repositories; init: template clone failed
	NOT_INSTALLED = 2  # update/uninstall: requested kit not installed locally
	INVALID_INPUT = 3  # install: unknown kit or conflicting target path; other commands: bad args
	IO_OR_STATE_ERROR = 4  # uninstall: filesystem/state mutation failed; available for other IO issues
	REPOSITORY_ERROR = 6  # install/update: repository layer threw; init could surface repo errors too
	GENERAL_FAILURE = 7  # install: unexpected exception; reserved for future failures
