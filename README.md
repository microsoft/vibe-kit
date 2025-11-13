# Microsoft Research Vibe Kit

The Microsoft Research Vibe Kit is a customized vibe coding environment to enable faster prototyping and integration of Microsoft Research innovations using GitHub Copilot inside Visual Studio Code. 

This repository provides a [Dev Container](https://containers.dev) with starting set of instructions, recommended VS Code settings, some initial MCP servers, and boilerplate projects for a Python API `backend` and Vite + React `frontend`.


## Quick Start

### Prerequisites

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) must be installed and running. 
The Dev Container runs inside a Docker container and requires a Docker server to run. 
2. Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) Visual Studio Code extension.

### Vibe Coding with the Vibe Kit

1. Clone the repo locally
2. Open the cloned repo folder in Visual Studio Code
3. Reopen the project in the Dev Container
   1. CTRL+SHIFT+P to Show All Commands for VS Code
   2. Search for and select "Dev Containers: Reopen in Container"
   3. The window will reopen. You should see "Dev Container: Vibe Kit" in the lower left corner of the VS Code window
4. Wait for the Docker image to download and the initialization script to complete
   1. View initialization status by opening the Dev Container log. On the far right side of the VS Code status bar at the bottom of the window, there should be a notification shown (if not, select the notifications (bell) icon to see): "Connecting to Dev Container (show log)". The notification link will open a terminal window that shows the status.
   2. Wait until you see "SETUP COMPLETE!" 
5. Install an Innovation Kit
   1. Open a new terminal window (CTRL+SHIFT+`)
   2. Type `vibekit install <innovation-kit>` (e.g. `vibekit install aurora`)
   3. **Reload VS Code window** (Ctrl+Shift+P → "Developer: Reload Window") to activate custom chat modes
6. Open GitHub Copilot Chat in Agent mode (CTRL+SHIFT+I)
7. Choose your preferred model (we like GPT-5-Codex and Claude Sonnet 4.5 at the moment)
8. Ask GitHub Copilot about your chosen innovation or to help you vibe code your prototype


## `vibekit` CLI

The Vibe Kit includes a CLI tool (`vibekit`) for managing innovation kits. To install an innovation kit:

```bash
vibekit list                # View available innovation kits
vibekit install <kit-name>  # Install an innovation kit
```

**After installation:** Reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window") to activate custom chat modes.

Installing an innovation kit with the CLI will:
- Copy the innovation kit's files into `.vibe-kit/innovation-kits/<kit-name>`
- Stage any customizations (instructions, chat modes, and prompts) into `.vibe-kit`
- Update your local innovation kit registry in `.vibe-kit/innovation-kits.json`

### Available commands
  - `vibekit init` – Initialize a new Vibe Kit workspace
  - `vibekit list` – Show available or installed kits
  - `vibekit install <kit-name>` – Install an innovation kit
  - `vibekit update <kit-name>` – Update an installed kit
  - `vibekit uninstall <kit-name>` – Remove an installed kit

For more details, see `vibekit-cli/README.md`.
