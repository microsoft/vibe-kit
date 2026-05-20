# Fine-Tuning Guide

This document explains how to adapt Aurora checkpoints for new variables, datasets, or lead times. It covers both the high-level workflow and engineering details for gradient handling, memory optimization, and variable extension.

> **Path note:** When the skill is installed, assets live under `.agents/skills/msresearch-aurora/`. In the source repository, the same files are under `skills/msresearch-aurora/`. Swap the prefix as needed.

---

## Contents

- [What is Fine-Tuning?](#what-is-fine-tuning)
- [When to Fine-Tune](#when-to-fine-tune)
- [Supported Checkpoints](#supported-checkpoints)
- [Fine-Tuning Workflow](#fine-tuning-workflow)
- [Computing Gradients Efficiently](#computing-gradients-efficiently)
- [Extending Aurora with New Variables](#extending-aurora-with-new-variables)
- [Preparing Data and Normalization](#preparing-data-and-normalization)
- [Other Model Modifications](#other-model-modifications)
- [Data Quality Checklist](#data-quality-checklist)
- [Related Resources](#related-resources)

---

## What is Fine-Tuning?

Fine-tuning continues training on a pretrained model using a smaller, targeted dataset. For Aurora, fine-tuning enables:

- Adding weather or climate variables not in the base checkpoint
- Adapting the model to more recent observations (e.g., 2020s data)
- Specializing for distinct applications (air quality, ocean waves, regional forecasts)

---

## When to Fine-Tune

Fine-tune when you need predictions for:

- Variables that Aurora does not currently output (UV radiation, air-pollution constituents)
- Regions or resolutions not covered by provided checkpoints
- More recent time ranges than the pretraining window
- Specialized operational scenarios (long-lead ocean forecasts, cyclone tracking)

If you only need standard global weather forecasts, use the pretrained checkpoints directly.

---

## Supported Checkpoints

The table below summarizes official checkpoints you can build upon.

| Model | Key Note | Surface Variables | Atmospheric Variables | Pressure Levels (hPa) |
|---|---|---|---|---|
| **Aurora 0.25° Pretrained** | Baseline | 2t, 10u, 10v, msl | z, u, v, t, q | 50–1000 (13 levels) |
| **Aurora 0.25° Fine-Tuned** | IFS HRES T0 | Same | Same | Same |
| **Aurora 0.25° 12-Hour** | 12h lead time | Same | Same | Same |
| **Aurora 0.1° Fine-Tuned** | High-res (0.1°) | Same | Same | Same |
| **Aurora 0.4° Air Pollution** | CAMS analysis | + PM1, PM2.5, PM10, total column pollutants | + CO, NO, NO2, SO2, O3 | Same |
| **Aurora 0.25° Wave** | HRES-WAM | + wave height, swell, direction, period | Same | Same |

Static variables: `lsm` (land-sea mask), `slt` (soil type), `z` (surface geopotential). Specialized checkpoints include additional static fields — see [available-models.md](available-models.md).

> **Note:** Aurora was pretrained on historical ERA5 and related datasets prior to the 2020s. Fine-tuning is how you adapt to newer observations.

---

## Fine-Tuning Workflow

Use this loop with the starter code in `starter-code/src/vibe_tune_aurora/`:

1. **Collect data** in Aurora's `surface`, `static`, and `atmospheric` variable groups. See [form-of-a-batch.md](form-of-a-batch.md).

2. **Add new variables** as needed and set their normalization statistics before training.

3. **Define the loss function.** Aurora authors recommend Mean Absolute Error (MAE). The starter code's `training.py` supports multiple loss types.

4. **Load the pretrained checkpoint:**

   ```python
   from aurora import AuroraPretrained

   model = AuroraPretrained()
   model.load_checkpoint()
   ```

5. **Run the fine-tuning loop:**
   - Sample a data batch
   - Produce predictions
   - Normalize predictions and targets
   - Compute loss and run optimizer step
   - Track gradient statistics and validation metrics

6. **Evaluate and export** with `cli/evaluate.py`.

The CLI wrapper handles most of this:

```bash
uv run python -m vibe_tune_aurora.cli.train \
  --pickle_file tests/inputs/era5_training_data_jan2025_1_to_7.pkl \
  --loss_type 2t_var \
  --max_epochs 10
```

> **Tip:** After the run starts (or finishes), inspect loss curves with `uv run tensorboard --logdir tb_logs/finetuning` and open `http://localhost:6006`. See [quick-start-finetune.md](quick-start-finetune.md#step-6-view-training-curves) for what to look for.

### Multi-variable training

The `--loss_type` flag selects a target-variable preset. Available presets are defined in `starter-code/src/vibe_tune_aurora/defaults/default_configs.py` under `TARGET_VAR_PRESETS`:

- `2t_var` — 2-meter temperature only (works with the bundled pretrained checkpoint)
- `2_cloud_vars` — total cloud cover and total cloud liquid water (`tcc`, `tclw`)
- `4_vars` — `tcc`, `tclw`, `uvb`, `ssrdc`
- `uvb_var`, `tcc_var` — single-variable variants

> **Caveat:** `4_vars`, `uvb_var`, `tcc_var`, and `2_cloud_vars` target variables (`tcc`, `tclw`, `uvb`, `ssrdc`) that are only available in the extended Aurora-AirPollution checkpoint, not the base pretrained checkpoint. See [available-models.md](available-models.md) for which checkpoint exposes which variables.

---

## Computing Gradients Efficiently

Gradient-based fine-tuning needs an A100-class GPU plus the three memory optimizations below. See [about-finetune.md](about-finetune.md#compute-requirements) for full hardware tiers.

- **Automatic Mixed Precision (AMP)** to reduce memory
- **Activation checkpointing** to trade compute for memory

Example setup:

```python
from aurora import AuroraPretrained

model = AuroraPretrained(autocast=True)  # Enable AMP
model.load_checkpoint()

model = model.cuda()
model.train()
model.configure_activation_checkpointing()

batch = ...  # Load via vibe_tune_aurora.data_utils
pred = model.forward(batch)
loss = ...
loss.backward()
```

The starter code enables AMP and checkpointing by default.

> For exploding gradients, OOM errors, and other training issues, see [troubleshooting.md](troubleshooting.md).

---

## Extending Aurora with New Variables

Adjust constructor arguments and update normalization statistics:

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

**Tips:**

- Use separate learning rates for new embeddings (e.g., 1e-3) vs. pretrained weights (3e-4). Configure via optimizer parameter groups in `training.py`.
- By default, new encoder embeddings are randomly initialized. To avoid perturbing outputs, initialize `model.encoder.{surf,atmos}_token_embeds.weights` to zero before training.

---

## Preparing Data and Normalization

1. Organize datasets per [form-of-a-batch.md](form-of-a-batch.md).

2. For any new variable, update normalization statistics:
   ```python
   from aurora.normalisation import locations, scales

   locations["new_var"] = mean_value
   scales["new_var"] = std_value
   ```

3. When extending the model, adjust `surf_vars`, `static_vars`, `atmos_vars` in the constructor. Load with `strict=False` to ignore mismatched parameters.

4. For separate learning rates on new embeddings, configure optimizer parameter groups in `starter-code/src/vibe_tune_aurora/training.py`.

---

## Other Model Modifications

When you add or remove modules, the checkpoint shape may no longer match. Load with `strict=False`:

```python
from aurora import AuroraPretrained

model = AuroraPretrained(...)
# Modify modules here
model.load_checkpoint(strict=False)
```

For deeper architectural changes, inspect `aurora_module.py` and `model_init.py` in the starter code.

---

## Data Quality Checklist

Validate inputs before investing GPU time:

- Are normalization statistics appropriate for the dataset?
- Are there missing variables? Remove from batch definition or infill sparse NaNs.
- Are there zeros, NaNs, or extreme outliers that will destabilize training?
- Are timestamps, resolutions, and coordinate grids aligned with checkpoint expectations?

Cross-reference sample data in `tests/inputs/` and consult [troubleshooting.md](troubleshooting.md) for known issues.

---

## Related Resources

- [about-finetune.md](about-finetune.md) — Why fine-tune Aurora, who should do it
- [quick-start-finetune.md](quick-start-finetune.md) — Run your first fine-tuning experiment
- [form-of-a-batch.md](form-of-a-batch.md) — Exact tensor layouts for `aurora.Batch`
- [troubleshooting.md](troubleshooting.md) — Training issues, environment problems, data pitfalls
- [available-models.md](available-models.md) — Detailed checkpoint specifications
- `starter-code/src/vibe_tune_aurora/cli/train.py` — CLI for launching jobs
- `starter-code/src/vibe_tune_aurora/cli/evaluate.py` — CLI for evaluation
- `starter-code/src/vibe_tune_aurora/cli/visualize.py` — Renders prediction heatmaps:
  ```bash
  uv run python -m vibe_tune_aurora.cli.visualize \
    --checkpoint runs/EXPERIMENT/checkpoints/last.ckpt \
    --pickle_file tests/inputs/era5_training_data_jan2025_8_to_14.pkl \
    --var 2t --sample_index 0 --difference \
    --output runs/EXPERIMENT/visuals/2t_sample0.png
  ```
