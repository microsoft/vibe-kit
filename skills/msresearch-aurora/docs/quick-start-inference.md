# Quick Start (Inference): Run Your First Aurora Forecast

**Launch the Norway reference app, then generate a 24-hour weather prediction.**

You will explore real ERA5 weather observations for June 1-7, then use Aurora to predict June 8. The whole process takes about 30 minutes (or 50 minutes on CPU). New to Aurora? Read [about-aurora.md](about-aurora.md) first.

> **Want to actually adapt Aurora to your problem?** This inference walkthrough is great for exploration, but most real applications need fine-tuning. See [quick-start-finetune.md](quick-start-finetune.md).

---

## Contents

- [Prerequisites](#prerequisites)
- [Step 1: Launch the Reference App](#step-1-launch-the-reference-app)
- [Step 2: Install Python Dependencies](#step-2-install-python-dependencies)
- [Step 3: Run Aurora Inference](#step-3-run-aurora-inference)
- [Step 4: Convert to Frontend Data](#step-4-convert-to-frontend-data)
- [Step 5: View the Forecast](#step-5-view-the-forecast)
- [Next Steps](#next-steps)

---

## Prerequisites

- Python 3.11+ with the `uv` package manager ([install uv](https://docs.astral.sh/uv/))
- Node.js 18+ with npm
- 6 GB free disk space (Aurora checkpoint is ~5 GB, downloaded on first run)
- GPU optional but recommended (8+ GB VRAM; CPU works, just slower)

---

## Step 1: Launch the Reference App

Start by viewing the bundled ERA5 observations (June 1-7, 2025):

```bash
cd assets/inference/norway-example/frontend
npm install
npm run dev
```

Open http://localhost:5174. You should see:

- A map covering mainland Norway (57.0-72.75°N, 4.0-31.75°E)
- **CDS Observations** toggle enabled with 28 timesteps (every 6 hours)
- **Aurora Predictions** toggle disabled (you will generate these next)

Scrub the time slider to watch temperature, wind, and pressure patterns evolve over 7 days. Hover over cells to inspect values.

---

## Step 2: Install Python Dependencies

In a separate terminal:

```bash
cd assets/inference/norway-example
uv pip install -r scripts/requirements.txt
```

This installs PyTorch, the Aurora package, xarray, and NetCDF4 support. First run also downloads the Aurora checkpoint (~5 GB) from HuggingFace.

---

## Step 3: Run Aurora Inference

Generate a 24-hour forecast for June 8:

```bash
uv run python3 scripts/run_aurora_inference.py \
  --surf data/norway_surface.nc \
  --atmos data/norway_atmospheric.nc \
  --static data/norway_static.nc \
  --output data/norway_june8_forecast.nc
```

**What happens:**
1. Loads the Aurora model (AuroraSmall, 1.3B parameters)
2. Reads ERA5 input: 64x112 grid, June 7 at 12:00 and 18:00 UTC
3. Runs 4 autoregressive steps (each = 6 hours), producing forecasts for June 8 at 00:00, 06:00, 12:00, 18:00
4. Saves output to NetCDF (~6 MB)

**Timing:** ~6 min on GPU (A100), ~45 min on CPU.

If you hit errors, see [troubleshooting.md](troubleshooting.md).

---

## Step 4: Convert to Frontend Data

The React app fetches forecast data as JSON at runtime. Generate the predictions file:

```bash
uv run python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/public/data/auroraForecastPredictions.json \
  --region-name 'Aurora Forecast: Norway June 8' \
  --max-steps 4
```

---

## Step 5: View the Forecast

Restart the frontend (Ctrl+C, then `npm run dev` again) and hard-refresh the browser (Ctrl+Shift+R).

1. Turn OFF "CDS Observations"
2. Turn ON "Aurora Predictions" — June 8 forecast appears (4 timesteps)
3. Scrub the time slider to see the 24-hour forecast evolve

Toggle both layers ON to compare June 7 observations against June 8 predictions. Aurora should produce realistic temperature ranges, preserved coastal gradients, and smooth transitions between steps.

---

## Next Steps

- **Adapt for your region:** [customization-guide.md](customization-guide.md) — Use `setup_region.py` to create Hawaii, California, or any custom region in 5-10 minutes
- **Understand the internals:** [technical-reference.md](technical-reference.md) — Grid constraints, data requirements, performance optimization
- **Fine-tune Aurora for your problem:** [quick-start-finetune.md](quick-start-finetune.md) — Train Aurora on your variables/region (this is the recommended path for serious applications)
