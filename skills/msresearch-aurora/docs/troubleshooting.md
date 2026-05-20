# Troubleshooting

**Quick solutions for Aurora inference and fine-tuning issues.**

This file covers both workflows. Jump to the section that matches what you were doing when the error appeared.

---

## Contents

- [Inference Issues](#inference-issues)
  - [Grid Dimension Errors](#grid-dimension-errors)
  - [CUDA Out of Memory (Inference)](#cuda-out-of-memory-inference)
  - [Model Divergence](#model-divergence)
  - [CDS API Issues](#cds-api-issues)
  - [Missing Model Checkpoint](#missing-model-checkpoint)
  - [Frontend Issues](#frontend-issues)
- [Fine-tuning Issues](#fine-tuning-issues)
  - [Training Issues](#training-issues)
  - [Environment Issues](#environment-issues)
  - [Data Pitfalls](#data-pitfalls)
  - [Reproducibility](#reproducibility)
  - [Model Modification](#model-modification)
- [Quick Diagnostics (Both Workflows)](#quick-diagnostics-both-workflows)
- [Full Reset (Inference)](#full-reset-inference)

---

# Inference Issues

These apply when running the Norway example or other inference-only workflows.

## Grid Dimension Errors

**Error:** `ValueError: Grid dimensions (50, 50) not divisible by patch_size (16)`

**Cause:** Aurora's patch encoder requires both lat and lon dimensions to be divisible by 16.

**Fix:** Validate and adjust bounds before downloading data:

```bash
uv run python assets/inference/scripts/validate_grid.py \
  --lat-min 36.0 --lat-max 48.0 --lon-min 0.0 --lon-max 12.0
```

The script reports whether dimensions are valid and suggests adjusted bounds if not.

**Formula:** `cells = (max - min) / 0.25`. Both lat and lon cell counts must be divisible by 16.

---

## CUDA Out of Memory (Inference)

**Error:** `RuntimeError: CUDA out of memory`

**Fix (in order of preference):**

1. **Use CPU** — slower but works without GPU memory:
   ```bash
   uv run python3 run_aurora_inference.py --device cpu
   ```

2. **Free GPU memory:**
   ```bash
   nvidia-smi                    # Check what's using VRAM
   pkill python                  # Kill other Python processes
   uv run python -c "import torch; torch.cuda.empty_cache()"
   ```

3. **Use mixed precision** (~40% memory reduction):
   ```python
   model = model.half()
   ```

4. **Reduce grid size** — use a smaller region (e.g., 32x32 instead of 64x112).

For fine-tuning OOM, see [CUDA out of memory (training)](#cuda-out-of-memory-training).

---

## Model Divergence

**Symptom:** Temperatures < -50°C or > 50°C, vertical striping patterns, unrealistic wind speeds.

**Causes:**
1. Too many forecast steps for grid size
2. Wrong prediction extraction from output tensor
3. Missing input variables

**Fixes:**

1. **Reduce steps** — see the [stability table](technical-reference.md#forecast-stability) for safe limits per grid size
2. **Verify stability:**
   ```bash
   uv run python assets/inference/scripts/check_divergence.py --forecast data/your_forecast.nc
   ```
3. **Check inputs:**
   ```bash
   uv run python assets/inference/scripts/check_aurora_dataset.py --data-dir ./your_data_folder
   ```
4. **Verify extraction** — the prediction is always `pred_batch[0, 0]` (first timestep), not `[0, 1]`

---

## CDS API Issues

### 401 Unauthorized

**Fix:**
1. Configure credentials:
   ```bash
   cd assets/inference
   cp .env.example .env
   # Edit .env: CDS_API_KEY=your-api-key-here
   ```
   The key is a simple alphanumeric string (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

2. Get your key from [CDS](https://cds.climate.copernicus.eu/how-to-api) (Account > "API key")

3. Accept ERA5 license terms in the CDS portal before downloading

Legacy `~/.cdsapirc` entries continue to work.

### 429 Too Many Requests

CDS rate limit hit. Wait 5-10 minutes before retrying. For large downloads, split into smaller requests or download during off-peak hours (weekends).

### Slow Downloads

- Use `--area` flag to limit spatial extent
- Split multi-month requests into individual months
- Check CDS status at https://cds.climate.copernicus.eu/live

---

## Missing Model Checkpoint

**Error:** `FileNotFoundError: aurora-0.25-small-pretrained.ckpt`

**Fix:** Let Aurora download automatically on first run (takes ~10 min on fast connection):

```python
model = AuroraSmall()  # Downloads checkpoint automatically
```

Or download manually:

```bash
uv pip install huggingface_hub
huggingface-cli download microsoft/aurora aurora-0.25-small-pretrained.ckpt \
  --local-dir ~/.cache/huggingface/hub/models--microsoft--aurora
```

---

## Frontend Issues

### Predictions toggle grayed out

The predictions JSON file is missing or empty.

```bash
# 1. Did you run inference?
ls -lh data/norway_june8_forecast.nc

# 2. Did you generate the frontend data?
ls -lh frontend/public/data/auroraForecastPredictions.json

# 3. Regenerate if needed:
uv run python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/public/data/auroraForecastPredictions.json \
  --max-steps 4

# 4. Hard refresh browser: Ctrl+Shift+R
```

### Wrong dates showing

Regenerate the JSON file after each new inference run:

```bash
uv run python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/public/data/auroraForecastPredictions.json \
  --max-steps 4
```

### Frontend won't start

```bash
cd frontend
rm -rf node_modules .vite
npm install
npm run dev
```

---

# Fine-tuning Issues

These apply when running the fine-tuning workflow (training, evaluation, visualization).

## Training Issues

### Exploding gradients / NaN loss

**Symptoms:** Rapidly increasing loss, NaNs, unstable training curves.

**Recommendations:**

1. **Monitor gradient norms** during training (starter code logs these automatically).

2. **Apply gradient clipping:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.train --gradient_clip_val 1.0 ...
   ```

3. **Stabilize level aggregation:**
   ```python
   from aurora import AuroraPretrained

   model = AuroraPretrained(stabilise_level_agg=True)
   model.load_checkpoint(strict=False)
   ```
   This inserts additional layer normalization. It perturbs the model, so expect longer fine-tuning before convergence.

4. **Lower learning rate** — try `--learning_rate 1e-7` if `1e-6` diverges.

### CUDA out of memory (training)

- Reduce batch size: `--batch_size 1`
- Switch to CPU: `--accelerator cpu`
- Enable `bf16_mode=True` in the Aurora constructor
- Combine with AMP (`autocast=True`) and activation checkpointing
- The starter code enables AMP and checkpointing by default

### Missing data

- Omit unavailable variables from the batch definition
- Interpolate or infill sparse NaNs
- Structured gaps may require advanced handling

### Variable scaling issues

If variables have different magnitudes, normalize them before computing the loss. Use helpers in `starter-code/src/vibe_tune_aurora/data/default_stats.py`.

### Checkpoint not found

Ensure the smoke test completed successfully — it downloads the Aurora pretrained checkpoint to the local cache. Re-run:

```bash
uv run pytest tests/test_training.py::test_finetuning_2t_var_pretrained --maxfail=1
```

### Data loading failed

Verify the pickle file exists:

```bash
ls -lh tests/inputs/era5_training_data_jan2025_1_to_7.pkl
```

If missing, re-run `initialization/initialize_starter_code.py` to populate sample data.

---

## Environment Issues

### CUDA version mismatch (bf16_mode)

On Azure ML notebooks, system CUDA (12.2) may conflict with PyTorch's bundled CUDA (12.6), producing illegal memory access errors when `bf16_mode=True`. Mitigate:

1. Disable conda auto-activation: `conda config --set auto_activate_base false`
2. Set CUDA paths in `~/.bashrc`:
   ```bash
   export CUDA_HOME=/usr/local/cuda-12.2
   export PATH=$CUDA_HOME/bin:$PATH
   export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
   ```
3. Create a dedicated `uv` environment with aligned package versions
4. Install kernel for notebooks: `python -m ipykernel install --user --name .venv`

### Disk and cache limits

Running `uv sync` or other `uv` commands in constrained environments (dev containers, Codespaces, cloud notebooks) can exhaust the default cache at `/tmp`. Large wheels — `torch`, `timm`, CUDA toolkits — may fail with `No space left on device` before installs complete.

**Mitigations:**

- Redirect the cache to persistent storage: `export UV_CACHE_DIR=$(pwd)/.uv-cache`
- Pair with `export UV_LINK_MODE=copy` so installs copy artifacts instead of hard-linking across filesystems
- Periodically clean old artifacts: `uv cache prune`

These environment variables apply to the initialization script, `uv sync`, and `uv pip install`. They do not change where the virtual environment itself lives.

### Slow ERA5 downloads

- Download once to cloud storage (Azure Blob, S3) and stream from there for training
- Use asynchronous retrieval workflows when fetching long time ranges

### CPU warm-up delay

CPU-only executions of `cli.evaluate` or other Aurora entry points spend several minutes loading PyTorch + timm on first run. Plan for warm-up — subsequent batches run steadily once imports complete.

### TensorBoard not found

Install via:

```bash
uv add tensorboard
```

### Visualization script fails

Check that `matplotlib` is installed:

```bash
uv add matplotlib
```

It should be in the dev dependencies — re-run `uv sync --extra dev` if missing.

---

## Data Pitfalls

### Variable, level, and regridding consistency

Aurora assumes you provide **exactly the same variable set, pressure levels, and data sources** it was trained on. Deviations — especially in regridding — can noticeably degrade predictions.

**Recommendations:**

- Match variables and levels to the tables in [finetuning-guide.md](finetuning-guide.md#supported-checkpoints).
- Follow the batch specification in [form-of-a-batch.md](form-of-a-batch.md).
- Regrid data using the same methodology as the original pretraining/fine-tuning pipelines. Even small interpolation differences can compound.

### HRES IFS T0 vs analysis

HRES IFS T0 is **not** the same as HRES IFS analysis; the latter includes an additional surface assimilation step.

**Model requirements:**

- `Aurora 0.25° Fine-Tuned` → requires IFS HRES T0
- `Aurora 0.1° Fine-Tuned` → requires IFS HRES analysis

Mixing these products can introduce systematic bias. See the variant table in [finetuning-guide.md](finetuning-guide.md#supported-checkpoints) for full details.

---

## Reproducibility

### Deterministic runs

Need reproducible output? Configure PyTorch accordingly:

1. Enable deterministic kernels: `torch.use_deterministic_algorithms(True)`
2. Switch to evaluation mode to disable dropout: `model.eval()`

Combine with fixed random seeds in your data pipeline for best results.

---

## Model Modification

### Loading modified models

When you alter the architecture (e.g., add LoRA adapters, extra layers, or variable embeddings), checkpoint shapes change. Load with relaxed matching:

```python
model.load_checkpoint(strict=False)
```

Toggling LoRA on or off changes parameter sets, so fine-tuned checkpoints won't load into mismatched configs without `strict=False`. Review [finetuning-guide.md](finetuning-guide.md) for broader guidance on extending Aurora.

---

# Quick Diagnostics (Both Workflows)

```bash
# Check Aurora installation
uv run python3 -c "import aurora; print('Aurora OK')"

# Check PyTorch + CUDA
uv run python3 -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}')"

# Check GPU status
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv

# Inspect a NetCDF file
uv run python3 -c "
import xarray as xr
ds = xr.open_dataset('data/your_file.nc')
print(f'Variables: {list(ds.data_vars)}')
print(f'Dimensions: {dict(ds.dims)}')
"
```

---

# Full Reset (Inference)

If everything is broken in the inference workflow, start fresh:

```bash
# 1. Reinstall Python packages (use uv)
uv pip uninstall aurora torch
uv pip install torch==2.5.1 microsoft-aurora==0.2.0

# 2. Clear caches
rm -rf ~/.cache/huggingface/ ~/.cache/torch/

# 3. Re-download model
uv run python3 -c "from aurora import AuroraSmall; m = AuroraSmall()"

# 4. Verify
uv run python3 -c "import aurora, torch; print('Ready')"
```

For a fine-tuning reset, re-run `initialization/initialize_starter_code.py` from the skill root.

---

**Still stuck?** Ask Copilot or your AI assistant: *"Aurora [inference|fine-tuning] failed with error: [paste error message]"*
