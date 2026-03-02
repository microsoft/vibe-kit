import os
import pytest

_TOKEN_ENV_NAMES = ("GIT_PAT", "GITHUB_PAT", "GITHUB_TOKEN", "GH_TOKEN")


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--allow-missing-github-token",
        action="store_true",
        default=False,
        help="Run integration tests even if no GitHub token environment variable is set.",
    )


def _has_required_env() -> bool:
    return any((os.getenv(name) or "").strip() for name in _TOKEN_ENV_NAMES)


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if not items:
        return
    if _has_required_env() or config.getoption("--allow-missing-github-token"):
        return

    message = (
        "Integration tests require a GitHub token via one of: "
        f"{', '.join(_TOKEN_ENV_NAMES)}. "
        "Set one of these variables or rerun with --allow-missing-github-token to force execution."
    )
    print(f"[integration-tests] {message}")
    skip_marker = pytest.mark.skip(reason=message)
    for item in items:
        item.add_marker(skip_marker)
