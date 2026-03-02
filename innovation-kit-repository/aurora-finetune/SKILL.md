---
name: aurora-finetune
description: Aurora finetuning workflows for custom variables, data pipelines, and training evaluation.
license: MIT
---
## Activation Conditions

Activate when users ask to finetune Aurora, train on custom weather variables, debug training instability, or evaluate checkpoints.

## Scope Boundaries

- Focus on workflow orchestration, data-shape correctness, and training/evaluation routing.
- Use `uv`-based environment and dependency management patterns.

## Prerequisites

- Python 3.11+.
- `torch`, `lightning`, `numpy`, `xarray`, `microsoft-aurora>=1.5.2`.
- 25 GB+ disk space and 8 GB+ RAM (16 GB+ recommended).
- GPU recommended for practical finetuning runs.

## Workflow

1. Run `initialization/initialize_starter_code.py` first; use `--skip-tests` by default unless users request full test execution.
2. Set up environment and dependencies via `docs/uv-getting-started-features.md`.
3. Route data schema and variable issues to `docs/form-of-a-batch.md`.
4. Route training and optimization topics to `docs/finetuning.md` and `docs/aurora-finetuning-guide.md`.
5. For quick-start walkthroughs, explain each step, confirm before continuing, and summarize completed versus next actions.

## Routing

- `docs/quick-start.md` for first training run.
- `docs/aurora-finetuning-guide.md` for end-to-end operations.
- `docs/finetuning.md`, `docs/form-of-a-batch.md`, and `docs/available-models.md` for technical references.
- `docs/beware.md` and `docs/tropical-cyclone-tracking.md` for pitfalls and domain cases.
- `starter-code/README.md` and `starter-code/src/vibe_tune_aurora/cli/` for executable interfaces.

## Starter Code Map

- `starter-code/src/vibe_tune_aurora/aurora_module.py` for model wrapper logic.
- `starter-code/src/vibe_tune_aurora/training.py` for training loop behavior.
- `starter-code/src/vibe_tune_aurora/evaluation.py` for metrics and rollout evaluation.
- `starter-code/src/vibe_tune_aurora/losses.py` for objective definitions.
- `starter-code/src/vibe_tune_aurora/model_init.py` for checkpoint and initialization controls.
- `starter-code/src/vibe_tune_aurora/callbacks.py` for runtime callbacks.
- `starter-code/src/vibe_tune_aurora/config.py` for defaults and arguments.

## Reference Links

- GitHub Aurora Repository: https://github.com/microsoft/aurora
- Hugging Face Model Hub: https://huggingface.co/microsoft/aurora
- Research Paper: https://arxiv.org/pdf/2405.13063
- Azure AI Foundry: https://ai.azure.com/catalog/models/Aurora
