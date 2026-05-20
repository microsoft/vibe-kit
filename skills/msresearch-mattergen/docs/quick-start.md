# MatterGen Quick Start

Goal: generate 16 property-steered inorganic crystal candidates in under an hour via local CLI or Azure AI Foundry.

> **Just want to explore the UI?** See [prototype.md](./prototype.md) for the bundled web app — its demo mode runs without any Azure setup. This guide covers the local CLI / hosted REST path.

> **Python 3.10 only.** MatterGen targets Python 3.10 with CUDA-enabled PyTorch wheels. 3.11+ triggers install failures (e.g., `torch_cluster` wheels not found). Create your virtual environment with Python 3.10 before installing.

## 1. Prerequisites

- **Python 3.10** with `pip` and `uv` (install Python 3.10 via `pyenv` or `apt` if your system default differs).
- **CUDA-capable GPU** (16 GB VRAM recommended). No GPU? Skip to [Hosted inference](#5-hosted-inference-azure-ai-foundry).
- **Git LFS** installed *before* cloning the MatterGen repo: `git lfs install`.
- **MatterGen repo** cloned locally with editable install.
- **Optional:** Azure subscription with access to the `azureml-msr` registry for hosted inference.

```bash
# Install Git LFS if missing (Ubuntu):
sudo apt-get update && sudo apt-get install git-lfs -y
git lfs install

# Create a Python 3.10 environment in the cloned mattergen repo:
pip install uv
uv venv .venv --python 3.10
source .venv/bin/activate
uv pip install -e ".[dev]"
```

## 2. Download assets

- Allow `mattergen-generate` to pull checkpoints from Hugging Face automatically, or prefetch via `git lfs pull -I checkpoints/mattergen_base --exclude=""`.
- Install MatterSim: `pip install mattersim`, then download `MatterSim-v1.0.0-1M.pth` from the [MatterSim releases](https://github.com/microsoft/mattersim/releases). The reference dataset for `mattergen-evaluate` is fetched in step 6.

## 3. Hello world (local CLI)

MatterGen ships Hydra sampling configs; this skill mirrors them in `assets/sampling_conf/` for reference. Run a default sampling job:

```bash
cd /path/to/mattergen
source .venv/bin/activate

export RESULTS_PATH=$(mktemp -d /tmp/mattergen-results-XXXX)

mattergen-generate "$RESULTS_PATH" \
  --pretrained-name mattergen_base \
  --batch_size 16 \
  --sampling_config_name default
```

Expected outputs in `$RESULTS_PATH`:

- `generated_crystals_cif.zip` — CIF archive of generated structures.
- `generated_crystals.extxyz` — Trajectory frames per structure.
- `generated_trajectories.zip` — Denoising trajectories (add `--record-trajectories False` to skip).

Default run is 16 samples × 1000 diffusion steps (~10 min on a T4). For a quicker smoke test, drop steps to 100 (~60–90 s):

```bash
mattergen-generate "$RESULTS_PATH" \
  --pretrained-name mattergen_base \
  --batch_size 16 \
  --sampling_config_overrides sampler_partial.N=100
```

## 4. Property-conditioned sampling

Swap to a property-specific checkpoint and pass property prompts:

```bash
# Single property
mattergen-generate "$RESULTS_PATH" \
  --pretrained-name dft_mag_density \
  --batch_size 16 \
  --properties_to_condition_on="{'dft_mag_density': 0.15}" \
  --diffusion_guidance_factor 2.0

# Multiple properties
mattergen-generate "$RESULTS_PATH" \
  --pretrained-name chemical_system_energy_above_hull \
  --properties_to_condition_on="{'energy_above_hull': 0.05, 'chemical_system': 'Li-O'}"
```

Higher `--diffusion_guidance_factor` improves property adherence at the cost of diversity (sweep 1.5–2.5).

## 5. Hosted inference (Azure AI Foundry)

1. Azure AI Foundry → Model catalog → search **MatterGen** → select version `1` in `azureml-msr` registry.
2. Create a managed endpoint and capture the REST URL + key (or AAD token).
3. Submit generation requests with the same property payloads:

```python
import os
import requests

endpoint = os.environ["MATTERGEN_ENDPOINT"]
key = os.environ["MATTERGEN_KEY"]

payload = {
    "num_samples": 16,
    "properties_to_condition_on": {"bulk_modulus": ">=400"},
    "batch_size": 16,
}

response = requests.post(
    endpoint,
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    json=payload,
    timeout=600,
)
response.raise_for_status()
print(response.json()["artifact_uri"])
```

4. Download the returned artifact (ZIP of CIF/EXTXYZ files) and proceed with MatterSim evaluation locally.

## 6. Evaluate with MatterSim

```bash
git lfs pull -I data-release/alex-mp/reference_MP2020correction.gz --exclude=""
mattergen-evaluate --structures_path "$RESULTS_PATH" \
  --relax True \
  --structure_matcher disordered \
  --save_as "$RESULTS_PATH/metrics.json"
```

Review stability (≤0.1 eV/atom), novelty, and uniqueness in the resulting JSON.

## 7. Next steps

- Pick a workflow in [application-patterns.md](./application-patterns.md).
- Onboard custom properties via [data-integration.md](./data-integration.md).
- Tune throughput with [performance-guide.md](./performance-guide.md).
- Hit an error? [emergency-fixes.md](./emergency-fixes.md).
