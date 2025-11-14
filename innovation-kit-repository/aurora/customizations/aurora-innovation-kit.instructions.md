---
description: Aurora Innovation Kit context and file locations for AI weather forecasting
applyTo: "**/*"
---

# Aurora Innovation Kit

**Invoke when**: User mentions "Aurora", "weather", "climate", "temperature", "wind", "forecasting", or regional weather prototyping.

## What is Aurora?

Microsoft's 1.3B-parameter foundation model for atmosphere/ocean forecasting. 0.1°-0.4° global predictions, 5,000× faster than traditional weather models. Open-source and runs locally.

## Kit Location

**Repository location**: `innovation-kit-repository/aurora/` (source files for kit developers)

**Installed location**: `.vibe-kit/innovation-kits/aurora/` (use this path after kit installation)

**Working example**: `.vibe-kit/innovation-kits/aurora/assets/norway-example/` (complete tutorial with the mainland ERA5 bundle ~8.5 MB total)

## File Index (Read These as Needed)

**Start Here**: `.vibe-kit/innovation-kits/aurora/INNOVATION_KIT.md` (Prerequisites, Getting Started, Learning Path)

**30-min Tutorial**: `.vibe-kit/innovation-kits/aurora/docs/quick-start.md` (Norway mainland forecast, frontend + inference)

**Technical Deep Dive**: `.vibe-kit/innovation-kits/aurora/docs/norway-technical-guide.md` (How Aurora inference works: 64×112 grid, 2 timesteps → 24h forecast)

**Build Your Own**:

- `.vibe-kit/innovation-kits/aurora/docs/expand-norway-example.md` (**Customization**: Expand the Norway example for your region)
- `.vibe-kit/innovation-kits/aurora/docs/aurora-prototyping-guide.md` (**From Scratch**: Build from fundamentals)

**Data Integration**: `.vibe-kit/innovation-kits/aurora/docs/data-integration.md` (CDS ERA5 downloads, format conversion)

**Use Case Templates**: `.vibe-kit/innovation-kits/aurora/docs/application-patterns.md` (Coastal, energy, agriculture, maritime scenarios)

**Troubleshooting**: `.vibe-kit/innovation-kits/aurora/docs/troubleshooting.md` (Model divergence, grid errors, timezone bugs)

**Performance**: `.vibe-kit/innovation-kits/aurora/docs/performance-guide.md` (Hardware sizing, GPU optimization, deployment)

**Utilities**: `.vibe-kit/innovation-kits/aurora/assets/scripts/` (check_aurora_dataset.py, download_era5_subset.py, quick_verify_netcdf.py, validate_grid.py)

## Quick Routing

- **"How do I start?" / "Launch reference app"** → Step 1: Launch the frontend to explore June 1–7 observations first (see Workflow below)
- **"How does it work?"** → `.vibe-kit/innovation-kits/aurora/docs/norway-technical-guide.md` (64×112 grid, SPATIAL_PATCH_SIZE=16, 2-timestep input)
- **"Adapt Norway example"** → `.vibe-kit/innovation-kits/aurora/docs/expand-norway-example.md` (Customization: change region, variables, deploy)
- **"Build from scratch"** → `.vibe-kit/innovation-kits/aurora/docs/aurora-prototyping-guide.md` (Learn fundamentals, write own code)
- **"Get my data"** → `.vibe-kit/innovation-kits/aurora/docs/data-integration.md` (CDS credentials, ERA5 downloads)
- **"Errors?"** → `.vibe-kit/innovation-kits/aurora/docs/troubleshooting.md` (Common issues + fixes)
- **"Use cases?"** → `.vibe-kit/innovation-kits/aurora/docs/application-patterns.md` (Coastal forecasting, energy planning, agriculture)

## User Workflow (Follow This Order)

### Step 1: Launch Frontend (Observations Only)

When user asks to "launch the reference app" or "get started":

1. Navigate to the installed Norway example:
   ```bash
   cd .vibe-kit/innovation-kits/aurora/assets/norway-example/frontend
   npm install
   npm run dev
   ```
2. Open browser to http://localhost:5174
3. User explores June 1–7 ERA5 observations; "Aurora Predictions" toggle is disabled (this is expected)
4. Wait for user to return and ask about predictions

### Step 2: Run Forecast Inference

When user returns asking about predictions or June 8:

1. **Install Python requirements first** (always required before inference):

   ```bash
   cd .vibe-kit/innovation-kits/aurora/assets/norway-example
   python3 -m pip install -r scripts/requirements.txt
   ```

   First run downloads PyTorch (~2 GB) and dependencies.

2. **Run Aurora inference**:

   ```bash
   python3 scripts/run_aurora_inference.py \
     --surf data/norway_surface.nc \
     --atmos data/norway_atmospheric.nc \
     --static data/norway_static.nc \
     --output data/norway_june8_forecast.nc
   ```

   Expect ~45 min on CPU or ~6 min on A100. First run downloads the 5.03 GB Aurora checkpoint to `~/.cache/aurora`.

3. **Convert NetCDF to TypeScript**:
   ```bash
   python3 scripts/build_forecast_module.py \
     data/norway_june8_forecast.nc \
     --output frontend/src/data/auroraForecastPredictions.ts \
     --region-name 'Aurora Forecast: Norway June 8' \
     --max-steps 4
   ```

### Step 3: Refresh Frontend

1. Track active terminals—if Vite is still running, tell user to **hard refresh** browser (Ctrl+Shift+R / Cmd+Shift+R)
2. If Vite stopped, restart it:
   ```bash
   cd .vibe-kit/innovation-kits/aurora/assets/norway-example/frontend
   npm run dev
   ```
3. Once refreshed, "Aurora Predictions" toggle enables
4. User can now scrub June 8 forecast alongside June 1–7 observations

### Step 4: Celebrate & Offer Next Steps

- Congratulate user on completing the full workflow
- Ask: "Ready to adapt this for your region, extend the forecast horizon, or try a different use case?"

## Working Example Structure

`.vibe-kit/innovation-kits/aurora/assets/norway-example/` contains:

- `frontend/` - React visualization (temperature heatmaps, time slider)
- `scripts/run_aurora_inference.py` - Main inference script (outputs `data/norway_june8_forecast.nc`)
- `scripts/build_forecast_module.py` - Regenerates frontend TypeScript modules; large outputs stay gitignored
- `data/` - ERA5 bundle for mainland Norway (June 1-7, 2025, 57.0°N–72.75°N, 4.0°E–31.75°E) → `norway_surface.nc`, `norway_atmospheric.nc`, `norway_static.nc`
- `README.md` - Example-specific setup and regeneration commands

### ERA5 Downloads (3 files)

```bash
cd .vibe-kit/innovation-kits/aurora/assets/scripts
python download_era5_subset.py \
	--dataset reanalysis-era5-single-levels \
	--variables 2m_temperature 10m_u_component_of_wind 10m_v_component_of_wind mean_sea_level_pressure \
	--year 2025 --month 06 --days 01 02 03 04 05 06 07 \
	--hours 00 06 12 18 \
	--area 72.75 4 57 31.75 \
	--target ../norway-example/data/norway_surface.nc

python download_era5_subset.py \
	--dataset reanalysis-era5-pressure-levels \
	--variables geopotential specific_humidity temperature u_component_of_wind v_component_of_wind \
	--levels 1000 925 850 700 \
	--year 2025 --month 06 --days 01 02 03 04 05 06 07 \
	--hours 00 06 12 18 \
	--area 72.75 4 57 31.75 \
	--target ../norway-example/data/norway_atmospheric.nc

python download_era5_subset.py \
	--dataset reanalysis-era5-single-levels \
	--variables geopotential land_sea_mask soil_type \
	--year 2025 --month 06 --days 01 \
	--hours 00 \
	--area 72.75 4 57 31.75 \
	--target ../norway-example/data/norway_static.nc
```

Surface ~1.5 MB, atmospheric ~6.9 MB, static ~81 KB. Keep the static fields separate for reproducible inference.

### Running Aurora Inference

**Always install requirements before running inference:**

```bash
cd .vibe-kit/innovation-kits/aurora/assets/norway-example
python3 -m pip install -r scripts/requirements.txt
```

**Then run inference:**

```bash
python3 scripts/run_aurora_inference.py \
	--surf data/norway_surface.nc \
	--atmos data/norway_atmospheric.nc \
	--static data/norway_static.nc \
	--output data/norway_june8_forecast.nc
```

Expect ~45 minutes on CPU or ~6 minutes on a single A100-class GPU for the 64×112 grid. The first run downloads the 5.03 GB checkpoint to `~/.cache/aurora`.

## Key Technical Details

- **Grid requirements**: Latitude/longitude dimensions must be divisible by 16 (conservative safety margin; Aurora source uses patch_size=4)
- **Input**: 2 consecutive timesteps (6-hour interval) over a 64×112 mainland Norway grid (adjust for your region as long as it stays divisible by 16)
- **Output**: 24-hour forecast at 6-hour intervals
- **Variables**: 2m temperature, 10m u/v wind, surface pressure (from ERA5)
- **Model**: microsoft-aurora package, downloads checkpoint automatically (~5GB first run)

## Official Resources

- GitHub: https://github.com/microsoft/aurora
- Hugging Face: https://huggingface.co/microsoft/aurora
- Paper: Nature 2025 (Aurora: A Foundation Model of the Atmosphere)
