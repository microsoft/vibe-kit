# Inference Basics

> **Context for fine-tuners:** This document covers how to *run* Aurora for inference. If you're here to fine-tune, see [finetuning-guide.md](finetuning-guide.md). Understanding inference is useful for validating your fine-tuned models.

---

## Contents

- [Installation](#installation)
- [One-Step Predictions](#one-step-predictions)
- [Autoregressive Rollouts](#autoregressive-rollouts)
- [Memory Requirements](#memory-requirements)
- [ECMWF ai-models Plugin](#ecmwf-ai-models-plugin)

---

## Installation

Install the official Aurora package:

```bash
pip install microsoft-aurora
```

Or via conda-forge:

```bash
mamba install microsoft-aurora -c conda-forge
```

Or from source:

```bash
git clone https://github.com/microsoft/aurora.git
cd aurora
virtualenv venv -p python3.10
source venv/bin/activate
make install
```

---

## One-Step Predictions

Making predictions involves three steps:

1. Prepare a batch of data
2. Construct the model and load a checkpoint
3. Run the model on the batch

### Prepare Data

A batch contains surface-level variables, static variables, atmospheric variables, and metadata. It must be an `aurora.Batch`:

```python
from datetime import datetime
import torch
from aurora import Batch, Metadata

batch = Batch(
    surf_vars={k: torch.randn(1, 2, 17, 32) for k in ("2t", "10u", "10v", "msl")},
    static_vars={k: torch.randn(17, 32) for k in ("lsm", "z", "slt")},
    atmos_vars={k: torch.randn(1, 2, 4, 17, 32) for k in ("z", "u", "v", "t", "q")},
    metadata=Metadata(
        lat=torch.linspace(90, -90, 17),
        lon=torch.linspace(0, 360, 32 + 1)[:-1],
        time=(datetime(2020, 6, 1, 12, 0),),
        atmos_levels=(100, 250, 500, 850),
    ),
)
```

See [form-of-a-batch.md](form-of-a-batch.md) for detailed tensor specifications.

### Load Model and Checkpoint

```python
from aurora import AuroraSmallPretrained

model = AuroraSmallPretrained()
model.load_checkpoint()
model.eval()
```

For other checkpoints:

```python
model.load_checkpoint("microsoft/aurora", "aurora-0.25-small-pretrained.ckpt")
```

See [available-models.md](available-models.md) for all checkpoint options.

### Run Inference

```python
model = model.to("cuda")

with torch.inference_mode():
    pred = model.forward(batch)
```

Predictions are also `aurora.Batch` objects. Access results like `pred.surf_vars["2t"]` for two-meter temperature.

---

## Autoregressive Rollouts

For multi-step forecasts, apply the model autoregressively with `aurora.rollout`:

```python
from aurora import rollout

model = model.to("cuda")

with torch.inference_mode():
    preds = [pred.to("cpu") for pred in rollout(model, batch, steps=10)]
```

Moving predictions to CPU after each step prevents GPU memory buildup. Each element of `preds` is an `aurora.Batch`.

---

## Memory Requirements

Inference (no gradients) is much lighter than training:

- **Full model on 0.25° global data:** ~40 GB VRAM
- **AuroraSmallPretrained:** Suitable for debugging on smaller GPUs
- **CPU inference:** Works but 5-8x slower

For training/fine-tuning hardware, see [about-finetune.md](about-finetune.md#compute-requirements). For memory-saving training techniques, see [finetuning-guide.md](finetuning-guide.md#computing-gradients-efficiently).

---

## ECMWF ai-models Plugin

Aurora integrates with ECMWF's [`ai-models`](https://github.com/ecmwf-lab/ai-models) framework via the [`ai-models-aurora`](https://github.com/ecmwf-lab/ai-models-aurora) plugin:

```bash
pip install ai-models-aurora
```

This enables Aurora in ECMWF's standardized AI model interface. See the plugin documentation for usage details.
