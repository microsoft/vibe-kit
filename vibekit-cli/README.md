# Vibe Kit CLI

This subdirectory contains the Vibe Kit CLI (vibekit) package.

## Contents

- `pyproject.toml` – package metadata and entry point (`vibekit`)
- `.env` – local path configuration (now relative to this folder)
- `src/` – Python package sources (installed as `vibekit-cli`)
- `tests/` – unit/integration tests for the CLI

## Project structure

- `src/`
  - `cli.py` – Typer application wiring together install/update/uninstall commands.
  - `commands/` – submodules that implement individual CLI commands (install, update, uninstall, list, etc.).
  - `assets.py` – helpers for copying customization bundles and maintaining the local asset index.
  - `manifests.py`, `repo.py`, `state.py`, `versioning.py` – shared services for reading innovation kit manifests, resolving repository paths, persisting local state, and tracking CLI version info.
- `tests/`
  - `integration/` – end-to-end scenarios that exercise the CLI via subprocess calls and validate filesystem side effects.
  - `unit/` – fast tests covering manifest parsing, version handling, and other isolated helpers.

## Development usage

```bash
cd vibekit-cli
python -m pip install -e .[dev]
pytest -q
```

## Environment variables

- `VIBEKIT_BASE_PATH` – absolute or relative path to the local `innovation-kit-repository` directory (the folder holding kit manifests). You can also point this to an HTTPS GitHub repository URL (for example `https://github.com/org/innovation-kit-repository`) to list/install kits remotely. If omitted, the CLI walks up from the current directory and, in this repo layout, picks `../innovation-kit-repository` by default.

> Run `vibekit` commands from inside this directory (or ensure your working directory has an `.env` if executing from the repo root).

## Getting Started

### Windows PowerShell

#### Option 1: Install vibekit CLI tool, then initialize in a project
 
```powershell
# 1. Create virtual environment (uv)
uv venv

# 2. Set required PAT (Azure DevOps; Code Read scope at minimum)
$env:GIT_PAT="<YOUR_PAT>"

# 3. (Optional) Override template repo URL
$env:VIBEKIT_INIT_REPO_URL="https://github.com/microsoft/vibe-kit"

# 4. Install vibekit CLI from feature branch
uv pip install -v "git+https://$env:GIT_PAT@github.com/microsoft/vibe-kit@<branch-name>#subdirectory=vibekit-cli"

# 5. Initialize a project (new folder) OR in-place
vibekit init MyProject
vibekit list
```

#### Option 2: One-shot uvx fetch + init
 
```powershell
$env:GIT_PAT="<YOUR_PAT>"
$env:VIBEKIT_INIT_REPO_URL="https://github.com/microsoft/vibe-kit"
$env:UV_LOG="debug"
$env:GIT_CURL_VERBOSE="1"
$env:GIT_LFS_SKIP_SMUDGE='1'  # Skip downloading large/missing LFS blobs

uvx --from "git+https://$GIT_PAT@github.com/microsoft/vibe-kit@<branch-name>#egg=vibekit-cli&subdirectory=vibekit-cli" vibekit init MyProject

# In-place initialization
uvx --from "git+https://$GIT_PAT@github.com/microsoft/vibe-kit@<branch-name>#egg=vibekit-cli&subdirectory=vibekit-cli" vibekit init

# Follow-up commands
vibekit list
vibekit install <kit-name>
vibekit update <kit-name>
vibekit uninstall <kit-name>
```

### macOS / Linux / Windows Subsystem for Linux (WSL)

```bash
# 1. (optional) Create virtual environment
uv venv

# 2. Export required environment variables
export GIT_PAT="<YOUR_PAT>"
export VIBEKIT_INIT_REPO_URL="https://github.com/microsoft/vibe-kit"
export GIT_LFS_SKIP_SMUDGE=1  # Prevent LFS smudge errors on large/missing files

# 3. Install & init (inline env assignments supported in bash)
GIT_LFS_SKIP_SMUDGE=1 UV_LOG=debug GIT_CURL_VERBOSE=1 \
uvx --from "git+https://$GIT_PAT@github.com/microsoft/vibe-kit@<branch-name>#egg=vibekit-cli&subdirectory=vibekit-cli" vibekit init MyProject

# Or initialize in-place
GIT_LFS_SKIP_SMUDGE=1 UV_LOG=debug GIT_CURL_VERBOSE=1 \
uvx --from "git+https://$GIT_PAT@github.com/microsoft/vibe-kit@<branch-name>#egg=vibekit-cli&subdirectory=vibekit-cli" vibekit init

# Subsequent commands
vibekit list
vibekit install <kit-name>
vibekit update <kit-name>
vibekit uninstall <kit-name>
```

### Fallback (local clone → install from path)

If network or quoting issues persist, clone first and install from the subdirectory:

```bash
git clone "https://$GIT_PAT@github.com/microsoft/vibe-kit" vibe-kit-base
uvx --from ./vibe-kit-base/vibekit-cli vibekit init MyProject
```

## Notes

- When `vibekit init` is called without a project name, template contents are copied into the current working directory. Existing files may be overwritten.
- Provide `MyProject` (or another name) to create a fresh folder if you prefer isolation.
- Ensure `GIT_PAT` is exported (PowerShell: `$env:GIT_PAT = 'your_pat_here'`).
- Set `VIBEKIT_INIT_REPO_URL` only if you need to override the default template repo URL.

## CLI commands

- `vibekit init [--source-label TEXT]` – creates the `.vibe-kit/` state folder and, when `VIBEKIT_BASE_PATH` points at a kit repository, copies baseline folders such as `frontend/`, `backend/`, `.devcontainer/`, and `.github/` if they are missing.
- `vibekit list [--installed|-i] [--json]` – without flags prints available kits from the detected repository; `-i/--installed` switches to the locally installed registry; `--json` emits structured output for scripting.
- `vibekit install kit-name` – copies the selected kit from the repository into `.vibe-kit/innovation-kits/kit-name`, records metadata, and stages customization files into the state directory (skipping conflicts). **Note:** Reload VS Code window after installation to activate custom chat modes.
- `vibekit update kit-name [--dry-run]` – compares the installed version with the repository copy; `--dry-run` only reports differences, otherwise replaces the install and refreshes customization assets.
- `vibekit uninstall kit-name` – removes the installed kit directory, prunes customization assets tracked for that kit, and updates `innovation-kits.json`.
