# Aurora Performance Guide

> **Run mode reminder:** All benchmarks in this kit assume the bundled Aurora checkpoint and ERA5 samples running locally unless otherwise noted. Azure AI Foundry numbers are provided as optional reference data points for teams that choose to offload inference; they do not change the default prototype behavior.

**Baseline scenario:** 64×112 mainland Norway grid (7,168 cells), June 1–7 observations → June 8, 24-hour forecast output. Runtime figures below reference this workflow unless stated otherwise.

## Performance Metrics

**Inference speed**: ~1.5 s for 6-hour rollout on A100 vs ~2 h ECMWF IFS HRES. (source: Microsoft Research blog)
**Norway baseline runtime**: 24-hour (4-step) rollout on the 64×112 mainland grid. Timing varies significantly by hardware—GPU recommended but CPU supported.
**Memory footprint**: Expect ≈3–4 GB of GPU VRAM (A100) or ~14 GB system RAM during the 64×112 rollout; monitor with `nvidia-smi` / `htop` while experimenting.
**Checkpoint download**: First run pulls the ~5 GB `aurora-0.25-small-pretrained.ckpt` checkpoint from Hugging Face; budget 3–5 minutes on a 1 Gbps link.
**Frontend bundles**: Regenerated TypeScript payloads weigh in at ~54 MB (`frontend/src/data/auroraForecast.ts`) and ~7.6 MB (`frontend/src/data/auroraForecastPredictions.ts`); they remain gitignored and should be rebuilt locally via `scripts/build_forecast_module.py`.

**Medium-range RMSE**: 0.52 K at 2-day horizon on 0.25° temperature vs 0.60 K GraphCast baseline. (source: Microsoft Research blog)

**Chemistry accuracy**: 74% of CAMS variables improved in 5-day forecast skill. (source: Microsoft Research blog)

**Wind-farm prototype throughput**: 28×4-step batch generated in <1 min on A100. Teams that opt into Azure AI Foundry see **~30–60 s** per request on the managed endpoint.

## Hardware Requirements

| Use Case   | CPU            | RAM   | GPU            | Cost/Hour |
| ---------- | -------------- | ----- | -------------- | --------- |
| Dev        | 8 vCPU (Standard_D4s_v5) | 32 GB | RTX 4090 / L40S (24 GB) | ~$1.20 |
| Production | 16 vCPU (Standard_ND40rs_v2) | 128 GB | A100 80 GB / H100 | ~$5.80 |

## Optimization

```python
# Memory optimization: half precision rollout
with torch.autocast(device_type="cuda", dtype=torch.float16):
    preds = [pred.to("cpu") for pred in rollout(model, batch, steps=4)]
```

```python
# Speed optimization: compile single-step forward pass
model = torch.compile(model, mode="reduce-overhead")
result = model.forward(batch)
```

```python
# Batch processing: stream multiple times into Foundry
results = submit(batch_list, model_name="aurora-small-pretrained", num_steps=2,
                 foundry_client=client, channel=channel, concurrency=4)
```

- **Frontend payload trimming**: Pass `--stride 2` (or higher) to `scripts/build_forecast_module.py` while prototyping to shrink TypeScript outputs before regenerating full-resolution bundles for sharing.

## Scaling

**Horizontal**: Shard rollouts across regions via Azure Batch or Kubernetes Jobs, then merge NetCDF outputs.  
**Vertical**: Upgrade to H100 80 GB for ≤0.1° grids or 10-day rollouts; enable tensor parallelism with `torch.distributed.fsdp`.  
**Caching**: Persist static features and checkpoints in Azure Blob or local NVMe; reuse `Batch.to(torch.float16)` outputs wherever possible.

