# BioEmu Protein Analysis Platform

> This app lives at `skills/msresearch-bioemu/assets/reference-app/` in the [microsoft/vibe-kit](https://github.com/microsoft/vibe-kit) repo. See the [parent skill quick-start](../../docs/quick-start.md) for full setup instructions.

Interactive web app for protein conformational ensemble analysis using Microsoft Research's BioEmu model.

## Features

- **3D Visualization**: Molstar viewer with trajectory playback
- **Ensemble Analysis**: RMSD, RMSF, radius of gyration, secondary structure
- **Structure Comparison**: Compare with AlphaFold or custom PDB references
- **PCA Analysis**: Conformational landscape visualization
- **Data Export**: Download PDB, XTC, and analysis results

## Architecture

```
reference-app/
+-- score/              # BioEmu inference server (Flask, runs on :5001)
¦   +-- Dockerfile      # GPU container for inference
¦   +-- score_server.py # /score and /ready endpoints
¦   +-- requirements.txt
+-- server/             # Proxy backend (Flask, runs on :5000)
¦   +-- app.py          # Routes requests to score/ server
¦   +-- ...             # Analysis, copilot, UniProt integration
+-- src/                # React frontend (runs on :3000)
¦   +-- App.js
¦   +-- components/     # Molstar viewer, analysis pages, copilot
¦   +-- services/       # API clients
+-- .env.example        # Environment config (local-first defaults)
+-- package.json        # Node.js dependencies
+-- tailwind.config.js  # CSS config
```

## Quick Start

See [quick-start.md Path B](../../docs/quick-start.md) for the full walkthrough. Summary:

```bash
# Terminal 1: score/ server (GPU inference on :5001)
cd score
docker build -t bioemu-score:local .
docker run --gpus all --rm -p 5001:5001 -v bioemu-cache:/app/colabfold_cache bioemu-score:local

# Terminal 2: proxy backend (:5000)
cd ../
cp .env.example .env
cd server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py

# Terminal 3: frontend (:3000)
cd ../
npm install --legacy-peer-deps
npm start
```

Open http://localhost:3000, select a protein, click Generate Ensemble.

## Environment Variables

Copy `.env.example` to `.env` at the app root. Key variables:

| Variable | Default | Description |
|---|---|---|
| `AZURE_BIOEMU_ENDPOINT` | `http://localhost:5001/score` | Score server URL (local or Azure) |
| `AZURE_BIOEMU_KEY` | `local-dev` | API key (any non-empty string for local) |
| `FLASK_PORT` | `5000` | Proxy backend port |
| `AZURE_OPENAI_*` | (optional) | For AI copilot; falls back to canned responses without |

## Example Proteins

| Protein | Sequence | Residues |
|---------|----------|----------|
| Trp-cage | `NLYIQWLKDGGPSSGRPPPS` | 20 |
| Villin HP35 | `LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF` | 35 |

## Troubleshooting

See [troubleshooting.md](../../docs/troubleshooting.md).

## Feedback

File issues at [microsoft/vibe-kit](https://github.com/microsoft/vibe-kit/issues).
