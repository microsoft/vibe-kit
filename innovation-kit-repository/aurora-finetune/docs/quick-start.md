# Quick Start: Finetune Aurora

**Run your first Aurora finetuning experiment on surface temperature prediction.**

This guide walks you through a minimal finetuning workflow using bundled ERA5 data. You'll train Aurora to predict 2-meter temperature (surface temperature), validate the results, and visualize predictions.

---

## Prerequisites

- **Vibe Kit installed** with Aurora Finetune Innovation Kit  
- **Dev container running** (recommended) or local Python 3.12+  
- **GPU recommended** (but CPU also works)  
- **"Aurora Finetune" chat mode active** (switch in Copilot Chat if needed)

---

## Step 1: Setup and Initialize Starter Code

The Aurora Finetune Kit includes a Python package (`vibe-tune-aurora`) with training scripts, test data, and CLI tools. Initialize it first:

```bash
cd .vibe-kit/innovation-kits/aurora-finetune
uv run python3 initialization/initialize_starter_code.py --skip-tests
```

**What happens:**
- Copies starter code to `aurora-finetune/` in your project root
- Installs dependencies via `uv sync` (PyTorch, Lightning, microsoft-aurora)
- Skips the full test suite (we'll run a targeted smoke test next)

---

## Step 2: Run Smoke Test

Before full training, validate the setup with a quick test that exercises the finetuning loop on a tiny slice of data:

```bash
cd ../aurora-finetune
uv run pytest tests/test_training.py::test_finetuning_2t_var_pretrained --maxfail=1 -s
```

**What this tests:**
- Downloads Aurora pretrained checkpoint (~5 GB, cached after first run)
- Loads sample ERA5 data from `tests/inputs/`
- Runs one training step with 2-meter temperature (`2t`) as target
- Verifies optimizer, loss computation, and checkpoint saving

This may take a few minutes on first run due to checkpoint download. Subsequent runs are faster.

**Troubleshooting:**
- **"CUDA out of memory"** → Reduce batch size or use CPU (see config.py)
- **"microsoft-aurora not found"** → Re-run `uv sync` in aurora-finetune/
- **Test fails** → Check that you're in the `aurora-finetune/` directory

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

This is a tiny slice for demonstration. Production finetuning uses months or years of data.

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

**Training may take a few minutes.** Loss should decrease steadily—if it spikes or diverges, see troubleshooting in `docs/aurora-finetuning-guide.md`.

**Performance benchmarks:**
- **GPU (A100 40GB):**
- **GPU (T4 16GB):**
- **CPU (16-core):**

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

Steady descent indicates successful finetuning. If loss plateaus early, consider:
- Increasing learning rate (e.g., 5e-5)
- Training longer (10-20 epochs)
- Using more diverse data

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

### Alternative Visualizations

**Wind speed comparison:**
```bash
uv run python -m vibe_tune_aurora.cli.visualize \
  --checkpoint tb_logs/finetuning/version_0/checkpoints/last.ckpt \
  --pickle_file tests/inputs/era5_training_data_jan2025_8_to_14.pkl \
  --var 10u \
  --sample_index 5 \
  --output visuals/wind_u_sample5.png
```

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

## Next Steps

### Finetune on a Different Variable

Try UV radiation (requires extended Aurora checkpoint with CAMS data):

```bash
uv run python -m vibe_tune_aurora.cli.train \
  --pickle_file tests/inputs/era5_training_data_jan2025_1_to_7.pkl \
  --loss_type surface_all \
  --target_vars 2t 10u 10v msl uvb \
  --max_epochs 10
```

**Note:** `uvb` (UV-B radiation) is not in the bundled data. See `docs/data-integration.md` for fetching CAMS datasets.

### Finetune for a Specific Region (e.g., Greece)

1. **Download regional ERA5 data** (requires CDS credentials):
   ```bash
   python scripts/download_era5_subset.py \
     --region greece \
     --start_date 2025-01-01 \
     --end_date 2025-01-31 \
     --output data/greece_jan2025.pkl
   ```

2. **Train on regional subset:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.train \
     --pickle_file data/greece_jan2025.pkl \
     --loss_type 2t_var \
     --max_epochs 20 \
     --learning_rate 1e-6
   ```

3. **Evaluate regional performance:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.evaluate \
     --checkpoint tb_logs/finetuning/version_1/checkpoints/last.ckpt \
     --pickle_file data/greece_feb2025.pkl \
     --metrics rmse mae bias
   ```

**Why regional finetuning?** Improves accuracy for local climate patterns (Mediterranean sea breezes, mountain effects) that global models may underfit.

### Extend Training to Multiple Variables

Finetune on all surface variables simultaneously:

```bash
uv run python -m vibe_tune_aurora.cli.train \
  --pickle_file tests/inputs/era5_training_data_jan2025_1_to_7.pkl \
  --loss_type surface_all \
  --max_epochs 10 \
  --learning_rate 1e-6
```

**Variables included in `surface_all`:**
- `2t` → 2-meter temperature
- `10u` → 10-meter eastward wind
- `10v` → 10-meter northward wind
- `msl` → Mean sea-level pressure

**Trade-off:** Training takes longer, but produces a more balanced multi-variable model.

### Scale to Production Data

For real-world applications, use months or years of ERA5 data:

1. **Fetch full dataset** (see `docs/data-integration.md`):
   ```bash
   python scripts/download_era5_subset.py \
     --start_date 2024-01-01 \
     --end_date 2024-12-31 \
     --output data/era5_2024_full.pkl
   ```

2. **Train with data augmentation:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.train \
     --pickle_file data/era5_2024_full.pkl \
     --loss_type 2t_var \
     --max_epochs 50 \
     --batch_size 4 \
     --accumulate_grad_batches 4 \
     --learning_rate 1e-6
   ```

3. **Deploy as inference service** (see `docs/deployment.md`)

---

## Common Questions

**Q: Can I run this on CPU?**  
A: Yes, but expect a much longer traning time. Add `--accelerator cpu` to the train command.

**Q: How much data do I need for good results?**  
A: For finetuning pretrained Aurora, 1-3 months of hourly/6-hourly data is sufficient for most variables. For training from scratch, you'd need years of data.

**Q: What if training diverges (loss explodes)?**  
A: Lower learning rate (try 5e-6), enable gradient clipping (`--gradient_clip_val 1.0`), or review `docs/aurora-finetuning-guide.md#troubleshooting-exploding-gradients`.

**Q: Can I finetune on custom weather variables?**  
A: Yes! See `docs/finetuning.md#extending-aurora-with-new-variables` for adding variables not in the pretrained checkpoint.

**Q: How do I evaluate on different metrics?**  
A: The `--metrics` flag accepts: `rmse`, `mae`, `bias`, `correlation`, `skill_score`. Combine multiple: `--metrics rmse mae bias`.

**Q: Where are checkpoints saved?**  
A: Default location: `tb_logs/finetuning/version_N/checkpoints/`. Change with `--default_root_dir`.

**Q: Can I resume interrupted training?**  
A: Yes, pass `--resume_from_checkpoint tb_logs/finetuning/version_0/checkpoints/last.ckpt` to the train command.

---

## Performance Benchmarks

**Memory usage:**
- **GPU:** 10-15 GB VRAM (A100), 8-12 GB (T4)
- **RAM:** 8-12 GB system memory
- **Disk:** 5.5 GB (model checkpoint + dependencies)

---

## Troubleshooting

**"Checkpoint not found"**  
→ Ensure smoke test completed successfully (downloads checkpoint to cache)

**"CUDA out of memory"**  
→ Reduce batch size: `--batch_size 1` or switch to CPU: `--accelerator cpu`

**"Loss is NaN"**  
→ Lower learning rate: `--learning_rate 1e-7` or enable gradient clipping: `--gradient_clip_val 1.0`

**"Data loading failed"**  
→ Verify pickle file exists: `ls -lh tests/inputs/era5_training_data_jan2025_1_to_7.pkl`

**"TensorBoard not found"**  
→ Install via: `pip install tensorboard` or `uv add tensorboard`

**"Visualization script fails"**  
→ Check matplotlib is installed: `uv add matplotlib` (should be in dev dependencies)

**Still stuck?** Ask in "Aurora Finetune" chat mode: *"Finetuning failed with error: [paste error message]"*

---

## Related Resources

**Starter Code:**
- `../starter-code/src/vibe_tune_aurora/` → Source code for training loop, losses, data loaders (see the README there for details)

**Documentation:**
- `aurora-finetuning-guide.md` → High-level workflow, variant catalog, troubleshooting
- `finetuning.md` → Technical details on gradients, AMP, variable extension
- `form-of-a-batch.md` → Aurora's expected tensor structure
- `beware.md` → Common pitfalls and mitigation strategies
- `uv-getting-started-features.md` → `uv` package manager cheat sheet

**Data Integration:**
- `data-integration.md` → Fetching ERA5/CAMS data from CDS
- `scripts/download_era5_subset.py` → Download regional/temporal subsets

**Official Resources:**
- GitHub: https://github.com/microsoft/aurora
- Paper: Nature 2025 (Aurora: A Foundation Model of the Atmosphere)
- Hugging Face: https://huggingface.co/microsoft/aurora

---

**Part of:** [Aurora Finetune Innovation Kit](../INNOVATION_KIT.md)  
**Reference implementation:** [starter-code/](../starter-code/)
