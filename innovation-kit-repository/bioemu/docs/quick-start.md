# Quick Start

Run your first protein conformational ensemble in 10 minutes.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Azure AI Foundry account

## Get Azure Credentials

1. Go to [Azure AI Foundry - BioEmu](https://ai.azure.com/explore/models/BioEmu)
2. Click **Deploy** and create a serverless endpoint
3. Copy the **Endpoint URL** and **API Key** from the deployment

## Setup

> **Important**: Use two separate terminals — one for backend, one for frontend. Keep both running.

### Terminal 1: Backend

```bash
cd assets/reference-app/server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Note**: Dependency installation may take several minutes depending on your hardware and network connection.

Configure credentials:
```bash
cd assets/reference-app/server  # if not already there
cp .env.example .env
```

Edit [`.env`](assets/reference-app/server/.env) with your credentials:
```dotenv
BIOEMU_MODE=azure
AZURE_BIOEMU_ENDPOINT=https://your-endpoint.inference.ml.azure.com/score
AZURE_BIOEMU_KEY=your_api_key
```

Start the backend (**keep this terminal open**):
```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

### Terminal 2: Frontend

Open a **new terminal** (do not run in the backend terminal):

```bash
cd assets/reference-app
npm install --legacy-peer-deps
npm start
```

**Note**: The first `npm install` and initial compilation may take several minutes. Subsequent starts are faster.

Open http://localhost:3000

## First Ensemble

1. Select **Trp-cage** example
2. Set samples to 50
3. Click **Generate Ensemble**
4. Explore the 3D viewer and analysis tabs

## Example Proteins

| Protein | Sequence | Residues |
|---------|----------|----------|
| Trp-cage | `NLYIQWLKDGGPSSGRPPPS` | 20 |
| Villin HP35 | `LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF` | 35 |

---

## Alternatives

### No Azure subscription?

Run BioEmu locally on a Linux machine with a GPU.

**Requirements:**
- Linux only (not Windows or macOS)
- Python 3.10 or 3.11 (not 3.12 — ColabFold compatibility issues)
- NVIDIA GPU strongly recommended (CPU works but 10-100x slower)

**Setup:**
```bash
pip install bioemu torch
```

**Configure `.env`:**
```dotenv
BIOEMU_MODE=local
```

First run downloads ~7GB (model checkpoint + ColabFold). See [`.env.example`](../assets/reference-app/server/.env.example) for performance estimates.

### Need help with Azure setup?

See the [Azure AI Foundry setup guide](azure-setup.md) for detailed deployment instructions.
