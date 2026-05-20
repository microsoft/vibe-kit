---
name: msresearch-bioemu
description: Microsoft Research's BioEmu — generates protein conformational ensembles from amino acid sequence on a local GPU. Use when users mention BioEmu by name, want to predict protein dynamics or flexibility from sequence, or are setting up / running / troubleshooting BioEmu locally.
license: MIT
---

## Scope

- Run BioEmu locally on a CUDA-capable NVIDIA GPU to sample protein conformational ensembles from amino acid sequence.
- Two supported entry points:
  1. **CLI** — `pip install bioemu[cuda]` and `python -m bioemu.sample` directly from the upstream package.
  2. **Reference app** — the React + Flask app in `assets/reference-app/`. Run its bundled `score/` Flask server locally on `:5001`, point the proxy backend at it via `.env`, and use the React frontend for visualization.
- Analyze trajectories with MDTraj (RMSD, RMSF, Rg, secondary structure) and visualize with Molstar in the reference app.

## Prerequisites

- Linux (or **WSL2 on Windows 11** with NVIDIA GPU passthrough — install WSL per [Microsoft's guide](https://learn.microsoft.com/windows/wsl/install) and follow [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) for driver setup) with a CUDA-capable NVIDIA GPU. CPU works only for ~10-residue toy sequences; everything else is unusably slow.
- Python 3.10+, ~5 GB free disk for cached weights (AlphaFold2 weights ~3.5 GB + BioEmu checkpoint + working space) at `~/.cache/colabfold/` (CLI) or `/app/colabfold_cache` (Docker).
- Path B only: Docker with GPU support (Docker Desktop on Windows includes this; Linux needs `nvidia-container-toolkit`), or system Python for a bare-metal `score/` run; Node.js 18+ for the frontend.

## Workflow

1. Load `docs/about-bioemu.md` when users ask what BioEmu is, how it works, or need scientific background.
2. Follow `docs/quick-start.md` to get a first ensemble locally — Path A (CLI smoke test) before Path B (reference app).
3. For code examples (Python sampling API, MDTraj analysis, AlphaFold comparison, output file formats), route to `docs/application-patterns.md`.
4. Route errors to `docs/troubleshooting.md`.

### Operating rules

- **Windows users:** BioEmu is Linux-only. On Windows, all commands must run inside a WSL2 distro (Ubuntu recommended) with NVIDIA drivers installed on the **Windows host** (not inside WSL). Native Windows Python and PowerShell are not supported. Point Windows users at [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) before running any quick-start step.
- **GPU probe first:** Before suggesting any non-trivial sampling, run `nvidia-smi` and confirm a CUDA-capable GPU is visible. If none is present, warn the user that BioEmu is unusable beyond ~10-residue toy sequences and stop — do not proceed to install.
- **Weight download:** First call downloads ~3.5 GB of AlphaFold2 + BioEmu weights. Tell the user this will be slow and must not be interrupted. Subsequent runs reuse the cache.
- **Install times:** `pip install bioemu[cuda]`, `pip install -r requirements.txt`, and `npm install --legacy-peer-deps` are all slow on first run. Do not interrupt installs.
- **Three terminals (Path B):** `score/` server, proxy backend, and frontend each run in their own terminal and must stay running. Never run other commands in a terminal hosting a live server.
- **Local credentials:** For Path B the `.env` keeps its `AZURE_BIOEMU_*` variable names because the proxy reads those exact names — but `AZURE_BIOEMU_ENDPOINT` should point at `http://localhost:5001/score` and `AZURE_BIOEMU_KEY` can be any non-empty string (the local `score/` server doesn't enforce auth). Explain this when guiding users; never ask them to paste secrets into chat.
- **Honest scope:** This is *local inference*, not *fully offline*. ColabFold MSA generation still hits an external MMseqs2 server on first use of a new sequence. Do not claim air-gapped operation.
- **Execute, don't display:** When terminal execution is available, run quick-start commands directly rather than printing bash blocks for the user to copy.
- **Always offer the next step:** After loading any explainer-style doc (e.g. `docs/about-bioemu.md`), end your response with a concrete offer to advance the user along the Learning Path. Default phrasing: *"Want to try BioEmu? I can walk you through running it locally — three commands gets you a first ensemble on your GPU, and from there we can wire up the full reference app UI if you want it."* Adapt wording to context, but never end an explainer response without a concrete next-step offer.

## Routing

| Doc | When to load |
|---|---|
| `docs/about-bioemu.md` | User asks what BioEmu is, how it works, performance metrics, limitations, or the scientific FAQ |
| `docs/quick-start.md` | User wants to run BioEmu locally (CLI or full reference app) |
| `docs/application-patterns.md` | User wants code examples for sampling, MDTraj analysis, output file formats, or AlphaFold comparison |
| `docs/troubleshooting.md` | User hits an error, missing GPU, weight download stall, port conflict, or MSA timeout |

## Learning Path

1. `docs/about-bioemu.md` — Understand what BioEmu is and why it matters
2. `docs/quick-start.md` Path A — Three-command CLI smoke test on your GPU
3. `docs/quick-start.md` Path B — Run the full reference app against a local `score/` server
4. `docs/application-patterns.md` — Build your own sampling and analysis workflows

## Reference Links

- Science paper: https://www.science.org/doi/10.1126/science.adv9817
- GitHub: https://github.com/microsoft/bioemu
- Hugging Face: https://huggingface.co/microsoft/bioemu

## Assets

- `assets/reference-app/` — Self-contained React + Flask + `score/` Docker app. This is Path B; no separate clone needed.
