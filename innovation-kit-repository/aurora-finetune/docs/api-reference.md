# Aurora API Reference

Use this guide to navigate the primary classes exposed by the Aurora Python package when extending or fine-tuning the model. The summaries below capture constructor arguments, default behaviors, and the most common helper methods.

## Batch

`aurora.Batch(surf_vars, static_vars, atmos_vars, metadata)`

A container for a single batch of Aurora data.

**Parameters**

- `surf_vars`: `dict[str, torch.Tensor]` – Surface variables shaped `(batch, time, height, width)`.
- `static_vars`: `dict[str, torch.Tensor]` – Static variables shaped `(height, width)`.
- `atmos_vars`: `dict[str, torch.Tensor]` – Atmospheric variables shaped `(batch, time, channels, height, width)`.
- `metadata`: [`aurora.Metadata`](#metadata) – Extra context attached to the batch.

**Key methods**

- `crop(patch_size: int) -> Batch` – Crop every tensor to the requested spatial patch.
- `from_netcdf(path: str | Path) -> Batch` – Load a batch from disk.
- `normalise(surf_stats: dict[str, tuple[float, float]]) -> Batch` / `unnormalise(...) -> Batch` – Adjust surface statistics using `(location, scale)` tuples.
- `regrid(res: float) -> Batch` – Downsample tensors to `res`-degree resolution (CPU-only helper).
- `spatial_shape -> tuple[int, int]` – Convenience accessor for `(height, width)`.
- `to(device: str | torch.device) -> Batch` – Move tensors to another device.
- `to_netcdf(path: str | Path)` – Persist the batch with `xarray`/`netcdf4`.
- `type(dtype: torch.dtype) -> Batch` – Cast tensors to a new dtype.

## Metadata

`aurora.Metadata(lat, lon, time, atmos_levels, rollout_step=0)`

Metadata bundled with each batch.

- `lat`, `lon`: torch tensors describing coordinates.
- `time`: tuple of datetimes matching the batch dimension.
- `atmos_levels`: tuple of pressure levels (hPa).
- `rollout_step`: how many autoregressive steps produced this prediction (0 for ground-truth data).

## Roll-outs

`aurora.rollout(model, batch, steps)`

Generator that yields the prediction after each autoregressive step.

- `model`: [`aurora.Aurora`](#aurora).
- `batch`: Initial [`aurora.Batch`](#batch).
- `steps`: Number of rollout steps to simulate.

Yields `aurora.Batch` objects for downstream evaluation or visualization.

## Tropical Cyclone Tracking

`aurora.Tracker(init_lat, init_lon, init_time)`

Simplified cyclone tracker derived from the Aurora research code.

- `step(batch: Batch)` – Ingest the next prediction.
- `results() -> pandas.DataFrame` – Assemble the accumulated track.

## Models

### Aurora

`aurora.Aurora(...)`

Core transformer-based weather model (≈1.3B parameters).

Key constructor arguments (defaults shown where helpful):

- `surf_vars`, `static_vars`, `atmos_vars`: tuples of variable names (default surface: `('2t', '10u', '10v', 'msl')`).
- `window_size`: `(levels, height, width)` for Swin blocks.
- `encoder_depths` / `decoder_depths`: number of blocks per level.
- `encoder_num_heads` / `decoder_num_heads`: attention heads per level (usually mirror each other).
- `latent_levels`: number of latent pressure levels (default `4`).
- `patch_size`: spatial patch size (default `4`).
- `embed_dim`, `num_heads`, `mlp_ratio`: standard transformer dimensions.
- `max_history_size`: maximum number of historical steps to keep.
- `timestep`: `datetime.timedelta(hours=6)` by default.
- `stabilise_level_agg`: adds an extra layer-norm in aggregation.
- `use_lora`, `lora_steps`, `lora_mode`: LoRA configuration for roll-outs.
- `surf_stats`: optional `(location, scale)` overrides per surface variable.
- `autocast`: enable AMP to reduce memory usage.
- `level_condition`, `dynamic_vars`, `atmos_static_vars`, `separate_perceiver`, `modulation_head`: feature toggles for advanced conditioning.
- `positive_surf_vars`, `positive_atmos_vars`: clamp lists for enforcing non-negativity.
- `simulate_indexing_bug`: compatibility switch for historical checkpoints.

Notable helpers:

- `default_checkpoint_name` → `'aurora-0.25-finetuned.ckpt'`.
- `default_checkpoint_repo` → `'microsoft/aurora'`.
- `load_checkpoint(repo=None, name=None, strict=True)` – Pull checkpoints from Hugging Face.
- `load_checkpoint_local(path, strict=True)` – Load checkpoints from disk.
- `configure_activation_checkpointing()` – Enable gradient checkpointing for training.
- `batch_transform_hook(batch) -> Batch` – Override to manipulate input batches before normalization.
- `adapt_checkpoint_max_history_size(checkpoint) -> None` – Expand history dimension when the model expects more steps than the checkpoint provides.

### Pretrained variants

All subclasses inherit Aurora’s interface and expose `default_checkpoint_name` for convenience.

| Class | Purpose | Default checkpoint name |
| --- | --- | --- |
| `aurora.AuroraPretrained` | 0.25° baseline | `aurora-0.25-pretrained.ckpt` |
| `aurora.AuroraSmallPretrained` | Lightweight debug model | `aurora-0.25-small-pretrained.ckpt` |
| `aurora.Aurora12hPretrained` | 12-hour timestep variant | `aurora-0.25-12h-pretrained.ckpt` |
| `aurora.AuroraHighRes` | 0.1° high-resolution checkpoint | `aurora-0.1-finetuned.ckpt` |
| `aurora.AuroraAirPollution` | CAMS air-quality finetune | `aurora-0.4-air-pollution.ckpt` |
| `aurora.AuroraWave` | ECMWF wave-model finetune | `aurora-0.25-wave.ckpt` |

### AuroraWave specifics

Adds wave-physics friendly defaults:

- Additional surface variables (significant wave height, swell components, etc.).
- Static variables such as `wmb` and `lat_mask`.
- Density and angle variable groupings for specialized preprocessing.
- LoRA mode defaults to `'from_second'` and level aggregation is stabilised.

## Usage tips

- Always normalize or unnormalize batches with the helper methods before/after running the model.
- Enable activation checkpointing plus AMP (`autocast=True`) for gradient-based fine-tuning on limited-memory GPUs.
- Use the pretrained subclasses when you simply need to load official checkpoints without redefining the architecture.
- When rolling out long forecasts, iterate over `aurora.rollout` and collect intermediate outputs for custom evaluation pipelines.
