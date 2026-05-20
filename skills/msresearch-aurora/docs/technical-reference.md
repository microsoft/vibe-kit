# Technical Reference

**Model specifications, data requirements, performance, deployment, and validation.**

This is the single authoritative reference for Aurora technical details. For a plain-language introduction, see [about-aurora.md](about-aurora.md). For hands-on usage, see [quick-start-inference.md](quick-start-inference.md) and [customization-guide.md](customization-guide.md).

---

## Contents

- [Model Specifications](#model-specifications)
- [Grid Constraints](#grid-constraints)
- [Data Requirements](#data-requirements)
- [Variable Naming](#variable-naming)
- [CDS Data Integration](#cds-data-integration)
- [Supported Data Formats](#supported-data-formats)
- [Forecast Stability](#forecast-stability)
- [Performance](#performance)
- [Deployment](#deployment)
- [Validation](#validation)

---

## Model Specifications

| Property | Value |
|---|---|
| Model | AuroraSmall (bundled) |
| Parameters | 1.3 billion |
| Architecture | 3D Swin Transformer U-Net with Perceiver encoder/decoder |
| Patch size | 16x16 |
| Timestep | 6 hours |
| Input requirement | 2 consecutive timesteps, 6 hours apart |
| Checkpoint size | ~5 GB |
| Default resolution | 0.25° (~31 km) |

Aurora uses two consecutive timesteps because it needs both the current atmospheric state and the rate of change (temperature trends, wind acceleration, pressure tendencies) to make accurate predictions.

### Model Variants

| Variant | Use case |
|---|---|
| `AuroraSmallPretrained` | General-purpose inference (this kit) |
| `Aurora` (full) | Higher accuracy, requires more VRAM |
| Fine-tuned variants | Domain-specific (air quality, waves) — see [finetuning-guide.md](finetuning-guide.md) |

---

## Grid Constraints

**All grid dimensions must be divisible by 16.** This is a hard constraint from Aurora's patch-based encoder.

Validate bounds before downloading data:

```bash
python assets/inference/scripts/validate_grid.py \
  --lat-min 36.0 --lat-max 48.0 --lon-min 0.0 --lon-max 12.0
```

If dimensions are not divisible by 16, the script suggests adjusted bounds.

**Working grid examples:**

| Region | Lat Range | Lon Range | Grid | Patches |
|--------|-----------|-----------|------|---------|
| Norway (demo) | 57.0-72.75°N | 4.0-31.75°E | 64x112 | 4x7 |
| North Sea | 52-60°N | 0-8°E | 32x32 | 2x2 |
| Mediterranean | 36-48°N | 0-12°E | 48x48 | 3x3 |
| US Northeast | 36-52°N | -80 to -64°W | 64x64 | 4x4 |
| Australia East | -38 to -22°S | 146-162°E | 64x64 | 4x4 |

---

## Data Requirements

Aurora expects three types of input, each in a separate NetCDF file:

### Surface Variables (required)

```
2m_temperature (t2m)           -> 2-meter temperature (K)
10m_u_component_of_wind (u10)  -> 10-meter zonal wind (m/s)
10m_v_component_of_wind (v10)  -> 10-meter meridional wind (m/s)
mean_sea_level_pressure (msl)  -> Mean sea level pressure (Pa)
```

### Atmospheric Variables (recommended)

At pressure levels (default: 1000, 925, 850, 700 hPa):

```
temperature (t)          -> Temperature (K)
u_component_of_wind (u)  -> Zonal wind (m/s)
v_component_of_wind (v)  -> Meridional wind (m/s)
specific_humidity (q)    -> Specific humidity (kg/kg)
geopotential (z)         -> Geopotential (m^2/s^2)
```

### Static Variables (recommended)

```
land_sea_mask (lsm)  -> 0=water, 1=land
geopotential (z)     -> Surface elevation (m^2/s^2)
soil_type (slt)      -> Categorical
```

### Tensor Shapes

| Type | Shape | Example |
|---|---|---|
| Surface | `(batch, time, lat, lon)` | `(1, 2, 64, 112)` |
| Atmospheric | `(batch, time, level, lat, lon)` | `(1, 2, 4, 64, 112)` |
| Static | `(lat, lon)` | `(64, 112)` |

---

## Variable Naming

ERA5 and Aurora use different names for the same variables. This is a common source of confusion.

| ERA5 name (download) | Aurora internal name (Batch) | Description |
|---|---|---|
| `t2m` / `2m_temperature` | `2t` | 2-meter temperature |
| `u10` / `10m_u_component_of_wind` | `10u` | 10-meter zonal wind |
| `v10` / `10m_v_component_of_wind` | `10v` | 10-meter meridional wind |
| `msl` / `mean_sea_level_pressure` | `msl` | Mean sea level pressure |

The inference script (`run_aurora_inference.py`) handles this mapping automatically. If building from scratch, ensure your Batch uses Aurora's internal names (right column).

---

## CDS Data Integration

### Credentials

1. Create an account at https://cds.climate.copernicus.eu
2. Get your API key from https://cds.climate.copernicus.eu/api-how-to
3. Configure:
   ```bash
   cd assets/inference
   cp .env.example .env
   # Edit .env and set: CDS_API_KEY=your-api-key-here
   ```

The API key is a simple alphanumeric string. The `.env` file is gitignored. Legacy `~/.cdsapirc` entries also work.

### Download Script

```bash
python assets/inference/scripts/download_era5_subset.py \
    --dataset reanalysis-era5-single-levels \
    --variables 2m_temperature 10m_u_component_of_wind 10m_v_component_of_wind mean_sea_level_pressure \
    --year 2025 --month 06 --days 01 02 03 04 05 06 07 \
    --hours 00 06 12 18 \
    --area 72.75 4 57 31.75 \
    --target data/my-region-surface.nc
```

Repeat for atmospheric (`reanalysis-era5-pressure-levels` with `--levels`) and static datasets.

### Manual Download

Use the [CDS web interface](https://cds.climate.copernicus.eu/datasets):
- Select dataset (`reanalysis-era5-single-levels` or `reanalysis-era5-pressure-levels`)
- Choose variables, date range, region
- Download as NetCDF

---

## Supported Data Formats

| Format | Source | Resolution | Notes |
|---|---|---|---|
| ERA5 NetCDF | Copernicus CDS | 0.25° | Primary path for this kit |
| WeatherBench2 Zarr/NetCDF | Google Cloud | 0.25°/0.1° | HRES T0 and analysis |
| CAMS NetCDF ZIP | Atmosphere Data Store | 0.4° | Air quality; not bundled |
| ECMWF MARS GRIB | ECMWF API | 0.25° | Ocean waves; not bundled |

Only ERA5 is directly supported by the bundled scripts. Other formats require custom loading code.

---

## Forecast Stability

Smaller grids diverge faster. Use this table to set `num_steps` safely:

| Grid Size | Stable Horizon | Marginal | Diverges |
|-----------|----------------|----------|----------|
| 32x32 | 12-18h (2-3 steps) | 24h | 36h+ |
| 48x48 | 18-24h (3-4 steps) | 36h | 60h+ |
| 64x64 | 24-36h (4-6 steps) | 48h | 72h+ |
| 64x112 (Norway) | 24h (4 steps) | 36-48h | 60h+ |
| 80x128 | 36-48h (6-8 steps) | 60-72h | 96h+ |

After inference, verify stability:

```bash
python assets/inference/scripts/check_divergence.py --forecast data/your_forecast.nc
```

Exit code 0 = plausible. Exit code 1 = temperatures outside -60 to +60 C — reduce `num_steps`.

---

## Performance

### Hardware Requirements

| Use Case | CPU | RAM | GPU | Approx. Cost/hr |
|---|---|---|---|---|
| Dev/prototyping | 8 vCPU | 32 GB | RTX 4090 / L40S (24 GB) | ~$1.20 |
| Production | 16 vCPU | 128 GB | A100 80 GB / H100 | ~$5.80 |

### Inference Benchmarks (Norway 64x112, 4-step forecast)

| Hardware | Time |
|---|---|
| NVIDIA A100 40GB | ~6 min |
| NVIDIA T4 16GB | ~10 min |
| 16-core Intel Xeon (CPU) | ~45 min |
| 8-core M2 Mac (CPU) | ~55 min |

### Memory Usage

- GPU: 8-12 GB VRAM during rollout
- CPU: 4-6 GB RAM
- Disk: ~6 GB (model checkpoint + dependencies)

### Optimization

**Mixed precision (~40% memory reduction):**

```python
model = model.half()
with torch.cuda.amp.autocast():
    predictions = model(batch)
```

**Torch compile (~20% speed improvement):**

```python
model = torch.compile(model, mode="reduce-overhead")
```

**Smaller grids:** Reduce from 64x112 to 32x32 for ~55% memory reduction (shorter stable horizon).

### Scaling

- **Horizontal:** Shard rollouts across regions via Azure Batch or Kubernetes Jobs, merge NetCDF outputs
- **Vertical:** Upgrade to H100 80 GB for 0.1° grids or 10-day rollouts; enable tensor parallelism with `torch.distributed.fsdp`
- **Caching:** Persist static features and checkpoints in Azure Blob or local NVMe

---

## Deployment

### FastAPI Backend

Create a `backend/forecast_service.py` with:
- Model loaded at startup (load checkpoint once, keep in memory)
- POST `/forecast` endpoint accepting lat/lon bounds, start time, step count
- Grid validation (dimensions divisible by 16) before inference
- Error handling for CUDA OOM and data loading failures

Run with: `uvicorn backend.forecast_service:app --host 0.0.0.0 --port 8000`

### Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts/ ./scripts/
COPY backend/ ./backend/
RUN python3 -c "from aurora import AuroraSmall; m = AuroraSmall()"
EXPOSE 8000
CMD ["uvicorn", "backend.forecast_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t aurora-forecast .
docker run --gpus all -p 8000:8000 aurora-forecast
```

### Azure Container Apps

```bash
az containerapp up \
  --name aurora-forecast \
  --resource-group aurora-rg \
  --location eastus \
  --source . \
  --target-port 8000 \
  --ingress external
```

### Production Checklist

- [ ] Grid dimensions divisible by 16
- [ ] Forecast stability tested via `check_divergence.py`
- [ ] Automated CDS data pipeline with error handling
- [ ] CDS request throttling (avoid HTTP 429)
- [ ] Aurora checkpoint loaded once at startup
- [ ] Logging and alerts for failed forecasts
- [ ] Regular validation via `validate_forecast.py`
- [ ] Local cache of recent ERA5 data
- [ ] Load tested for expected traffic
- [ ] Dependency versions pinned
- [ ] Rollback plan with previous checkpoint

---

## Validation

### Quick Validation

```bash
python assets/inference/scripts/validate_forecast.py \
    --forecast data/norway_june8_forecast.nc \
    --observations data/norway_surface.nc \
    --variable t2m
```

Add `--plot validation_plot.png` for a 3-panel comparison (forecast, observations, error).

### Interpreting Results

| Metric | Good | Acceptable | Investigate |
|---|---|---|---|
| RMSE | < 1.0 K | 1.0-2.5 K | > 2.5 K |
| MAE | < 0.8 K | 0.8-2.0 K | > 2.0 K |
| Bias | +/-0.3 K | +/-0.3-1.0 K | > +/-1.0 K |
| Correlation | > 0.95 | 0.85-0.95 | < 0.85 |

Thresholds apply to 2-meter temperature at 6-hour lead time. Accuracy degrades at longer horizons and smaller grids.

### Persistence Baseline

Compare Aurora against "tomorrow equals today" — Aurora should easily beat this:

```python
import numpy as np
import xarray as xr

obs = xr.open_dataset("data/norway_surface.nc")
forecast = xr.open_dataset("data/norway_june8_forecast.nc")

persistence = obs["t2m"].isel(time=-1).values
aurora_pred = forecast["t2m"].isel(step=0).values
truth = obs["t2m"].isel(time=-1).values

aurora_rmse = float(np.sqrt(np.mean((aurora_pred - truth) ** 2)))
persist_rmse = float(np.sqrt(np.mean((persistence - truth) ** 2)))
print(f"Aurora: {aurora_rmse:.2f} K, Persistence: {persist_rmse:.2f} K")
```
