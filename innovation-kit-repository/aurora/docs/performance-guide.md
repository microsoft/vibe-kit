# Aurora Performance Guide

> **Run mode reminder:** All benchmarks in this kit assume the bundled Aurora checkpoint and ERA5 samples running locally unless otherwise noted. Azure AI Foundry numbers are provided as optional reference data points for teams that choose to offload inference; they do not change the default prototype behavior.

## Performance Metrics

**Inference speed**: ~1.5 s for 6-hour rollout on A100 vs ~2 h ECMWF IFS HRES. (source: Microsoft Research blog)

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

## Scaling

**Horizontal**: Shard rollouts across regions via Azure Batch or Kubernetes Jobs, then merge NetCDF outputs.  
**Vertical**: Upgrade to H100 80 GB for ≤0.1° grids or 10-day rollouts; enable tensor parallelism with `torch.distributed.fsdp`.  
**Caching**: Persist static features and checkpoints in Azure Blob or local NVMe; reuse `Batch.to(torch.float16)` outputs wherever possible.

