# Norway Technical Guide: Aurora Inference Deep Dive

**Understand how Aurora generates 24-hour forecasts for mainland Norway.**

This guide unpacks the 64×112 Norway demo: data requirements, model expectations, script architecture, and validation workflows. Read it after [quick-start.md](quick-start.md) to understand every decision embedded in `run_aurora_inference.py`.

---

## Overview

**What this guide covers:**
- Aurora's input/output requirements (why 2 timesteps, why 64×112 grid)
- Script architecture (`run_aurora_inference.py` internals)
- Model mechanics (patch encoder, rollout loop, autoregressive prediction)
- Stability analysis (why 24 h works, what fails beyond)
- NetCDF structure, variable mapping, and TypeScript conversion

**Prerequisites:** Complete [quick-start.md](quick-start.md) first to have working example.

---

## 1. Aurora Model Specifications

### Model Details

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Model variant** | `Aurora` (pretrained 0.25° checkpoint) | 1.3 B parameters, ~5 GB weight file |
| **Patch size** | 16×16 cells | Height/width must be multiples of 16 |
| **Input timesteps** | Two consecutive | 6 h apart (e.g., 12 UTC & 18 UTC) |
| **Output per rollout step** | One timestep | 6 h ahead of last input |
| **Autoregressive** | Yes | Output is appended and fed back in |
| **Training data** | ERA5 global reanalysis | 1979–2023, 0.25° grid |

### Norway Configuration

| Parameter | Value |
|-----------|-------|
| **Grid size** | 64 latitudes × 112 longitudes (7,168 points) |
| **Resolution** | 0.25° (~28 km at 60° N) |
| **Geographic extent** | 57.0° N–72.75° N, 4.0° E–31.75° E |
| **Forecast steps** | 4 (June 8 00/06/12/18 UTC) |
| **Input timesteps** | June 7 at 12 UTC and 18 UTC (ERA5) |

---

## 2. Why 2 Input Timesteps?

### Atmospheric State vs Trends

Aurora requires **two consecutive timesteps exactly six hours apart** to capture:

**Timestep 1 (T−6 h, e.g., June 7 12:00):**
- Temperature distribution
- Pressure field
- Wind field
- Humidity profile

**Timestep 2 (T, e.g., June 7 18:00):**
- Same variables, 6 hours later

**Derived information (T₂ − T₁):**
- **Wind acceleration:** Is the jet stream strengthening or weakening?
- **Temperature trends:** Heating or cooling? How fast?
- **Pressure tendencies:** Rising (fair weather) or falling (storm approaching)?
- **Moisture flux:** Convergence (precipitation forming) or divergence?

**Analogy:** Predicting where a car will be in one hour requires:
1. Current position (Timestep 2)
2. Velocity (difference between Timestep 2 and Timestep 1)

One timestep ⇒ position only → You cannot infer motion.  
Two timesteps ⇒ position + velocity → You can extrapolate trajectory.

### Common Misconception

**WRONG:** "Aurora outputs 2 timesteps per forecast step, so it needs 2 inputs"  
**CORRECT:** Aurora outputs **1 timestep** per rollout step. It needs 2 inputs to understand atmospheric dynamics (state + trends).

---

## 3. Grid Constraints & Why 64×112 Works

### Patch Size Requirement

Aurora tokenizes the planet into **16×16 spatial patches**. Any regional subset must therefore have heights and widths that divide cleanly by 16.

```
Input grid: 64 × 112 cells
           ↓
Patches:   (64 ÷ 16) × (112 ÷ 16) = 4 × 7 = 28 patches
           ↓
Each patch: 16 × 16 cells processed together
```

**Rule of thumb:** `lat_cells % 16 == 0` and `lon_cells % 16 == 0` or Aurora throws `ValueError: grid dimensions must be divisible by 16`.

### Choosing a Domain Size

| Grid (lat × lon) | Points | Patches | Typical use |
|------------------|--------|---------|-------------|
| 32 × 32 | 1,024 | 4 | Toy experimentation only |
| 48 × 48 | 2,304 | 9 | Fast regional demo, limited coverage |
| **64 × 112** | **7,168** | **28** | **Full mainland Norway (current demo)** |
| 80 × 128 | 10,240 | 40 | Regional + buffer zone |
| 128 × 256 | 32,768 | 128 | Continental / global slices |

We selected **64 × 112** because it:
- Captures the full Norwegian mainland while keeping inference time manageable.
- Preserves coastlines and fjords that were clipped in smaller grids.
- Provides better boundary context than the older coastal subset without requiring cloud-scale hardware.

---

## 4. Why Stop at 24 Hours?

### Stability Checkpoints

Aurora excels on global domains because surrounding cells provide natural boundary conditions. Regional cut-outs—64 × 112 included—lack that context, so autoregressive errors grow over time.

| Steps | Hours | Result | Typical 2 m temp range | Notes |
|-------|-------|--------|------------------------|-------|
| **4** | **24 h** | ✅ Stable | −5 °C to 18 °C | Smooth evolution, used in demo |
| 8 | 48 h | ⚠️ Watch | −8 °C to 22 °C | Minor ringing near edges |
| 16 | 96 h | ❌ Diverges | below −40 °C / above 40 °C | Boundary artifacts dominate |
| 28 | 168 h | ❌ Fails | Unphysical extremes | Vertical striping, energy blow-up |

### What Breaks

1. **Boundary shortages** – With only a few cells buffering the coastline, the model must invent inflow/outflow conditions.
2. **Error compounding** – Each 6 h step feeds slightly worse inputs back into the loop.
3. **Energy imbalance** – Without global constraints the latent dynamics drift.
4. **Feedback loops** – Once a hot/cold streak forms at the edge, later steps amplify it.

### Extending Responsibly

- Increase domain size (e.g., 80 × 128) so inflow boundaries sit farther offshore.
- Blend with a coarse global forecast every few steps (boundary relaxation).
- Run short Aurora segments (24–36 h), then hand off to a physics model for longer horizons.

---

## 5. Script Architecture: `run_aurora_inference.py`

### High-Level Flow

1. Parse CLI overrides (defaults point to norway_surface/atmospheric/static.nc)
2. Load two ERA5 timesteps (June 7 12 UTC & 18 UTC) and crop to 64 × 112
3. Build an Aurora `Batch` containing surface, atmospheric, and static tensors
4. Instantiate the pretrained Aurora model and rollout four autoregressive steps
5. Write the predictions to `data/norway_june8_forecast.nc`

The code is split into three helpers plus a CLI wrapper:

| Function | Responsibility |
|----------|----------------|
| `load_era5_input()` | Open NetCDF, enforce patch-compatible cropping, build the `Batch` object |
| `run_forecast()` | Load the model, execute the rollout, return a list of predicted `Batch` objects |
| `save_forecast_netcdf()` | Extract numpy arrays, assemble an `xarray.Dataset`, and write NetCDF |

### Loading ERA5 (`load_era5_input`)

Key operations:

1. **File I/O** – Opens `norway_surface.nc`, `norway_atmospheric.nc`, `norway_static.nc` with `xarray`. The files already contain the full 64 × 112 domain, so only minimal cropping is needed to enforce multiples of 16.
2. **Variable mapping** – Surface variables (`10u`, `10v`, `2t`, `msl`) become `torch.Tensor` batches shaped `[1, 2, 64, 112]`. Atmospheric tensors include the four pressure levels and end up `[1, 2, 4, 64, 112]`. Static tensors drop singleton dimensions to `[64, 112]`.
3. **Metadata** – Latitude/longitude arrays and the second timestamp (18 UTC) are packaged into Aurora's `Metadata` class so downstream code knows the grid.

### Rollout (`run_forecast`)

```python
model = Aurora(use_lora=False)
model.load_checkpoint("microsoft/aurora", "aurora-0.25-pretrained.ckpt")
model = model.to(DEVICE)

predictions = [pred.to("cpu") for pred in rollout(model, batch, steps=num_steps)]
```

Important details:

- `DEVICE` selects CUDA when available; otherwise CPU. On CPU the rollout takes ~45 min in the dev container.
- `rollout` returns a list of `Batch` objects, each with shape `(1, 1, 64, 112)` for surface variables. We immediately move them to CPU memory so downstream processing does not depend on GPU availability.
- The script uses `num_steps=4` to produce 24 h of output. You can make it a CLI flag if you need experimentation.

### Persisting Output (`save_forecast_netcdf`)

The helper extracts each scalar field, stacks them over the `time` dimension, and writes an `xarray.Dataset`:

```python
u10 = np.stack([pred.surf_vars["10u"][0, 0].cpu().numpy() for pred in predictions])
# ... same for v10, t2m, msl

ds = xr.Dataset(
    {
        "u10": (["valid_time", "latitude", "longitude"], u10),
        "v10": (...),
        "t2m": (...),
        "msl": (...),
    },
    coords={
        "valid_time": times,  # June 8 00/06/12/18 UTC
        "latitude": lat,
        "longitude": lon,
    },
)
```

Static variables (land-sea mask, geopotential, soil type) are copied into the dataset so converters and visualizations can reuse them if needed. The final NetCDF weighs ~6.4 MB.

---

## 6. Required Variables & File Layout

### Surface & Static (`data/norway_surface.nc` / `data/norway_static.nc`)

| Variable | NetCDF name | Units | Purpose |
|----------|-------------|-------|---------|
| 10 m U wind | `u10` | m s⁻¹ | Zonal wind forcing at the surface |
| 10 m V wind | `v10` | m s⁻¹ | Meridional wind forcing |
| 2 m temperature | `t2m` | K | Near-surface thermal state |
| Mean sea-level pressure | `msl` | Pa | Synoptic pressure pattern |

Static fields live in `norway_static.nc` and load once per run:

| Variable | NetCDF name | Notes |
|----------|-------------|-------|
| Land–sea mask | `lsm` | Binary mask used to sharpen coastal gradients |
| Surface geopotential | `z` | Orography (m² s⁻²) |
| Soil type | `slt` | ERA5 categorical soil representation |

### Atmospheric (`data/norway_atmospheric.nc`)

The atmospheric file carries four pressure levels—1000, 925, 850, and 700 hPa—for each timestep.

| Variable | NetCDF name | Units | Why Aurora needs it |
|----------|-------------|-------|---------------------|
| Geopotential | `z` | m² s⁻² | Height of each pressure surface |
| Specific humidity | `q` | kg kg⁻¹ | Moisture transport, latent heating |
| Temperature | `t` | K | Vertical temperature profile |
| U wind | `u` | m s⁻¹ | Zonal wind at each level |
| V wind | `v` | m s⁻¹ | Meridional wind at each level |

Sampling multiple levels lets Aurora reason about jet dynamics, frontal slopes, and moist instability. Removing a level breaks the model contract and raises key errors during batching.

---

## 7. NetCDF Structure Details

### ERA5 Inputs

**Surface (`norway_surface.nc`)**

```python
<xarray.Dataset>
Dimensions:  (valid_time: 28, latitude: 64, longitude: 112)
Coordinates:
    * valid_time  (valid_time) datetime64[ns] 2025-06-01 ... 2025-06-07T18:00
    * latitude    (latitude) float32 72.75 72.5 ... 57.25 57.0
    * longitude   (longitude) float32 4.0 4.25 ... 31.5 31.75
Data variables:
        u10  (valid_time, latitude, longitude) float32 ...
        v10  (valid_time, latitude, longitude) float32 ...
        t2m  (valid_time, latitude, longitude) float32 ...
        msl  (valid_time, latitude, longitude) float32 ...
```

Static fields (`norway_static.nc`) mirror the latitude/longitude coordinates but lack a time axis.

**Atmospheric (`norway_atmospheric.nc`)**

```python
<xarray.Dataset>
Dimensions:  (valid_time: 28, pressure_level: 4, latitude: 64, longitude: 112)
Coordinates:
    * valid_time     (valid_time) datetime64[ns] ...
    * pressure_level (pressure_level) int32 1000 925 850 700
    * latitude       (latitude) float32 ...
    * longitude      (longitude) float32 ...
Data variables:
        z  (valid_time, pressure_level, latitude, longitude) float32 ...
        q  (...)
        t  (...)
        u  (...)
        v  (...)
```

### Aurora Output (`norway_june8_forecast.nc`)

```python
<xarray.Dataset>
Dimensions:  (valid_time: 4, latitude: 64, longitude: 112)
Coordinates:
    * valid_time  (valid_time) datetime64[ns] 2025-06-08 ... 2025-06-08T18:00
    * latitude    (latitude) float32 72.75 ... 57.0
    * longitude   (longitude) float32 4.0 ... 31.75
Data variables:
        t2m  (valid_time, latitude, longitude) float32 ...
        u10  (valid_time, latitude, longitude) float32 ...
        v10  (valid_time, latitude, longitude) float32 ...
        msl  (valid_time, latitude, longitude) float32 ...
Attributes:
        forecast_reference_time: 2025-06-07T18:00:00
        model: Aurora-0.25-pretrained
```

Static fields (`lsm`, `z`, `slt`) are appended as 2-D variables so downstream tooling (including the TypeScript converter) has access to land/ocean masks and elevation data when building visualizations.

---

## 8. Performance Snapshot

### Runtime Benchmarks (4 steps, 64 × 112)

| Hardware | Model load | Rollout | Save | Total |
|----------|------------|---------|------|-------|
| GPU (A100 40 GB) | 45 s | 5 min | 10 s | ~6 min |
| GPU (T4 16 GB) | 70 s | 7 min | 10 s | ~8 min |
| CPU (Devcontainer, 16 vCPU) | 2 min | 42 min | 15 s | ~45 min |

Numbers assume the Aurora checkpoint is already cached. The first run downloads ~5 GB, which can add several minutes depending on bandwidth.

### Memory & Disk

- **VRAM:** 9–12 GB during rollout on GPU
- **System RAM:** 6 GB (CPU path)
- **Disk:**
    - Aurora checkpoint: ~5 GB (`~/.cache/huggingface/`)
    - ERA5 inputs: ~8.5 MB (`norway_surface.nc`, `norway_atmospheric.nc`, `norway_static.nc`)
    - Forecast output: ~6.4 MB (`norway_june8_forecast.nc`)

---

## 9. Common Issues & Fixes

### Grid Dimension Errors

```
ValueError: grid dimensions (60, 112) not divisible by patch_size (16)
```

**Fix:** Ensure both axes obey the 16-cell rule.

```python
lat_cells = int((lat_max - lat_min) / 0.25)
lon_cells = int((lon_max - lon_min) / 0.25)
assert lat_cells % 16 == 0
assert lon_cells % 16 == 0
```

The bundled downloads already satisfy this. If you customize the bounds, adjust them in 0.25° increments until both counts divide by 16.

### Output Divergence

**Symptoms:** Unrealistic temperatures (e.g., below −40 °C or above 35 °C) or striped patterns after step 5.

**Fixes:**

```python
# Keep horizons short
forecast = run_forecast(batch, num_steps=4)

# If experimenting, ramp slowly
# forecast = run_forecast(batch, num_steps=6)
```

Then inspect the logged min/max from `save_forecast_netcdf`. If values explode, revert to four steps or expand the domain.

### CUDA Out of Memory

```
RuntimeError: CUDA out of memory
```

**Options:**

1. Free GPU memory (`nvidia-smi --gpu-reset` on bare metal, close other notebooks, etc.).
2. Force CPU execution: `python3 scripts/run_aurora_inference.py --device cpu` (slow but reliable).
3. If you added extra variables, remove them—batch size is already minimal.

---

## 10. Extending the Example

### Change the Domain

Region bounds live near the top of `run_aurora_inference.py`:

```python
LAT_MIN, LAT_MAX = 57.0, 72.75
LON_MIN, LON_MAX = 4.0, 31.75
```

Update those values (or add CLI flags) to target another geography. After editing, recompute cell counts to confirm patch compatibility:

```python
lat_cells = int((LAT_MAX - LAT_MIN) / 0.25) + 1
lon_cells = int((LON_MAX - LON_MIN) / 0.25) + 1
assert lat_cells % 16 == 0
assert lon_cells % 16 == 0
```

Re-run the ERA5 download helper (`assets/scripts/download_era5_subset.py`) with the new bounds so the NetCDF files match.

### Export More Variables

The forecast dataset already contains `u10`, `v10`, `t2m`, and `msl`. To surface additional fields:

1. Confirm the Aurora `Batch` exposes them (`pred.surf_vars` or `pred.atmos_vars`).
2. Append them in `save_forecast_netcdf` and add metadata describing units.
3. Update `scripts/build_forecast_module.py` and the frontend components to render the new variable.

### Longer Horizons

Experiment gradually:

```python
forecast = run_forecast(batch, num_steps=6)   # 36 h
forecast = run_forecast(batch, num_steps=8)   # 48 h
```

Check the logged stats after each run. If temperatures explode or the UI shows edge artifacts, scale back or enlarge the spatial domain before going further.

---

## 11. Validation & Debugging

### Inspect Inputs Quickly

```bash
python3 assets/scripts/describe_netcdf.py data/norway_surface.nc
```

Expect 28 timesteps (June 1–7) and 64 × 112 grids with the four surface variables. Run the same command for `norway_atmospheric.nc` and verify the four pressure levels.

### Plot a Forecast Slice

```python
import xarray as xr
import matplotlib.pyplot as plt

ds = xr.open_dataset("data/norway_june8_forecast.nc")

plt.figure(figsize=(9, 6))
ds.t2m.isel(valid_time=0).plot()
plt.title("Aurora forecast – 8 Jun 00 UTC")
plt.tight_layout()
plt.savefig("forecast_t0.png", dpi=150)
```

### Compare with Observations

If you download ERA5 observations for June 8:

```python
obs = xr.open_dataset("data/norway_surface_june8.nc")
pred = xr.open_dataset("data/norway_june8_forecast.nc")

obs = obs.interp_like(pred)
rmse = float(((pred.t2m - obs.t2m) ** 2).mean() ** 0.5)
print(f"2m temperature RMSE: {rmse:.2f} K")
```

Anything beyond ~2 K RMSE indicates either a bad input pull or a long forecast horizon introducing drift.

---

## 12. Further Reading

**Aurora paper:** [Aurora: A Foundation Model of the Atmosphere](https://www.microsoft.com/en-us/research/publication/aurora/)  
**HuggingFace model:** [microsoft/aurora](https://huggingface.co/microsoft/aurora)  
**CDS ERA5 docs:** [ERA5 hourly data](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels)  
**NetCDF guide:** [Xarray documentation](https://docs.xarray.dev/)

---

## Summary

**Key takeaways:**
- Aurora needs **two six-hour timesteps** to derive both state and tendency information.
- Keep spatial dimensions **aligned to 16-cell patches**; the demo uses 64 × 112 for mainland coverage.
- **24-hour horizons** remain stable on regional domains; extend cautiously and monitor diagnostics.
- Surface, static, and multi-level atmospheric fields are all required to build the Aurora `Batch`.
- The rollout is autoregressive: every new prediction feeds the next step and is saved to NetCDF for downstream tooling.

**Next steps:**
- [expand-norway-example.md](expand-norway-example.md) – Customize regions, dates, and variables.
- [application-patterns.md](application-patterns.md) – See how teams integrate forecasts.
- [troubleshooting.md](troubleshooting.md) – Triage unexpected runtime issues.

---

**Part of:** [Aurora Innovation Kit](.agents/skills/aurora/SKILL.md)  
**Reference code:** [assets/norway-example/scripts/run_aurora_inference.py](.agents/skills/aurora/assets/norway-example/scripts/run_aurora_inference.py)
