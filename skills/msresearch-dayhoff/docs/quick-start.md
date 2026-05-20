# Dayhoff Quick Start

Run the Dayhoff reference app locally and generate your first protein sequences. Three paths:

- **Path A — Cached demo (no GPU, no backend):** Just the frontend (`npm run dev`). The bundled `demoCache.ts` ships precomputed real Dayhoff outputs for four prompts (Cas9, insulin, DNA polymerase, SARS-CoV-2 spike) across all four model variants. One terminal. Best for a first look on a laptop without GPU access or before standing up any backend.
- **Path B — Proxy mode (fastest live inference):** Backend proxy + frontend, calling a remote Azure ML endpoint for inference. Two terminals, no local model load. Best for first-time setup with live arbitrary-prompt generation.
- **Path C — Fully local:** Add a local `score/` server that loads Dayhoff models on your GPU. Three terminals. Best for offline work, custom variants, or when you don't have an AML endpoint.

## Prerequisites

- **Windows users:** Run everything inside WSL2 (Ubuntu 22.04 recommended). Install WSL2 per [Microsoft's guide](https://learn.microsoft.com/windows/wsl/install), then install the NVIDIA driver on the **Windows host** (not inside WSL) per [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html). Verify with `nvidia-smi` from inside your WSL distro before continuing. Native Windows / PowerShell is not supported.
- Linux (or WSL2) with a CUDA-capable NVIDIA GPU for Path C. Path B only needs network access to your AML endpoint.
- Python 3.10+ for the backend.
- Node.js 18+ for the frontend.

> **First-run weight download (Path C):** ~1 GB for 170M, ~25 GB for all four variants. Slow — do not interrupt. See SKILL.md operating rules for HF auth and `HF_TRANSFER` tuning.
>
> **Biosecurity reminder:** Read [`responsible-use.md`](responsible-use.md) before exporting or sharing any generated sequence. The bundled toxin screen (`backend/sequence_screening.py`) is a guardrail, not a guarantee.

---

## Step 0: Verify your GPU (Path C only)

```bash
nvidia-smi
```

If this fails or shows no GPU and you only have CPU, fall back to Path A (cached demo, four bundled prompts) or Path B (live but proxied to a remote AML endpoint). The 3B variants are unusably slow on CPU.

> **Windows users:** run `nvidia-smi` from **inside your WSL2 distro**, not from PowerShell. If it works in PowerShell but not WSL2, the driver was installed in the wrong place — see [`troubleshooting.md`](troubleshooting.md).

---

## Path A — Cached Demo (frontend only, no GPU, no backend)

The fastest way to see Dayhoff outputs in the UI: run only the frontend. The bundled `frontend/src/demoCache.ts` ships precomputed real Dayhoff outputs (sequences + fitness scores) for four prompts × four model variants (16 entries total, generated against `dayhoff-score:v7` at temperature 1.0, min_p 0.05, max_length 512, num_sequences 3). When the backend is offline, the four example chips return their cached results instantly.

### A.1 Start the frontend

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/frontend
npm install
npm run dev   # listens on :5173
```

Open http://localhost:5173. The connection badge will show **Backend offline · cached examples only** — that's expected.

### A.2 Click an example chip

The four bundled prompts:

- **Cas9** (N-terminal seed)
- **Insulin** (preproinsulin prefix)
- **DNA polymerase** (N-terminal seed)
- **SARS-CoV-2 spike** (S-protein prefix)

Click any one. The UI loads the seed, marks the run **Demo seed · cached result**, and Generate returns the precomputed completion (with fitness scores and inline 3D structure via Mol\*) immediately.

### A.3 Limits of Path A

- Editing the prompt or selecting a non-cached `(prompt, model)` combo will say **Backend offline** — no live inference.
- Custom prompts, custom lengths, batch jobs, motif scaffolding, and fitness scoring on user-supplied sequences all need a backend → upgrade to Path B or Path C.
- The cache lives in source (`demoCache.ts`) plus a session-scoped sessionStorage layer — no persistence across browser sessions for live runs.

---

## Path B — Proxy Mode (remote AML endpoint)

The proxy at `backend/app.py` forwards requests to a `dayhoff-multi` AML endpoint and a `dayhoff-fold` ESMFold endpoint (or the public ESM Atlas API). The frontend talks to the proxy. No local model load.

> Don't have an AML endpoint yet? See the AML deployment section in [`prototype-expansion.md`](prototype-expansion.md#deploying-your-extensions) — the bundled `infra/*.yml` files are working endpoint + deployment definitions you can adapt.

### B.1 Configure `.env`

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype
cp .env.example .env
```

Edit `.env` and set your endpoint URL and key:

```bash
DAYHOFF_ENDPOINT=https://your-endpoint.<your-region>.inference.ml.azure.com/score
DAYHOFF_API_KEY=your_api_key_here
# Optional: structure prediction (defaults to public ESM Atlas, 400 aa cap)
ESMFOLD_ENDPOINT=https://your-fold-endpoint.<your-region>.inference.ml.azure.com/score
ESMFOLD_API_KEY=your_fold_api_key_here
```

> The proxy reads these exact variable names — keep them as-is. Never paste keys into chat; only into `.env`.

### B.2 Start the proxy backend (Terminal 1)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements-proxy.txt
python app.py   # listens on :8000
```

Confirm it's healthy:

```bash
curl http://localhost:8000/api/health
```

### B.3 Start the frontend (Terminal 2)

> Open a **second terminal**.

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/frontend
npm install
npm run dev   # listens on :5173, proxies API to :8000
```

Open http://localhost:5173.

### B.4 Generate your first sequences

1. Pick a task preset (e.g., **Generate variants** or **De novo design**).
2. Pick a model variant — `170m-UR50-BRn` for fastest iteration, `3b-UR90` for highest quality, `3b-GR-HM-c` for fitness scoring. See [`about-dayhoff.md`](about-dayhoff.md) for the picker.
3. (Optional) Provide a starting prompt sequence or a homolog FASTA (homologs only work for `3b-GR-HM-c` and `3b-GR-HM`).
4. Click **Generate**.
5. Inspect results, fitness scores, and inline 3D structure (Mol* viewer).

---

## Path C — Fully Local (self-hosted score server)

Adds a local Flask `score/` server that loads Dayhoff models on your GPU. The proxy backend points at it instead of an AML endpoint. Frontend works unchanged.

### C.1 Run the local `score/` server (Terminal 1)

> Keep this terminal running. Don't run other commands in it.

**Recommended: Docker** (Docker Desktop on Windows includes GPU support; Linux needs `nvidia-container-toolkit`):

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/backend/score
docker build -t dayhoff-score:local .
docker run --gpus all --rm -p 5001:5001 \
  -v dayhoff-cache:/root/.cache/huggingface \
  -e DAYHOFF_LOAD_ALL=0 \
  dayhoff-score:local
```

The named volume `dayhoff-cache` persists the HF weight cache across container restarts. Set `DAYHOFF_LOAD_ALL=1` to load all four variants (~20 GB GPU RAM); leave it `0` to load only the 170M variant for development.

**Bare-metal fallback:**

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/backend/score
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python score_server.py
```

Confirm readiness from another terminal:

```bash
curl http://localhost:5001/ready
```

Returns `200` once the model is loaded. The first start takes a while because of the weight download.

### C.2 Point the proxy at the local server

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype
cp .env.example .env
```

Edit `.env`:

```bash
DAYHOFF_ENDPOINT=http://localhost:5001/score
DAYHOFF_API_KEY=local-dummy-key   # any non-empty string; score/ doesn't enforce auth
```

### C.3 Start the proxy backend (Terminal 2)

> Open a **second terminal**.

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements-proxy.txt
python app.py   # listens on :8000
```

### C.4 Start the frontend (Terminal 3)

> Open a **third terminal**.

```bash
cd skills/msresearch-dayhoff/assets/dayhoff-prototype/frontend
npm install
npm run dev   # listens on :5173
```

Open http://localhost:5173 and generate as in Step B.4.

### C.5 (Optional) Local fold server

If you also want self-hosted ESMFold (for sequences > 400 aa, which the public ESM Atlas API rejects), build the fold server in `backend/fold/` the same way as `score/`. It runs on its own port; point `ESMFOLD_ENDPOINT` in `.env` at it.

---

## Programmatic Alternative (no web app)

For one-off scripts or notebook use, call the models directly via `transformers`:

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_id = "microsoft/Dayhoff-170m-GR"
tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    trust_remote_code=True,
    torch_dtype=torch.float16,
    device_map="auto",
    use_mamba_kernels=False,  # set True only if you've installed mamba-ssm from source
)

inputs = tokenizer("M", return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_length=80, num_return_sequences=3, do_sample=True, temperature=0.8)
print([tokenizer.decode(seq, skip_special_tokens=True) for seq in outputs])
```

For more patterns (fitness scoring, motif preservation, batch sampling, export), see [`application-patterns.md`](application-patterns.md).

---

## Next Steps

- [`about-dayhoff.md`](about-dayhoff.md) — Pick the right model variant for your task
- [`responsible-use.md`](responsible-use.md) — **Read before exporting any sequence**
- [`application-patterns.md`](application-patterns.md) — Generation, scoring, motif preservation, batch processing
- [`data-integration.md`](data-integration.md) — Load Dayhoff Atlas datasets for training or analysis
- [`prototype-expansion.md`](prototype-expansion.md) — Add custom endpoints, scoring filters, batch jobs
- [`performance-guide.md`](performance-guide.md) — GPU sizing and throughput tuning
- [`troubleshooting.md`](troubleshooting.md) — Common errors and fixes
