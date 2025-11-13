# Aurora Application Patterns

**Domain-specific workflows and proven use case implementations.**

This guide shows real-world Aurora applications across different domains. Each pattern includes code examples you can adapt for your scenario.

**Learning approach:**
1. **Norway prototype first** - See [quick-start.md](quick-start.md) for complete working example
2. **Understand patterns below** - Domain-specific adaptations
3. **Adapt for your use case** - Combine patterns with [prototyping-guide.md](prototyping-guide.md)

---

## Primary Use Cases

> **Getting started**: Run the Norway coastal forecast ([quick-start.md](quick-start.md)) to understand the end-to-end workflow. Then adapt these patterns for your domain.

---

### Use Case 1: Regional Coastal Forecasting (Norway Example)

**Scenario**: 24-hour temperature forecasts for Norway's coast at 0.25° resolution (48×48 grid).

**Reference implementation:** [assets/norway-example/](.vibe-kit/innovation-kits/aurora/assets/norway-example/)

**Key characteristics:**
- Small regional grid (48×48 = 2,304 points)
- 24-hour stable horizon (4 steps × 6h)
- Interactive React frontend with time slider
- Uses CDS ERA5 observations as input

```python
# From run_aurora_inference.py (simplified)
from aurora import AuroraSmall
import torch

model = AuroraSmall()
model.load_checkpoint("microsoft/aurora")
model.eval()

# Load 2 consecutive timesteps (June 7: 12:00, 18:00)
batch = load_era5_input(
    surf_file="data/4d2238a45558de23ef37ca2e27a0315.nc",
    atmos_file="data/4a1f46cd2447ab83c1f564af59d53023.nc",
    times=["2025-06-07T12:00", "2025-06-07T18:00"]
)

# Run 4-step rollout (24h forecast)
predictions = []
for step in range(4):
    with torch.no_grad():
        pred = model(batch)
        predictions.append(pred[0, 0])  # Extract first timestep
        batch = update_batch(batch, pred)  # Slide window

# Save to NetCDF for frontend visualization
save_forecast(predictions, "aurora_forecast_june8.nc")
```

**Adaptation tips:**
- Change region in `GRID_BOUNDS` (ensure divisible by 16)
- Extend to 48h (8 steps) for larger grids (64×64+)
- See [prototyping-guide.md](prototyping-guide.md) for full customization guide

**Real-world impact**: Fast regional forecasts (5-10 min on GPU) for applications needing high temporal resolution in specific areas.

---

### Use Case 2: High-Resolution Weather Nowcasting

**Scenario**: Generate 12–18 h forecasts at 0.25° for grid-aware decision dashboards.

```python
import matplotlib.pyplot as plt
import torch
from aurora import Aurora, rollout

model = Aurora(use_lora=False)
model.load_checkpoint("microsoft/aurora", "aurora-0.25-pretrained.ckpt")
model = model.to("cuda").eval()

with torch.inference_mode():
    preds = [pred.to("cpu") for pred in rollout(model, batch, steps=2)]

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].imshow(preds[0].surf_vars["2t"][0, 0].numpy() - 273.15, vmin=-40, vmax=40)
axes[0].set_title("Aurora 12h")
axes[1].imshow(reference_t2m.numpy() - 273.15, vmin=-40, vmax=40)
axes[1].set_title("ERA5 12h")
plt.tight_layout()
```

**Expected Output**: Side-by-side temperature maps with smooth gradients.

**Real-World Impact**: Proves Aurora’s ~5,000× faster turnaround for operational what-if analysis. (source: Microsoft Research blog)

---

### Use Case 2: Urban Air-Quality Outlooks

**Scenario**: Deliver 48-hour particulate and NO₂ forecasts for city health advisories.

```python
import torch
from aurora import AuroraAirPollution, rollout

model = AuroraAirPollution()
model.load_checkpoint("microsoft/aurora", "aurora-0.4-air-pollution.ckpt")
model = model.to("cuda").eval()

with torch.inference_mode():
    predictions = [pred.to("cpu") for pred in rollout(model, batch, steps=4)]

no2_series = [pred.surf_vars["tcno2"][0, 0].numpy() / 1e-6 for pred in predictions]
city_profile = [grid.mean() for grid in no2_series]
print("NO₂ forecast (µmol/m²):", city_profile)
```

**Expected Output**: Time series for NO₂ concentrations with reductions vs CAMS baseline.

**Real-World Impact**: Demonstrates 74% target improvement over CAMS for 5-day chemistry tasks. (source: Microsoft Research blog)

---

### Use Case 3: Ocean Wave Logistics Planning

**Scenario**: Predict swell height and wind wave direction for offshore operations.

```python
import torch
from aurora import AuroraWave, rollout

model = AuroraWave()
model.load_checkpoint("microsoft/aurora", "aurora-0.25-wave.ckpt")
model = model.to("cuda").eval()

with torch.inference_mode():
    waves = [pred.to("cpu") for pred in rollout(model, batch, steps=2)]

swh_forecast = waves[0].surf_vars["swh"][0, 0].numpy()
critical_cells = (swh_forecast > 4.0).sum()
print(f"SWH>4m grid cells: {critical_cells}")
```

**Expected Output**: Map of significant wave height with threshold exceedance counts.

**Real-World Impact**: Highlights multi-variable wave support with meteorological coupling. (source: example_wave.html)

---

### Use Case 4: Cyclone Track Ensemble Analysis

**Scenario**: Compare Aurora ensemble hurricane tracks against ground-truth observations using the included Hurricane Erin sample.

```python
from importlib import import_module
from pathlib import Path
import sys

import pandas as pd

DATA_DIR = (
    Path.cwd()
    / ".vibe-kit"
    / "innovation-kits"
    / "aurora"
    / "assets"
    / "samples"
    / "data"
).resolve()
if str(DATA_DIR) not in sys.path:
    sys.path.append(str(DATA_DIR))

ensemble = import_module("aurora_ensemble")
comparison = import_module("aurora_comparison")

tracks = {
    name: pd.DataFrame(track)
    for name, track in ensemble.get_all_ensemble_forecasts().items()
}
ground_truth_df = pd.DataFrame(comparison.get_track("ground_truth"))

spread = (
    pd.concat(tracks.values())
    .groupby("time")
    .agg({"latitude": ["mean", "min", "max"], "longitude": ["mean", "min", "max"], "wind": ["mean", "min", "max"]})
    .reset_index()
)

print(spread.head())
```

**Expected Output**: Summary table with ensemble mean/min/max latitude, longitude, and wind speed values per timestamp.

**Real-World Impact**: Demonstrates rapid situational awareness for cyclone forecasting by quantifying track uncertainty straight from the Aurora ensemble sample.

---

### Use Case 5: Operational Planning with Aurora Forecasts

**Scenario**: Convert Aurora weather forecasts into operational planning data using the Norway example pattern.

```python
import json
from pathlib import Path

# Use the Norway example as a reference for your domain
data_path = (
    Path.cwd()
    / ".vibe-kit"
    / "innovation-kits"
    / "aurora"
    / "assets"
    / "norway-example"
    / "frontend"
    / "public"
    / "forecast-data.json"
)

with data_path.open() as f:
    forecast = json.load(f)

daily_peak_power = []
for window in forecast["forecasts"]:
    steps = window["steps"]
    peak_kw = max(step["power_limited_kw"] for step in steps)
    ramp_flag = any(step["ramp_detected"] for step in steps)
    daily_peak_power.append(
        {
            "start": window["forecast_start_time"],
            "peak_power_kw": round(peak_kw, 2),
            "ramp_detected": ramp_flag,
        }
    )

print("First 3 planning entries:")
for entry in daily_peak_power[:3]:
    print(entry)
```

**Expected Output**: JSON-style summaries showing daily peak power (post ramp limiter) and whether grid ramp protection was triggered.

**Real-World Impact**: Captures the energy prototype’s workflow—offline Aurora inference, domain limits, and operator-facing analytics—in a reusable pattern you can adapt for other grid assets or planning dashboards.

> **More**: Pair this pattern with your scenario documentation to capture architecture diagrams, control logic, and deployment notes tailored to your environment. Use your preferred dashboard framework to visualise the stacked forecasts, timeline, and CSV exports.

> **Local first:** The pattern runs entirely on the bundled checkpoint until you provide the optional `AZURE_AURORA_*` environment variables, at which point the same scripts offload inference to Azure AI Foundry with automatic fallback.

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

## Integration Examples

### **With Azure Maps + Power BI**

```python
# Publish aurora forecast tiles to Azure Maps for visualization
upload_to_azure_maps(preds[0].surf_vars["2t"], layer="aurora-forecast")
```

### **With Geospatial ML Services**

```python
from geobuf import encode

encoded = encode(preds[0].surf_vars["swh"][0, 0].numpy())
ml_service.publish_feature("aurora_swh", encoded)
```
