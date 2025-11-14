# Aurora Troubleshooting Guide

**Quick solutions for common Aurora inference problems.**

This guide covers critical errors and their fixes. For detailed troubleshooting, see:
- [quick-start.md](quick-start.md) - Tutorial-specific issues
- [norway-technical-guide.md](norway-technical-guide.md) - Technical deep-dives
- [expand-norway-example.md](expand-norway-example.md) - Advanced troubleshooting

---

## Critical Issues

### Grid Dimension Errors

**Error:** `ValueError: Grid dimensions (50, 50) not divisible by patch_size (16)`

**Cause:** Aurora's encoder requires grid dimensions divisible by 16.

**Fix:**
```python
# BAD: 50×50 grid
lat_range = (58.0, 70.5)  # 50 cells at 0.25°

# GOOD: 64×112 grid covering mainland Norway
lat_range = (57.0, 72.75)  # 64 cells at 0.25°
lon_range = (4.0, 31.75)   # 112 cells at 0.25°
```

**Prevention:** Use this formula before setting bounds:
```python
def check_divisibility(lat_min, lat_max, lon_min, lon_max, resolution=0.25):
    lat_cells = int((lat_max - lat_min) / resolution)
    lon_cells = int((lon_max - lon_min) / resolution)
    
    if lat_cells % 16 != 0:
        # Round up to next multiple of 16
        new_cells = ((lat_cells // 16) + 1) * 16
        suggested_max = lat_min + (new_cells * resolution)
        print(f"❌ Lat: {lat_cells} cells. Try lat_max={suggested_max:.2f}")
    
    if lon_cells % 16 != 0:
        new_cells = ((lon_cells // 16) + 1) * 16
        suggested_max = lon_min + (new_cells * resolution)
        print(f"❌ Lon: {lon_cells} cells. Try lon_max={suggested_max:.2f}")
```

---

### CUDA Out of Memory

**Error:** `RuntimeError: CUDA out of memory`

**Fix 1 - Use CPU:**
```python
# In run_aurora_inference.py
device = torch.device('cpu')
model = load_aurora_model(device=device)
```

**Fix 2 - Free GPU memory:**
```bash
# Check what's using VRAM
nvidia-smi

# Kill other processes if needed
pkill python

# Clear PyTorch cache
python -c "import torch; torch.cuda.empty_cache()"
```

**Fix 3 - Use smaller model (if available):**
```python
# Use AuroraSmall instead of AuroraLarge
from aurora import AuroraSmall  # 1.3B params, ~8GB VRAM
```

**Fix 4 - Reduce grid size:**
```python
# 32×32 instead of the 64×112 Norway baseline (significantly less memory)
GRID_BOUNDS = {
    'lat_min': 60.0, 'lat_max': 68.0,  # 32 cells
    'lon_min': 8.0,  'lon_max': 16.0   # 32 cells
}
```

---

### Model Divergence (Unrealistic Predictions)

**Symptom:** Temperatures < -50°C or > 50°C, vertical striping patterns

**Causes:**
1. Too many forecast steps for grid size
2. Wrong prediction extraction
3. Missing input variables

**Fix 1 - Reduce steps:**
```python
# Original: 28 steps (7 days) - DIVERGES on small grids
num_steps = 28

# Fixed: 4 steps (24h) - Stable on 64×112 baseline
num_steps = 4
```

**Fix 2 - Check extraction:**
```python
# WRONG: Extracts both input and prediction
pred_state = pred_batch[0, 1]  # Gets second timestep (wrong!)

# CORRECT: First timestep is the prediction
pred_state = pred_batch[0, 0]  # Gets first timestep (correct!)
```

**Fix 3 - Validate inputs:**
```bash
# Check NetCDF files have required variables
python3 scripts/quick_inspect.py data/*.nc
```

---

### CDS API Issues

**Error:** `cdsapi.exceptions.Unauthorized`

**Fix:**
1. Set credentials via environment variable (preferred):
  ```bash
  # .env or shell profile
  CDS_API_KEY="YOUR_UID:YOUR_API_KEY"
  # Optional override
  # CDS_API_URL="https://cds.climate.copernicus.eu/api"
  ```
  Existing `~/.cdsapirc` entries continue to work, but env vars avoid hidden-file issues on Windows.

2. Get API key from [CDS](https://cds.climate.copernicus.eu/how-to-api) (Account → "API key")

3. Accept ERA5 license terms in the CDS portal before retrying the download

**Error:** `HTTP 429 Too Many Requests`

**Fix:** CDS rate limit hit. Wait 5-10 minutes before retrying.

---

### Missing Model Checkpoint

**Error:** `FileNotFoundError: aurora-0.25-small-pretrained.ckpt`

**Fix:** Download manually:
```bash
# Using huggingface-cli
pip install huggingface_hub
huggingface-cli download microsoft/aurora aurora-0.25-small-pretrained.ckpt \
  --local-dir ~/.cache/huggingface/hub/models--microsoft--aurora
```

Or let Aurora download automatically on first run (takes ~10 min):
```python
model = AuroraSmall()  # Downloads checkpoint automatically
```

---

### Frontend Issues

**Problem:** Aurora predictions toggle grayed out

**Fix:** Check these steps:
```bash
# 1. Did you run inference?
ls -lh data/norway_june8_forecast.nc  # Should exist

# 2. Did you convert to TypeScript?
ls -lh frontend/src/data/auroraForecastPredictions.ts  # Should exist

# 3. Hard refresh browser
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

**Problem:** Wrong dates showing

**Fix:** Check TypeScript module has correct timesteps:
```bash
grep -c '"timestamp":' frontend/src/data/auroraForecastPredictions.ts
# Should output: 4 (for 4-step forecast)
```

If wrong, regenerate:
```bash
python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/src/data/auroraForecastPredictions.ts \
  --max-steps 4
```

---

## Quick Diagnostics

### Check GPU Status

```bash
# See GPU memory usage
nvidia-smi --query-gpu=name,memory.total,memory.free,memory.used --format=csv

# Monitor GPU in real-time
watch -n 1 nvidia-smi
```

### Validate Python Environment

```bash
# Check Aurora installation
python3 -c "import aurora; print(aurora.__version__)"

# Check PyTorch + CUDA
python3 -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"

# Check dependencies
pip list | grep -E "aurora|torch|xarray|netCDF4"
```

### Verify Data Files

```bash
# Check NetCDF structure
python3 -c "
import xarray as xr
ds = xr.open_dataset('data/4d2238a45558de23ef37ca2e27a0315.nc')
print(ds.info())
print(f'Variables: {list(ds.data_vars)}')
print(f'Dimensions: {dict(ds.dims)}')
"
```

---

## Recovery Procedures

### Complete Reset

If everything's broken, start fresh:

```bash
# 1. Clean Python environment
pip uninstall aurora torch -y
pip install torch==2.5.1 microsoft-aurora==0.2.0

# 2. Clear caches
rm -rf ~/.cache/huggingface/
rm -rf ~/.cache/torch/

# 3. Re-download model
python3 -c "from aurora import AuroraSmall; m = AuroraSmall()"

# 4. Verify installation
python3 -c "import aurora, torch; print('✓ Aurora ready')"
```

### Frontend Reset

```bash
cd frontend
rm -rf node_modules .vite
npm install
npm run dev
```

---


## Azure-Specific Issues (Optional)

_Using Azure-hosted infrastructure?_ Check `docs/deployment/DEPLOYING-AZURE-AI-FOUNDRY-MODELS.md` for platform-specific setup tips and share GPU SKU, driver version, and region when escalating issues.
