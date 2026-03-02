---
name: aurora
description: Aurora weather forecasting workflows and regional adaptation guidance.
license: MIT
---
## Activation Conditions

Activate when the user asks about Aurora weather forecasting, climate prediction, wind and temperature mapping, or adapting the Norway example to another region.

## Scope Boundaries

- Focus on local and Azure-assisted Aurora inference workflows for regional 24-hour forecasts.
- Prioritize the Norway example as the canonical path before custom regional adaptation.

## Quick Context

- Norway baseline grid: 64x112 covering 57.0–72.75 N and 4.0–31.75 E.
- First run downloads Aurora checkpoint (~5 GB) into local cache.
- Keep static, atmospheric, and surface ERA5 files separate for reproducible runs.

## Prerequisites

- Python 3.10+ with `torch`, `numpy`, `xarray`, and `aurora`.
- Node.js 18+ and `npm` for frontend tasks.
- 4 GB+ free disk space.
- GPU recommended for faster inference.

## Workflow

1. Launch frontend observations from `assets/norway-example/frontend` and confirm prediction layers are initially disabled.
2. Open a separate terminal for inference, install Python requirements, run `scripts/run_aurora_inference.py`, and generate the frontend module with `scripts/build_forecast_module.py`.
3. Return to the frontend terminal, refresh, and validate prediction layers are available.
4. Offer next paths: adapt to a new region, extend forecast horizon, or apply a domain-specific pattern.

For regional setup, use `assets/scripts/setup_region.py` and keep longitude handling aligned with `scripts/run_aurora_inference.py`.

## Routing

- `docs/quick-start.md` for first-run workflow.
- `docs/norway-technical-guide.md` for inference internals.
- `docs/expand-norway-example.md` for regional adaptation.
- `docs/aurora-prototyping-guide.md` for from-scratch implementations.
- `docs/data-integration.md` for ERA5 data ingestion.
- `docs/application-patterns.md` for use-case templates.
- `docs/troubleshooting.md` and `docs/performance-guide.md` for reliability and optimization.
- `assets/norway-example/` for the reference implementation.

## Learning Path

1. Run `docs/quick-start.md` and verify first forecast output.
2. Read `docs/norway-technical-guide.md` for grid and stability constraints.
3. Adapt boundaries with `docs/expand-norway-example.md`.
4. Apply scenario patterns from `docs/application-patterns.md`.

## Reference Links

- Azure AI Foundry Model Page: https://ai.azure.com/catalog/models/Aurora
- GitHub: https://github.com/microsoft/aurora
- Hugging Face: https://huggingface.co/microsoft/aurora
- Research Paper: https://arxiv.org/pdf/2405.13063
