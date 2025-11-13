# UV Getting Started & Feature Overview

`uv` is the package manager used throughout the Aurora Finetuning Innovation Kit. This guide preserves the upstream feature list while organizing it for quick reference so you can move between the initialization script (`../initialization/initialize_starter_code.py`, surfaced at `.vibe-kit/innovation-kits/aurora-finetune/initialization/initialize_starter_code.py` after install) and day-to-day workflows.

## Core concepts

`uv` provides an integrated interface for:

- Installing and managing Python runtimes.
- Running standalone scripts with isolated dependencies.
- Managing full projects (`pyproject.toml`) with lockfiles.
- Installing CLI tools.
- Working with a pip-compatible layer when you need low-level control.
- Maintaining caches and self-updating the binary.

## Feature breakdown

### Python versions

Commands for installing and managing Python itself:

- `uv python install` — Install Python versions.
- `uv python list` — View available Python versions.
- `uv python find` — Locate an installed Python version.
- `uv python pin` — Pin the current project to a specific Python version.
- `uv python uninstall` — Remove a Python version.

Refer to the upstream “installing Python” guide for detailed workflows.

### Scripts

Execute self-contained scripts (for example `example.py`) with isolated dependencies:

- `uv run` — Run a script.
- `uv add --script` — Add a dependency to a script.
- `uv remove --script` — Remove a dependency from a script.

See the “running scripts” guide for more examples.

### Projects

Create and maintain Python projects with `pyproject.toml` metadata, mirroring how the starter code in `starter-code/` is structured:

- `uv init` — Bootstrap a new project.
- `uv add` — Add a dependency.
- `uv remove` — Remove a dependency.
- `uv sync` — Synchronize dependencies into the active environment.
- `uv lock` — Create or refresh the dependency lockfile.
- `uv run` — Execute a command within the project environment.
- `uv tree` — Inspect the dependency graph.
- `uv build` — Build distribution artifacts.
- `uv publish` — Publish the project to a package index.

Consult the “projects” guide for end-to-end tutorials.

### Tools

Install and execute CLI tools published to Python package indexes (for example `ruff`, `black`):

- `uvx` / `uv tool run` — Run a tool in a temporary environment.
- `uv tool install` — Install a tool user-wide.
- `uv tool uninstall` — Remove an installed tool.
- `uv tool list` — List installed tools.
- `uv tool update-shell` — Update shell environment variables so tools appear on your `PATH`.

See the “tools” guide for additional usage patterns.

### Pip-compatible interface

Use these commands when you need manual control of environments and packages. They mimic familiar `venv`, `pip`, and `pip-tools` flows but are implemented by `uv`.

**Virtual environments (replacement for `venv` / `virtualenv`):**

- `uv venv` — Create a virtual environment.

See the documentation on using environments for more examples.

**Managing packages within an environment (replacement for `pip` / `pipdeptree`):**

- `uv pip install` — Install packages into the active environment.
- `uv pip show` — Display details about an installed package.
- `uv pip freeze` — List installed packages and versions.
- `uv pip check` — Verify dependency compatibility.
- `uv pip list` — List installed packages.
- `uv pip uninstall` — Remove packages.
- `uv pip tree` — View the dependency tree.

**Locking dependencies (replacement for `pip-tools`):**

- `uv pip compile` — Generate a lockfile.
- `uv pip sync` — Sync an environment with a lockfile.

> **Important:** These commands are intentionally compatible with the `pip` ecosystem, but they do not replicate every edge case. The further you diverge from standard workflows, the more likely you are to encounter differences. Consult the official pip-compatibility guide if you depend on nuanced behaviors.

### Utility commands

Maintain caches, inspect data directories, and update `uv` itself:

- `uv cache clean` — Remove cache entries.
- `uv cache prune` — Clear outdated cache entries.
- `uv cache dir` — Show the cache directory path.
- `uv tool dir` — Show where tools are installed.
- `uv python dir` — Show where `uv` stores installed Python versions.
- `uv self update` — Update `uv` to the latest release.

> **Tip:** On environments with small `/tmp` partitions (Codespaces, dev containers, shared notebooks), export `UV_CACHE_DIR` to a persistent path before running `uv sync` or the initialization script. Combine it with `UV_LINK_MODE=copy` to avoid cross-filesystem hard-link errors:
>
> ```bash
> export UV_CACHE_DIR="$PWD/.uv-cache"
> export UV_LINK_MODE=copy
> uv sync
> ```
>
> Clean up with `uv cache prune` if the cache grows too large.

## Next steps

- Review `uv`’s upstream guides for deeper dives into each feature area.
- Explore the concept documentation for architecture details.
- If issues arise, follow the “getting help” guidance from the official docs or cross-reference `docs/beware.md` in this innovation kit for Aurora-specific pitfalls.