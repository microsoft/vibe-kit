---
name: msresearch-mattergen
description: MatterGen workflows for property-conditioned inorganic crystal generation, MatterSim triage, adapter fine-tuning, and Azure AI Foundry hosted deployment. Use when users ask about MatterGen, materials discovery, crystal generation, property-conditioned diffusion (bulk modulus, band gap, magnetic density, HHI), MatterSim evaluation, or Azure AI Foundry materials deployment.
license: MIT
---

## Scope

- Property-conditioned inorganic crystal generation and candidate triage
- Local CUDA workflows, hosted Azure AI Foundry inference, adapter-based extension
- Generation, evaluation, and adapter fine-tuning only — DFT-level physics validation is out of scope and should be handed to computational chemistry teams

## Prerequisites

- **Windows users:** run inside a **WSL2** distro (Ubuntu recommended) with NVIDIA drivers installed on the Windows host (not inside WSL). The MatterGen/MatterSim prototype was developed and tested on WSL2/Ubuntu; native Windows Python/PowerShell is not supported for the local CUDA path. See [Microsoft's WSL install guide](https://learn.microsoft.com/windows/wsl/install) and [NVIDIA's CUDA-on-WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html). The Azure AI Foundry hosted path still requires WSL2 for the local CLI tooling used to call it.
- Python **3.10** (3.11+ breaks `torch_cluster` wheels) with `pip` and `uv`
- CUDA-capable GPU (16 GB VRAM recommended) — or Azure AI Foundry access for the hosted path
- Git LFS installed before cloning the MatterGen repo
- MatterSim installed separately for evaluation (`pip install mattersim`)

## Workflow

0. If users need background on what MatterGen and MatterSim are, start with `docs/about-mattergen.md` before any setup.
1. **Recommended on-ramp:** Run `docs/prototype.md` to launch the local web UI — demo mode works with no Azure setup.
2. For scripted, scaled, or CLI-based use, follow `docs/quick-start.md` instead (local CUDA + Hydra configs + hosted REST).
3. Pick a scenario from `docs/application-patterns.md` and define success metrics.
4. If you need custom properties or datasets, follow `docs/data-integration.md` to prepare data and adapters.
5. Apply `docs/performance-guide.md` for batching, multi-GPU, and cost tuning once the basic loop works.
6. Review `docs/alignment-constitution.md` before any external sharing or lab handoff.

## Routing

- `docs/about-mattergen.md` — what MatterGen and MatterSim are, how they work, why they matter
- `docs/prototype.md` — run the local web UI to play with MatterGen + MatterSim (demo mode requires no Azure)
- `docs/quick-start.md` — local CLI setup, hello world, hosted Azure AI Foundry path
- `docs/application-patterns.md` — superhard, magnetic, optoelectronic, supply-chain, lab-loop scenarios
- `docs/data-integration.md` — datasets, CSV→LMDB preprocessing, custom property adapters
- `docs/performance-guide.md` — hardware sizing, throughput, fine-tuning, hosted cost
- `docs/emergency-fixes.md` — Git LFS, CUDA, MatterSim, hosted endpoint errors
- `docs/alignment-constitution.md` — responsible-use guardrails and oversight

## Assets

- `assets/sampling_conf/` — Hydra sampling configs (`default.yaml`, `csp.yaml`) used by `mattergen-generate`
- `assets/prototype/` — Runnable FastAPI + React web app for interactive MatterGen + MatterSim use; see `docs/prototype.md` to run it
- `assets/paper/mattergen-nature-paper.pdf`, `assets/paper/mattergen-a-new-paradigm-of-materials-design.pdf` — Source papers for offline reference

## Reference Links

- GitHub: https://github.com/microsoft/mattergen
- Hugging Face: https://huggingface.co/microsoft/mattergen
- Nature paper: https://www.nature.com/articles/s41586-025-08628-5
- Azure AI Foundry Model: https://ai.azure.com/catalog/models/MatterGen
