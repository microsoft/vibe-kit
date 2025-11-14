# Quick Start: Run Your First Aurora Forecast

**Launch the Norway reference app in 5 minutes, then generate 24-hour forecasts.**

This guide walks you through the 64×112 Norway demo. First you'll explore June 1–7 observations, then generate June 8 predictions using Aurora AI.

---

## Prerequisites

✅ **Vibe Kit installed** with Aurora Innovation Kit  
✅ **Dev container running** (recommended) or local Python 3.12+ / Node.js 18+  
✅ **~6GB disk space** (Aurora checkpoint + dependencies, needed for inference only)  
✅ **GPU optional** (~6 min on A100, ~45 min on CPU for inference)

---

## Step 1: Launch the Reference App (5 min)

Start by viewing the bundled ERA5 observations (June 1–7, 2025):

```bash
cd .vibe-kit/innovation-kits/aurora/assets/norway-example/frontend
npm install
npm run dev
```

**Open browser:** http://localhost:5174

### What You'll See

- **Map view** covering mainland Norway (57.0°N–72.75°N, 4.0°E–31.75°E)
- **CDS Observations** toggle enabled (June 1–7, 2025 data)
- **Aurora Predictions** toggle disabled (you'll generate these next)
- **Time slider** with 28 observation timesteps (every 6 hours)

### Explore the Observations

1. **Scrub the time slider** → Watch temperature patterns evolve over 7 days
2. **Hover over cells** → Inspect exact values (°C, wind speed, pressure)
3. **Notice the patterns** → Gulf Stream warmth, inland cooling, synoptic fronts

**Key insight:** These are real ERA5 reanalysis observations. Next you'll use Aurora to predict June 8 based on the last 2 timesteps (June 7 at 12:00 & 18:00).

---

## Step 2: Generate Aurora Predictions

Once you've explored the observations, come back to GitHub Copilot Chat and ask:

> *"I'm ready to run Aurora inference for June 8"*

or simply continue to Step 3 below.

---

## Step 3: Install Python Dependencies (3 min)

Before running inference, install the required packages:

```bash
cd .vibe-kit/innovation-kits/aurora/assets/norway-example
pip install -r scripts/requirements.txt
```

**What gets installed:**
- `torch>=2.0.0` - PyTorch for Aurora model
- `microsoft-aurora` - Aurora inference package
- `netCDF4` - For reading/writing forecast files
- `numpy`, `xarray` - Array operations
- `huggingface-hub` - Downloads model checkpoint (~5 GB on first run)

---

## Step 4: Run Aurora Inference (6 min GPU · 45 min CPU)

Generate the June 8 forecast:

```bash
python3 scripts/run_aurora_inference.py \
  --surf data/norway_surface.nc \
  --atmos data/norway_atmospheric.nc \
  --static data/norway_static.nc \
  --output data/norway_june8_forecast.nc
```

### What Happens

**Loading phase (1-2 min):**
```
Loading Aurora model (AuroraSmall, 1.3B parameters)...
Loading checkpoint from microsoft/aurora...
Checkpoint loaded: 5.03 GB
```

**First run downloads the ~5 GB Aurora checkpoint** to `~/.cache/aurora`. Subsequent runs skip this step.

**Data loading (30 sec):**
```
Loading ERA5 input data...
Input grid: 64×112 cells (7,168 points)
Timesteps: June 7, 2025 at 12:00 and 18:00
Surface variables: 10m wind (u/v), 2m temperature, mean sea-level pressure
Atmospheric variables: geopotential, humidity, temperature, winds (1000/925/850/700 hPa)
```

**Inference (6 min GPU, 45 min CPU devcontainer):**
```
Running forecast...
Step 1/4: June 8, 00:00 ✓
Step 2/4: June 8, 06:00 ✓
Step 3/4: June 8, 12:00 ✓
Step 4/4: June 8, 18:00 ✓
```

**Saving output (10 sec):**
```
DEBUG: First prediction shape for '2t': torch.Size([1, 1, 64, 112])
DEBUG: Extracted array shape: (lat=64, lon=112)
✓ Saved 6.4 MB → data/norway_june8_forecast.nc
Variables: 2m_temperature, 10m_u_wind, 10m_v_wind, mean_sea_level_pressure
```

### Troubleshooting

**"CUDA out of memory"**
→ Reduce batch size in `run_aurora_inference.py` (line 40: `batch_size=1`)

**"Grid dimensions not divisible by 16"**
→ The bundled data already aligns to 64×112. If you edited files, re-run the ERA5 download script to restore the grid.

**"Module 'microsoft_aurora' not found"**
→ Run `pip install -r scripts/requirements.txt` again

**Still stuck?** Ask Copilot: *"Aurora inference failed with error: [paste error]"*

---

## Step 5: Convert NetCDF to TypeScript (1 min)

Aurora writes NetCDF files; the React app consumes TypeScript modules. Regenerate the predictions module so the visualization can load the new forecast:

```bash
python3 scripts/build_forecast_module.py \
  data/norway_june8_forecast.nc \
  --output frontend/src/data/auroraForecastPredictions.ts \
  --region-name 'Aurora Forecast: Norway June 8' \
  --max-steps 4
```

The script prints the timestep range, grid dimensions (64×112), and min/max values. The generated `.ts` file remains untracked in git—regenerate whenever you re-run inference.

---

## Step 6: View the Forecast (2 min)

### Restart the Frontend

The Vite dev server may not pick up the large TypeScript file automatically. Stop the server (Ctrl+C) and restart it:

```bash
cd frontend
npm run dev
```

### Hard Refresh the Browser

Visit http://localhost:5174 and do a **hard refresh** (Ctrl+Shift+R or Cmd+Shift+R) to force reload the bundle.

### Toggle to Aurora Predictions

1. **Turn OFF "CDS Observations"** → Heatmap clears
2. **Turn ON "Aurora Predictions"** → June 8 forecast appears (4 timesteps)
3. **Scrub the time slider** → Compare June 8 predictions with June 7 observations

### Compare Observations vs Predictions

Toggle both ON to see:
- **CDS (June 1-7):** 28 timesteps of historical data
- **Aurora (June 8):** 4 timesteps of AI predictions

**Key observations:**
- **Temperature ranges:** Aurora predicts roughly −5 °C to 18 °C (realistic for June)
- **Spatial patterns:** Coastal gradients preserved
- **Temporal evolution:** Smooth transitions between 6-hour steps
- **Conservative forecasts:** Aurora stays within plausible bounds

---

## Congratulations!

You've completed the full Aurora workflow:

✅ **Launched the reference app** with June 1–7 observations  
✅ **Installed inference dependencies** (PyTorch, Aurora, NetCDF)  
✅ **Ran Aurora inference** using last 2 timesteps (June 7, 12:00 & 18:00)  
✅ **Generated 24-hour forecast** (June 8, 4 steps at 6-hour intervals)  
✅ **Converted outputs to TypeScript** and visualized predictions  
✅ **Compared AI forecasts** against historical patterns

**What's next?** Adapt this for your region, extend the forecast horizon, or explore other use cases below.

---

## Next Steps

### Learn the Internals (1 hour)

**Read:** [norway-technical-guide.md](norway-technical-guide.md)

**Topics:**
- How `run_aurora_inference.py` works (line-by-line)
- Aurora's architecture (patch encoder, rollout loop)
- NetCDF structure and variable requirements
- Model stability analysis (why 24h vs 7 days)

### Build Your Own Forecast (4-8 hours)

**Read:** [expand-norway-example.md](expand-norway-example.md)

**Adapt the example:**
- Change region (modify lat/lon bounds)
- Extend forecast horizon (test 48h, 72h)
- Add variables (precipitation, humidity)
- Fetch your own CDS data
- Deploy as web service

### Explore Other Applications

**Read:** [application-patterns.md](application-patterns.md)

**Example scenarios:**
- **Wind farm control** - Optimize turbine settings based on forecasts
- **Solar energy** - Predict cloud cover for PV output
- **Emergency response** - Regional extreme weather alerts
- **Agriculture** - Frost warnings, growing degree days

---

## Common Questions

**Q: Can I run this on CPU?**  
A: Yes, but expect 45 minutes vs 6 minutes on GPU. The command is the same.

**Q: How accurate is Aurora?**  
A: Aurora matches operational NWP models on global benchmarks. For regional forecasts, validate against actual June 8 observations if available.

**Q: Can I use different dates?**  
A: Yes! Fetch different CDS data and update the date range in `run_aurora_inference.py`. Ensure 2 consecutive timesteps for input.

**Q: What if my region isn't Norway?**  
A: See [expand-norway-example.md](expand-norway-example.md) "Adapting the Region" section. Key: Ensure grid dimensions divisible by 16.

**Q: Can I run Aurora without internet?**  
A: After first download, Aurora runs offline. Model checkpoint (~5GB) is cached in `~/.cache/huggingface/`.

**Q: How do I validate predictions?**  
A: Download actual June 8 observations from CDS and compare against `norway_june8_forecast.nc` using tools like `xarray` or visualization scripts.

---

## Performance Benchmarks

**Tested on:**
- **GPU (NVIDIA A100 40GB):** 6 min (4-step forecast)
- **GPU (NVIDIA T4 16GB):** 10 min
- **CPU (16-core Intel Xeon):** 45 min
- **CPU (8-core M2 Mac):** 55 min

**Memory usage:**
- **GPU:** 8-12 GB VRAM
- **CPU:** 4-6 GB RAM
- **Disk:** 5.2 GB (model + dependencies)

---

**Part of:** [Aurora Innovation Kit](../INNOVATION_KIT.md)  
**Reference implementation:** [assets/norway-example/](../assets/norway-example/)
