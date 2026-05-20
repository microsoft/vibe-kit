# MatterGen Skill Assets

| Asset | Notes |
| --- | --- |
| `sampling_conf/default.yaml`, `sampling_conf/csp.yaml` | Reference Hydra sampling configs, mirrored from the upstream MatterGen repo for offline inspection. |
| `prototype/` | Runnable FastAPI + React web app wiring MatterGen and MatterSim into an interactive UI. **See [`docs/prototype.md`](../docs/prototype.md) to run it.** |
| `paper/mattergen-nature-paper.pdf` | Source: Microsoft Research, *A generative model for inorganic materials design*, Nature 2025. |
| `paper/mattergen-a-new-paradigm-of-materials-design.pdf` | Companion overview of the property-conditioned diffusion approach. |

## External assets (not bundled)

These live upstream and are pulled on demand:

- **Pretrained checkpoints** — Hugging Face [`microsoft/mattergen`](https://huggingface.co/microsoft/mattergen). Recommended: `mattergen_base`, `ml_bulk_modulus`, `dft_mag_density`, `dft_mag_density_hhi_score`. `mattergen-generate` downloads them automatically; cache via `HF_HOME`/`TORCH_HOME`.
- **Training datasets** — Git LFS under `data-release/` in the [MatterGen repo](https://github.com/microsoft/mattergen): `mp-20` (~1.2 GB) and `alex-mp-20` (~6 GB).
- **Reference dataset for evaluation** — `data-release/alex-mp/reference_MP2020correction.gz` (required by `mattergen-evaluate`).
- **MatterSim potentials** — [MatterSim releases](https://github.com/microsoft/mattersim/releases): `MatterSim-v1.0.0-1M.pth` (default) or `-5M.pth` (higher fidelity).
- **Hosted inference** — Azure AI Foundry catalog (`azureml-msr` registry, `MatterGen/version/1`).
