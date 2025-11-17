# Aurora Application Patterns

**Domain-specific workflows and proven use case implementations.**

This guide shows real-world Aurora applications across different domains. Each pattern includes code examples you can adapt for your scenario.

**Learning approach:**
1. **Norway prototype first** - See [quick-start.md](quick-start.md) for complete working example
2. **Understand patterns below** - Domain-specific adaptations
3. **Adapt for your use case** - Combine patterns with [expand-norway-example.md](expand-norway-example.md)

---

## Primary Use Cases

> **Getting started**: Run the Norway mainland forecast ([quick-start.md](quick-start.md)) to understand the end-to-end workflow. Then adapt these patterns for your domain.

---

### Use Case 1: Regional Mainland Forecasting (Norway Example)

**Scenario**: 24-hour forecasts for mainland Norway at 0.25° resolution (64×112 grid).

**Reference implementation:** [assets/norway-example/](.vibe-kit/innovation-kits/aurora/assets/norway-example/)

**Key characteristics:**
- Expanded mainland grid (64×112 = 7,168 points; 4×7 Aurora patches)
- 24-hour stable horizon (4 steps × 6h) with clean coastal boundaries
- Interactive React + Fluent UI frontend with observation/prediction toggle
- CDS ERA5 observations (June 1–7, 2025) + Aurora forecast (June 8, 2025)

```python
# From run_aurora_inference.py (simplified)
from aurora import AuroraSmall
import torch

model = AuroraSmall()
model.load_checkpoint("microsoft/aurora")
model.eval()

# Load 2 consecutive timesteps (June 7: 12:00, 18:00)
batch = load_era5_input(
    surf_file="data/norway_surface.nc",
    atmos_file="data/norway_atmospheric.nc",
    static_file="data/norway_static.nc",
    times=["2025-06-07T12:00", "2025-06-07T18:00"]
)

# Run 4-step rollout (24h forecast)
predictions = []
for step in range(4):
    with torch.no_grad():
        pred = model(batch)
        predictions.append(pred[0, 0])  # Extract first timestep
        batch = update_batch(batch, pred)  # Slide window

# Save to NetCDF for frontend + TypeScript generation
save_forecast(predictions, "data/norway_june8_forecast.nc")
```

**Adaptation tips:**
- Update `GRID_BOUNDS` to your region (keep both dimensions divisible by 16)
- Re-run `scripts/build_forecast_module.py` for observations **and** predictions after producing new NetCDF files
- Extend to 48h (8 steps) once stability is confirmed; larger buffers (≥80×128) handle longer rollouts better
- See [expand-norway-example.md](expand-norway-example.md) for the end-to-end customization checklist

**Real-world impact**: Fast regional forecasts (5-10 min on GPU) for applications needing high temporal resolution in specific areas.

---

### Use Case 2: Rapid Regional Customization

**Scenario**: Adapt the Norway prototype for a new region in one command.

**Recommended approach**: Use `setup_region.py` (automates download, template copying, frontend generation):

# 1. Configure CDS credentials (one-time setup)
```bash
cd .vibe-kit/innovation-kits/aurora/assets
cp .env.example .env
# Edit .env and add: CDS_API_KEY=your-api-key-here
```
Pause and instruct the user to edit `.env` with their CDS API key before proceeding.

# 2. Generate region-specific prototype (example: California)
```bash
cd scripts
python3 setup_region.py \
    --name "California" \
    --lat-min 32 --lat-max 42 \
    --lon-min -124 --lon-max -114

# Creates: .vibe-kit/innovation-kits/aurora/assets/california-example/
# Downloads: 3 ERA5 files (surface, atmospheric, static)
# Generates: Frontend with California bounds and June 1-7 observations
```

**Manual method** (if you need custom control, see [expand-norway-example.md](expand-norway-example.md)):

```bash
# 1. Fetch ERA5 tiles for the new region (example: Bay of Biscay, 48x80 grid)
cd .vibe-kit/innovation-kits/aurora/assets/scripts
python download_era5_subset.py \
    --dataset reanalysis-era5-single-levels \
    --area 50 -10 40 0 \
    --start-date 2025-06-01 \
    --end-date 2025-06-08 \
    --output ../norway-example/data/biscay_surface.nc

python download_era5_subset.py \
    --dataset atmospheric \
    --area "50/-10/40/0" \
    --pressure-levels 1000 925 850 700 \
    --start-date 2025-06-01 \
    --end-date 2025-06-08 \
    --output ../norway-example/data/biscay_atmospheric.nc

python download_era5_subset.py \
    --dataset static \
    --area "50/-10/40/0" \
    --output ../norway-example/data/biscay_static.nc
```

```python
# 2. Update the inference script (scripts/run_aurora_inference.py)
from pathlib import Path

GRID_BOUNDS = {
    "lat_min": 40.0,
    "lat_max": 50.0,
    "lon_min": -10.0,
    "lon_max": 0.0,
}

SURFACE_FILE = Path("data/biscay_surface.nc")
ATMOS_FILE = Path("data/biscay_atmospheric.nc")
STATIC_FILE = Path("data/biscay_static.nc")
```

```bash
# 3. Run Aurora inference for the new region
cd .vibe-kit/innovation-kits/aurora/assets/norway-example
python scripts/run_aurora_inference.py \
    --surf data/biscay_surface.nc \
    --atmos data/biscay_atmospheric.nc \
    --static data/biscay_static.nc \
    --output data/biscay_forecast.nc
```

**Expected Output**: `data/biscay_forecast.nc` plus regenerated TypeScript bundles after running `scripts/build_forecast_module.py` on the new files.

**Real-World Impact**: Shows teams how to stand up new coastal or regional domains in under an hour using the stock scripts and ERA5 downloads. (See [expand-norway-example.md](expand-norway-example.md) for the full checklist.)

---

### Use Case 3: Forecast Verification Against ERA5 Observations

**Scenario**: Quantify Norway forecast skill by comparing Aurora predictions with the bundled ERA5 truth.

```python
import numpy as np
import xarray as xr

surface_ds = xr.open_dataset(".vibe-kit/innovation-kits/aurora/assets/norway-example/data/norway_surface.nc")
forecast_ds = xr.open_dataset(".vibe-kit/innovation-kits/aurora/assets/norway-example/data/norway_june8_forecast.nc")

# Align to the same timestamps (forecast starts 2025-06-08 00:00 UTC)
truth = surface_ds.sel(time="2025-06-08T00:00")

# Handle whichever lead-time dimension Aurora saved (step, lead_time, etc.)
forecast_var = forecast_ds["t2m"]
lead_dim = next(dim for dim in forecast_var.dims if dim not in {"latitude", "longitude", "lat", "lon"})
pred = forecast_var.isel({lead_dim: 0}, drop=True)

t2m_truth = truth["t2m"].values - 273.15  # °C
t2m_pred = pred.values - 273.15

rmse = float(np.sqrt(np.mean((t2m_pred - t2m_truth) ** 2)))
mae = float(np.mean(np.abs(t2m_pred - t2m_truth)))

print(f"Norway 0h RMSE: {rmse:.2f} °C")
print(f"Norway 0h MAE: {mae:.2f} °C")
```

**Expected Output**: RMSE/MAE summary values that demonstrate Aurora’s close alignment with ERA5 for the first forecast step.

**Real-World Impact**: Gives stakeholders a quick, reproducible skill check they can extend to wind components or additional forecast steps before publishing a dashboard.

---

### Use Case 4: Operational Planning with Aurora Forecasts

**Scenario**: Convert the Norway forecast (NetCDF + TypeScript payload) into grid-aware operational metrics.

```python
import json
from pathlib import Path

module_path = (
    Path.cwd()
    / ".vibe-kit"
    / "innovation-kits"
    / "aurora"
    / "assets"
    / "norway-example"
    / "frontend"
    / "src"
    / "data"
    / "auroraForecastPredictions.ts"
)

module_text = module_path.read_text(encoding="utf-8")
payload_str = module_text.split("export const auroraForecast: Forecast = ", 1)[1]
payload_json = payload_str.rsplit(" as const;", 1)[0]
forecast = json.loads(payload_json)

def peak_power_kw(step):
    # Example placeholder: treat high wind speeds as higher turbine output
    return max(cell["windSpeed"] for cell in step["cells"]) * 120.0

daily_peak_power = []
for step in forecast["steps"]:
    peak_kw = peak_power_kw(step)
    ramp_flag = peak_kw > 5000  # Replace with domain-specific logic
    daily_peak_power.append(
        {
            "timestamp": step["timestamp"],
            "peak_power_kw": round(peak_kw, 2),
            "ramp_detected": ramp_flag,
        }
    )

print("First 3 planning entries:")
for entry in daily_peak_power[:3]:
    print(entry)
```

**Expected Output**: Summaries showing per-step peak power (proxy based on wind speed) and a flag indicating when operational ramps exceed a threshold.

**Real-World Impact**: Demonstrates how to repurpose the regenerated TypeScript payload for downstream planning dashboards and alerts without maintaining separate JSON artifacts.

> **More**: Run `scripts/build_forecast_module.py data/norway_june8_forecast.nc --output frontend/src/data/auroraForecastPredictions.ts` after every new inference so operational data stays current.

> **Local first:** The pattern works offline with the bundled checkpoint; set `AZURE_AURORA_*` to offload the same workflow to Azure AI Foundry once production-ready.

## Common Workflow Patterns

### **Pattern 1: Batch → Rollout → Compare**

```python
import torch
from aurora import Aurora, rollout

def aurora_forecast(model_cls, checkpoint, batch, steps=2):
    model = model_cls()
    model.load_checkpoint("microsoft/aurora", checkpoint)
    model = model.to("cuda").eval()
    with torch.inference_mode():
        preds = [pred.to("cpu") for pred in rollout(model, batch, steps=steps)]
    return preds
```

### **Pattern 2: Lat/Lon Subsetting for Regional Apps**

```python
from aurora import Batch

def subset_batch(batch: Batch, lat_slice, lon_slice) -> Batch:
    return batch.select_region(lat_slice=lat_slice, lon_slice=lon_slice)

regional_batch = subset_batch(batch, slice(30, 60), slice(-130, -60))
regional_preds = aurora_forecast(Aurora, "aurora-0.25-pretrained.ckpt", regional_batch)
```

## Results Interpretation

### **Understanding Aurora Outputs**

```python
import torch

def interpret_surface(pred):
    metrics = {
        "t2m_mean": pred.surf_vars["2t"].mean().item() - 273.15,
        "wind_speed": torch.hypot(
            pred.surf_vars["10u"], pred.surf_vars["10v"]
        ).mean().item(),
        "msl_pressure": pred.surf_vars["msl"].mean().item() / 100.0,
    }
    return metrics

metrics = interpret_surface(preds[0])
for name, value in metrics.items():
    print(f"{name}: {value:.2f}")
```

### **Quality Assessment**

```python
import torch

def assess_rmse(pred, reference, key):
    diff = pred.surf_vars[key] - reference[key]
    return torch.sqrt((diff ** 2).mean()).item()

rmse = assess_rmse(preds[1], reference_batch, "2t")
print(f"RMSE (K): {rmse:.3f}")
```

## Performance Optimization

### **For Speed**

- Use `AuroraSmallPretrained` for exploratory work; upgrade to fine-tuned checkpoints once pipelines are stable.
- Cache checkpoints locally (`~/.cache/aurora`) to avoid repeated downloads.

### **For Accuracy**

- Enable LoRA weights for long-horizon rollouts when available (e.g., `Aurora(use_lora=True)` for HRES T0).  
- Align preprocessing with training stats—flip WeatherBench2 latitudes and ensure ERA5 static grids match target resolution.

### **For Scale**

- Stream data with Zarr chunks from WeatherBench2 and regrid with `Batch.regrid` to 0.1° only when required.  
- Offload multi-step rollouts to Azure AI Foundry using Blob storage channels.

