# Microsoft Research Vibe Kit

The easiest way to incorporate innovations from Microsoft Research into your development projects.

The Microsoft Research Vibe Kit creates an environment inside a [Developer Container](https://containers.dev/) that kick-starts your ability to use Visual Studio Code with GitHub Copilot.

Innovation Kits specific to different Microsoft Research projects can be added to the Vibe Kit to enable GitHub Copilot to answer questions about the research and to know how to integrate the project's innovations into either a new prototype web site or your existing software project.


## Quick start (VS Code Dev Container + Launch)

### Prerequisites
1) Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running. This is required to run the Dev Container.
2) Ensure you have the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) Visual Studio Code extension installed.

### Setup
1) Open the folder containing this `README.md` file in VS Code.
2) Reopen the Vibe Kit in the Dev Container.
    1) **CTRL+SHIFT+P** (**⌘+SHIFT+P**) → "**Dev Containers: Reopen in Container**"
    2) Wait for the container to build and start (which will take a few minutes the first time). Once the Docker image is downloaded, tools are installed, and the container is launched, the setup will automatically run the script `.devcontainer/postCreateCommand.sh` which will:
        1. Verify proper tool installation - Confirms all development tools are available
    2. Show version information - Shows versions of key tools (Python, Node.js, uv, npm, etc.)
        3. Install `backend` Python packages - Installs Python dependencies via `uv`
        4. Install `frontend` Node.js modules - Installs Node.js dependencies via `npm`
        5. Install MCP servers and ensure that they are initialized - Prepares GitHub Copilot MCP servers for faster initial Copilot chat startup
    3) **Look for the clear "SETUP COMPLETE!" banner in the terminal to know when everything is ready.**
3) Run and view the boilerplate website
    1) Open the "**Run and Debug**" panel in VS Code (**CTRL+SHIFT+D** / **⌘+SHIFT+D**) and select the "**Backend + Frontend (Debug)**" configuration at the top of the panel.
    2) Start both the front end and backend projects in the debugger. Two options:
        1) Press **F5**
        2) OR Click the green play button next to "**Backend + Frontend (Debug)**"
    3) Open the boilerplate website in a browser with this URL: http://localhost:3010
    4) To stop debugging, you can use the debugging toolbar that appears when debugging or use **SHIFT+F5** (**⌘+SHIFT+F5**))

### Innovation Kits
Once the Vibe Kit is installed, one or more Microsoft Research Innovation Kits can be added to the project. Innovation Kits add knowledge to GitHub Copilot for specific Microsoft Research projects.

***INSTRUCTIONS TO BE ADDED***


### Vibe Code
Once you have the Vibe Kit open in its dev container and have verified that the boilerplate frontend and backend projects work, it's time to start vibing!

1) Use **CTRL+SHIFT+I** (**⌘+SHIFT+I**) to open GitHub Copilot's "**Agent**" mode. This works whether the Chat window is already visible or not.
2) Select your model of choice. If you would like a recommendation, our favorites at the moment are:
    - **GPT-5-Codex (Preview)** *This is a model that uses premium requests  and requires enabling in your [GitHub user account's Copilot settings](https://github.com/settings/copilot/features); see your premium requestusage [here](https://github.com/settings/billing/usage)*
    - **Claude Sonnet 4** *Another premium model*
    - **GPT-5 mini** *A model that does not use premium requests but still subject to Copilot usage limits*
3) In the GitHub Copliot Chat panel, chat with Copilot
    - Ask Copilot to build a prototype for you. Or a
    - Ask about the technology behind a Microsoft Research project from an innovation kit that you have installed.
4) Vibe!

#### Notes
- API runs at [http://localhost:8010](http://localhost:8010) (FastAPI). You can see the Swagger documentation at [http://localhost:8010/docs](http://localhost:8010/docs)
- Ports are auto-forwarded by the dev container and are pinned to 3010 and 8010 on the host.

<br>
<br>

--- 

<br>

## Vibe Kit Contents

### Dev Container

Dev Container contents are defined in the `.devcontainer/` directory:
- Base Docker image: `mcr.microsoft.com/devcontainers/python:dev-3.12-bullseye` with Node 20.x and global `npm`.
- VS Code Extensions & settings: Python, Pylance, Jupyter, ESLint, Prettier, Ruff (Python linting and formatter), GitHub Copilot Chat, Markdown.
- Ports forwarded: 3010 (`frontend/` web site), 8010 (`backend/` Python API). These are required on the host (no remap). Other ports notify on access.
- Volumes: `uv-cache` at `/home/vscode/.cache/uv`, `npm-cache` at `/home/vscode/.npm-cache`.
- Post-create: ensures Astral `uv` is installed, prints tool versions, runs `npm install` in `frontend/`, and `uv sync` in `backend/`.
- Proxy support via build args `HTTP_PROXY/HTTPS_PROXY/NO_PROXY` if set locally.


### VS Code Tasks and Launch configs

Tasks (`.vscode/tasks.json`):
- Backend: uv sync — sync Python dependencies in `backend/`.
- Frontend: npm install — install JS dependencies in `frontend/`.

Launch (`.vscode/launch.json`):
- Python: **FastAPI (uvicorn)**
	- Runs `uvicorn main:app --reload` in `backend/` with `PYTHONPATH` set.
	- Pre-launch task: Backend: uv sync.
- Node: **Vite Dev Server (Debug)**
    - Runs `npm run dev -- --logLevel info` in `frontend/` on port 3010.
    - Env: `VITE_API_URL=http://localhost:8010`.
    - Pre-launch task: Wait for backend.
    - Automatically opens your browser when the server starts.
- Compound: **Backend + Frontend (Debug)**
    - Starts both the Python API and Vite web site configurations


## Manual run via CLI (alternative to Run and Debug)

### Backend (FastAPI)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

Check: http://localhost:8010/helloworld

### Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3010

The Vite dev server proxies `/api` requests to `http://localhost:8010` as configured in `frontend/vite.config.ts`.
