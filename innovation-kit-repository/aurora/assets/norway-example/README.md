# Aurora Norway Forecast Demo (64×112)

This directory contains the end-to-end demo used in the `global-demo` branch. It ships with the full 64×112 ERA5 coverage of mainland Norway (57.0°N–72.75°N, 4.0°E–31.75°E) and shows how to regenerate Aurora predictions without checking large artifacts into git.

## What's Included

| Component | Description |
| --- | --- |
| `data/norway_surface.nc` | ERA5 single-level variables (June 1–7, 2025) at 64×112 resolution — bundled for visualization. |
| `data/norway_atmospheric.nc` | ERA5 pressure-level variables (June 1–7, 2025) required for Aurora inference. |
| `data/norway_static.nc` | ERA5 static fields (geopotential, land/sea mask, soil type). |
| `scripts/run_aurora_inference.py` | CLI that consumes the three files above and produces `data/norway_june8_forecast.nc`. |
| `scripts/build_forecast_module.py` | Converts any Aurora-compatible NetCDF file into a TypeScript module for the frontend. |
| `frontend/src/App.tsx` | React/Fluent UI viewer with observation ↔ prediction toggle, dark mode, zoom controls, and (Lon,Lat) popovers. |

Generated TypeScript payloads (`auroraForecast.ts`, `auroraForecastPredictions.ts`, `globalForecast.ts`) are gitignored to keep the repo small. Follow the regeneration commands below to rebuild them locally.

> **Planning a new region?** Run `python ../../scripts/validate_grid.py --lat-min ... --lat-max ... --lon-min ... --lon-max ...` first to check that your latitude/longitude bounds align with Aurora's 16×16 patch requirement before pulling fresh ERA5 tiles.

## Quick Start

```bash
# 1. Install frontend deps & run dev server
cd frontend
npm install
npm run dev  # http://localhost:5174
# (First launch can take 20-30 seconds while Vite compiles.)
```

Return to the repo root (`cd ..`) before running the remaining steps.

Optional: rebuild the observations TypeScript module ahead of inference.

```bash
# 2. (Optional) Rebuild observations TypeScript module
python3 scripts/build_forecast_module.py \
  data/norway_surface.nc \
  --output frontend/src/data/auroraForecast.ts
```

```bash
# 3. Run Aurora inference (outputs NetCDF)
python3 scripts/run_aurora_inference.py \
  --surf data/norway_surface.nc \
  --atmos data/norway_atmospheric.nc \
  --static data/norway_static.nc \
  --output data/norway_june8_forecast.nc
# An "initializing" message follows while model weights load; expect a short pause.

# 4. Convert predictions to TypeScript for the UI
python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/src/data/auroraForecastPredictions.ts
```

Refresh the browser once `auroraForecastPredictions.ts` is regenerated to view the new forecast.

## Data Sources

All datasets are downloaded via the ERA5 APIs using `assets/scripts/download_era5_subset.py`.

| File | Size | ERA5 dataset | Notes |
| --- | --- | --- | --- |
| `data/norway_surface.nc` | 1.5 MB | `reanalysis-era5-single-levels` | Variables: `2m_temperature`, `10m_u_component_of_wind`, `10m_v_component_of_wind`, `mean_sea_level_pressure`. |
| `data/norway_atmospheric.nc` | 6.9 MB | `reanalysis-era5-pressure-levels` | Variables: `geopotential`, `specific_humidity`, `temperature`, `u_component_of_wind`, `v_component_of_wind` at 1000/925/850/700 hPa. |
| `data/norway_static.nc` | 81 KB | `reanalysis-era5-single-levels` | Variables: `geopotential`, `land_sea_mask`, `soil_type` (single timestep). |

See `INNOVATION_KIT_UPDATES.md` for the exact download commands that reproduce these files.

## Model Configuration Highlights

- Grid: 64 latitudes × 112 longitudes (7,168 cells) aligned to Aurora's 16× patch size.
- Lookback window: June 1–7, 2025 observations (4 timesteps per day) → autoregressive forecast for June 8 at 00/06/12/18 UTC.
- Model: `microsoft/aurora` (default checkpoint) loaded with `torch.compile` acceleration.
- Runtime: ~6 minutes on GPU (A100) or ~45 minutes on CPU in the dev container.
- Output: `data/norway_june8_forecast.nc` plus TypeScript module for the viewer.

