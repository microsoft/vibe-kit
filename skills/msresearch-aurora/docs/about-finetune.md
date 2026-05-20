# Why Fine-Tune Aurora?

**Adapt a foundation weather model to your region, variables, or use case — in hours, not months.**

> **Just want to see Aurora in action?** Spin up the [demo app](finetune-demo.md) for an interactive look at how training data size affects predictions — no fine-tuning, no GPU, no code required.

> **New to Aurora?** Start with [about-aurora.md](about-aurora.md) for a model overview (what Aurora is, how it works, ERA5), then return here for the fine-tuning angle.

---

## Contents

- [The Fine-Tuning Advantage](#the-fine-tuning-advantage)
- [What Fine-Tuning Unlocks](#what-fine-tuning-unlocks)
- [Who Should Fine-Tune Aurora](#who-should-fine-tune-aurora)
- [Compute Requirements](#compute-requirements)
- [How Aurora Makes Fine-Tuning Work](#how-aurora-makes-fine-tuning-work)
- [Published Results](#published-results)
- [Next Steps](#next-steps)

---

## The Fine-Tuning Advantage

Training a weather AI from scratch requires:

- **Millions of hours** of atmospheric data
- **Weeks on 32+ GPUs** (A100-class hardware)
- **Deep ML expertise** to stabilize training

Aurora eliminates this barrier. Microsoft Research pre-trained Aurora on over one million hours of atmospheric data, learning general patterns of how the Earth system evolves. Fine-tuning lets you **inherit that knowledge** and specialize it for your specific application with:

- **Days to weeks** of training time (not months)
- **A single GPU** (A100 recommended, but smaller GPUs work for demos)
- **Small datasets** — months of data instead of decades

This is the same transfer-learning approach that revolutionized NLP (BERT, GPT) and computer vision (ImageNet pretraining). Aurora brings it to weather and climate.

---

## What Fine-Tuning Unlocks

### Regional Adaptation

The base Aurora model is trained on global data. Fine-tuning on regional observations improves accuracy for local climate patterns:

- Mediterranean sea breezes and mountain effects
- Monsoon dynamics in South Asia
- Arctic sea-ice interactions
- Urban heat islands

### New Variables

Aurora's base checkpoint predicts standard weather variables (temperature, wind, pressure). Fine-tuning can add:

- **Air quality:** PM2.5, PM10, ozone, NO2 from CAMS data
- **Ocean waves:** Significant wave height, swell direction from HRES-WAM
- **Solar radiation:** UV index, downward shortwave flux
- **Custom variables:** Any gridded observation you can provide

### Specialized Applications

Fine-tuned models already demonstrated in the Aurora research:

| Application | Data Source | Key Result |
|---|---|---|
| Air pollution forecasting | CAMS analysis | Matches CAMS on 74% of targets; 100,000x faster |
| Ocean wave prediction | HRES-WAM | Matches HRES-WAM on 86% of targets |
| Tropical cyclone tracking | IFS HRES | Outperforms 6 national weather agencies |

### Extended Lead Times

The base model predicts 6 hours ahead per step. Fine-tuning can optimize for:

- **12-hour timesteps** (fewer rollout steps for weekly forecasts)
- **Longer-horizon stability** (reduced error accumulation)

---

## Who Should Fine-Tune Aurora

**Good fit:**

- Researchers studying regional climate or specialized phenomena
- Organizations needing forecasts for variables Aurora doesn't predict out of the box
- Teams with domain data (local weather stations, satellite products, reanalysis)
- Anyone who needs better accuracy than the global model for a specific application

**Not required if:**

- You only need global weather forecasts for standard variables — use the pre-trained checkpoints directly
- Your application is air quality, ocean waves, or tropical cyclones — Microsoft already published fine-tuned checkpoints for these

---

## Compute Requirements

This is the canonical compute reference for the skill. Other docs link here rather than repeating numbers.

### By scenario

| Scenario | GPU (VRAM) | System RAM | Disk | Time |
|---|---|---|---|---|
| **Smoke test** (1 batch, starter-code tests) | CPU or any GPU | 8 GB | 6 GB | 2-8 minutes |
| **Quick-start demo** (2 epochs, bundled `era5_training_data_jan2025_1_to_7.pkl`) | T4 16 GB (8-12 GB used) or A100 (10-15 GB used) | 8-12 GB | 6 GB | 10-30 minutes |
| **Serious fine-tuning** (10-50 epochs, months of ERA5) | A100 40 GB (with AMP + checkpointing) or 80 GB | 32 GB | 100 GB (model + months of ERA5) | Hours to days |
| **Production training** (multi-GPU, years of data) | 4-8× A100 80 GB | 64 GB+ | 200 GB+ (years of ERA5) | Days to weeks |

### What the disk numbers measure

- **6 GB** — Aurora pretrained checkpoint (~5 GB) + Python dependencies. Sufficient for the quick-start and demo app.
- **100 GB** — Above plus a few months of ERA5 reanalysis data at 0.25° resolution, training logs, and checkpoint snapshots.
- **200 GB+** — Above plus multi-year ERA5 archives and multiple training runs. Push raw data to cloud storage if local disk is tight.

### Memory optimization

Memory is the primary constraint. The full Aurora model requires ~40 GB VRAM for gradient-based training at 0.25° resolution. The starter code enables all three of the following by default:

- **Automatic Mixed Precision (AMP):** Halves memory for activations
- **Activation checkpointing:** Trades compute for memory
- **Gradient accumulation:** Simulates larger batches without more VRAM

For inference (no gradients), VRAM drops substantially — see [inference-basics.md](inference-basics.md#memory-requirements).

### CPU-only path

CPU works for the starter-code test suite and 1-batch smoke tests but is 5-8× slower than GPU. Not viable for multi-epoch training.

---

## How Aurora Makes Fine-Tuning Work

Aurora's architecture is designed for efficient adaptation:

### 3D Perceiver Encoder

Processes multi-resolution, multi-source data through a flexible attention mechanism. When you add new variables, Aurora only needs to learn new input embeddings — the core model architecture stays frozen or lightly tuned.

### LoRA (Low-Rank Adaptation)

For long autoregressive rollouts, Aurora applies small rank-4 adapters to attention layers. This prevents error accumulation without retraining the full model.

### Separate Learning Rates

New variable embeddings train at higher learning rates (1e-3) while pretrained weights use conservative rates (3e-4). This prevents catastrophic forgetting of learned weather dynamics.

### Normalization Statistics

Each variable has mean/std statistics for input normalization. When adding variables, you only need to provide these statistics — Aurora handles the rest.

---

## Published Results

From the Nature paper (May 2025):

> "Aurora can be efficiently fine-tuned to achieve strong performance on downstream applications, including air quality prediction and ocean wave forecasting, at a fraction of the computational cost of specialized models."

Key numbers:

- **Air quality:** Fine-tuned Aurora matches or beats CAMS on 74% of all variables while running ~100,000x faster
- **Ocean waves:** Matches or beats HRES-WAM on 86% of wave variables
- **Tropical cyclones:** Outperforms official forecasts from JTWC, NHC, JMA, CMA, KMA, and IMD across all 2022-2023 storms
- **Scaling:** Performance improves ~6% for every 10x increase in training data

---

## Next Steps

- **Quick start:** [quick-start-finetune.md](quick-start-finetune.md) — Run your first fine-tuning experiment in 30 minutes
- **Technical details:** [finetuning-guide.md](finetuning-guide.md) — Gradients, LoRA, variable extension, troubleshooting
- **Data format:** [form-of-a-batch.md](form-of-a-batch.md) — How to structure inputs for Aurora
- **Common pitfalls:** [troubleshooting.md](troubleshooting.md) — Known issues and mitigations
- **Research paper:** [A foundation model for the Earth system](https://www.nature.com/articles/s41586-025-09005-y) (Nature, 2025)
