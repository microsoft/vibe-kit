# Dayhoff Atlas Performance Guide

## Performance Metrics

**Sampling throughput**: ~6 sequences/sec (60 AA, temperature 0.8) on NVIDIA L4 with fallback kernels (source: prototype runtime logs).  
**Mutation scoring**: ~120 residues/sec for log-likelihood scoring on A10 GPU (source: test_fitness.py measurements).  
**Web UI latency**: Initial load 30 s (model warm-up) then sub-second prompts (source: Flask UX validation).

## Hardware Requirements

| Use Case   | CPU                 | RAM    | GPU           | Cost/Hour |
| ---------- | ------------------ | ------ | ------------- | --------- |
| Dev        | 4 vCPU             | 16 GB  | Optional CPU  | $0.35     |
| GPU Rapid  | 8 vCPU             | 32 GB  | NVIDIA L4 24 GB | $1.25     |
| Production | 16 vCPU            | 64 GB  | NVIDIA A100 40 GB | $3.90     |

## Optimization

```python
"""Batch prompts for GPU-efficient sampling."""
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

tokenizer = AutoTokenizer.from_pretrained("microsoft/Dayhoff-170m-GR", trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Dayhoff-170m-GR",
    trust_remote_code=True,
    device_map="auto",
    torch_dtype=torch.float16,
    use_mamba_kernels=False,
)

prompts = ["M", "MK", "GAVL"]
inputs = tokenizer(prompts, return_tensors="pt", padding=True).to(model.device)
outputs = model.generate(**inputs, max_length=100, num_return_sequences=4)
```

```python
"""Cache tokenizer + model in global state when using Flask."""
from functools import lru_cache
from dayhoff_simple import DayhoffGenerator

@lru_cache(maxsize=1)
def get_generator():
    return DayhoffGenerator()

generator = get_generator()
```

```python
"""Chunk long sequences to reduce memory footprint during scoring."""
import math

def chunked_score(generator, sequence, chunk_size=256):
    chunks = [sequence[i : i + chunk_size] for i in range(0, len(sequence), chunk_size)]
    log_probs = [generator.calculate_fitness_score(chunk) for chunk in chunks]
    return sum(log_probs) / max(len(log_probs), 1)

```

## Scaling

**Horizontal**: Use Kubernetes Jobs or Azure Batch to distribute prompt lists; store outputs in shared Blob Storage.  
**Vertical**: Move from L4 to A100/H100 for >5× throughput and access to FlashAttention2 (source: GitHub README).  
**Caching**: Persist tokenizer + model weights in shared volume; enable Hugging Face hub cache across containers using `HF_HOME`.

## Troubleshooting Performance Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slow first generation | Model loading | Pre-warm with a dummy prompt at startup |
| Out of memory | Batch too large | Reduce `num_return_sequences` or use `torch.float16` |
| Inconsistent throughput | Thermal throttling | Monitor GPU temps, ensure adequate cooling |

See [troubleshooting.md](troubleshooting.md) for setup and kernel issues.