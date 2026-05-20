# Quick Start (Fine-tuning): Finetune Aurora

**Run your first Aurora finetuning experiment on surface temperature prediction.**

This guide walks you through a minimal finetuning workflow using bundled ERA5 data. You'll train Aurora to predict 2-meter temperature (surface temperature), validate the results, and visualize predictions.

> Not sure you need fine-tuning yet? Explore Aurora outputs interactively first — see [finetune-demo.md](finetune-demo.md). Or, for a non-training visualization of Aurora forecasts over Norway, see [quick-start-inference.md](quick-start-inference.md).

---

## Contents

- [Prerequisites](#prerequisites)
- [Step 1: Setup and Initialize Starter Code](#step-1-setup-and-initialize-starter-code)
- [Step 2: Run Smoke Test](#step-2-run-smoke-test)
- [Step 3: Understand the Task](#step-3-understand-the-task)
- [Step 4: Run Finetuning](#step-4-run-finetuning)
- [Step 5: Evaluate the Model](#step-5-evaluate-the-model)
- [Step 6: View Training Curves](#step-6-view-training-curves)
- [Step 7: Generate Visualizations](#step-7-generate-visualizations-optional)
- [Where to Go Next](#where-to-go-next)
- [Related Resources](#related-resources)

---

## Prerequisites

- **Skill installed** via `npx skills add msresearch-aurora`
- **Python 3.11+** with `uv` package manager
- **GPU recommended** but CPU works for smoke tests — see [about-finetune.md](about-finetune.md#compute-requirements) for the full hardware matrix. The bundled demo uses ~8-15 GB VRAM, ~10 GB RAM, and ~6 GB disk.

---

## Step 1: Setup and Initialize Starter Code

The Aurora kit includes a Python package (`vibe-tune-aurora`) with training scripts, test data, and CLI tools. Initialize it first:

```bash
cd .agents/skills/msr-aurora
uv run python3 initialization/initialize_starter_code.py --skip-tests
```

---

## Step 2: Run Smoke Test

Before full training, validate the setup with a quick test that exercises the finetuning loop on a tiny slice of data. The initialization script copies `starter-code/` to `aurora-finetune/` at the repo root:

```bash
cd ../../../aurora-finetune
uv run pytest tests/test_training.py::test_finetuning_2t_var_pretrained --maxfail=1 -s
```

**What this tests:**
- Downloads Aurora pretrained checkpoint (~5 GB, cached after first run)
- Loads sample ERA5 data from `tests/inputs/`
- Runs one training step with 2-meter temperature (`2t`) as target
- Verifies optimizer, loss computation, and checkpoint saving

This may take a few minutes on first run due to checkpoint download. Subsequent runs are faster.

> If the test fails (CUDA OOM, missing modules, wrong directory), see [troubleshooting.md](troubleshooting.md).

---

## Step 3: Understand the Task

Before training, let's clarify what we're predicting:

### What is `2t_var`?

- **`2t`** = 2-meter temperature (surface air temperature in Kelvin)
- **`2t_var`** = Loss function targeting only the `2t` variable
- **Why this matters:** Aurora predicts multiple weather variables (wind, pressure, etc.), but for this demo we focus the loss function on surface temperature alone

### Training Data

The bundled dataset (`tests/inputs/era5_training_data_jan2025_1_to_7.pkl`) contains:
- **Timespan:** January 1–7, 2025 (7 days)
- **Variables:** Surface temperature, winds, pressure, atmospheric profiles
- **Grid:** Global 0.25° resolution (721×1440 cells)
- **Timesteps:** 6-hour intervals (28 total samples)

This is a tiny slice for demonstration. For real fine-tuning, 1-3 months of hourly or 6-hourly data is typically sufficient when starting from a pretrained checkpoint; training from scratch would require years.

---

## Step 4: Run Finetuning

Now launch the full training run:

```bash
uv run python -m vibe_tune_aurora.cli.train \
  --pickle_file tests/inputs/era5_training_data_jan2025_1_to_7.pkl \
  --loss_type 2t_var \
  --max_epochs 2 \
  --learning_rate 1e-6
```

**Arguments explained:**
- `--pickle_file` → Training data source (ERA5 slice)
- `--loss_type 2t_var` → Focus loss on 2-meter temperature only
- `--max_epochs 2` → 2 training epochs (each epoch processes all 28 samples)
- `--learning_rate 1e-6` → Conservative learning rate for finetuning

**Training may take a few minutes.** Loss should decrease steadily—if it spikes or diverges, see [troubleshooting.md](troubleshooting.md).

> While training runs, you can open TensorBoard in another terminal to watch loss curves live — see [Step 6](#step-6-view-training-curves).

---

## Step 5: Evaluate the Model

After training, compute evaluation metrics on the finetuned checkpoint:

```bash
uv run python -m vibe_tune_aurora.cli.evaluate \
  --checkpoint tb_logs/finetuning/version_0/checkpoints/last.ckpt \
  --metrics rmse mae
```

> Checkpoint results are saved to `tb_logs/finetuning/version_0/evaluation_metrics.json`

**What these metrics mean:**
- **RMSE** (Root Mean Square Error): Average prediction error magnitude
- **MAE** (Mean Absolute Error): Average absolute difference from ground truth
- **Lower is better** for both metrics
- **Typical ranges:** 1-2 K for short-term temperature forecasts

---

## Step 6: View Training Curves

TensorBoard logs are automatically generated during training. Launch the dashboard to inspect loss curves:

```bash
tensorboard --logdir tb_logs/ --port 6006
```

**Open browser:** http://localhost:6006

### What to Look For

**SCALARS tab:**
- **train_loss** → Should decrease smoothly over epochs
- **val_loss** → Should track train_loss (gap indicates overfitting)
- **learning_rate** → Verify scheduler is working (cosine annealing)

**HPARAMS tab:**
- View hyperparameters (learning rate, batch size, loss type)

**Example healthy curves:**
```
train_loss: 0.78 → 0.56 → 0.42 → 0.35 → 0.34
val_loss:   0.69 → 0.52 → 0.39 → 0.32 → 0.32
```

Steady descent indicates successful finetuning. If loss plateaus, diverges, or behaves unexpectedly, see [troubleshooting.md](troubleshooting.md) and [finetuning-guide.md](finetuning-guide.md#computing-gradients-efficiently).

---

## Step 7: Generate Visualizations (Optional)

Visualize predictions vs ground truth to qualitatively assess model performance.

### Temperature Heatmap Comparison

Generate a side-by-side comparison of predicted vs actual surface temperature:

```bash
uv run python -m vibe_tune_aurora.cli.visualize \
  --checkpoint tb_logs/finetuning/version_0/checkpoints/last.ckpt \
  --pickle_file tests/inputs/era5_training_data_jan2025_8_to_14.pkl \
  --var 2t \
  --sample_index 0 \
  --difference \
  --output visuals/2t_prediction_sample0.png
```

**Panel layout:**
1. **Prediction** → Aurora's finetuned forecast
2. **Ground Truth** → Actual ERA5 observation
3. **Absolute Error** → Pixel-wise difference

**What to look for:**
- **Spatial patterns preserved** → Model captures temperature gradients
- **Error map mostly blue/green** → Low prediction errors
- **Red/orange patches** → Areas where model struggles (e.g., coastal boundaries, mountains)

To visualize other variables, swap `--var 2t` for any variable name in the batch (e.g., `10u`, `10v`, `msl`).

---

## Congratulations!

You've completed the Aurora finetuning workflow:

✅ **Initialized** the starter code package  
✅ **Validated** setup with smoke test  
✅ **Finetuned** Aurora on 2-meter temperature prediction  
✅ **Evaluated** model performance (RMSE, MAE)  
✅ **Inspected** training curves in TensorBoard  
✅ **Visualized** predictions vs ground truth  

**What's next?** Experiment with more variables, longer training, or regional datasets.

---

## Where to Go Next

You've run a complete fine-tuning loop on bundled data. From here:

- **Train on more variables or for longer** → [finetuning-guide.md](finetuning-guide.md#fine-tuning-workflow) covers multi-variable training, loss-type presets, gradient handling, and AMP.
- **Add weather variables Aurora doesn't predict out of the box** (e.g., UV-B, custom pollutants) → [finetuning-guide.md#extending-aurora-with-new-variables](finetuning-guide.md#extending-aurora-with-new-variables).
- **Fine-tune on a specific region** (e.g., Greece, your country) → You'll need ERA5 data for the region. This skill bundles `assets/inference/scripts/download_era5_subset.py` and a data-integration workflow for fetching CDS data; see [customization-guide.md](customization-guide.md).
- **Understand the data format** before bringing your own dataset → [form-of-a-batch.md](form-of-a-batch.md).
- **Hit a problem during training** → [troubleshooting.md](troubleshooting.md).

---

## Related Resources

**Starter Code:**
- `../starter-code/src/vibe_tune_aurora/` → Source code for training loop, losses, data loaders (see the README there for details)

**Documentation:**
- [finetuning-guide.md](finetuning-guide.md) — Workflow, gradients, AMP, variable extension
- [form-of-a-batch.md](form-of-a-batch.md) — Aurora's expected tensor structure
- [troubleshooting.md](troubleshooting.md) — Training issues, environment problems, data pitfalls

**Sister workflow (inference):**
- ERA5/CDS data download utilities (`assets/inference/scripts/download_era5_subset.py`) and the Norway visualization example — see [quick-start-inference.md](quick-start-inference.md).

**Official Resources:**
- GitHub: https://github.com/microsoft/aurora
- Paper: Nature 2025 (Aurora: A Foundation Model of the Atmosphere)
- Hugging Face: https://huggingface.co/microsoft/aurora

---

**Part of:** [Aurora Skill](../SKILL.md)
**Reference implementation:** [starter-code/](../starter-code/)
