# Prototype Expansion Guide

The reference app (`assets/dayhoff-prototype/`) is a multi-tier prototype: a Flask proxy backend, an optional self-hosted Azure ML score server, an optional self-hosted ESMFold structure server, and a Vite + React + TypeScript frontend. This guide covers common ways to extend it.

## Architecture Overview

```
dayhoff-prototype/
├── backend/                    # Flask proxy (port 8000)
│   ├── app.py                  # Routes, validation, model routing, screening
│   ├── generator.py            # Local generation (dev/testing fallback)
│   ├── constants.py            # Model configs, generation modes
│   ├── exporters.py            # FASTA / CSV / JSON / TXT export
│   ├── sequence_screening.py   # 3-layer Select Agent toxin screen
│   ├── cli.py                  # Command-line interface
│   ├── requirements.txt        # Full dev dependencies
│   ├── requirements-proxy.txt  # Minimal proxy-only dependencies
│   ├── score/                  # Generation server (deployable to AML: dayhoff-multi)
│   │   ├── score_server.py     # Flask inference server (port 5001)
│   │   ├── generator.py        # Multi-model generator
│   │   ├── constants.py        # Model registry
│   │   ├── download_models.py  # HF model downloader
│   │   ├── Dockerfile          # GPU container
│   │   └── requirements.txt
│   └── fold/                   # Structure server (deployable to AML: dayhoff-fold)
│       ├── fold_server.py      # ESMFold inference server
│       ├── download_model.py   # Bakes facebook/esmfold_v1 weights into image
│       ├── Dockerfile          # GPU container
│       └── requirements.txt
├── frontend/                   # Vite + React + TypeScript (port 5173)
│   └── src/
│       ├── App.tsx             # Main app with task presets and progress pipeline
│       ├── api.ts              # API client with AbortSignal
│       ├── types.ts            # TypeScript interfaces
│       ├── demoCache.ts        # SessionStorage demo cache
│       └── components/         # MolstarStructureViewer, GenerationProgress, etc.
├── infra/                      # Azure ML deployment YAMLs
│   ├── dayhoff-deployment.yml  # Multi-model generation deployment
│   ├── dayhoff-endpoint.yml
│   ├── dayhoff-fold-deployment.yml
│   └── dayhoff-fold-endpoint.yml
├── examples/
│   └── example_sequences.json
├── Dockerfile                  # App Service container for the proxy + frontend
├── .env.example
└── README.md
```

The proxy backend (`backend/app.py`) is the integration point: it validates inputs, routes by `model` field, runs toxin screening, calls either a remote AML endpoint or a local `score/` server, and returns standardized responses to the frontend.

> **CLI alternative:** `backend/cli.py` is a headless entry point — `python cli.py --prompt M --num 5 --length 80 --fitness --save` from `backend/` runs generation, validation, optional fitness scoring, and optional save without standing up the Flask layer. Useful for batch jobs and scripted runs.
>
> **Executable usage examples:** `backend/test_*.py` and `backend/score/test_local.py` exercise every public path in `generator.py`, `exporters.py`, `sequence_screening.py`, and the score server. Read them as ground-truth examples for each module's API.

## When to Expand the Reference App

**Keep the reference app as-is if:**
- You need interactive generation with immediate visual feedback and 3D structure preview.
- Your workflow fits: prompt → generate → score → export → external tools.
- You're prototyping with up to a few hundred sequences per session.
- You want a turnkey demo for stakeholders.

**Extend the reference app when:**
- You need batch processing of many prompts in one job.
- You want custom scoring beyond log-likelihood (domain-specific filters, structure-based scores, downstream model output).
- You need additional API endpoints for programmatic access (e.g., a webhook for an external pipeline).
- You want to integrate persistent storage (database, blob storage) for sequences and metadata.
- You need authentication or multi-user support beyond the App Service Easy Auth pattern in `Dockerfile`.

## Pattern 1: Add New API Endpoints

Add new routes in `backend/app.py`. The proxy already validates inputs and runs screening — wire your new endpoint into the same helpers:

```python
# backend/app.py
@app.route('/api/batch', methods=['POST'])
def batch_generate():
    data = request.get_json()
    prompts = data.get('prompts', [])
    model_name = data.get('model', '170m-UR50-BRn')
    results = []

    for prompt in prompts:
        # Re-use the existing proxy helper that calls AML or local score server
        sequences = call_score_endpoint(
            prompt=prompt,
            model=model_name,
            num_sequences=data.get('num_sequences', 3),
            max_length=data.get('max_length', 100),
        )
        # Re-use the existing screening pass
        screened = screen_sequences(sequences)
        results.extend(screened)

    return jsonify({'sequences': results})
```

## Pattern 2: Add Custom Scoring Filters

The score server returns model log-likelihoods. Layer your own scoring on top in `backend/app.py` or a new module:

```python
def calculate_hydrophobicity(sequence: str) -> float:
    hydrophobic = sum(1 for aa in sequence if aa in "GAVLIPFWM")
    return hydrophobic / max(len(sequence), 1)

def filter_sequences(
    sequences: list[str], min_hydro: float = 0.3, max_hydro: float = 0.6
) -> list[str]:
    return [
        seq for seq in sequences
        if min_hydro <= calculate_hydrophobicity(seq) <= max_hydro
    ]
```

For structure-based filters, call the bundled fold server (`backend/fold/`) and threshold on pLDDT.

## Pattern 3: Batch Processing Mode

For overnight runs across many prompts, add a long-running endpoint that streams progress and persists results:

```python
import pandas as pd
from datetime import datetime

@app.route('/api/batch-csv', methods=['POST'])
def batch_csv():
    prompts = request.json.get('prompts', [])
    model_name = request.json.get('model', '170m-UR50-BRn')
    rows = []

    for prompt in prompts:
        sequences = call_score_endpoint(prompt=prompt, model=model_name, num_sequences=10)
        for seq in sequences:
            rows.append({
                'timestamp': datetime.utcnow().isoformat(),
                'prompt': prompt,
                'model': model_name,
                'sequence': seq,
                'length': len(seq),
            })

    out = f'/data/batch_{datetime.utcnow():%Y%m%dT%H%M%S}.csv'
    pd.DataFrame(rows).to_csv(out, index=False)
    return jsonify({'status': 'complete', 'rows': len(rows), 'file': out})
```

## Pattern 4: Database Integration

The frontend's `demoCache.ts` ships precomputed real Dayhoff outputs for four prompts × four model variants — that's what powers **Path A (cached demo)** in [`quick-start.md`](quick-start.md), letting users see real Dayhoff outputs in the UI with no GPU and no backend. It's also a sessionStorage layer for live runs in Path B/C.

For your own use case (persistent generation history, audit trails, multi-user sharing), add a backend endpoint that writes to SQLite, Postgres, or Azure Cosmos DB rather than overloading the demo cache:

```python
import sqlite3
from contextlib import closing

DB_PATH = '/data/dayhoff.db'

def init_db():
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT,
                model TEXT,
                sequence TEXT,
                fitness REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()

@app.route('/api/generate-and-store', methods=['POST'])
def generate_and_store():
    data = request.get_json()
    sequences = call_score_endpoint(**data)
    with closing(sqlite3.connect(DB_PATH)) as conn:
        for seq in sequences:
            conn.execute(
                'INSERT INTO sequences (prompt, model, sequence) VALUES (?, ?, ?)',
                (data.get('prompt'), data.get('model'), seq),
            )
        conn.commit()
    return jsonify({'sequences': sequences})
```

## Pattern 5: Real-Time Validation Pipeline

Stack additional validation on top of the bundled toxin screen and amino-acid validator:

```python
def validate_sequence(sequence: str) -> tuple[bool, dict]:
    checks = {
        'length_ok': 20 <= len(sequence) <= 500,
        'has_start_methionine': sequence.startswith('M'),
        'no_ambiguous_aas': set(sequence) <= set('ACDEFGHIKLMNPQRSTVWY'),
    }
    return all(checks.values()), checks
```

For pre-export validation pipelines (e.g., BLAST against a hazard database, structure prediction sanity check), wire them into a dedicated `/api/export-check` endpoint that the frontend gates on before allowing FASTA download.

## Deploying Your Extensions

The bundled `Dockerfile` builds the proxy + frontend into a single App Service container. The bundled `backend/score/Dockerfile` and `backend/fold/Dockerfile` build the GPU inference containers for Azure ML. The `infra/*.yml` files are working AML deployment definitions you can adapt.

For a managed-online deployment of your extended `score/` server:

```bash
az ml online-endpoint create -f infra/dayhoff-endpoint.yml
az ml online-deployment create -f infra/dayhoff-deployment.yml
```

For App Service deployment of the proxy + frontend:

```bash
docker build -t <your-acr>.azurecr.io/dayhoff-prototype:dev .
docker push <your-acr>.azurecr.io/dayhoff-prototype:dev
az webapp config container set --name <your-webapp> --resource-group <rg> \
  --docker-custom-image-name <your-acr>.azurecr.io/dayhoff-prototype:dev
```

> Easy Auth on the App Service is recommended for any deployment that calls a real AML endpoint; do not expose the proxy publicly without auth.

## When to Build from Scratch

Consider a custom application when:

- You need tight integration with existing enterprise systems that don't fit the React frontend.
- You're building a production service with strict SLAs and need fine-grained control over scaling and failover.
- You need streaming generation, multi-model ensemble comparison, or interactive exploration UIs that don't fit the current `App.tsx` pattern.

For most prototyping scenarios, **extending the reference app is faster and more maintainable** than building from scratch.
