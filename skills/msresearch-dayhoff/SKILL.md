---
name: msresearch-dayhoff
description: Microsoft Research's Dayhoff — generates novel protein sequences and scores variants using hybrid Mamba+Transformer models trained on the 3.34B-sequence Dayhoff Atlas. Use when users mention Dayhoff by name, want to generate protein sequences from scratch or from a prompt, score mutations / variants / fitness without experimental data, design sequences in a protein family from homologs, scaffold sequences around a motif, or are setting up / running / troubleshooting the Dayhoff prototype locally.
license: MIT
---

## Scope

- Run the Dayhoff reference app locally to generate novel protein sequences, score variants, scaffold motifs, and (for some variants) condition on homologous sequences.
- Three ways to run the reference app, in increasing order of capability and setup cost:
  1. **Path A — Cached demo:** frontend only (`npm run dev`), no GPU, no backend. Returns precomputed real Dayhoff outputs for four bundled prompts (Cas9, insulin, DNA polymerase, SARS-CoV-2 spike) across all four model variants. Best for evaluating the UX or demoing on a laptop with no GPU access.
  2. **Path B — Proxy mode:** Flask proxy on `:8000` + frontend on `:5173`, calling a `dayhoff-multi` Azure ML endpoint. Two terminals, no local model load. Live arbitrary-prompt generation.
  3. **Path C — Fully local:** adds a self-hosted score server on `:5001` (and optionally a fold server) running on a CUDA-capable NVIDIA GPU. Three to four terminals.
- Hosted models are also published to Hugging Face and Azure AI Foundry — use the proxy in `backend/app.py` to call a `dayhoff-multi` AML endpoint, or use the `transformers` library directly against [the Dayhoff model collection](https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969).
- Four model variants (`3b-GR-HM-c`, `3b-GR-HM`, `3b-UR90`, `170m-UR50-BRn`) with different strengths — see `docs/about-dayhoff.md` for the picker.
- Bundled biosecurity guardrail: `backend/sequence_screening.py` runs a 3-layer Select Agent toxin screen on inputs and outputs. This is a guardrail, not a guarantee — see `docs/responsible-use.md`.

## Prerequisites

- **Windows users:** Dayhoff prototype is developed and tested on Linux / WSL2. On Windows 11, run everything inside a WSL2 distro (Ubuntu recommended) with NVIDIA drivers installed on the **Windows host** (not inside WSL). Native Windows Python / PowerShell is not supported. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html). (Path A — cached demo — is the one exception: if a Windows user just wants to see Dayhoff outputs in the UI, `npm run dev` from the frontend on native Windows works fine because it never invokes the Python backend or the GPU.)
- Linux (or WSL2) with a CUDA-capable NVIDIA GPU for Path C. Path B needs only network access to the AML endpoint. Path A needs only Node.js. CPU works only for the 170M variant on toy sequences and is unusably slow for the 3B variants.
- Python 3.10+ for the backend (Path B and Path C); Node.js 18+ for the frontend (all paths).
- Disk space:
  - Path A (cached demo): ~200 MB for `node_modules`.
  - Path B (proxy-only, calling a remote AML endpoint): ~1 GB for Python deps.
  - Path C with the 170M variant: ~2 GB additional for weights.
  - Path C with all four variants loaded: ~20 GB GPU memory and ~25 GB disk for weights.

## Workflow

1. Load `docs/about-dayhoff.md` when users ask what Dayhoff is, how it works, which variant to use, or for benchmark numbers.
2. Follow `docs/quick-start.md` to get the reference app running locally — proxy first, then frontend, then optional score / fold servers.
3. For code examples (generation, fitness scoring, motif preservation, batch sampling, FASTA / CSV / JSON export), route to `docs/application-patterns.md`.
4. For loading the Dayhoff Atlas datasets (GigaRef, BackboneRef, DayhoffRef), route to `docs/data-integration.md`.
5. For extending the prototype (new endpoints, custom scoring filters, batch jobs, database integration), route to `docs/prototype-expansion.md`.
6. For GPU sizing, throughput tuning, and scaling, route to `docs/performance-guide.md`.
7. For errors, route to `docs/troubleshooting.md`.
8. **Before any sequence is exported, shared, or sent to a wet lab**, route to `docs/responsible-use.md`.

### Operating rules

- **Windows users:** Dayhoff is Linux/WSL2-only for Path B and Path C. On Windows, all backend / score-server commands must run inside a WSL2 distro with NVIDIA drivers installed on the Windows host. Native Windows Python and PowerShell are not supported. Point Windows users at [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) before running any Path B/C step. (Path A — cached demo — is the one exception: pure-frontend `npm run dev` works on native Windows because it never invokes Python or the GPU.)
- **No-GPU demo path exists:** If the user has no GPU, no AML endpoint, or just wants a quick look at what Dayhoff produces, route to **Path A** in `docs/quick-start.md` — frontend only with cached real Dayhoff outputs for four bundled prompts. Don't gatekeep on hardware. The cache lives in `frontend/src/demoCache.ts` and is what the UI shows when the backend badge says "Backend offline · cached examples only."
- **GPU probe first (Path C only):** Before suggesting Path C (local model loading), run `nvidia-smi` and confirm a CUDA-capable GPU is visible. If none is present, default to Path A (cached demo) or Path B (remote AML endpoint) — do not try to load the 3B models on CPU.
- **First-run weight download (Path C):** First call to the local score server downloads model weights from Hugging Face. The 170M variant is ~1 GB; loading all four variants is ~25 GB. Tell the user this will be slow and must not be interrupted. Subsequent runs reuse the cache. Recommend `huggingface-cli login` and `HUGGINGFACE_HUB_ENABLE_HF_TRANSFER=1` to avoid throttling.
- **Multi-terminal discipline:** Path A needs one terminal (frontend on `:5173`). Path B needs two (proxy backend on `:8000` + frontend on `:5173`). Path C needs three (add local score server on `:5001`), and up to four with a local fold server. Each must stay running in its own terminal — never run other commands in a terminal hosting a live server.
- **Local credentials handling:** Copy `.env.example` to `.env` and fill in `DAYHOFF_ENDPOINT` / `DAYHOFF_API_KEY` for the AML proxy mode, or leave them pointing at `http://localhost:5001/score` for fully-local mode. Never ask the user to paste credentials into chat — always reference the `.env` file. Keep the `DAYHOFF_*` and `ESMFOLD_*` variable names exactly as written; the proxy reads those exact names.
- **Honest scope:** The reference app is a *research prototype*. Generated sequences are model predictions of plausibility, not validated designs. The bundled `sequence_screening.py` toxin filter catches a small Select Agent reference set — it is a guardrail, not a guarantee. Do not claim safety, function, or foldability for any generated sequence.
- **Biosecurity gate:** Before assisting with any sequence export, sharing, or wet-lab handoff, surface `docs/responsible-use.md` and confirm the user has reviewed the pre-export checklist. Never assist with sequences targeting pathogens, toxins, or dual-use applications. Treat every generated sequence as a research draft requiring qualified human review.
- **Variant selection matters:** When a user asks for sequence generation, pick the right variant (see `docs/about-dayhoff.md` matrix). Reject homolog inputs for `3b-UR90` and `170m-UR50-BRn` early — the score server will return 400 if a model that doesn't support homolog conditioning receives a `homologs` payload.
- **Execute, don't display:** When terminal execution is available, run quick-start commands directly rather than printing bash blocks for the user to copy.
- **Always offer the next step:** After loading any explainer-style doc (e.g. `docs/about-dayhoff.md`), end your response with a concrete offer to advance the user. Default phrasing: *"Want to try Dayhoff? Fastest path is just `npm run dev` in the bundled frontend — no GPU, no backend, four cached prompts (Cas9, insulin, DNA polymerase, SARS-CoV-2 spike) return real Dayhoff outputs instantly. From there we can stand up proxy mode against an Azure ML endpoint or fully local mode on your GPU when you want custom prompts."* Adapt wording to context.

## Routing

| Doc | When to load |
|---|---|
| `docs/about-dayhoff.md` | User asks what Dayhoff is, how it works, which variant to use, benchmarks, or scientific background |
| `docs/quick-start.md` | User wants to run the reference app locally |
| `docs/application-patterns.md` | User wants code examples for generation, fitness scoring, motif preservation, batch sampling, or export |
| `docs/data-integration.md` | User wants to load Dayhoff Atlas datasets (GigaRef, BackboneRef, DayhoffRef) |
| `docs/prototype-expansion.md` | User wants to extend the reference app — new endpoints, custom scoring, batch processing, database, validation |
| `docs/performance-guide.md` | User asks about GPU sizing, throughput, batching, or scaling |
| `docs/troubleshooting.md` | User hits an error: missing GPU, Mamba kernel error, weight download stall, port conflict, AML 401, HF rate limit |
| `docs/responsible-use.md` | **Before** any sequence export, sharing, or wet-lab handoff; or when user asks about safety, biosecurity, or responsible use |

## Learning Path

1. `docs/about-dayhoff.md` — Understand what Dayhoff is, the four model variants, and which one fits your task
2. `docs/quick-start.md` — Run the reference app locally and generate your first sequences
3. `docs/responsible-use.md` — Read the biosecurity guardrails and pre-export checklist before exporting anything
4. `docs/application-patterns.md` — Build your own generation, scoring, and export workflows
5. `docs/data-integration.md` and `docs/prototype-expansion.md` — Scale up with Atlas datasets and custom prototype features

## Reference Links

- Research paper (preprint): https://aka.ms/dayhoff/preprint
- GitHub: https://github.com/microsoft/dayhoff
- Hugging Face model collection: https://huggingface.co/collections/microsoft/dayhoff-atlas-6866d679465a2685b06ee969
- Azure AI Foundry model card: https://ai.azure.com/catalog/models/Dayhoff-170m-GR

## Assets

- `assets/dayhoff-prototype/` — Self-contained reference app: Flask proxy backend (`backend/app.py`, port `:8000`), local score server (`backend/score/`, port `:5001`), optional ESMFold structure server (`backend/fold/`), Vite + React + TypeScript frontend (`frontend/`, port `:5173`), Azure ML deployment YAMLs (`infra/`), and `Dockerfile` for App Service deployment.
- `assets/paper/dayhoff-biorxiv-paper.pdf` — Bundled offline copy of the bioRxiv preprint.
