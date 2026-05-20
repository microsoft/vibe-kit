# What is Aurora?

**Aurora is an AI system built by Microsoft Research that predicts weather, air quality, ocean waves, and more — faster and cheaper than traditional methods.**

> **Already familiar with Aurora and want to fine-tune it?** Skip ahead to [about-finetune.md](about-finetune.md), or jump straight to [quick-start-finetune.md](quick-start-finetune.md).

---

## Contents

- [The Problem Aurora Solves](#the-problem-aurora-solves)
- [What Aurora Can Do](#what-aurora-can-do)
- [How Aurora Works](#how-aurora-works)
- [What is ERA5?](#what-is-era5)
- [Key Results](#key-results)
- [Real-World Applications](#real-world-applications)
- [Limitations](#limitations)
- [Learn More](#learn-more)

---

## The Problem Aurora Solves

Weather forecasting today relies on massive supercomputers that simulate the physics of the atmosphere. These systems:

- **Cost millions** to build and maintain
- **Take hours** to produce a single global forecast
- **Require large teams** of specialized engineers
- **Are hard to adapt** for new applications (air quality, ocean waves, etc.)

This means that accurate, timely weather predictions are only available to organizations with enormous budgets — national weather agencies, military, and large corporations.

Aurora changes this. It learned weather patterns from over **one million hours** of real-world atmospheric data, and can now produce forecasts that match or beat traditional supercomputer models — running on a **single GPU in seconds** instead of a supercomputer cluster in hours.

---

## What Aurora Can Do

Aurora is a **foundation model** — a single AI system that can be adapted to many different prediction tasks:

| Application | What it predicts | vs. traditional methods |
|---|---|---|
| **Weather** | Temperature, wind, pressure at 0.1° resolution | Beats ECMWF IFS on 92% of targets |
| **Air quality** | Pollution levels (PM10, ozone, etc.) | Matches or beats CAMS on 74% of variables; 100,000x faster |
| **Ocean waves** | Wave height, period, and direction | Matches or beats HRES-WAM on 86% of variables |
| **Tropical cyclones** | Storm track predictions | Outperforms official forecasts from multiple national agencies |

All at **orders of magnitude lower computational cost**. Most of these specialized capabilities were unlocked through fine-tuning — a workflow this skill also helps you reproduce for your own variables and regions (see [about-finetune.md](about-finetune.md)).

---

## How Aurora Works

Aurora has three main components:

```
Weather Data --> [Encoder] --> [Processor] --> [Decoder] --> Forecast
```

### 1. Encoder: Reads the weather

Takes in weather observations — temperature, wind speed, pressure, humidity — from different sources and formats, and converts them into a standardized internal representation. Think of it as a translator that can read weather data from anywhere in the world, at any resolution.

When you fine-tune Aurora on **new variables**, the encoder is where new input embeddings get added. See [about-finetune.md#how-aurora-makes-fine-tuning-work](about-finetune.md#how-aurora-makes-fine-tuning-work) for details.

### 2. Processor: Simulates time passing

The core of Aurora is a 3D Swin Transformer — a type of neural network that processes spatial data efficiently. It takes the current weather state and predicts what the atmosphere will look like 6 hours later. To make longer forecasts, Aurora feeds its own predictions back in as inputs, stepping forward 6 hours at a time (called "autoregressive rollout").

**Why Aurora needs 2 timesteps:** To predict where the weather is going, Aurora needs to know not just the current state, but also how things are changing. Just like predicting where a car will be requires knowing both its position and speed, Aurora uses two snapshots 6 hours apart to capture atmospheric trends — whether temperatures are rising or falling, whether winds are accelerating or slowing.

### 3. Decoder: Writes the forecast

Converts Aurora's internal representation back into physical quantities — temperature in Kelvin, wind speed in m/s, pressure in Pa. These come out as gridded data (like a spreadsheet laid over a map), ready for visualization or downstream analysis.

### Training: How Aurora learned

Aurora was trained in two phases:

1. **Pretraining:** Trained on a huge, diverse collection of atmospheric data (ERA5 reanalysis, operational forecasts, climate simulations) for 150,000 steps on 32 A100 GPUs (~2.5 weeks). This gave it a general understanding of how the atmosphere works.

2. **Fine-tuning:** The pretrained model can then be cheaply adapted to specific tasks using much smaller datasets. Fine-tuning typically takes 4-8 weeks with a small team, compared to years for traditional models. See [about-finetune.md](about-finetune.md) for the why and [quick-start-finetune.md](quick-start-finetune.md) for a 30-minute first run.

---

## What is ERA5?

ERA5 is the most widely used weather dataset in the world, produced by the European Centre for Medium-Range Weather Forecasts (ECMWF).

**What makes it special:**
- Combines real observations (weather stations, satellites, weather balloons) with physics-based models to fill in gaps — a process called **reanalysis**
- Covers the entire globe at 0.25° resolution (~31 km between grid points)
- Provides data every hour, going back to 1940
- Includes surface weather (temperature, wind, pressure) and atmospheric profiles at multiple altitude levels

**Why Aurora uses ERA5:** ERA5 provides the input data Aurora needs. You give Aurora two ERA5 snapshots 6 hours apart, and it predicts what happens next. The bundled Norway example uses ERA5 data from June 1-7, 2025, and Aurora predicts June 8. The fine-tuning quick-start uses `era5_training_data_jan2025_1_to_7.pkl` (one week of January 2025 ERA5 data, pre-packaged so you don't need a CDS account to try the workflow).

ERA5 data is freely available from the [Copernicus Climate Data Store](https://cds.climate.copernicus.eu). You need a free account and API key to download it for your own region or time range. This skill bundles `assets/inference/scripts/download_era5_subset.py` for turnkey ERA5 retrieval.

---

## Key Results

From the published research (Nature, May 2025):

- **High-resolution weather (0.1°):** Outperforms ECMWF IFS HRES on 92% of target variables, with RMSE reductions up to 24%
- **Air quality:** Matches or outperforms CAMS on 74% of all targets, generating predictions ~100,000x faster
- **Ocean waves:** Matches or outperforms HRES-WAM on 86% of wave variables, accurately predicting wave height during Typhoon Nanmadol (2022)
- **Tropical cyclones:** Outperforms official track forecasts from six national agencies across four ocean basins for all 2022-2023 tropical cyclones
- **Storm Ciaran (2023):** Among tested AI models, Aurora was the only one that accurately predicted the abrupt increase in maximum wind speeds during this high-impact European storm
- **Scaling:** Performance improves ~6% for every 10x increase in model size, suggesting further gains with larger models

---

## Real-World Applications

Aurora's speed, accuracy, and adaptability open up applications that were previously impractical:

- **Wind energy** — Predict wind speeds at turbine hub heights to optimize generation and detect ramp events
- **Solar energy** — Forecast temperature and pressure patterns as proxies for cloud cover and PV output
- **Emergency response** — Rapid regional forecasts for storms, heat waves, and flooding
- **Agriculture** — Frost warnings, growing degree days, crop condition monitoring
- **Shipping** — Ocean wave forecasts for route planning and port operations
- **Air quality** — Predict pollution events (sandstorms, smog) to trigger public health alerts

The key advantage: where traditional systems require purpose-built supercomputers for each application, Aurora can be fine-tuned for new tasks with modest compute and small datasets.

Most of the air-quality, ocean-wave, and cyclone results above came from **fine-tuned** variants of the base Aurora model — exactly the kind of adaptation this skill enables.

---

## Limitations

- **Not real-time out of the box.** ERA5 data has ~5-day latency. Real-time forecasting requires alternative inputs (e.g., GFS or HRES T0 initial conditions).
- **Regional grid constraints.** Grid dimensions must be divisible by 16. Small grids (< 48x48) limit stable forecast horizons.
- **Deterministic only.** Produces a single forecast, not an ensemble. Cannot directly quantify uncertainty.
- **Fine-tuning needed for new domains.** The base model is optimized for weather. Air quality, ocean waves, and other applications require fine-tuning with domain-specific data — which is what the fine-tuning workflow in this skill helps you do.
- **GPU strongly recommended for training.** CPU works for the starter-code smoke tests but is 5-8x slower. See [about-finetune.md#compute-requirements](about-finetune.md#compute-requirements) for the canonical hardware reference.

---

## Learn More

- **Try inference first:** [quick-start-inference.md](quick-start-inference.md) — Run the Norway forecast in 30 minutes
- **Why fine-tune Aurora:** [about-finetune.md](about-finetune.md) — The fine-tuning advantage, what it unlocks, who should do it
- **Try fine-tuning:** [quick-start-finetune.md](quick-start-finetune.md) — Run your first fine-tuning experiment in 30 minutes
- **Research paper:** [A foundation model for the Earth system](https://www.nature.com/articles/s41586-025-09005-y) (Nature, 2025)
- **Source code:** [github.com/microsoft/aurora](https://github.com/microsoft/aurora)
- **Model weights:** [huggingface.co/microsoft/aurora](https://huggingface.co/microsoft/aurora)
- **Azure deployment:** [Azure AI Foundry](https://ai.azure.com/catalog/models/Aurora)

## Paper

Local copies of the Aurora research papers are bundled with this skill at `assets/inference/paper/`:

- [`s41586-025-09005-y.pdf`](../assets/inference/paper/s41586-025-09005-y.pdf) — *A foundation model for the Earth system*, the published Nature article (Bodnar et al., 2025).
- [`2509.25268v1.pdf`](../assets/inference/paper/2509.25268v1.pdf) — Companion arXiv preprint with extended methodology and supplementary material.
