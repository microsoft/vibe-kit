# MatterGen + MatterSim Prototype Web App

A FastAPI backend + React frontend for interactive MatterGen generation and MatterSim evaluation. Includes a bundled demo mode that works without any Azure deployment.

## Run it

See [`docs/prototype.md`](../../docs/prototype.md) in the parent skill for setup, Azure config, walkthrough, and troubleshooting.

## Layout

- `backend/` — FastAPI app. Python 3.10+ via `pyproject.toml`, or Python 3.12 via `Pipfile` (matches the Docker image).
- `frontend/` — React + Vite + react-three-fiber. Node 18+, see `package.json`.
- `backend/data/demo_data/` — Pre-generated CIFs that power demo mode (9 property folders).
- `backend/.env.template` — Backend configuration template (MatterGen + MatterSim endpoint URLs, Entra auth toggle, app mode).
- `mattergen/`, `mattersim/` — Vendored upstream source for reference.

## Modes

- **`research`** (default `APP_MODE`): all 9 property prompts available, demo-mode toggle visible in the UI.
- **`production`**: limited property set, demo mode force-disabled. Set `APP_MODE=production` in `backend/.env` for external-facing deployments.
