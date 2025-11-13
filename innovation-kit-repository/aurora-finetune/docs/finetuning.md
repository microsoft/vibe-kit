# Fine-Tuning Engineering Notes

This document captures implementation details for extending and training Aurora checkpoints. Use it alongside the starter code under `starter-code/src/vibe_tune_aurora/` and the high-level workflow in `docs/aurora-finetuning-guide.md`.

## Table of contents

- [Fine-Tuning Engineering Notes](#fine-tuning-engineering-notes)
  - [Table of contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Baseline fine-tuning loop](#baseline-fine-tuning-loop)
  - [Computing gradients efficiently](#computing-gradients-efficiently)
  - [Mitigating exploding gradients](#mitigating-exploding-gradients)
  - [Extending Aurora with new variables](#extending-aurora-with-new-variables)
  - [Other model modifications](#other-model-modifications)
  - [Data quality checklist](#data-quality-checklist)

## Prerequisites

- Install `microsoft-aurora` and related dependencies via `uv sync` (see `starter-code/pyproject.toml`).
- Ensure access to a GPU such as an NVIDIA A100 (80 GB) for gradient-based fine-tuning.
- Review the normalization statistics in `starter-code/src/vibe_tune_aurora/data/default_stats.py` before adding variables.

## Baseline fine-tuning loop

Start from an official checkpoint using the `AuroraPretrained` class. The starter CLI (`python -m vibe_tune_aurora.cli.train`) handles this automatically, but the low-level pattern is:

```python
from aurora import AuroraPretrained

model = AuroraPretrained()
model.load_checkpoint()

# Integrate with vibe_tune_aurora.training.TrainingLoop for a full run
```

## Computing gradients efficiently

Gradient-based fine-tuning typically requires:

- An NVIDIA A100 80 GB GPU (or similar high-memory accelerator).
- PyTorch Automatic Mixed Precision (AMP) to reduce memory footprints.
- Activation (gradient) checkpointing to trade compute for memory.

Example setup:

```python
from aurora import AuroraPretrained

model = AuroraPretrained(autocast=True)  # Enable AMP
model.load_checkpoint()

batch = ...  # Retrieve data via vibe_tune_aurora.data_utils

model = model.cuda()  # or model.cpu()
model.train()
model.configure_activation_checkpointing()

pred = model.forward(batch)
loss = ...
loss.backward()
```

Refer to `docs/uv-getting-started-features.md` for managing environments and `docs/aurora-finetuning-guide.md` for broader troubleshooting.

## Mitigating exploding gradients

Symptoms: rapidly increasing loss, NaNs, or unstable training curves.

Recommendations:

- Monitor gradient norms or loss values during training (see hooks in `callbacks.py`).
- Apply gradient clipping or add layer-normalization layers where activations spike.
- Stabilize level aggregation when necessary:

    ```python
    from aurora import AuroraPretrained

    model = AuroraPretrained(stabilise_level_agg=True)
    model.load_checkpoint(strict=False)
    ```

    `stabilise_level_agg=True` inserts additional layer normalization. It perturbs the model, so expect to fine-tune for longer before convergence.

## Extending Aurora with new variables

Adjust the constructor arguments for surface, static, or atmospheric variables and update normalization statistics accordingly:

```python
from aurora import AuroraPretrained
from aurora.normalisation import locations, scales

model = AuroraPretrained(
        surf_vars=("2t", "10u", "10v", "msl", "new_surf_var"),
        static_vars=("lsm", "z", "slt", "new_static_var"),
        atmos_vars=("z", "u", "v", "t", "q", "new_atmos_var"),
)
model.load_checkpoint(strict=False)

# Means
locations["new_surf_var"] = 0.0
locations["new_static_var"] = 0.0
locations["new_atmos_var"] = 0.0

# Standard deviations
scales["new_surf_var"] = 1.0
scales["new_static_var"] = 1.0
scales["new_atmos_var"] = 1.0
```

Additional guidance:

- Use separate learning rates for new patch embeddings (for example `1e-3` for new embeddings vs. `3e-4` for the rest) via optimizer parameter groups in `training.py`.
- By default, new encoder embeddings are randomly initialized, which perturbs existing outputs. To avoid this, initialize `model.encoder.{surf,atmos}_token_embeds.weights` to zero before training.

## Other model modifications

When you add or remove modules, the checkpoint shape may no longer match. Load with `strict=False` to ignore mismatches:

```python
from aurora import AuroraPretrained

model = AuroraPretrained(...)

# Modify modules here

model.load_checkpoint(strict=False)
```

For deeper architectural changes, inspect `aurora_module.py` and `model_init.py` in the starter code to keep the Lightning integration consistent.

## Data quality checklist

Always validate inputs before investing GPU time:

- Are normalization statistics (old and new) appropriate for the dataset?
- Are there missing variables? Remove them from the batch definition or infill sparse NaNs (see `docs/form-of-a-batch.md`).
- Are there zeros, NaNs, or extreme outliers that will destabilize training?
- Are timestamps, resolutions, and coordinate grids aligned with the checkpoint expectations?

Cross-reference the sample ERA5 data in `tests/inputs/` for format guidance and consult `docs/beware.md` for a curated list of known issues.