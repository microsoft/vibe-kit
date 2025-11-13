# Vibe Tune Aurora Starter Code

This package (`vibe_tune_aurora`) powers the Aurora Finetuning Innovation Kit. It provides a runnable PyTorch Lightning training stack, CLI wrappers, and sample data so assistants or developers can fine-tune Microsoft’s Aurora model with minimal setup.

## Quick start

1. **Initialize the project (from the repository root):**
   ```bash
   uv run .vibe-kit/innovation-kits/aurora-finetune/initialization/initialize_starter_code.py
   ```
   This copies the starter code into place, syncs dependencies, and can run automated tests. Pass `--skip-tests` to speed up the copy step if desired.

2. **Sync dependencies (if you skipped the initialization script’s sync step):**
   ```bash
   uv sync
   ```

3. **Run the bundled tests (optional but recommended):**
   ```bash
   uv run pytest -s
   ```
   Expect ~8 minutes on a laptop CPU; the suite exercises data loading and training loops with sample ERA5 slices under `tests/inputs/`.

   _Need a faster signal?_ Target the tiniest training case:
   ```bash
   uv run pytest tests/test_training.py::test_finetuning_2t_var_pretrained --maxfail=1
   ```
   This validates the optimizer step and checkpoint wiring in roughly one minute on CPU.

4. **Launch a training run:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.train --help
   ```
   Configure datasets, variables, and hyperparameters via CLI arguments or config files (see `vibe_tune_aurora/config.py`).

   For a quick CPU-only trial using the bundled ERA5 slice, run:
   ```bash
   uv run python -m vibe_tune_aurora.cli.train \
     --pickle_file tests/inputs/era5_training_data_jan2025_1_to_7.pkl \
     --loss_type 4_vars \
     --max_epochs 1
   ```
   This should complete in ~5 minutes on a laptop and confirms the fine-tuning loop end to end.

5. **Evaluate a checkpoint:**
   ```bash
   uv run python -m vibe_tune_aurora.cli.evaluate --checkpoint path/to.ckpt
   ```

6. **Generate a quick-look visualization (optional):**
   ```bash
   uv run python -m vibe_tune_aurora.cli.visualize \
     --checkpoint runs/EXPERIMENT/finetuning/version_0/checkpoints/last.ckpt \
     --pickle_file tests/inputs/era5_training_data_jan2025_8_to_14.pkl \
     --var 2t --sample_index 0 --difference \
     --output runs/EXPERIMENT/visuals/2t_sample0.png
   ```
   This renders prediction, target, and optional absolute-error panels for a chosen surface variable.

Refer to `docs/aurora-finetuning-guide.md` for an end-to-end workflow and `docs/uv-getting-started-features.md` for a refresher on `uv` commands.

## Project layout

```
starter-code/
├── pyproject.toml                # uv project manifest & dependencies
├── uv.lock                       # Locked dependency versions
├── src/vibe_tune_aurora/
│   ├── aurora_module.py          # LightningModule wrapper for Aurora
│   ├── training.py               # Training loop & optimizer utilities
│   ├── evaluation.py             # Evaluation routines
│   ├── model_init.py             # Checkpoint loading helpers
│   ├── losses.py                 # Loss definitions
│   ├── callbacks.py              # Training callbacks (checkpointing, logging)
│   ├── config.py                 # Configuration primitives / CLI defaults
│   ├── data_utils.py             # Data loaders, normalization helpers
│   └── cli/
│       ├── train.py              # CLI entry point for fine-tuning
│       ├── evaluate.py           # CLI entry point for evaluation
│       └── visualize.py          # CLI for prediction/target quick-look plots
└── tests/
    ├── inputs/                   # Sample ERA5 data and checkpoints
    └── ...                       # Unit/integration tests
```

## Usage patterns

- **New variable fine-tuning:** Edit `config.py` or pass CLI flags to add surface, static, or atmospheric variables. Pair with normalization updates in `data/default_stats.py`.
- **Custom datasets:** Replace or augment files under `tests/inputs/` and update the data loader paths in `data_utils.py`.
- **Advanced training tweaks:** Modify callbacks, optimizers, or schedulers in `callbacks.py` and `training.py`. Use `docs/finetuning.md` for guidance on AMP, gradient checkpointing, and `stabilise_level_agg`.
- **Visualization & reporting:** Extend `evaluation.py` or create new scripts under `cli/` to generate plots or JSON scorecards.

## Related documentation

- `docs/aurora-finetuning-guide.md` — High-level workflow, variant catalog, troubleshooting.
- `docs/finetuning.md` — Gradient computation, model extension, normalization details.
- `docs/form-of-a-batch.md` — Expected tensor structure for Aurora batches.
- `docs/beware.md` — Known pitfalls and mitigation strategies.
- `docs/uv-getting-started-features.md` — `uv` package manager cheat sheet.

## Example assistant flows

The kit is designed so an AI assistant (or human developer) can complete tasks like:

1. **Fine-tune on a new variable (e.g., UVB radiation)** for Jan–Mar 2025 data limited to the northwest quadrant, evaluate on April 2025, and output metrics as JSON.
2. **Generate a 10-step rollout visualization** for surface wind velocity starting 1 May using the fine-tuned checkpoint, returning an HTML plot.

Feel free to script additional scenarios under `cli/` or as notebooks (see `.vibe-kit/innovation-kits/aurora-finetune/docs/` for guidance).
