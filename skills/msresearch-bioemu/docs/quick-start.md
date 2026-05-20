# Quick Start

Run BioEmu locally on your own GPU. Two paths:

- **Path A (CLI smoke test)** — three commands, proves your install + GPU works. Start here.
- **Path B (reference app)** — run the self-contained React + Flask app in `assets/reference-app/` (with its bundled `score/` Flask server) for the full UI with Molstar viewer and MDTraj analysis.

## Prerequisites

- **Windows users:** Run everything inside WSL2 (Ubuntu 22.04 recommended). Install WSL2 per [Microsoft's guide](https://learn.microsoft.com/windows/wsl/install), then install the NVIDIA driver on the **Windows host** (not inside WSL) per [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html). Verify with `nvidia-smi` from inside your WSL distro before continuing. Native Windows / PowerShell is not supported.
- Linux with a CUDA-capable NVIDIA GPU. CPU works only for ~10-residue toy sequences and is not a supported workflow.
- Python 3.10+, ~5 GB free disk for cached weights (AlphaFold2 weights ~3.5 GB + BioEmu checkpoint + working space).
- Path B only: Docker with `nvidia-container-toolkit` (recommended) **or** system Python 3.10+ to run `score/` bare-metal; Node.js 18+ for the frontend. On Windows, use **Docker Desktop with the WSL2 backend** (see [Microsoft's Docker + WSL2 guide](https://learn.microsoft.com/windows/wsl/tutorials/wsl-containers)) — not `apt install docker.io` inside the distro.

> **First-run weight download:** The first sample call downloads ~3.5 GB of AlphaFold2 + BioEmu weights. This is slow — do not interrupt. Subsequent runs reuse the cache.
>
> **Not air-gapped:** ColabFold MSA generation hits an external MMseqs2 server on first use of a new sequence. This is local inference, not fully offline.

---

## Step 0: Verify your GPU

```bash
nvidia-smi
```

If this fails or shows no GPU, stop here. The rest of this guide assumes a working CUDA-capable GPU.

> **Windows users:** run `nvidia-smi` from **inside your WSL2 distro**, not from PowerShell. If it works in PowerShell but not WSL2, you installed the driver in the wrong place — see [troubleshooting.md](troubleshooting.md).

---

## Path A — CLI Smoke Test

The fastest way to confirm BioEmu works on your machine.

### A.1 Install

```bash
python -m venv ~/bioemu-venv
source ~/bioemu-venv/bin/activate
pip install bioemu[cuda]
```

### A.2 Sample Trp-cage (20 residues, fast)

```bash
python -m bioemu.sample \
    --sequence NLYIQWLKDGGPSSGRPPPS \
    --num_samples 10 \
    --output_dir ~/bioemu-trpcage
```

Expected output in `~/bioemu-trpcage/`:

| File | Description |
|---|---|
| `topology.pdb` | 3D structure (first frame) |
| `samples.xtc` | Trajectory containing all conformations |
| `sequence.fasta` | Input sequence |

By default, BioEmu filters out structures with steric clashes or chain breaks, so the output may contain fewer than `--num_samples` frames. Pass `--filter_samples=False` to keep all generated samples.

### A.3 Inspect

Open `topology.pdb` in any PDB viewer, or load both files in Python with MDTraj — see [application-patterns.md](application-patterns.md) for analysis examples.

If Path A worked, your local setup is good. Continue to Path B if you want the full UI.

---

## Path B — Reference App with Local `score/` Server

The app lives in `assets/reference-app/` of this skill. It ships a self-contained Flask scoring server (`score/`) that wraps `bioemu==1.3.1`. We run it locally on `:5001`, point the proxy at it via env var, and the React frontend works unchanged.

### B.1 Enter the reference-app directory

```bash
cd skills/msresearch-bioemu/assets/reference-app
```

### B.2 Run the `score/` server (Terminal 1)

> Keep this terminal running. Don't run other commands in it.

**Recommended: Docker** (Docker Desktop on Windows includes GPU support; Linux needs `nvidia-container-toolkit`):

```bash
cd score
docker build -t bioemu-score:local .
docker run --gpus all --rm -p 5001:5001 \
    -v bioemu-cache:/app/colabfold_cache \
    bioemu-score:local
```

The named volume `bioemu-cache` persists the ~3.5 GB of weights across container restarts so you only download them once.

**Bare-metal fallback** (if you don't have Docker):

```bash
cd score
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python score_server.py
```

Either way, confirm readiness from another terminal:

```bash
curl http://localhost:5001/ready
```

Returns `200` once the model is loaded into GPU memory. The first start takes a while because of the weight download.

### B.3 Configure `.env` to point at the local server

The `.env` lives at the **reference-app root** (not in `server/`):

```bash
cd ../   # back to reference-app root if you moved into score/
cp .env.example .env
```

The defaults already point at `http://localhost:5001/score` with a dummy key. No edits needed for local mode.

The variables keep their `AZURE_BIOEMU_*` names because `server/app.py` reads those exact names. In local mode the key is just any non-empty string — `score/` doesn't enforce auth.

### B.4 Start the proxy backend (Terminal 2)

> Open a **new terminal** — do not run this in Terminal 1.

```bash
cd skills/msresearch-bioemu/assets/reference-app/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
```

You should see:

```
 * Running on http://127.0.0.1:5000
```

The proxy will now POST predictions to `http://localhost:5001/score` instead of an Azure endpoint — same wire format, no proxy code change needed.

### B.5 Start the frontend (Terminal 3)

> Open a **third terminal**.

```bash
cd skills/msresearch-bioemu/assets/reference-app
npm install --legacy-peer-deps
npm start
```

Open http://localhost:3001.

### B.6 First Ensemble

1. Select **Trp-cage** example.
2. Set samples to 50.
3. Click **Generate Ensemble**.
4. Watch Terminal 1 (`score/`) log the inference run, Terminal 2 (proxy) log the request, and the UI render the trajectory in Molstar.

---

## Example Proteins

| Protein | Sequence | Residues |
|---------|----------|----------|
| Trp-cage | `NLYIQWLKDGGPSSGRPPPS` | 20 |
| Villin HP35 | `LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF` | 35 |

## Optional: AI Copilot

The Copilot panel needs `AZURE_OPENAI_*` credentials to provide real LLM responses. Without them it falls back to canned text. Everything else in the app works regardless.

## Optional: Steering and Side-chain Reconstruction

Path A users can opt into BioEmu's steering system (reduces unphysical structures) or side-chain reconstruction + MD relaxation. See the upstream [BioEmu README](https://github.com/microsoft/bioemu) for `--denoiser_config` and `bioemu.sidechain_relax` usage.

## Hitting an error?

See [troubleshooting.md](troubleshooting.md).
