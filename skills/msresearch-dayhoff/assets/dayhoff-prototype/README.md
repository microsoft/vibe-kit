# Dayhoff Protein Design — Research Prototype

> **Research Prototype** — sequences require experimental validation before use.

Self-hostable web application for protein sequence generation using Microsoft's [Dayhoff](https://huggingface.co/models?search=microsoft/Dayhoff) protein language models. Supports 4 model variants optimized for different downstream tasks. Run locally for development, or deploy to your own Azure subscription using the manifests in `infra/`.

## Model Variants

| Model | Params | Best For |
|-------|--------|----------|
| **UR50-BRn** | 170M | Rapid exploration & novel folds. 18× faster than 3B models. |
| **UR90** | 3B | Best overall generation quality. Highest structural plausibility. |
| **GR-HM-c** | 3B | Best zero-shot fitness prediction. Top ProteinGym scores. |
| **GR-HM** | 3B | Homolog-guided generation. Provide related sequences for family-conditioned design. |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│  React Frontend │────▶│  Flask Proxy     │──┬─▶│  AML: dayhoff-multi      │
│  (Vite + TS)    │     │  (app.py)        │  │  │  4 Dayhoff models · A100 │
│  Port 5173      │     │  Port 8000       │  │  └──────────────────────────┘
└─────────────────┘     └─────────────────┘  │  ┌──────────────────────────┐
         ▲                       ▲           └─▶│  AML: dayhoff-fold       │
         │ Easy Auth (AAD)       │ Bearer key   │  ESMFold v1 · A100       │
         │                       │              └──────────────────────────┘
```

- **Frontend:** React + TypeScript + Vite. Task presets, real protein-prefix examples, canonical amino acid validation, progress pipeline, model-aware time estimates, demo cache, FASTA/CSV/JSON export, inline 3D structure viewer (Mol*).
- **Backend proxy:** Flask app that forwards requests to two AML endpoints (generation + structure). Handles model routing, input/output validation, structured logging, toxin safety screening, and post-generation plausibility filtering.
- **Structure server:** `backend/fold/` — self-hosted ESMFold v1 packaged as a GPU container; the bundled `infra/dayhoff-fold-deployment.yml` provides a working AML manifest for a `dayhoff-fold` endpoint. Folds sequences up to 1200 aa (vs. the 400 aa cap on the public ESM Atlas API). Weights baked into the image; fp16 ESM trunk + fp32 structure module + chunked attention for memory headroom.
- **Auth:** App Service can be fronted by Easy Auth (AAD); only `/api/health` need be public. AML endpoints use key auth and are only called server-side.

## Project Structure

```
dayhoff-prototype/
├── backend/
│   ├── app.py                 # Flask proxy → Azure ML endpoint
│   ├── generator.py           # Local generation (for dev/testing)
│   ├── constants.py           # Model configs, generation modes
│   ├── exporters.py           # FASTA/CSV/JSON/TXT export with metadata
│   ├── sequence_screening.py  # Select Agent toxin safety screening
│   ├── cli.py                 # CLI interface
│   ├── requirements.txt       # Proxy dependencies
│   ├── requirements-proxy.txt # Minimal proxy deps
│   ├── test_dayhoff.py        # Tests
│   ├── test_fitness.py        # Fitness scoring tests
│   ├── test_golden_prefixes.py # Golden-prefix regression tests
│   ├── test_screening.py     # Toxin screening tests
│   ├── test_validation.py    # Amino acid validation tests
│   ├── score/                 # Generation server (AML: dayhoff-multi)
│   │   ├── score_server.py    # Inference server
│   │   ├── generator.py       # Multi-model generator
│   │   ├── constants.py       # Model registry
│   │   ├── download_models.py # HF model downloader
│   │   ├── Dockerfile         # GPU container
│   │   └── requirements.txt   # GPU dependencies
│   └── fold/                  # Structure server (AML: dayhoff-fold)
│       ├── fold_server.py     # ESMFold inference server
│       ├── download_model.py  # Bakes facebook/esmfold_v1 weights into image
│       ├── Dockerfile         # GPU container (PyTorch 2.4 + CUDA 12.4)
│       └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main app with task presets & progress
│   │   ├── api.ts             # API client with AbortSignal
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── demoCache.ts       # SessionStorage demo cache
│   │   └── components/
│   │       ├── FeatureTour.tsx
│   │       ├── GenerationProgress.tsx
│   │       ├── InfoPanel.tsx
│   │       ├── InfoTip.tsx
│   │       ├── InputView.tsx
│   │       ├── MolstarStructureViewer.tsx  # Inline 3D viewer
│   │       ├── ResultsView.tsx
│   │       └── VariantTable.tsx
│   ├── package.json
│   └── vite.config.ts
├── infra/                     # AML deployment configs (multi + fold)
│   ├── dayhoff-deployment.yml
│   ├── dayhoff-endpoint.yml
│   ├── dayhoff-fold-deployment.yml
│   └── dayhoff-fold-endpoint.yml
├── docs/                      # Deployment, model docs, feedback roadmap
├── Dockerfile                 # App Service container
├── .env.example               # Environment variable template
└── README.md
```

## Setup

### Environment Variables

Copy `.env.example` to `.env` and set:

```bash
# Generation (required)
DAYHOFF_ENDPOINT=https://your-scoring-endpoint.inference.ml.azure.com/score
DAYHOFF_API_KEY=your_key_here

# Structure prediction (optional — defaults to public ESM Atlas, 400 aa cap)
ESMFOLD_ENDPOINT=https://your-fold-endpoint.inference.ml.azure.com/score
ESMFOLD_API_KEY=your_fold_key_here
ESMFOLD_MAX_LENGTH=1200
```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py  # runs on :8000

# Frontend
cd frontend
npm install
npm run dev    # runs on :5173, proxies API to :8000
```

### Docker

```bash
docker build -t dayhoff-prototype .
docker run -p 8000:8000 \
  -e DAYHOFF_ENDPOINT=... \
  -e DAYHOFF_API_KEY=... \
  dayhoff-prototype
```

### Deployment

Deployable via Azure App Service + two AML managed online endpoints (one for generation, one for ESMFold). See `infra/` for YAMLs and `docs/` for the deployment guide.

## Features

- **4 model variants** with per-model benchmarks (pLDDT, Fitness, RFDiffusion, MotifBench)
- **Real protein-prefix examples** — Cas9, insulin, DNA polymerase, coronavirus spike, blank custom seed
- **Task presets** — Complete protein, Generate variants, De novo design, Score variants
- **Strict validation** — canonical amino acids only (rejects B, X, O, U, Z with specific messages)
- **Zero-shot fitness / likelihood scoring** with plain-language explanation
- **Inline 3D structure prediction** — self-hosted ESMFold (up to 1200 aa) rendered in a Mol* viewer per result card
- **Generation progress pipeline** — model-aware time estimates (calibrated against measured AML latency), phase steps, skeleton cards, elapsed time in result header
- **Request cancellation** for long-running generation
- **Demo cache** — one-click workflows with sessionStorage caching, gated on max_length + count to avoid stale results
- **Batch export** — FASTA, CSV, JSON, TXT with actual model name and research disclaimer
- **Safety screening** — 3-layer toxin screen (exact, subsequence, 70% identity) on inputs and outputs
- **Structured logging** — request IDs, model, mode, latency, valid/invalid counts
- **Dark/light theme**
- **Feature tour** for new users
- **Homolog input** for GR-HM model (provide related FASTA sequences)

## Related

- [Dayhoff models on Hugging Face](https://huggingface.co/models?search=microsoft/Dayhoff)
- [Dayhoff paper](https://www.biorxiv.org/content/10.1101/2025.07.21.665991v1)
