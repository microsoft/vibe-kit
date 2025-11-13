# Quick Start: Run Your First Aurora Forecast

**Complete this tutorial in 30 minutes to generate a 24-hour weather forecast using Aurora AI.**

This guide walks you through the Norway coastal forecast example from start to finish. You'll visualize historical data, run ML inference, and compare AI predictions against observations.

---

## Prerequisites

✅ **Vibe Kit installed** with Aurora Innovation Kit  
✅ **Dev container running** (recommended) or local Python 3.12+ / Node.js 18+  
✅ **~5GB disk space** (Aurora model checkpoint + dependencies)  
✅ **GPU optional** (5-10 min on GPU, 15-20 min on CPU)

> **Preview only?** Complete Step 1 to explore June 1-7 observations. Steps 3-5 install Aurora (~5GB first run) and generate June 8 predictions when you're ready.

---

## Step 1: Launch the Frontend (5 min)

Open the norway-example and start the visualization:

```bash
cd .vibe-kit/innovation-kits/aurora/assets/norway-example/frontend
pnpm install
pnpm dev
```

**Open browser:** http://localhost:5174

### What You'll See

- **Map view** of Norway's coast (58.25°N-70°N, 5°E-16.75°E)
- **CDS Observations toggle** (ON) - Shows June 1-7, 2025 historical data
- **Aurora Predictions toggle** (disabled until inference) - Turns on after you complete Steps 3-5
- **Time slider** to scrub through June 1-7
- **Tutorial hint** at top: *"Ready for the next step? Ask GitHub Copilot to guide you through generating Aurora predictions for June 8."*

### Explore the Data

1. **Scrub the time slider** → Watch temperature patterns change over 7 days
2. **Hover over cells** → See exact temperature values (°C)
3. **Notice the patterns** → Coastal gradients, daily cycles, weather fronts

**Key insight:** These are real ERA5 reanalysis observations. Aurora will predict June 8 based on the last 2 timesteps (June 7 at 12:00 & 18:00).

---

## Step 2: Ask GitHub Copilot for Guidance (2 min)

Open **GitHub Copilot Chat** in VS Code and ask:

> *"Guide me through running Aurora inference for the Norway example"*

**Copilot will:**
1. Check if dependencies are installed
2. Explain what `run_aurora_inference.py` does
3. Show you the exact command to run
4. Explain expected output

**Why use Copilot?** The Innovation Kit customizations ensure Copilot has context about Aurora's architecture, the norway-example structure, and common troubleshooting steps.

---

## Step 3: Install Dependencies (3 min, when ready for inference)

> Skip to Step 6 if you only need to explore the observations. Run this step once you're ready to generate Aurora predictions.

```bash
cd .vibe-kit/innovation-kits/aurora/assets/norway-example
pip install -r scripts/requirements.txt
```

**What gets installed:**
- `torch>=2.0.0` - PyTorch for Aurora model
- `microsoft-aurora` - Aurora inference package
- `netCDF4` - For reading/writing forecast files
- `numpy`, `xarray` - Array operations
- `huggingface-hub` - Download model checkpoint

**First time?** PyTorch (~2GB) + Aurora checkpoint (5GB) will download. Subsequent runs are fast.

---

## Step 4: Run Aurora Inference (10 min)

```bash
python3 scripts/run_aurora_inference.py
```

### What Happens

**Loading phase (1-2 min):**
```
Loading Aurora model (AuroraSmall, 1.3B parameters)...
Loading checkpoint from microsoft/aurora...
Checkpoint loaded: 5.03 GB
```

**Data loading (30 sec):**
```
Loading ERA5 input data...
Input grid: 48×48 cells (2,304 points)
Timesteps: June 7, 2025 at 12:00 and 18:00
Variables: 4 surface, 4 atmospheric (3 levels each)
```

**Inference (5-10 min on GPU, 15-20 min on CPU):**
```
Running forecast...
Step 1/4: June 8, 00:00 ✓
Step 2/4: June 8, 06:00 ✓
Step 3/4: June 8, 12:00 ✓
Step 4/4: June 8, 18:00 ✓
```

**Saving output (10 sec):**
```
Forecast saved: data/aurora_forecast_june8.nc (187 KB)
Variables: 2m_temperature, 10m_u_wind, 10m_v_wind
```

### Troubleshooting

**"CUDA out of memory"**
→ Reduce batch size in `run_aurora_inference.py` (line 40: `batch_size=1`)

**"Grid dimensions not divisible by 16"**
→ Should not happen with 48×48 grid. See [emergency-fixes.md](emergency-fixes.md) if you modified region.

**"Module 'microsoft_aurora' not found"**
→ Run `pip install -r scripts/requirements.txt` again

**Still stuck?** Ask Copilot: *"Aurora inference failed with error: [paste error]"*

---

## Step 5: Convert to Visualization Format (1 min)

Aurora outputs NetCDF. The frontend needs TypeScript. Run this command after inference to generate the dataset the UI consumes.

Convert:

```bash
python3 scripts/build_forecast_module.py \
  data/aurora_forecast_june8.nc \
  --output frontend/src/data/auroraForecastPredictions.ts \
  --max-steps 4
```

**What this does:**
1. Reads `aurora_forecast_june8.nc`
2. Extracts temperature data for June 8 (4 timesteps)
3. Converts to TypeScript with proper types
4. Saves to `frontend/src/data/auroraForecastPredictions.ts`

**Output:**
```
Processing forecast data...
Timesteps: 4 (June 8: 00:00, 06:00, 12:00, 18:00)
Grid: 48×48 cells
Output: frontend/src/data/auroraForecastPredictions.ts (183 KB)
```

---

## Step 6: View Results (5 min)

### Refresh the Frontend

Go back to http://localhost:5174 and **hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)

### Toggle Between Datasets

1. **Turn OFF "CDS Observations"** → Heatmap clears
2. **Turn ON "Aurora Predictions"** → June 8 forecast appears
3. **Scrub the time slider** → See 4 timesteps (00:00, 06:00, 12:00, 18:00)

If you skipped Steps 3-5, the Aurora toggle remains disabled—complete the inference steps to populate it.

### Compare Observations vs Predictions

Toggle both ON to see:
- **CDS (June 1-7):** 28 timesteps of historical data
- **Aurora (June 8):** 4 timesteps of AI predictions

**Key observations:**
- **Temperature ranges:** Aurora predicts 0-15°C (realistic for coastal Norway in June)
- **Spatial patterns:** Coastal gradients preserved
- **Temporal evolution:** Smooth transitions between 6-hour steps
- **Conservative forecasts:** Aurora stays within plausible bounds

---

## What You Just Did

✅ **Loaded 7 days of ERA5 observations** (June 1-7)  
✅ **Ran Aurora inference** using last 2 timesteps (June 7)  
✅ **Generated 24-hour forecast** (June 8, 4 steps)  
✅ **Visualized results** in interactive React app  
✅ **Compared AI predictions** against historical patterns

---

## Understanding the Results

### Why Only 24 Hours?

Aurora was trained on global data. On small regional grids (48×48), predictions remain stable for 24-48 hours before boundary effects accumulate. Extending to 7 days causes model divergence (unrealistic temperatures).

### Why 2 Input Timesteps?

Aurora needs:
1. **Current state** (June 7, 18:00) - Temperature, pressure, wind
2. **Previous state** (June 7, 12:00) - To calculate trends (acceleration, gradients)

This captures atmospheric dynamics (momentum, energy transport) needed for accurate forecasting.

### Why 48×48 Grid?

Aurora's encoder uses `patch_size=16`. Grid dimensions must be divisible by 16. Common options:
- **48×48** (2,304 points) - Small regional forecasts
- **64×64** (4,096 points) - Medium regions
- **80×80** (6,400 points) - Larger areas with better boundary conditions

---

## Next Steps

### Learn the Internals (1 hour)

**Read:** [norway-technical-guide.md](norway-technical-guide.md) or `assets/norway-example/AURORA_INFERENCE_GUIDE.md`

**Topics:**
- How `run_aurora_inference.py` works (line-by-line)
- Aurora's architecture (patch encoder, rollout loop)
- NetCDF structure and variable requirements
- Model stability analysis (why 24h vs 7 days)

### Build Your Own Forecast (4-8 hours)

**Read:** [prototyping-guide.md](prototyping-guide.md)

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
A: Yes, but expect 15-20 minutes vs 5-10 on GPU. Add `--device cpu` to `run_aurora_inference.py`.

**Q: How accurate is Aurora?**  
A: Aurora matches operational NWP models on global benchmarks. For regional forecasts, validate against actual June 8 observations if available.

**Q: Can I use different dates?**  
A: Yes! Fetch different CDS data and update the date range in `run_aurora_inference.py` (line 85-95). Ensure 2 consecutive timesteps for input.

**Q: What if my region isn't Norway?**  
A: See [prototyping-guide.md](prototyping-guide.md) "Adapting the Region" section. Key: Ensure grid dimensions divisible by 16.

**Q: Can I run Aurora without internet?**  
A: After first download, Aurora runs offline. Model checkpoint (~5GB) is cached in `~/.cache/huggingface/`.

**Q: How do I validate predictions?**  
A: Download actual June 8 observations from CDS and compare against `aurora_forecast_june8.nc` using tools like `xarray` or visualization scripts.

---

## Troubleshooting Guide

### Frontend Issues

**Aurora toggle grayed out**
→ Did you run `build_forecast_module.py`? Check `frontend/src/data/auroraForecastPredictions.ts` exists.

**Wrong dates showing**
→ Hard refresh (Ctrl+Shift+R). Check `auroraForecastPredictions.ts` has exactly 4 timesteps.

**Heatmap not updating**
→ Open browser console (F12). Look for errors. Try `pnpm dev` again.

### Inference Issues

**"RuntimeError: CUDA out of memory"**
→ Close other programs. Try `--device cpu` or reduce `batch_size=1`.

**"ValueError: Grid dimensions must be divisible by 16"**
→ Check `run_aurora_inference.py` line 25-30. Grid should be 48×48.

**Predictions look wrong (temps > 50°C or < -50°C)**
→ Model diverged. Reduce `num_steps` to 2-3 and test again.

### Data Issues

**"FileNotFoundError: data/4d2238a45558de23ef37ca2e27a0315.nc"**
→ You're not in the `norway-example/` directory. Run `cd .vibe-kit/innovation-kits/aurora/assets/norway-example`.

**"Invalid NetCDF file"**
→ Files corrupted. Re-download the sample data or fetch fresh data from CDS.

---

## Performance Benchmarks

**Tested on:**
- **GPU (NVIDIA A100 40GB):** 5 min (4-step forecast)
- **GPU (NVIDIA T4 16GB):** 8 min
- **CPU (16-core Intel Xeon):** 18 min
- **CPU (8-core M2 Mac):** 22 min

**Memory usage:**
- **GPU:** 8-12 GB VRAM
- **CPU:** 4-6 GB RAM
- **Disk:** 5.2 GB (model + dependencies)

---

## What's Next?

**Congratulations!** You've run your first Aurora forecast. Choose your path:

1. **Deep dive:** [norway-technical-guide.md](norway-technical-guide.md) - Understand every line of code
2. **Build your own:** [prototyping-guide.md](prototyping-guide.md) - Adapt for your scenario
3. **Explore patterns:** [application-patterns.md](application-patterns.md) - See other use cases

---

**Part of:** [Aurora Innovation Kit](.vibe-kit/innovation-kits/aurora/INNOVATION_KIT.md)  
**Reference implementation:** [assets/norway-example/](.vibe-kit/innovation-kits/aurora/assets/norway-example/)
