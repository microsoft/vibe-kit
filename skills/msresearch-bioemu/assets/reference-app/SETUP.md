# Setup

See [quick-start.md Path B](../../docs/quick-start.md) for the full walkthrough.

## Prerequisites

- Linux or WSL2 with NVIDIA GPU
- Python 3.10+
- Node.js 18+
- Docker (recommended for `score/` server) or bare-metal Python

## Environment Variables

Copy `.env.example` to `.env` at the project root:

```bash
cp .env.example .env
```

The defaults point at the local `score/` server (`http://localhost:5001/score`). No edits needed for local mode.

| Variable | Description |
|---|---|
| `AZURE_BIOEMU_ENDPOINT` | Score server URL (default: local) |
| `AZURE_BIOEMU_KEY` | API key (any non-empty string for local) |
| `FLASK_PORT` | Proxy backend port (default: 5000) |
| `AZURE_OPENAI_*` | Optional — AI copilot credentials |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/predict` | POST | Generate ensemble from sequence |
| `/api/predict-uniprot` | POST | Generate ensemble from UniProt ID |
| `/api/uniprot-info/<id>` | GET | Protein info from UniProt |
| `/api/alphafold-structure/<id>` | GET | AlphaFold structure |
| `/api/analyze-trajectory` | POST | MDTraj analysis |
