---
Name: "Aurora Finetuning"
Description: >-
  Toolkit for finetuning Microsoft's Aurora foundation model on custom weather
  variables, recent climate data, and specialized applications. Enable training
  Aurora on new variables (e.g., UV radiation), custom datasets, and domain-specific
  use cases.
ReferenceLinks:
  - label: "GitHub Aurora Repository"
    url: "https://github.com/microsoft/aurora"
  - label: "Hugging Face Model Hub"
    url: "https://huggingface.co/microsoft/aurora"
  - label: "Research Paper"
    url: "https://arxiv.org/pdf/2405.13063"
  - label: "Azure AI Foundry"
    url: "https://ai.azure.com/catalog/models/Aurora"
---

## Aurora Finetuning Innovation Kit Contents

**Installation:** Run `vibekit install aurora-finetune` from your workspace root, then reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window") to activate the Aurora Finetuning chat mode.

**Learn by doing:** This kit provides a complete PyTorch Lightning training stack, CLI tools, and sample ERA5 data to finetune Aurora for custom weather variables and specialized forecasting tasks.

### Prerequisites

Before starting, ensure you have:
- **Python 3.11+** with `torch`, `lightning`, `numpy`, `xarray`, `microsoft-aurora>=1.5.2`
- **25GB+ free disk space** for model checkpoints, training data, and cache
- **8GB+ RAM** minimum; 16GB+ recommended
- **GPU strongly recommended** (NVIDIA A10, A100, or equivalent; CPU works, but it's much slower and not recommended for serious finetuning)
- **CDS API credentials** (free, optional) for downloading additional ERA5 data

### Getting Started

- **[docs/quick-start.md](./docs/quick-start.md)** – Launch finetuning on sample ERA5 data (CLI setup → data validation → training run -> visualization)
- **[docs/aurora-finetuning-guide.md](./docs/aurora-finetuning-guide.md)** – End-to-end workflow, supported model variants, compute requirements, and troubleshooting
- **[starter-code/README.md](./starter-code/README.md)** – Python package reference (`vibe_tune_aurora`), training/evaluation CLI, and test suite
- **[initialization/initialize_starter_code.py](./initialization/initialize_starter_code.py)** – Run this to copy starter code, sync dependencies, and execute tests

### Core Documentation

- **[docs/finetuning.md](./docs/finetuning.md)** – Technical reference for gradient computation, AMP settings, loss functions, and model extension strategies
- **[docs/form-of-a-batch.md](./docs/form-of-a-batch.md)** – Data format specification: tensor layout, batch structure, and Aurora-compatible variable lists
- **[docs/available-models.md](./docs/available-models.md)** – Matrix of pretrained Aurora checkpoints, supported variable combinations, and compatibility notes
- **[docs/beware.md](./docs/beware.md)** – Known pitfalls: data quality issues, gradient explosions, cache limits, checkpoint loading gotchas
- **[docs/usage.md](./docs/usage.md)** – Installation, single-step predictions, rollout workflows, and model versioning
- **[docs/api-reference.md](./docs/api-reference.md)** – Python API reference for core classes (`Batch`, rollout helpers, model variants)
- **[docs/uv-getting-started-features.md](./docs/uv-getting-started-features.md)** – `uv` package manager cheat sheet and environment management

### Advanced Topics

- **[docs/plugin-for-ecmwf.md](./docs/plugin-for-ecmwf.md)** – Integrate ECMWF data sources into training pipelines
- **[docs/tropical-cyclone-tracking.md](./docs/tropical-cyclone-tracking.md)** – Domain-specific finetuning for tropical cyclone detection and tracking

### Starter Code (Python Package: `vibe_tune_aurora`)

**Project config**: `starter-code/pyproject.toml` (dependencies, uv configuration)

**Core modules**:

- `starter-code/src/vibe_tune_aurora/aurora_module.py` — PyTorch Lightning wrapper; extend when modifying forward passes or logging
- `starter-code/src/vibe_tune_aurora/training.py` — Main training loop utilities; adjust learning rates, schedulers, optimizer groups
- `starter-code/src/vibe_tune_aurora/evaluation.py` — Scorecard and rollout reference implementation; clone for custom evaluation jobs
- `starter-code/src/vibe_tune_aurora/losses.py` — Loss function definitions; add or modify objectives here
- `starter-code/src/vibe_tune_aurora/model_init.py` — Checkpoint loading, strict flags, embedding initialization
- `starter-code/src/vibe_tune_aurora/callbacks.py` — PyTorch Lightning callbacks for checkpointing, logging, gradient monitoring
- `starter-code/src/vibe_tune_aurora/config.py` — Default hyperparameters and CLI argument definitions

**CLI Tools**:

- `starter-code/src/vibe_tune_aurora/cli/train.py` — Training entry point with full hyperparameter control
- `starter-code/src/vibe_tune_aurora/cli/evaluate.py` — Evaluation CLI for checkpoint analysis and metric generation
- `starter-code/src/vibe_tune_aurora/cli/visualize.py` — Visualization utilities for plotting forecasts, errors, and diagnostics

**Test Data**: `starter-code/tests/inputs/` — Sample ERA5 slices and pretrained Aurora small checkpoint for rapid validation

## Philosophy

**Focus**: Enable practitioners to finetune Aurora on custom weather variables and specialized forecasting tasks via a complete, runnable training stack  
**Scope**: Regional-to-global finetuning (2T, wind, pressure, UV, and custom fields); support for up to 10-day forecasts  

## Key Advantages

- **Accuracy improvement**: Finetuning on domain-specific data or new variables can improve predictions by 5–20% RMSE over base Aurora
- **Flexibility**: Add new weather variables without retraining from scratch; leverage Aurora's pretrained foundation
- **Reproducibility**: Complete starter code with test suite ensures your experiments are traceable and scalable
- **Production-ready**: PyTorch Lightning integration enables distributed training, checkpointing, and deployment to cloud platforms

## Quick Wins Checklist

After completing the quick start, you should be able to:

- ✓ Run finetuning on sample ERA5 data
- ✓ Understand Aurora batch structure and validation requirements
- ✓ Generate and analyze evaluation metrics on a finetuned checkpoint
- ✓ Download your own ERA5 data using provided utilities
- ✓ Add a custom weather variable to the model
- ✓ Deploy a finetuned model to Azure ML or local inference

## Official Resources

- **GitHub**: https://github.com/microsoft/aurora
- **Hugging Face**: https://huggingface.co/microsoft/aurora
- **Paper**: Nature, 2025, "A Foundation Model for the Earth System"
- **Azure AI Foundry**: https://ai.azure.com/catalog/models/Aurora
