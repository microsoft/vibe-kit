# MatterGen Prototype Web App

A FastAPI + React web app that wraps MatterGen and MatterSim into an interactive UI: pick property prompts, generate candidate crystals, view their 3D structures, and (optionally) run MatterSim evaluation — all without writing CLI commands or Hydra configs.

> **Fastest way to play with MatterGen.** The bundled demo mode works without any Azure setup at all.

## Two ways to run

### Path A — Demo mode (no Azure, ~5 minutes)

What you get:
- Full UI, structure browser, 3D crystal viewer
- 9 property prompts (band gap, bulk modulus, magnetic density, HHI score, space group, chemical system, plus multi-property combinations)
- Each generation request returns 2 pre-bundled CIF structures matching the requested properties

What it can't do:
- No real MatterGen sampling — structures are sampled at random from `backend/data/demo_data/<property>/`
- No real MatterSim evaluation

### Path B — Hosted mode (Azure AI Foundry, real generation + evaluation)

What you get:
- Real MatterGen generation via your deployed Azure endpoint
- Real MatterSim evaluation via your deployed Azure endpoint
- All UI features above

Prerequisites:
- Deployed MatterGen endpoint in Azure AI Foundry (see [quick-start.md §5](./quick-start.md#5-hosted-inference-azure-ai-foundry))
- Deployed MatterSim endpoint (see "Deploying MatterSim to Azure" below)

## Prerequisites

- **Python 3.10+** (3.12 recommended — matches the Docker image)
- **Node 18+** with `npm`
- (Path B only) Azure AI Foundry endpoints for MatterGen and MatterSim, plus either Entra credentials (`az login`) or API keys

## Setup

### 1. Configure the backend

```bash
cd assets/prototype/backend
cp .env.template .env
```

Edit `.env`:

```env
# Path A (demo mode): leave URLs blank — frontend demo toggle handles fallback
MATTERGEN_ENDPOINT_URL=
MATTERSIM_ENDPOINT_URL=

# Path B (hosted): fill in your scoring URLs
# MATTERGEN_ENDPOINT_URL=https://<your-endpoint>.<region>.inference.ml.azure.com/score
# MATTERGEN_USE_ENTRA_AUTH=true
# MATTERSIM_ENDPOINT_URL=https://<your-mattersim-endpoint>.<region>.inference.ml.azure.com/score
# MATTERSIM_USE_ENTRA_AUTH=true

APP_MODE=research
```

### 2. Install and run the backend

Pick one of the following:

```bash
# Option A: pyproject.toml (pip)
pip install -e .
uvicorn main:app --reload --port 8010

# Option B: Pipfile (matches the Docker image, Python 3.12)
pipenv install
pipenv run uvicorn main:app --reload --port 8010
```

The backend listens on `http://localhost:8010` by default. The Vite dev server proxies `/api` to that port (`vite.config.ts:14`).

### 3. Install and run the frontend

In a second terminal:

```bash
cd assets/prototype/frontend
npm install
npm run dev
```

Open `http://localhost:3010`.

## Walkthrough

1. The **Demo mode** toggle in the top nav is ON by default in `research` mode.
2. Pick a property prompt (e.g., bulk modulus = 400, or magnetic density + HHI score).
3. Click **Generate**.
   - Demo mode (or hosted mode with a failed Azure call): backend's `/api/demo/generate` returns 2 CIFs from the matching `backend/data/demo_data/<property>/` folder.
   - Hosted mode: backend posts to your MatterGen endpoint and downloads the returned artifact.
4. Click any structure to open the 3D viewer (react-three-fiber).
5. (Hosted mode) Trigger MatterSim evaluation to see stability, energy-above-hull, novelty, and uniqueness metrics merged onto each structure.

## App modes

`APP_MODE` (in `backend/.env`) gates which property prompts are surfaced and whether the demo toggle is available:

| Mode | Property prompts | Demo toggle |
|---|---|---|
| `research` (default) | All 9, including `band_gap`, `bulk_modulus`, `chemical_system`, `hhi_score`, `magnetic_density`, `space_group`, plus multi-property combos | Visible, defaults ON |
| `production` | Adds `energy_above_hull` and `chemical_system_energy_above_hull`; restricts UI for external demos | Force-disabled |

## Docker

Both `backend/Dockerfile` and `frontend/Dockerfile` are present.

- Backend image listens on **port 5000** (not 8010) and uses Pipfile + Python 3.12.
- Frontend image is built with Vite and served via nginx (see `frontend/nginx.conf.template`).

There's no top-level `docker-compose.yml`; build and run them separately, or wire them into your own compose/k8s setup. If you change the backend port, update CORS allowlist in `backend/main.py:37` and the Vite proxy target in `frontend/vite.config.ts:14`.

## Deploying MatterSim to Azure

The skill's main docs treat MatterSim as a local install (`pip install mattersim`), but the prototype's hosted mode requires a deployed Azure endpoint. There is no first-party Azure AI Foundry catalog entry for MatterSim today — you deploy it as a custom Azure ML online endpoint:

1. Wrap MatterSim in a scoring script that accepts a CIF/EXTXYZ payload and returns relaxation results + metrics. See the [MatterSim repo](https://github.com/microsoft/mattersim) for the inference API.
2. Build a container image with MatterSim and your scoring script (use `MatterSim-v1.0.0-1M.pth` for a smaller, faster endpoint or `-5M.pth` for higher fidelity).
3. Create a custom managed online endpoint in your Azure ML workspace and deploy the image.
4. Set `MATTERSIM_ENDPOINT_URL` (and optionally `MATTERSIM_USE_ENTRA_AUTH=false` with an API key) in `backend/.env`.

If you don't need real MatterSim evaluation in the UI, stay in demo mode — the rest of the app works without a MatterSim endpoint.

## Troubleshooting

- **Frontend can't reach backend.** Confirm backend is on port 8010 (or update `vite.config.ts:14` and the CORS list in `main.py:37`).
- **Demo mode keeps returning the same 2 structures.** That's expected — `load_demo_structures` randomly samples 2 CIFs from the matching property folder under `backend/data/demo_data/`. Add more CIFs there to expand the pool.
- **Hosted mode returns 401/403.** Confirm Entra credentials (`az login` in the same shell as `uvicorn`) or set `MATTERGEN_USE_ENTRA_AUTH=false` and use the endpoint's primary key.
- **`pymatgen` install fails.** Use Python 3.10–3.12; older or newer Pythons may not have wheels.

## Where to go next

- [`quick-start.md`](./quick-start.md) — local CLI path with Hydra configs and direct `mattergen-generate` invocation
- [`application-patterns.md`](./application-patterns.md) — six end-to-end scenarios you can demo through this UI
- [`data-integration.md`](./data-integration.md) — fine-tune adapters for new properties so the hosted endpoint serves them
