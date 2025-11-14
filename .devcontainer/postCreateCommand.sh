#!/usr/bin/env bash

# Purpose: Dev Container post-create setup
#
# Notes:
# - We use strict bash options for safety.
# - The devcontainer config already extends PATH with ~/.local/bin for the vscode user.

set -euo pipefail
umask 0002

echo ""
echo "============================================="
echo "   VIBE KIT DEV CONTAINER SETUP"
echo "============================================="
echo ""
echo "Setting up your development environment..."
echo "This may take a few moments."
echo ""

echo "Verifying development tools..."

# Resolve repository root (script is located at <repo>/.devcontainer/postCreateCommand.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -P)"

## 'uv' is installed in the image (Dockerfile). Verify availability.
if command -v uv >/dev/null 2>&1; then
  echo "'uv' is available."
else
  echo "WARNING: 'uv' not found on PATH; check Dockerfile install."
fi

echo ""
echo "Tool versions:"
echo -n "  • uv:        " && uv --version || true
echo -n "  • uvx:       " && uvx --version || true
echo -n "  • node:      " && node --version || true
echo -n "  • npm:       " && npm --version || true
echo -n "  • python3:   " && python3 --version || true
echo -n "  • az:        " && az version --output tsv | head -1 || true

# Prepare writable caches for tools (uv, npm)
echo ""
echo "Preparing cache directories..."
mkdir -p "$HOME/.cache" || true

PROJECT_CACHE_SEGMENT="$(basename "${ROOT_DIR}")"
DEFAULT_UV_CACHE_ROOT="${UV_CACHE_DIR:-/tmp/uv-cache}"
export UV_CACHE_DIR="${DEFAULT_UV_CACHE_ROOT}/${PROJECT_CACHE_SEGMENT}"
export TMPDIR="${TMPDIR:-/tmp}"
mkdir -p "${UV_CACHE_DIR}" || true
mkdir -p "${TMPDIR}" || true

# Ensure vscode user can write to .vibe-kit/innovation-kits
if [ -d "${ROOT_DIR}/.vibe-kit/innovation-kits" ]; then
  sudo chown -R vscode:vscode "${ROOT_DIR}/.vibe-kit/innovation-kits" || true
  sudo chmod -R 755 "${ROOT_DIR}/.vibe-kit/innovation-kits" || true
fi

# Initialize backend dependencies if present
echo ""
echo "Setting up Vibe Kit CLI..."
VIBEKIT_CLI_DIR="${ROOT_DIR}/vibekit-cli"
VIBEKIT_CLI_PYPROJECT="${VIBEKIT_CLI_DIR}/pyproject.toml"
if [ -d "${VIBEKIT_CLI_DIR}" ]; then
  if [ -f "${VIBEKIT_CLI_PYPROJECT}" ]; then
    echo "   Installing vibekit CLI in editable mode..."
    (
      set -euo pipefail
      cd "${VIBEKIT_CLI_DIR}"
      python3 -m pip install -e . --quiet
      echo "   vibekit CLI installed successfully!"
    )
  else
    echo "Skipping vibekit CLI setup: no pyproject.toml found."
  fi
else
  echo "Skipping vibekit CLI setup: directory not found."
fi

echo ""
echo "Setting up Python backend..."
BACKEND_DIR="${ROOT_DIR}/backend"
BACKEND_PYPROJECT="${BACKEND_DIR}/pyproject.toml"
if [ -d "${BACKEND_DIR}" ]; then
  if [ -f "${BACKEND_PYPROJECT}" ]; then
    echo "   Installing Python dependencies with uv..."
    (
      set -euo pipefail
      cd "${BACKEND_DIR}"
      # If an existing .venv points to system /usr/bin/python3 (Debian's 3.9 in some images), remove it.
      if [ -L ".venv/bin/python3" ]; then
        TARGET=$(readlink -f .venv/bin/python3 || true)
        if [[ "${TARGET:-}" == "/usr/bin/python3"* ]]; then
          echo "   Removing stale .venv bound to ${TARGET}"
          rm -rf .venv
        fi
      fi
  BACKEND_UV_CACHE_DIR="${UV_CACHE_DIR}"
  mkdir -p "${BACKEND_UV_CACHE_DIR}"
      MAX_UV_ATTEMPTS=4
      BACKEND_UV_SUCCESS=0
      BACKEND_UV_ATTEMPT=1
      while [ "${BACKEND_UV_ATTEMPT}" -le "${MAX_UV_ATTEMPTS}" ]; do
        echo "   Attempt ${BACKEND_UV_ATTEMPT}/${MAX_UV_ATTEMPTS}: uv sync..."
        if UV_CACHE_DIR="${BACKEND_UV_CACHE_DIR}" UV_PYTHON="${UV_PYTHON:-/usr/local/bin/python3}" uv sync --link-mode=copy; then
          BACKEND_UV_SUCCESS=1
          break
        fi
        echo "   uv sync attempt ${BACKEND_UV_ATTEMPT} failed."
        if [ "${BACKEND_UV_ATTEMPT}" -lt "${MAX_UV_ATTEMPTS}" ]; then
          echo "   Cleaning backend virtual environment and uv cache before retry..."
          rm -rf .venv
          rm -rf "${BACKEND_UV_CACHE_DIR}"
          mkdir -p "${BACKEND_UV_CACHE_DIR}"
          sleep 2
        fi
        BACKEND_UV_ATTEMPT=$((BACKEND_UV_ATTEMPT + 1))
      done
      if [ "${BACKEND_UV_SUCCESS}" -eq 1 ]; then
        echo "Python backend dependencies installed successfully!"
      else
        echo "WARNING: uv sync failed (backend) after ${MAX_UV_ATTEMPTS} attempts."
      fi
    )
  else
    echo "Skipping backend uv sync: no pyproject.toml found."
  fi
else
  echo "Skipping backend init: directory not found."
fi

# Initialize frontend dependencies if present
echo ""
echo "Setting up React frontend..."
FRONTEND_DIR="${ROOT_DIR}/frontend"
if [ -d "${FRONTEND_DIR}" ]; then
  echo "Installing frontend dependencies with npm..."
  (
    set -euo pipefail
    cd "${FRONTEND_DIR}"
    MAX_NPM_ATTEMPTS=4
    FRONTEND_NPM_SUCCESS=0
    FRONTEND_NPM_ATTEMPT=1
    while [ "${FRONTEND_NPM_ATTEMPT}" -le "${MAX_NPM_ATTEMPTS}" ]; do
      echo "   Attempt ${FRONTEND_NPM_ATTEMPT}/${MAX_NPM_ATTEMPTS}: npm install..."
      if npm install; then
        FRONTEND_NPM_SUCCESS=1
        break
      fi
      echo "   npm install attempt ${FRONTEND_NPM_ATTEMPT} failed."
      if [ "${FRONTEND_NPM_ATTEMPT}" -lt "${MAX_NPM_ATTEMPTS}" ]; then
        echo "   Cleaning frontend install artifacts before retry..."
        CACHE_PATH="${NPM_CACHE_DIR:-${NPM_CONFIG_CACHE:-}}"
        rm -rf node_modules .turbo .cache ${CACHE_PATH:+"$CACHE_PATH"}
        if command -v npm >/dev/null 2>&1; then
          npm cache clean --force >/dev/null 2>&1 || true
        fi
        sleep 2
      fi
      FRONTEND_NPM_ATTEMPT=$((FRONTEND_NPM_ATTEMPT + 1))
    done
    if [ "${FRONTEND_NPM_SUCCESS}" -eq 1 ]; then
      echo "Frontend dependencies installed successfully!"
    else
      echo "WARNING: npm install failed (frontend) after ${MAX_NPM_ATTEMPTS} attempts."
    fi
  )
else
  echo "Skipping frontend init: directory not found."
fi


# --- Optional: Prewarm MCP servers so they start fast in Copilot ---
echo ""
echo "Prewarming MCP servers for GitHub Copilot..."
(
  set -euo pipefail
  # Derive workspace root if running inside devcontainer default workdir
  WORKSPACE="${ROOT_DIR}"
  [ -d "$WORKSPACE" ] || WORKSPACE="${PWD%/*}"
  # Use workspace-local cache if available
  mkdir -p "${UV_CACHE_DIR}"


  # Memory & Sequential-thinking MCP servers (npx)
  if command -v npx >/dev/null 2>&1; then
    echo "   • Memory MCP server..."
    # Use a no-op command with an optional timeout to ensure termination
    if command -v timeout >/dev/null 2>&1; then TIMEOUT_CMD="timeout -k 5s 45s"; else TIMEOUT_CMD=""; fi
      bash -lc "$TIMEOUT_CMD npx -y --package @modelcontextprotocol/server-memory -c 'node -e \"process.exit(0)\"'" >/dev/null 2>&1 || true

    echo "   • Sequential-thinking MCP server..."
  mkdir -p "${UV_CACHE_DIR}"

    echo "   • Context7 MCP server..."
      bash -lc "$TIMEOUT_CMD npx -y --package @upstash/context7-mcp@latest -c 'node -e \"process.exit(0)\"'" >/dev/null 2>&1 || true
    
    echo "MCP servers prewarmed successfully!"
  fi

  # # Azure AI Foundry MCP Server (stdio)
  # if command -v uvx >/dev/null 2>&1; then
  #   echo "  - Prewarming Azure AI Foundry MCP Server (uvx)…"
  # UV_CACHE_DIR="$WORKSPACE/backend/.cache/uv" \
  #     uvx --prerelease=allow --from git+https://github.com/azure-ai-foundry/mcp-foundry.git \
  #     run-azure-ai-foundry-mcp --help >/dev/null 2>&1 || true
  # fi

) || echo "MCP prewarm completed with some warnings (non-fatal)."

echo ""
echo "Setup process completed successfully!"
echo ""
echo "============================================="
echo "   SETUP COMPLETE!"
echo "============================================="
echo ""
echo "Your Vibe Kit development environment is ready!"
echo ""
echo "Quick start:"
echo "   • Backend API will be available at: http://localhost:8010"
echo "   • Frontend will be available at: http://localhost:3010"
echo "   • All dependencies are installed and ready to use"
echo ""
echo "You can now start developing!"
echo ""
echo "============================================="
