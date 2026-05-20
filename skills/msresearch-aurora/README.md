# Aurora Skill

Aurora is a foundation model for the Earth system built by Microsoft Research. It predicts weather, air quality, ocean waves, and tropical cyclone tracks — matching or beating traditional supercomputer models at orders of magnitude lower cost.

This kit covers **two complementary workflows**:

- **Inference** — Run Aurora on a region (Norway example bundled) and visualize forecasts in a React frontend.
- **Fine-tuning** — Adapt Aurora to custom variables, regions, or lead times. The recommended path for serious applications.

## Choosing a path

| You want to... | Start with |
|---|---|
| Actually use Aurora for a custom problem | [docs/about-finetune.md](docs/about-finetune.md) → [docs/quick-start-finetune.md](docs/quick-start-finetune.md) |
| Explore Aurora outputs interactively (no training) | [docs/finetune-demo.md](docs/finetune-demo.md) |
| Generate a regional forecast with a frontend | [docs/quick-start-inference.md](docs/quick-start-inference.md) |
| Understand what Aurora is | [docs/about-aurora.md](docs/about-aurora.md) |

## Docs

| Doc | Purpose |
|---|---|
| [About Aurora](docs/about-aurora.md) | What Aurora is, how it works, why it matters |
| [About Fine-tuning](docs/about-finetune.md) | Why fine-tune Aurora, who fine-tuning is for |
| [Demo App](docs/finetune-demo.md) | Spin up the bundled exploration demo (no training) |
| [Quick Start (Inference)](docs/quick-start-inference.md) | Run the Norway forecast in 30 minutes |
| [Quick Start (Fine-tuning)](docs/quick-start-finetune.md) | Run your first fine-tuning experiment in 30 minutes |
| [Customization Guide](docs/customization-guide.md) | Adapt the inference example for a new region/domain |
| [Fine-tuning Guide](docs/finetuning-guide.md) | Workflow, gradients, AMP, variable extension |
| [Form of a Batch](docs/form-of-a-batch.md) | Aurora's expected tensor structure |
| [Available Models](docs/available-models.md) | Checkpoint selection |
| [Inference Basics](docs/inference-basics.md) | Running Aurora predictions without the frontend |
| [Technical Reference](docs/technical-reference.md) | Grid constraints, data specs, performance, deployment |
| [Troubleshooting](docs/troubleshooting.md) | Error fixes and diagnostics for both workflows |

## Layout

- `docs/` — Workflow documentation
- `starter-code/` — Full Python project (`vibe-tune-aurora`) with training loop, CLIs, tests
- `initialization/initialize_starter_code.py` — Copies `starter-code/` into your repo as `aurora-finetune/`
- `assets/inference/` — Norway example, ERA5/CDS scripts, paper artifacts
- `assets/finetune/` — Exploration demo app, fine-tuning helper scripts

## Links

- Skill definition: [SKILL.md](./SKILL.md)
- Research paper: https://www.nature.com/articles/s41586-025-09005-y
- GitHub: https://github.com/microsoft/aurora
- Hugging Face: https://huggingface.co/microsoft/aurora
- Azure AI Foundry: https://ai.azure.com/catalog/models/Aurora

## Install

```bash
npx skills add microsoft/vibe-kit/skills/msresearch-aurora
```
