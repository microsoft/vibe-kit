---
Name: "Aurora"
Description: >-
  Aurora is Microsoft’s 1.3B-parameter foundation model for atmosphere and ocean
  forecasting, delivering 0.1°–0.4° global predictions up to ten days faster than
  conventional numerical weather models.
ReferenceLinks:
  - label: "Azure AI Foundry Model Page"
    url: "https://ai.azure.com/catalog/models/Aurora"
  - label: "GitHub"
    url: "https://github.com/microsoft/aurora"
  - label: "Hugging Face"
    url: "https://huggingface.co/microsoft/aurora"
  - label: "Research Paper"
    url: "https://arxiv.org/pdf/2405.13063" 
---
## Aurora Innovation Kit Contents

**Installation:** Run `vibekit install aurora` from your workspace root, then reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window") to activate the Aurora Forecast chat mode.

**Learn by doing:** This kit centers on the Norway mainland forecast prototype (64×112 grid)—a complete, working example that teaches Aurora's capabilities through hands-on experience.

### Prerequisites
Before starting, ensure you have:
- **Python 3.10+** with `torch`, `numpy`, `xarray`, `aurora` (or use provided `requirements.txt`)
- **Node.js 18+** and `npm` for frontend development (optional)
- **4GB+ free disk space** for model checkpoints and sample data
- **GPU recommended** (but CPU works for small grids)

**Map center (Norway example)**: [64.875°N, 17.875°E]

### Getting Started
- **[docs/quick-start.md](.vibe-kit/innovation-kits/aurora/docs/quick-start.md)** – Get the 64×112 Norway example running in 30 minutes (frontend → Copilot → inference → results)
- **[docs/norway-technical-guide.md](.vibe-kit/innovation-kits/aurora/docs/norway-technical-guide.md)** – Understand how Aurora inference works (2 timesteps, 64×112 grid, 24-hour stability)
- **[assets/norway-example/](.vibe-kit/innovation-kits/aurora/assets/norway-example/)** – Complete reference implementation (scripts, frontend, mainland Norway ERA5 bundle)

### Build Your Own
- **[docs/expand-norway-example.md](.vibe-kit/innovation-kits/aurora/docs/expand-norway-example.md)** – **Customization Guide**: Adapt the Norway example for your region, variables, and forecast horizon (modify working code)
- **[docs/aurora-prototyping-guide.md](.vibe-kit/innovation-kits/aurora/docs/aurora-prototyping-guide.md)** – **From Scratch Guide**: Build your own Aurora application from fundamentals (learn core concepts without starting from an example)
- **[docs/data-integration.md](.vibe-kit/innovation-kits/aurora/docs/data-integration.md)** – Connect your own CDS ERA5 data sources and convert to Aurora format
- **[docs/application-patterns.md](.vibe-kit/innovation-kits/aurora/docs/application-patterns.md)** – Scenario templates for coastal forecasting, energy, agriculture, and maritime

**Norway baseline facts:** 64×112 grid (57.0–72.75° N, 4.0–31.75° E). ERA5 bundle totals ~8.5 MB (`norway_surface.nc` 1.5 MB, `norway_atmospheric.nc` 6.9 MB, `norway_static.nc` 81 KB). Frontend assets for the example include ~54 MB observations and ~7.6 MB predictions (these bundles are gitignored). Forecast output `norway_june8_forecast.nc` + regenerated TypeScript modules stay local.

Checkpoint download: the first run downloads the Aurora checkpoint (~5.03 GB) to `~/.cache/aurora` -- this typically takes ~5 minutes on a fast connection; subsequent runs use the cached checkpoint.

### Utilities & Tools
- **[assets/scripts/](.vibe-kit/innovation-kits/aurora/assets/scripts/)** – Standalone utilities for data validation, CDS downloads, and NetCDF inspection
  - `quick_verify_netcdf.py` – Fast sanity checks without heavy dependencies
  - `check_aurora_dataset.py` – Validate NetCDF files have required Aurora variables
  - `download_era5_subset.py` – Automate CDS API downloads for custom regions

### Troubleshooting & Optimization
- **[docs/troubleshooting.md](.vibe-kit/innovation-kits/aurora/docs/troubleshooting.md)** – Solutions to common issues (model divergence, grid errors, timezone bugs)
- **[docs/performance-guide.md](.vibe-kit/innovation-kits/aurora/docs/performance-guide.md)** – Hardware sizing, GPU optimization, and production deployment patterns


## Learning Path

**Beginner** (First 2 hours)
1. ✓ **Quick Start (30 min)** → Get Norway example running, see your first Aurora forecast
2. ✓ **Technical Guide (1 hour)** → Understand WHY it works (model architecture, grid constraints, stability)
3. ✓ **Run your own inference** → Modify the Norway scripts to forecast a different date range

**Intermediate** (Next 4-8 hours)
4. **Prototyping Guide** → Adapt for YOUR region (download new ERA5 data, adjust grid boundaries)
5. **Data Integration** → Connect your own data pipelines and automate forecast updates
6. **Frontend customization** → Brand the dashboard, add new visualizations

**Advanced** (Ongoing)
7. **Application Patterns** → Explore scenario templates (energy dispatch, crop risk, maritime routing)
8. **Performance optimization** → Production deployment, GPU scaling, caching strategies
9. **Custom fine-tuning** → Train Aurora variants on domain-specific data (requires research expertise)

## Deployment Modes

- **Local bundle (default)** – Every quick start and prototype ships with the small Aurora checkpoint, ERA5 tiles, and offline generation scripts so an engineer can reproduce results on a laptop with no cloud dependency.
- **Azure AI Foundry (optional)** – When teams export the four `AZURE_AURORA_*` variables and install the optional SDK, the same scripts call a managed Aurora deployment. 
Each doc clearly labels this as opt-in so readers understand the prototype continues to function offline.


## Quick Wins Checklist

After completing the quick start, you should be able to:
- ✓ Run Aurora inference on a 64×112 grid in ~45 minutes (CPU) or ~6 minutes (GPU)
- ✓ Generate 24-hour forecasts with 6-hour timesteps (4 predictions)
- ✓ Visualize wind speed, temperature, and pressure on an interactive map
- ✓ Download your own ERA5 data for any region using the provided utilities
- ✓ Explain why Aurora needs 2 input timesteps and what "autoregressive rollout" means

## Philosophy

**Focus**: Hands-on learning through the Norway mainland forecast prototype, then adaptation to your specific scenario  
**Scope**: Regional weather forecasting (24-hour horizons), with patterns for energy, agriculture, and maritime  
**Timeline**: Hour 1 – Norway example running | Hours 2-4 – understand internals | Hours 4-8 – build your own prototype


## Key Advantages

- **Accuracy headroom**: Aurora matches or beats GraphCast on 94% of 0.25° targets and improves extreme-event RMSEs by up to 15%. (source: Microsoft Research blog)
- **Speed**: ~5,000× faster inference than ECMWF IFS HRES once checkpoints are cached, enabling rapid what-if analysis. (source: Microsoft Research blog)
- **Versatility**: Fine-tuned variants cover medium-/high-res weather, air chemistry, waves, and cyclone tracking from a single API (source: GitHub README)


## Resources

- **GitHub**: https://github.com/microsoft/aurora
- **Paper**: Nature, 2025, "[A Foundation Model for the Earth System](.vibe-kit/innovation-kits/aurora/assets/paper/s41586-025-09005-y.pdf)"
- **Models**: https://huggingface.co/microsoft/aurora (checkpoints and static feature pickles)
