# Aurora Fine-Tuning Guide

> Source: Aurora Technical team at Microsoft Research.

This document explains how to adapt the Aurora weather foundation model for new variables, datasets, or lead times. It complements the starter code supplied with the kit and preserves the original technical guidance from the Aurora authors while improving navigation and formatting.

> **Path note:** When the kit is installed via `vibekit`, assets live under `.vibe-kit/innovation-kits/aurora-finetune/`. Inside this repository, the same files are under `innovation-kit-repository/aurora-finetune/`. Swap the prefix as needed for your environment.

## Quick links

- Initialization script: `../initialization/initialize_starter_code.py`
- Starter-code README: `../starter-code/README.md`
- Fine-tuning engineering notes: `./finetuning.md`
- Data format reference: `./form-of-a-batch.md`
- Common pitfalls: `./beware.md`

## Table of contents

- [Aurora Fine-Tuning Guide](#aurora-fine-tuning-guide)
	- [Quick links](#quick-links)
	- [Table of contents](#table-of-contents)
	- [What is fine-tuning?](#what-is-fine-tuning)
	- [Fine-tuning workflow](#fine-tuning-workflow)
	- [When to fine-tune Aurora](#when-to-fine-tune-aurora)
	- [Supported Aurora variants](#supported-aurora-variants)
	- [Preparing data and normalization](#preparing-data-and-normalization)
	- [Troubleshooting common issues](#troubleshooting-common-issues)
		- [Exploding gradients](#exploding-gradients)
		- [Missing data](#missing-data)
		- [Out-of-memory errors](#out-of-memory-errors)
		- [Illegal memory access when `bf16_mode=True`](#illegal-memory-access-when-bf16_modetrue)
		- [Variable scaling issues](#variable-scaling-issues)
		- [Slow ERA5 downloads](#slow-era5-downloads)
		- [Additional notes](#additional-notes)
	- [Related resources](#related-resources)

## What is fine-tuning?

Fine-tuning refers to continuing training on a pretrained model using a smaller, targeted dataset that was not part of the original pretraining corpus. In Aurora’s case, fine-tuning enables:

- Adding weather or climate variables that are currently unsupported.
- Adapting the model to more recent observations (for example 2020s data).
- Specializing the model for distinct applications such as air-quality forecasting or ocean-wave prediction.

## Fine-tuning workflow

Use this high-level loop with the starter code in `starter-code/src/vibe_tune_aurora/`:

1. **Collect data** in Aurora’s `surface`, `static`, and `atmospheric` variable groups (see [Supported Aurora variants](#supported-aurora-variants)).
2. **Add new variables** as needed and set their normalization statistics (means and standard deviations) before training.
3. **Define the loss function.** Aurora authors recommend a Mean Absolute Error (MAE) objective, but the starter code in `training.py` is easy to extend.
4. **Load the pretrained checkpoint** using `AuroraPretrained` from the `microsoft-aurora` package. Configure the optimizer and learning-rate schedule in `training.py` or the CLI wrapper `cli/train.py`.
5. **Run the fine-tuning loop** for several epochs:
	- Sample a data batch.
	- Produce predictions.
	- Normalize predictions and targets.
	- Compute the loss and run the optimizer step.
	- Track gradient statistics and validation metrics.
6. **Evaluate and export** the fine-tuned model with `cli/evaluate.py` or `evaluation.py`.

```python
from aurora import AuroraPretrained

model = AuroraPretrained()
model.load_checkpoint()

# Continue training with starter-code utilities.
```

For details on gradient checkpointing, AMP, and extending variables, see `docs/finetuning.md`.

## When to fine-tune Aurora

Fine-tune when you need predictions for:

- Variables that Aurora does not currently output (for example UV radiation or air-pollution constituents).
- Regions or resolutions not covered by the provided checkpoints.
- More recent time ranges than the pretraining window.
- Specialized operational scenarios (for example, long-lead ocean forecasts).

## Supported Aurora variants

The table below summarizes the official checkpoints you can build upon. “Same as above” means the configuration matches the previous row.

| Model | Key note | Surface variables | Static variables | Atmospheric variables | Pressure levels (hPa) |
| --- | --- | --- | --- | --- | --- |
| **Aurora 0.25° Pretrained** | Baseline model | Two-meter temperature (K); Ten-meter eastward wind speed (m/s); Ten-meter southward wind speed (m/s); Mean sea-level pressure (Pa) | Land-sea mask; Soil type; Surface-level geopotential (m²/s²) | Temperature (K); Eastward wind speed (m/s); Southward wind speed (m/s); Specific humidity (kg/kg); Geopotential (m²/s²) | 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000 |
| **Aurora 0.25° Fine-Tuned** | Fine-tuned on IFS HRES T0 | Same as above | Same as above | Same as above | Same as above |
| **Aurora 0.25° 12-Hour Pretrained** | 12-hour lead-time checkpoint | Same as above | Same as above | Same as above | Same as above |
| **Aurora 0.1° Fine-Tuned** | Fine-tuned on IFS HRES analysis (0.1°) | Same as above | Same as above (use [aurora-0.1-static.pickle](https://github.com/microsoft/aurora/blob/main/aurora-0.1-static.pickle) for consistent regridding) | Same as above | Same as above |
| **Aurora 0.4° Air Pollution** | Fine-tuned on CAMS analysis | Aurora 0.25° surface variables plus: PM₁, PM₂.₅, PM₁₀ (kg/m³); Total column CO, NO, NO₂, SO₂, O₃ (kg/m²) | Use [aurora-0.4-air-pollution-static.pickle](https://huggingface.co/microsoft/aurora/resolve/main/aurora-0.4-air-pollution-static.pickle) | Aurora 0.25° atmospheric vars plus: CO, NO, NO₂, SO₂, O₃ (kg/kg) | Same as above |
| **Aurora 0.25° Wave** | Fine-tuned on ECMWF Ocean Wave Model high-resolution 15-day forecast | Aurora 0.25° variables plus: Significant wave height (total, wind, swell components); Mean/peak wave direction and period (total, wind, swell); Ten-meter neutral wind speed and components | Use [aurora-0.25-wave-static.pickle](https://huggingface.co/microsoft/aurora/resolve/main/aurora-0.25-wave-static.pickle) | Same as Aurora 0.25° baseline | Same as above |

> **Note on pretraining data:** The Aurora team pre-trained using historical ERA5 and related datasets prior to the 2020s. Fine-tuning is the recommended way to adapt the model to newer observations.

## Preparing data and normalization

1. Organize datasets according to the batch structure described in `docs/form-of-a-batch.md`.
2. For any **new variable**, update normalization statistics prior to training:

	```python
	from aurora.normalisation import locations, scales

	locations["new_var"] = mean
	scales["new_var"] = std
	```

3. When extending the model, adjust `surf_vars`, `static_vars`, and `atmos_vars` in the `AuroraPretrained` constructor. Loading checkpoints with `strict=False` lets you ignore mismatched parameters introduced by new modules.
4. If you require separate learning rates for new patch embeddings (recommended), configure the optimizer parameter groups in `starter-code/src/vibe_tune_aurora/training.py`.

## Troubleshooting common issues

### Exploding gradients

- Monitor gradient norms during training.
- Enable level-aggregation stabilization when necessary:

  ```python
  from aurora import AuroraPretrained

  model = AuroraPretrained(stabilise_level_agg=True)
  model.load_checkpoint(strict=False)
  ```

- Consider gradient clipping or additional layer normalization if large activations persist.

### Missing data

- Omit variables that are entirely unavailable from the batch definition.
- Interpolate or infill sparse NaNs; structured gaps may require more advanced handling (see Aurora forum discussions attributed to Wessel).

### Out-of-memory errors

- The authors report success enabling `bf16_mode=True` in Aurora’s constructor to reduce memory usage.
- Combine with PyTorch Automatic Mixed Precision (AMP) and activation checkpointing (`docs/finetuning.md`).

### Illegal memory access when `bf16_mode=True`

This issue has been observed on Azure Machine Learning (AML) notebook environments where the system-level CUDA (12.2) mismatched the CUDA version bundled with PyTorch (12.6). The mitigation is to align CUDA toolkits and create a dedicated `uv` environment:

1. Disable automatic activation of the base conda environment:

	```bash
	conda config --set auto_activate_base false
	```

2. Define CUDA paths in `~/.bashrc`:

	```bash
	export CUDA_HOME=/usr/local/cuda-12.2
	export PATH=$CUDA_HOME/bin:$PATH
	export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
	```

3. Update packages and verify `nvcc`:

	```bash
	sudo apt-get update
	nvcc --version
	```

	Install `nvcc` if it is missing, then reboot with `sudo reboot` to avoid driver mismatches.

4. Install `uv` and create a dedicated project environment:

	```bash
	curl -LsSf https://astral.sh/uv/install.sh | sh
	uv init ~/YOUR_PROJECT
	cd ~/YOUR_PROJECT
	uv venv -p 3.10
	source .venv/bin/activate
	```

	Add the activation command to `~/.bashrc` if you want it to run automatically: `echo 'source ~/YOUR_PROJECT/.venv/bin/activate' >> ~/.bashrc`.

5. Configure the environment for notebooks:

	```bash
	uv add ipykernel
	python -m ipykernel install --user --name .venv --display-name "Aurora Fine-Tune"
	```

	Reboot (`sudo reboot`) to register the kernel with AML.

6. Install dependencies inside the environment:

	```bash
	uv add torch==2.2.0 numpy==1.26.4 xarray==2024.10.0 microsoft-aurora==1.7.0 cdsapi
	```

7. Tips:
	- If `uv` cannot locate the environment, ensure you are inside the project root or use `uv add --active`.
	- Restart the notebook kernel after installing new packages.
	- Give each virtual environment a unique name (not always `.venv`) if you create multiple kernels.
	- If `uv` is unavailable in future sessions, add `alias uv="$HOME/.local/bin/uv"` to `~/.bashrc`.
	- Updating system-wide CUDA is possible but risky; prefer aligning the bundled toolkits as above.

### Variable scaling issues

If variables have different magnitudes, normalize them before computing the loss. The starter code exposes helper utilities in `data/default_stats.py`.

### Slow ERA5 downloads

- Download once to cloud storage (Azure Blob, S3, etc.) and stream from there for training.
- Consider the asynchronous ERA5 retrieval workflows described in `docs/example_era5.py`.

### Additional notes

- Certain training instabilities (for example a dot-product fix referenced by the Aurora team) are tracked internally; incorporate any patches shared by Aurora team (`[DM1]` reference) when they are published.
- CPU-only executions of `cli.evaluate` or other Aurora entry points spend several minutes loading PyTorch + timm the first time. Plan for the warm-up instead of interrupting—subsequent batches run steadily once imports complete.
- The starter code ships a `cli/visualize.py` helper that renders prediction/target/error heatmaps. Use it to spot-check checkpoint quality quickly:

	```bash
	uv run python -m vibe_tune_aurora.cli.visualize \
		--checkpoint runs/EXPERIMENT/finetuning/version_0/checkpoints/last.ckpt \
		--pickle_file tests/inputs/era5_training_data_jan2025_8_to_14.pkl \
		--var 2t --sample_index 0 --difference \
		--output runs/EXPERIMENT/visuals/2t_sample0.png
	```

## Related resources

- `docs/finetuning.md`: gradient computation, AMP, adding new variables.
- `docs/beware.md`: curated list of common pitfalls with links to official Aurora issues.
- `docs/form-of-a-batch.md`: exact tensor layouts for `aurora.Batch`.
- `starter-code/src/vibe_tune_aurora/cli/train.py`: CLI for launching fine-tuning jobs.
- `starter-code/src/vibe_tune_aurora/cli/evaluate.py`: CLI for evaluation and report generation.
 
