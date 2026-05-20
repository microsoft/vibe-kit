# Performance & Scaling Guide

Optimize throughput, stability, and cost for MatterGen generation, evaluation, and fine-tuning.

## Hardware tiers

| Scenario | Minimum | Recommended |
| --- | --- | --- |
| Sampling (CLI) | NVIDIA T4 16 GB | NVIDIA A100 40 GB |
| Adapter fine-tuning | Dual A40 48 GB or single A100 80 GB | 8× A100 80 GB with DDP |
| Evaluation (MatterSim) | CPU with AVX2, 32 GB RAM | GPU + MatterSim-v1.0.0-5M for higher fidelity |

## Model size & baseline speed

- **Parameter count:** 46.8 M parameters (≈190 MB in fp32). Keep at least 500 MB of GPU memory free for activations when sampling.
- **Sampling throughput:** Generating **1,000 structures ≈ 2 hours** on a single NVIDIA V100 (≈7.2 s/sample). Expect ~20–25 % slower on a T4, and proportionally faster on A100 class hardware.
- **Training cadence:** On 8×A100, a full epoch over ~600 K samples finishes in ~6 minutes. Adapter fine-tuning typically converges within 50–100 epochs, so budget 5–10 hours for a new property.

> **Practical planning tips**
>
> - For demo settings, downshift diffusion steps (`--sampling_config_overrides sampler_partial.N=100`) to produce coarse samples in <2 minutes.
> - Hosted Azure AI Foundry endpoints surface identical checkpoints with comparable latency (~7–10 s/sample) once warm and remove local GPU requirements.
> - Batch size scales with GPU memory; set `--batch_size` to the largest value without OOM.
> - For offline environments, stage checkpoints/datasets on NVMe for faster IO.

## Generation throughput

- `batch_size` × `num_batches` governs sample count; prefer larger batches to reduce startup overhead.
- Tune `--diffusion_guidance_factor` per the quick-start guidance (sweep 1.5–2.5).
- Use multiple GPUs by sharding prompts and combining outputs. MatterGen CLI currently runs single-device; orchestrate multi-GPU via GNU Parallel or custom scripts.

## Adapter fine-tuning

- Use gradient accumulation (`trainer.accumulate_grad_batches`) to simulate larger effective batch sizes on smaller GPUs.
- Enable mixed precision (`trainer.precision=bf16-mixed`) for speedups on Ampere+ hardware.
- Monitor validation loss; early stop if plateauing beyond 0.4 for MP-20 dataset.
- Log metrics with Weights & Biases by removing `~trainer.logger` override and configuring API keys.

## Evaluation scaling

- MatterSim relaxation is parallelizable across CPU cores or GPU streams. For large batches, split structures into chunks (e.g., 200 per job).
- When you already have DFT energies, run `mattergen-evaluate --relax False --energies_path <np file>` to skip relaxation.
- Store metrics in a structured database (e.g., Cosmos DB, PostgreSQL) to enable trend analysis.

## Hosted cost optimization

- Bundle multiple prompt requests per Azure AI Foundry call and reuse returned artifact URIs instead of re-generating.
- Cache frequent property prompts locally and reuse results when exploring minor variations.
- Monitor quota usage through Azure Monitor; set alerts for 70% of daily budget.

## Data management

- Deduplicate generated structures using the provided disorder-aware matcher to avoid redundant evaluation.
- Retain metadata (prompt, seed, checkpoint version) alongside CIF files to ensure reproducibility.
- Archive intermediate trajectories only when needed—they add storage overhead quickly.

## Troubleshooting performance

- If throughput regresses, verify GPU clocks (Power Save mode) and ensure no competing jobs are consuming resources.
- For containerized runs, mount persistent volumes for checkpoints to avoid repeated downloads.
- Profile with PyTorch profiler to identify dataloader vs. model bottlenecks when customizing training loops.