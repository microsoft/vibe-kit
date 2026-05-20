# Customization Guide

**Adapt Aurora for your own region, build from scratch, or apply domain-specific logic.**

After completing the [inference quick-start](quick-start-inference.md), use this guide to go beyond Norway. For technical details on grid constraints, data formats, and performance, see [technical-reference.md](technical-reference.md).

---

## Contents

- [Quick Regional Adaptation](#quick-regional-adaptation)
- [Manual Adaptation](#manual-adaptation)
- [Building from Scratch](#building-from-scratch)
- [Domain Recipes](#domain-recipes)
- [Fine-Tuning Aurora](#fine-tuning-aurora)

---

## Quick Regional Adaptation

Adapt the Norway prototype to any region in one command using `setup_region.py`.

### Step 1: Get CDS API Credentials

1. Create an account at https://cds.climate.copernicus.eu
2. After email verification, visit https://cds.climate.copernicus.eu/api-how-to
3. Copy your API key (alphanumeric string)

### Step 2: Configure Credentials

```bash
cd assets/inference
cp .env.example .env
# Edit .env and set: CDS_API_KEY=your-api-key-here
```

The `.env` file is gitignored so credentials stay local.

### Step 3: Run setup_region.py

```bash
cd assets/inference/scripts

# Example: Hawaii
python3 setup_region.py \
  --name "Hawaii" \
  --lat-min 18.5 --lat-max 23.5 \
  --lon-min -161 --lon-max -154
```

This adjusts bounds to Aurora's grid requirements (dimensions divisible by 16), copies the Norway template, updates the frontend, downloads ERA5 data, and generates the visualization. Takes 5-10 minutes.

### Step 4: Launch

```bash
cd assets/hawaii-example/frontend
npm install && npm run dev
```

Open http://localhost:5174 to see your region's observations. Run inference and build forecast modules the same way as the quick-start.

### Common Regions

```bash
# California
python3 setup_region.py --name "California" \
  --lat-min 32 --lat-max 42 --lon-min -124 --lon-max -114

# Mediterranean
python3 setup_region.py --name "Mediterranean" \
  --lat-min 30 --lat-max 46 --lon-min -6 --lon-max 37

# Southeast Asia
python3 setup_region.py --name "Southeast Asia" \
  --lat-min -11 --lat-max 28 --lon-min 95 --lon-max 141
```

---

## Manual Adaptation

If you need more control than `setup_region.py` provides.

### Change Geographic Region

**Critical constraint:** Grid dimensions must be divisible by 16. Validate bounds first:

```bash
python assets/inference/scripts/validate_grid.py \
  --lat-min 36.0 --lat-max 48.0 --lon-min 0.0 --lon-max 12.0
```

**Working examples:**

| Region | Lat Range | Lon Range | Grid | Patches |
|--------|-----------|-----------|------|---------|
| Norway (demo) | 57.0-72.75°N | 4.0-31.75°E | 64x112 | 4x7 |
| North Sea | 52-60°N | 0-8°E | 32x32 | 2x2 |
| Mediterranean | 36-48°N | 0-12°E | 48x48 | 3x3 |
| US Northeast | 36-52°N | -80 to -64°W | 64x64 | 4x4 |

Edit `GRID_BOUNDS` in `run_aurora_inference.py`, then update `norwayBounds` and `mapCenter` in `frontend/src/App.tsx`.

### Fetch Your Own CDS Data

Use `download_era5_subset.py` for each data type:

```bash
# Surface variables
python assets/inference/scripts/download_era5_subset.py \
    --dataset reanalysis-era5-single-levels \
    --variables 2m_temperature 10m_u_component_of_wind 10m_v_component_of_wind mean_sea_level_pressure \
    --year 2025 --month 06 --days 01 02 03 04 05 06 07 \
    --hours 00 06 12 18 \
    --area 48.0 0.0 36.0 12.0 \
    --target data/your_region_surface.nc
```

Repeat for atmospheric (`reanalysis-era5-pressure-levels` with `--levels`) and static variables. See [technical-reference.md](technical-reference.md#data-requirements) for full variable specifications.

### Adjust Forecast Horizon

Edit `num_steps` in `run_aurora_inference.py`:

```python
num_steps = 4   # 24h (default)
num_steps = 8   # 48h
num_steps = 12  # 72h
```

Larger grids support longer horizons. See the [stability table](technical-reference.md#forecast-stability) for limits. After inference, verify stability:

```bash
python assets/inference/scripts/check_divergence.py --forecast data/your_forecast.nc
```

### Add Variables

Aurora supports additional ERA5 variables: `total_precipitation`, `surface_pressure`, `total_cloud_cover`, `relative_humidity`, `vertical_velocity`, etc.

1. Add variable names to `download_era5_subset.py --variables`
2. Update `run_aurora_inference.py` input batch
3. Update `build_forecast_module.py` if exposing in the frontend

**Note:** Aurora was trained on specific variables. Adding unsupported variables will not improve predictions. Check the [Aurora docs](https://huggingface.co/microsoft/aurora) for the full supported set.

---

## Building from Scratch

If you want to build an Aurora application without starting from the Norway example.

### Use the Prototype Template

Copy and customize the bundled template:

```bash
cp assets/inference/scripts/aurora_prototype_template.py my_prototype.py
# Edit: replace load_your_data() and apply_your_domain_logic()
python my_prototype.py --data ./data/your_data.nc --steps 4
```

The template provides the complete skeleton: model loading, data input, inference loop, and domain logic hooks. See `assets/inference/scripts/README.md` for details.

### Batch Construction

Aurora's input is a `Batch` object containing:
- **surf_vars:** Surface variables as 4D tensors `(batch, time, lat, lon)` — required: `2t`, `10u`, `10v`, `msl`
- **static_vars:** Static features as 2D tensors `(lat, lon)` — `lsm`, `z`, `slt`
- **atmos_vars:** Atmospheric profiles as 5D tensors `(batch, time, level, lat, lon)` — `t`, `u`, `v`, `q`, `z`
- **metadata:** Lat/lon arrays, timestamps, pressure levels

See `assets/inference/norway-example/scripts/run_aurora_inference.py` (function `load_era5_input()`) for a complete working implementation. See [technical-reference.md](technical-reference.md#variable-naming) for the mapping between ERA5 names and Aurora's internal names.

### Inference Pattern

```python
from aurora import AuroraSmallPretrained, rollout
import torch

model = AuroraSmallPretrained()
model.load_checkpoint()
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device).eval()

batch = load_your_data(...)  # Returns a Batch object
batch = batch.to(device)

with torch.inference_mode():
    forecasts = [pred.to("cpu") for pred in rollout(model, batch, steps=4)]
```

### Output Processing

Aurora produces full spatial grids. Summarize them for your application:

```python
import numpy as np

for step_idx, pred in enumerate(forecasts):
    u10 = pred.surf_vars["10u"][0, 0].numpy()
    v10 = pred.surf_vars["10v"][0, 0].numpy()
    t2m = pred.surf_vars["2t"][0, 0].numpy()
    wind_speed = np.sqrt(u10**2 + v10**2)

    print(f"+{(step_idx+1)*6}h: wind={wind_speed.mean():.1f} m/s, temp={t2m.mean()-273.15:.1f} C")
```

---

## Domain Recipes

Each recipe uses the base Aurora workflow with domain-specific post-processing. Start from the prototype template.

### Wind Farm Siting

Extrapolate 10m wind to hub height using the log-wind profile:

```python
def wind_power_estimate(forecasts, hub_height=80, roughness=0.03):
    results = []
    for pred in forecasts:
        u10 = pred.surf_vars["10u"][0, 0].numpy()
        v10 = pred.surf_vars["10v"][0, 0].numpy()
        ws_10m = np.sqrt(u10**2 + v10**2)

        # Log-wind profile extrapolation
        ws_hub = ws_10m * np.log(hub_height / roughness) / np.log(10 / roughness)

        # Simple power curve (cut-in 3 m/s, rated 12 m/s, cut-out 25 m/s)
        power = np.where(ws_hub < 3, 0,
                np.where(ws_hub < 12, (ws_hub / 12) ** 3,
                np.where(ws_hub < 25, 1.0, 0)))

        results.append({"capacity_factor": float(power.mean())})
    return results
```

### Emergency Response

Set up threshold-based alerts for extreme weather:

```python
def check_extreme_weather(forecasts, temp_threshold_C=35, wind_threshold_ms=25):
    alerts = []
    for step_idx, pred in enumerate(forecasts):
        t2m = pred.surf_vars["2t"][0, 0].numpy() - 273.15
        u10 = pred.surf_vars["10u"][0, 0].numpy()
        v10 = pred.surf_vars["10v"][0, 0].numpy()
        ws = np.sqrt(u10**2 + v10**2)

        if t2m.max() > temp_threshold_C:
            alerts.append(f"Step {step_idx}: Heat warning ({t2m.max():.1f} C)")
        if ws.max() > wind_threshold_ms:
            alerts.append(f"Step {step_idx}: Wind warning ({ws.max():.1f} m/s)")
    return alerts
```

### Solar Energy

Use temperature and pressure gradients as cloud cover proxies:
- Temperature inversions suggest stable air (clear skies, higher PV)
- Large pressure gradients indicate frontal activity (cloud cover, lower PV)
- Combine with ERA5 `total_cloud_cover` if available for better estimates

### Operational Planning

Convert forecasts to planning metrics (e.g., peak power, ramp detection):

```python
def peak_power_kw(step):
    return max(cell["windSpeed"] for cell in step["cells"]) * 120.0

for step in forecast["steps"]:
    peak_kw = peak_power_kw(step)
    ramp_flag = peak_kw > 5000
    print(f"{step['timestamp']}: {peak_kw:.0f} kW, ramp={ramp_flag}")
```

### Tropical Cyclone Tracking

Aurora can track tropical cyclones (TCs) through autoregressive rollouts using the built-in `aurora.Tracker`. Use the **Aurora 0.25° Fine-Tuned** checkpoint for best results.

```python
from datetime import datetime

import torch
from aurora import Aurora, Batch, Tracker, rollout

model = Aurora()
model.load_checkpoint()

# Construct an initial condition for the model. The TC will be tracked using
# predictions for this initial condition.
initial_condition = Batch(...)

# Initialise the tracker with the current position and time of the TC. The time
# should match the initial condition above.
tracker = Tracker(init_lat=..., init_lon=..., init_time=datetime(...))

model.eval()
model = model.to("cuda")

# Run the tracker for predictions up to two days (8 six-hour steps).
with torch.inference_mode():
    for pred in rollout(model, initial_condition, steps=8):
        tracker.step(pred)

model = model.to("cpu")

# Summarize the track as a DataFrame.
track = tracker.results()
```

For a complete worked example tracking [Typhoon Nanmadol (2022)](https://en.wikipedia.org/wiki/Typhoon_Nanmadol_(2022)), see the [upstream Aurora repository examples](https://github.com/microsoft/aurora).

---

## Fine-Tuning Aurora

The base Aurora model works well for general weather forecasting. Consider fine-tuning when you need:

- **Domain-specific behavior** (microclimates, urban heat islands, specialized maritime conditions)
- **Improved accuracy** for a specific region or phenomenon
- **Custom variables** not in Aurora's original training set

Use the fine-tuning workflow in this skill — see [quick-start-finetune.md](quick-start-finetune.md), [about-finetune.md](about-finetune.md), and [finetuning-guide.md](finetuning-guide.md). The starter code (`starter-code/`) ships with training, evaluation, and visualization CLIs.
