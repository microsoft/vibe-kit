---
name: msresearch-aurora
description: Aurora — Microsoft's foundation model for the Earth system. Use this skill for both inference (regional weather/climate forecasting, Norway example, ERA5/CDS data, wind/temperature/pressure mapping) and fine-tuning Aurora on new variables, regions, or domains (training, evaluation, checkpoint extension, gradient/loss debugging). Triggers on Aurora, Microsoft Aurora, foundation models for Earth systems, ERA5/CDS/NetCDF weather data, weather forecast validation, and adapting Aurora to new use cases.
license: MIT
---
## Choosing the right path

Before diving in, identify what the user is actually trying to do. Three buckets:

1. **"I want to actually use Aurora for my problem"** (custom variables, regional adaptation, domain-specific predictions) → **fine-tuning path**. This is the recommended path for serious applications.
   - Route: [docs/about-finetune.md](docs/about-finetune.md) → [docs/quick-start-finetune.md](docs/quick-start-finetune.md) → [docs/finetuning-guide.md](docs/finetuning-guide.md).

2. **"I'm exploring / just curious / want to see Aurora work"** → **inference path** (Norway regional example with frontend visualization). Lower commitment, no GPU required.
   - Route: [docs/about-aurora.md](docs/about-aurora.md) → [docs/quick-start-inference.md](docs/quick-start-inference.md) → [docs/customization-guide.md](docs/customization-guide.md) for adapting to a new region.

3. **"Not sure / want to see Aurora in action first"** → route by audience:
   - **Non-technical audience** (execs, PMs, general scientists): start with the **Norway Prototype** ([docs/quick-start-inference.md](docs/quick-start-inference.md)) — visual maps over a real region, intuitive at a glance.
   - **Weather/climate practitioners** (familiar with NWP, ERA5, model evaluation): start with the **Finetune Exploration Demo** ([docs/finetune-demo.md](docs/finetune-demo.md)) — interactive divergence metrics and batch comparisons that surface fine-tuning behavior.
   Once they have a use case in mind, steer them toward the fine-tuning path.

If a user mentions a real problem they want Aurora to solve (custom forecasting, air quality, wave heights, regional energy planning, etc.), check the user for their familiarity/comfort with the Aurora model and finetuning in general. If a user is comfortable, steer them toward fine-tuning Aurora. If they want to learn more about Aurora first, direct them to [docs/about-aurora.md](docs/about-aurora.md). If they're familiar with Aurora and/or weather modeling, but they're new to finetuning, send them to [docs/about-finetune.md](docs/about-finetune.md).

## Scope

- Local and Azure-assisted Aurora inference for regional forecasts (Norway example as canonical starting point).
- End-to-end fine-tuning of the base Aurora checkpoint on custom variables, regions, or lead times.
- Data preparation (ERA5/CDS download, validation, batch construction).
- Evaluation, checkpoint selection, training instability debugging.

## Prerequisites

- **Windows users:** run inside a **WSL2** distro (Ubuntu recommended) with NVIDIA drivers installed on the Windows host (not inside WSL). The Aurora prototypes and demoes were developed and tested on WSL2/Ubuntu; native Windows Python/PowerShell is not supported. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html).
- Python 3.11+ with [`uv`](https://docs.astral.sh/uv/) package manager
- `torch`, `lightning`, `numpy`, `xarray`, `microsoft-aurora>=1.5.2`
- Node.js 18+ with `npm` (only for the inference Norway example frontend)
- 6 GB free disk space (Aurora checkpoint ~5 GB)
- GPU optional for inference smoke runs; A100-class strongly recommended for serious training. See [docs/about-finetune.md](docs/about-finetune.md#compute-requirements) for the full hardware matrix.

## Workflow

1. **Decide the path** (see "Choosing the right path" above) before touching files.
2. **Inference path:**
   1. Load [docs/about-aurora.md](docs/about-aurora.md) for background if needed.
   2. Walk through [docs/quick-start-inference.md](docs/quick-start-inference.md) to run the Norway example end-to-end.
   3. Use [docs/customization-guide.md](docs/customization-guide.md) for regional adaptation; [docs/technical-reference.md](docs/technical-reference.md) for grid/data/deployment specs.
3. **Fine-tuning path:**
   1. Run `initialization/initialize_starter_code.py` first (use `--skip-tests` by default). This copies `starter-code/` into `aurora-finetune/` at the repo root.
   2. Validate with the smoke test from `aurora-finetune/`: `uv run pytest tests/test_training.py::test_finetuning_2t_var_pretrained --maxfail=1`.
   3. Walk the user through [docs/quick-start-finetune.md](docs/quick-start-finetune.md), then deeper material in [docs/finetuning-guide.md](docs/finetuning-guide.md), [docs/form-of-a-batch.md](docs/form-of-a-batch.md), and [docs/available-models.md](docs/available-models.md).
4. **Demo path (exploratory):** Route to [docs/finetune-demo.md](docs/finetune-demo.md) and offer to walk the user through `docker compose up`.
5. Route all errors to [docs/troubleshooting.md](docs/troubleshooting.md) — it has dedicated inference and fine-tuning sections.

### Operational notes

- **Terminal hygiene (inference):** During the Norway quick-start, the frontend dev server (Step 1) must keep running in its own terminal. Open a *new* terminal for Steps 2-5 (Python install, inference, build) so you don't kill the dev server.
- **Repo-root trap (inference):** `npm install` and `npm run dev` must run from `assets/inference/norway-example/frontend/` (or the analogous regional directory). The repo root has a different boilerplate app and will fail with confusing errors.
- **Install `cdsapi` proactively** as soon as the user mentions adapting to a new region or downloading ERA5 data: `uv pip install cdsapi`. Don't wait for an import error mid-workflow.
- **Secret hygiene:** When walking the user through CDS credential setup (`assets/inference/.env.example` → `.env`), instruct them to edit `.env` locally. Never accept, display, or commit API keys.
- **Execute, don't display:** When the agent supports terminal execution, run quick-start commands directly via the terminal tool rather than displaying bash blocks for the user to copy. Show bash blocks only when reviewing or when the user explicitly wants to copy commands.
- **Fine-tuning quick-start UX:** Brief the user before each command, confirm before continuing, and summarize completed vs. next actions.
- **When a user starts or completes fine-tuning, surface TensorBoard:** Remind them to inspect loss curves with `uv run tensorboard --logdir tb_logs/finetuning` and open `http://localhost:6006`. Look for steady descent in `train_loss` and `val_loss`; flag plateauing or divergence with concrete remediation prompts (see `docs/troubleshooting.md`).
- **After any code change in the fine-tuning workflow:** Run `uv run pytest` (or a targeted eval) before declaring success. Flag NaN, divergence, or plateauing loss with concrete remediation prompts (lower learning rate, gradient clipping, see `docs/troubleshooting.md`).

## Routing

Format: `{{Doc}}` — {{when to load}}

- [docs/about-aurora.md](docs/about-aurora.md) — User asks what Aurora is, how it works, why it matters, or needs background.
- [docs/about-finetune.md](docs/about-finetune.md) — User asks why fine-tune Aurora, who fine-tuning is for, or what it unlocks.
- [docs/finetune-demo.md](docs/finetune-demo.md) — User wants to see Aurora outputs interactively without training (best for weather/climate practitioners).
- [docs/quick-start-inference.md](docs/quick-start-inference.md) — User wants to run the Norway forecast or visualize Aurora predictions (best for non-technical audiences and first-look demos).
- [docs/quick-start-finetune.md](docs/quick-start-finetune.md) — User wants to run a first fine-tuning experiment on bundled data.
- [docs/customization-guide.md](docs/customization-guide.md) — User wants a new region for the inference example, custom prototype, or domain recipes.
- [docs/finetuning-guide.md](docs/finetuning-guide.md) — Training/optimization, gradients, AMP, LoRA, variable extension.
- [docs/form-of-a-batch.md](docs/form-of-a-batch.md) — Data format / `aurora.Batch` structure.
- [docs/available-models.md](docs/available-models.md) — Checkpoint selection.
- [docs/inference-basics.md](docs/inference-basics.md) — Running predictions without the Norway frontend.
- [docs/technical-reference.md](docs/technical-reference.md) — Grid constraints, data formats, variable naming, deployment, validation.
- [docs/troubleshooting.md](docs/troubleshooting.md) — Errors and diagnostics for both inference and fine-tuning.
- [starter-code/README.md](starter-code/README.md) — CLI and starter-code reference.
- [assets/inference/scripts/README.md](assets/inference/scripts/README.md) — Inference scripts and utilities.

### Assets

- `assets/inference/norway-example/` — Reference inference implementation with frontend.
- `assets/inference/scripts/` — ERA5 download, validation, regional setup utilities.
- `assets/inference/paper/` — Paper artifacts and supplementary material.
- `assets/finetune/finetune-exploration-demo-app/` — Dockerized exploration demo (no training required).
- `starter-code/` — Full Python project (`vibe-tune-aurora`) with training loop, losses, data loaders, CLIs, and tests.
- `initialization/initialize_starter_code.py` — Copies `starter-code/` into the user's repo as `aurora-finetune/`.

## Reference Links

- Research Paper: [A foundation model for the Earth system](https://www.nature.com/articles/s41586-025-09005-y) (Nature, 2025)
- GitHub: [github.com/microsoft/aurora](https://github.com/microsoft/aurora)
- Model Weights: [huggingface.co/microsoft/aurora](https://huggingface.co/microsoft/aurora)
- Azure AI Foundry: [ai.azure.com/catalog/models/Aurora](https://ai.azure.com/catalog/models/Aurora)
