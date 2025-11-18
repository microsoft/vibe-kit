---
description: Aurora Finetuning Innovation Kit context and file locations for custom weather model training
applyTo: "**/*"
---

# Aurora Finetuning Innovation Kit

**Invoke when**: User mentions "finetune Aurora", "Aurora training", "custom weather variable", "new climate variable", "finetune on recent data"

## What is the Aurora Finetuning Innovation Kit?

Toolkit to:

- Finetune Microsoft's Aurora foundation model for custom weather variables, more recent climate data, and other use cases.
- Enable training Aurora on new variables (e.g., UV radiation), custom datasets, and specialized applications.
- Include starter code, training scripts, evaluation tools, and Azure ML integration guidance.

## Kit Location

`.vibe-kit/innovation-kits/aurora-finetune/`

## Setup instructions

1. Run `.vibe-kit/innovation-kits/aurora-finetune/initialization/initialize_starter_code.py` to copy the starter assets, sync dependencies with `uv`, and (optionally) execute the bundled tests. Pass `--skip-tests` by default, unless user wants to run the full test suite.
2. Review `.vibe-kit/innovation-kits/aurora-finetune/docs/uv-getting-started-features.md` for this purpose, and confirm to the user that you've read it. Use `uv` instead of `pip` for all Python environment management. For example, to run a python file using the virtual environment (venv), use `uv run python <file.py>`. Or to add packages to the python project, use `uv add <package-name>`.

## File Index (Read These as Needed)

### Getting Started

**Setup script**: `.vibe-kit/innovation-kits/aurora-finetune/initialization/initialize_starter_code.py` — Run this to copy the starter code, sync dependencies, and optionally execute tests (`--skip-tests` skips them).

**Starter Code README**: `.vibe-kit/innovation-kits/aurora-finetune/starter-code/README.md` — Follow these guidelines whenever you create or modify fine-tuning and evaluation scripts.

**UV getting started**: `.vibe-kit/innovation-kits/aurora-finetune/docs/uv-getting-started-features.md` — Use this as the authoritative reference for `uv` commands and workflows.

### Documentation

**Finetuning overview**: `.vibe-kit/innovation-kits/aurora-finetune/docs/aurora-finetuning-guide.md` — Use this for the end-to-end workflow, supported variants, compute requirements, and troubleshooting checklists.

**Technical finetuning**: `.vibe-kit/innovation-kits/aurora-finetune/docs/finetuning.md` — Reference this while modifying gradients, AMP settings, variable lists, and normalization statistics.

**Data format**: `.vibe-kit/innovation-kits/aurora-finetune/docs/form-of-a-batch.md` — Confirm tensor layout, metadata expectations, and batching rules before writing loaders.

**Available models**: `.vibe-kit/innovation-kits/aurora-finetune/docs/available-models.md` — Check this matrix when selecting a pretrained checkpoint and compatible variables.

**Common issues**: `.vibe-kit/innovation-kits/aurora-finetune/docs/beware.md` — Review known pitfalls around data quality, cache limits, and checkpoint loading.

**Aurora model usage**: `.vibe-kit/innovation-kits/aurora-finetune/docs/usage.md` — Follow these steps for installation, single-step predictions, and rollout workflows.

**ERA5 example**: `.vibe-kit/innovation-kits/aurora-finetune/docs/example_era5.py` — Copy patterns from this script when wiring ERA5 data into the loaders.

**Aurora python API reference**: `.vibe-kit/innovation-kits/aurora-finetune/docs/api-reference.md` — Summaries of core classes (Batch, rollout helpers, model variants) for quick lookup.

**ECMWF integration**: `.vibe-kit/innovation-kits/aurora-finetune/docs/plugin-for-ecmwf.md` — Integrate the European Centre for Medium-Range Weather Forecasts (ECMWF) data plugin into your pipelines.

**Cyclone tracking**: `.vibe-kit/innovation-kits/aurora-finetune/docs/tropical-cyclone-tracking.md` — Follow this guide for tropical cyclone detection and tracking workflows.

**UV environment follow-up**: `.vibe-kit/innovation-kits/aurora-finetune/docs/uv-getting-started-features.md` — Revisit this when providing environment setup, dependency sync, or CLI troubleshooting support.

### Starter Code (Python Package: `vibe-tune-aurora`)

**Project Config**: `.vibe-kit/innovation-kits/aurora-finetune/starter-code/pyproject.toml` (dependencies, uv config)

**Core modules**:

- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/aurora_module.py` — Lightning wrapper; extend this when changing forward passes or logging hooks.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/training.py` — Main training loop utilities; update learning rates, schedulers, and optimizer groups here.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/evaluation.py` — Reference implementation for scorecards and rollouts; clone for custom evaluation jobs.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/losses.py` — Adjust or add loss definitions when experimenting with new objectives.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/model_init.py` — Centralize checkpoint loading, strict flags, and embedding initialization tweaks.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/callbacks.py` — Modify checkpointing, logging, and gradient monitoring behaviour here.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/config.py` — Default hyperparameters and CLI argument definitions.
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/data_utils.py` — Data loaders and normalization helpers; extend when wiring custom datasets.

**CLI Tools**:

- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/cli/train.py` (training CLI)
- `.vibe-kit/innovation-kits/aurora-finetune/starter-code/src/vibe_tune_aurora/cli/evaluate.py` (evaluation CLI)

**Test Data**: `.vibe-kit/innovation-kits/aurora-finetune/starter-code/tests/inputs/` (sample ERA5 data, pretrained Aurora small checkpoint)

## Quick Routing

- **"How do I start finetuning?"** → Run `.vibe-kit/innovation-kits/aurora-finetune/initialization/initialize_starter_code.py`, then follow `starter-code/README.md`.
- **"Add new weather variable (e.g., UVB)"** → Study `.vibe-kit/innovation-kits/aurora-finetune/docs/finetuning.md#extending-aurora-with-new-variables`.
- **"What data format does Aurora need?"** → Use `.vibe-kit/innovation-kits/aurora-finetune/docs/form-of-a-batch.md` as the schema reference.
- **"Exploding gradients / training instability"** → Combine `.vibe-kit/innovation-kits/aurora-finetune/docs/finetuning.md#mitigating-exploding-gradients` with `.vibe-kit/innovation-kits/aurora-finetune/docs/aurora-finetuning-guide.md#troubleshooting-common-issues`.
- **"Set up normalisation statistics"** → Reference `.vibe-kit/innovation-kits/aurora-finetune/docs/finetuning.md#prerequisites` alongside `starter-code/src/vibe_tune_aurora/data/default_stats.py`.
- **"Run training"** → Use the CLI entry point `starter-code/src/vibe_tune_aurora/cli/train.py`.
- **"Evaluate model"** → Use `starter-code/src/vibe_tune_aurora/cli/evaluate.py` and follow up with `evaluation.py` for custom reports.
- **"Common errors / issues"** → Review `.vibe-kit/innovation-kits/aurora-finetune/docs/beware.md`.
- **"Azure ML / large-scale training"** → Check `.vibe-kit/innovation-kits/aurora-finetune/docs/aurora-finetuning-guide.md#troubleshooting-common-issues` for compute requirements and deployment notes.

## Official Resources

- GitHub: https://github.com/microsoft/aurora
- Azure AI Foundry: https://ai.azure.com/catalog/models/Aurora
- Hugging Face: https://huggingface.co/microsoft/aurora
- Paper: Nature, 2025, "A Foundation Model for the Earth System"

## Key Workflows

1. **Initialize**: Run `initialize_starter_code.py` to set up workspace
2. **Prepare Data**: Format data as `aurora.Batch` (see `form-of-a-batch.md`)
3. **Configure**: Set variables, normalization stats, loss function
4. **Train**: Use CLI or Python API from starter code. Refactor or augment the code as needed.
5. **Evaluate**: Run evaluation scripts, visualize predictions
6. **Scale**: Deploy to Azure ML for production workloads
