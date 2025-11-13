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

**Working example**: `.vibe-kit/innovation-kits/aurora/assets/norway-example/` (complete tutorial with 5.2MB ERA5 data)

## File Index (Read These as Needed)

**Start Here**: `.vibe-kit/innovation-kits/aurora/INNOVATION_KIT.md` (Prerequisites, Getting Started, Learning Path)

**30-min Tutorial**: `.vibe-kit/innovation-kits/aurora/docs/quick-start.md` (Norway coastal forecast, frontend + inference)

**Technical Deep Dive**: `.vibe-kit/innovation-kits/aurora/docs/norway-technical-guide.md` (How Aurora inference works: 2 timesteps → 24h forecast)

**Build Your Own**:

- `.vibe-kit/innovation-kits/aurora/docs/prototyping-guide.md` (**Customization**: Adapt Norway example for your region)
- `.vibe-kit/innovation-kits/aurora/docs/aurora-prototyping-guide.md` (**From Scratch**: Build from fundamentals)

**Data Integration**: `.vibe-kit/innovation-kits/aurora/docs/data-integration.md` (CDS ERA5 downloads, format conversion)

**Use Case Templates**: `.vibe-kit/innovation-kits/aurora/docs/application-patterns.md` (Coastal, energy, agriculture, maritime scenarios)

**Troubleshooting**: `.vibe-kit/innovation-kits/aurora/docs/emergency-fixes.md` (Model divergence, grid errors, timezone bugs)

**Performance**: `.vibe-kit/innovation-kits/aurora/docs/performance-guide.md` (Hardware sizing, GPU optimization, deployment)

**Utilities**: `.vibe-kit/innovation-kits/aurora/assets/scripts/` (check_aurora_dataset.py, download_era5_subset.py, quick_verify_netcdf.py)

## Quick Routing

- **"How do I start?"** → `.vibe-kit/innovation-kits/aurora/docs/quick-start.md` (Norway example: cd .vibe-kit/innovation-kits/aurora/assets/norway-example/)
- **"How does it work?"** → `.vibe-kit/innovation-kits/aurora/docs/norway-technical-guide.md` (48×48 grid, SPATIAL_PATCH_SIZE=16, 2-timestep input)
- **"Adapt Norway example"** → `.vibe-kit/innovation-kits/aurora/docs/prototyping-guide.md` (Customization: change region, variables, deploy)
- **"Build from scratch"** → `.vibe-kit/innovation-kits/aurora/docs/aurora-prototyping-guide.md` (Learn fundamentals, write own code)
- **"Get my data"** → `.vibe-kit/innovation-kits/aurora/docs/data-integration.md` (CDS credentials, ERA5 downloads)
- **"Errors?"** → `.vibe-kit/innovation-kits/aurora/docs/emergency-fixes.md` (Common issues + fixes)
- **"Use cases?"** → `.vibe-kit/innovation-kits/aurora/docs/application-patterns.md` (Coastal forecasting, energy planning, agriculture)

## Working Example Structure

`.vibe-kit/innovation-kits/aurora/assets/norway-example/` contains:

- `frontend/` - React visualization (temperature heatmaps, time slider)
- `scripts/run_aurora_inference.py` - Main inference script
- `data/` - 5.2MB ERA5 observations (June 1-7, 2025, Norway coastal region 58.25°N-70°N, 5°E-16.75°E)
- `docs/` - AURORA_INFERENCE_GUIDE.md, LESSONS_LEARNED.md, ROADMAP.md
- `README.md` - Example-specific setup and usage

## Key Technical Details

- **Grid requirements**: Latitude/longitude dimensions must be divisible by 16 (conservative safety margin; Aurora source uses patch_size=4)
- **Input**: 2 consecutive timesteps (6-hour interval), 48×48 spatial grid minimum
- **Output**: 24-hour forecast at 6-hour intervals
- **Variables**: 2m temperature, 10m u/v wind, surface pressure (from ERA5)
- **Model**: microsoft-aurora package, downloads checkpoint automatically (~5GB first run)

## Official Resources

- GitHub: https://github.com/microsoft/aurora
- Hugging Face: https://huggingface.co/microsoft/aurora
- Paper: Nature 2025 (Aurora: A Foundation Model of the Atmosphere)
