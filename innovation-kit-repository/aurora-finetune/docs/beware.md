# Beware! Common Aurora Pitfalls

Keep these caveats in mind while working through the Aurora Finetuning Innovation Kit. 

## Table of contents

- [Beware! Common Aurora Pitfalls](#beware-common-aurora-pitfalls)
  - [Table of contents](#table-of-contents)
  - [Data sensitivity](#data-sensitivity)
  - [Disk and cache limits](#disk-and-cache-limits)
  - [HRES IFS variants](#hres-ifs-variants)
  - [Deterministic runs](#deterministic-runs)
  - [Loading modified models](#loading-modified-models)

## Data sensitivity

Aurora assumes you provide **exactly the same variable set, pressure levels, and data sources** it was trained on. Deviations—especially in regridding—can noticeably degrade predictions.

Recommendations:

- Match variables and levels to the tables in `docs/aurora-finetuning-guide.md`.
- Follow the batch specification in `docs/form-of-a-batch.md`.
- Regrid data using the same methodology as the original pretraining/fine-tuning pipelines. Even small interpolation differences can compound.

## Disk and cache limits

Running `uv sync` or other `uv` commands in constrained environments (for example dev containers, Codespaces, or cloud notebooks) can exhaust the default cache at `/tmp`. Large wheels—`torch`, `timm`, CUDA toolkits—may fail with `No space left on device` before installs complete.

**Mitigations:**

- Redirect the cache to persistent storage before invoking `uv`, for example `export UV_CACHE_DIR=$(pwd)/.uv-cache`.
- Pair the cache override with `export UV_LINK_MODE=copy` so the install copies artifacts instead of hard-linking across filesystems.
- Periodically clean old artifacts (`uv cache prune`) if you switch between many dependency sets.

These environment variables apply to the initialization script, `uv sync`, and `uv pip install`; they do not change where the virtual environment itself lives.

## HRES IFS variants

HRES IFS T0 is **not** the same as HRES IFS analysis; the latter includes an additional surface assimilation step.

Model requirements:

- `Aurora 0.25° Fine-Tuned` → requires IFS HRES T0.
- `Aurora 0.1° Fine-Tuned` → requires IFS HRES analysis.

Mixing these products can introduce systematic bias. See the variant table in `docs/aurora-finetuning-guide.md` for full details.

## Deterministic runs

Need reproducible output? Configure PyTorch accordingly:

1. Enable deterministic kernels: `torch.use_deterministic_algorithms(True)`.
2. Switch to evaluation mode to disable dropout: `model.eval()`.

Combine this with fixed random seeds in your data pipeline for best results.

## Loading modified models

When you alter the architecture (e.g., add LoRA adapters, extra layers, or variable embeddings), checkpoint shapes change. Load with relaxed matching:

```python
model.load_checkpoint(strict=False)
```

Remember: toggling LoRA on or off changes parameter sets, so fine-tuned checkpoints won’t load into mismatched configs without `strict=False`. Review `docs/finetuning.md` for broader guidance on extending Aurora.