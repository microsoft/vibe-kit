# Emergency Fixes

Common blockers and rapid fixes when running MatterGen locally or through Azure AI Foundry.

## Git LFS / checkpoint issues

| Symptom | Fix |
| --- | --- |
| `pointer instead of file` when pulling checkpoints | Run `git lfs install` then `git lfs pull -I checkpoints/<model> --exclude=""`. Ensure corporate proxies allow LFS traffic. |
| CLI keeps re-downloading checkpoints | Set `HF_HOME` or `TORCH_HOME` to a persistent path with write permissions. |

## CUDA & environment problems

| Symptom | Fix |
| --- | --- |
| `RuntimeError: CUDA error: no kernel image` | Verify NVIDIA driver + CUDA toolkit compatibility (`nvidia-smi`). Reinstall PyTorch with matching CUDA wheels (`pip install torch --index-url https://download.pytorch.org/whl/cu121`). |
| `Torch not compiled with CUDA enabled` | Ensure you installed the CUDA build of PyTorch (via `pip install torch` from CUDA wheel index). |
| `RuntimeError: CUDA error: device-side assert triggered` on machines without GPUs | MatterGen sampling requires a CUDA-capable GPU. Run on a GPU workstation or fall back to the [hosted Azure AI Foundry path](./quick-start.md#5-hosted-inference-azure-ai-foundry). |
| Apple Silicon crash | Set `export PYTORCH_ENABLE_MPS_FALLBACK=1`; note that performance is experimental and slower than CUDA. |

## MatterSim evaluation failures

| Symptom | Fix |
| --- | --- |
| `ModuleNotFoundError: mattersim` | `pip install mattersim` in the active environment. |
| `FileNotFoundError: MatterSim-v1.0.0-1M.pth` | Download from [MatterSim releases](https://github.com/microsoft/mattersim/releases) and point `MATTERSIM_POTENTIAL_PATH` or `--potential_load_path` to the file. |
| `Reference dataset missing` | Pull `data-release/alex-mp/reference_MP2020correction.gz` via Git LFS and ensure it’s on disk before running `mattergen-evaluate`. |

## Azure AI Foundry endpoint

| Symptom | Fix |
| --- | --- |
| `403 Forbidden` | Confirm the deployment workspace has access to `azureml-msr` registry; request inclusion via Azure AI Foundry admin. |
| `429 Too Many Requests` | Endpoint hitting quota; submit fewer concurrent jobs or request higher limits. Cache large artifacts externally to reduce repeated downloads. |
| Long latencies | Reuse the same warm endpoint deployment rather than re-provisioning per request. |

## Adapter & training errors

| Symptom | Fix |
| --- | --- |
| `KeyError: <property>` during fine-tuning | Add the property to dataset CSVs and `PROPERTY_SOURCE_IDS`, then regenerate caches. |
| `CUDA OOM` while training | Reduce `trainer.accumulate_grad_batches` or switch to `bf16` precision; distribute across multiple GPUs if available. |
| `Hydra` configuration conflicts | Use `hydra.verbose=1` to inspect overrides; ensure multi-property adapters use unique config names. |
| `MissingConfigException: Primary config directory not found` during sampling | Pass `--sampling_config_name default` (or `csp`) so Hydra can locate the bundled sampling configs. The configs ship with the MatterGen repo under `mattergen/conf/sampling`; this skill mirrors them in `assets/sampling_conf/` for reference. |

## DFT follow-up blockers

- MatterSim is faster but not a drop-in replacement for DFT. Coordinate with computational chemistry teams to schedule VASP/Quantum ESPRESSO runs for top-ranked candidates.
- Capture per-candidate metadata (prompt, metrics, structure hash) so the lab pipeline can trace back to the generation context.

## When in doubt

- Check [MatterGen GitHub Discussions](https://github.com/microsoft/mattergen/discussions) for similar issues, and see the upstream [`MODEL_CARD.md`](https://github.com/microsoft/mattergen/blob/main/MODEL_CARD.md) for maintainer contacts.