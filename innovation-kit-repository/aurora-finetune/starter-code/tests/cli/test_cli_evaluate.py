"""Tests for the evaluate CLI script."""

import subprocess
from pathlib import Path

from lightning import Trainer
from vibe_tune_aurora.aurora_module import LitAurora, create_default_aurora_lightning_module

# Get project and tests directories
TESTS_DIR = Path(__file__).parent.parent
PROJECT_ROOT = TESTS_DIR.parent


def test_cli_evaluate_pretrained_model_2t_var():
    """Test evaluate CLI with 2t variable on pretrained model."""
    # Construct paths
    evaluate_script = PROJECT_ROOT / "src/vibe_tune_aurora/cli/evaluate.py"
    single_level = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_level = TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"
    output_json = TESTS_DIR / "outputs/evaluation_results_cli_test.json"
    desired_checkpoint_path = TESTS_DIR / "outputs/aurora_small_pretrained.ckpt"

    # Save a temp copy of the checkpoint
    create_and_save_pretrained_aurora_checkpoint(desired_checkpoint_path)

    # Build command
    cmd = [
        "uv",
        "run",
        "python",
        str(evaluate_script),
        "--checkpoint",
        str(desired_checkpoint_path),
        "--single_level_file",
        str(single_level),
        "--pressure_level_file",
        str(pressure_level),
        "--loss_type",
        "2t_var",
        "--output_json",
        str(output_json),
    ]

    # Run the CLI script
    result = subprocess.run(cmd, capture_output=True, text=True)

    # Check that the command succeeded
    assert result.returncode == 0, f"CLI command failed with error:\n{result.stderr}"

    # Check that the output file was created
    assert output_json.exists(), "Output JSON file should be created"


def create_and_save_pretrained_aurora_checkpoint(checkpoint_path: Path) -> None:
    """
    Creates a basic pretrained aurora lightning module, and saves the model training checkpoint to a given path
    """
    aurora_lightning_module: LitAurora = create_default_aurora_lightning_module(
        log_dir=TESTS_DIR / "outputs/tb_logs",
        num_training_samples=100,  # arbitrary num samples for this test
    )
    # Perform a "no-op" training run; a trainer.fit is required to save checkpoints
    trainer = Trainer(
        num_sanity_val_steps=0,  # skip sanity val
        limit_train_batches=0,  # do not run training
        limit_val_batches=0,  # do not run validation
        logger=False,
    )
    trainer.fit(aurora_lightning_module)
    trainer.save_checkpoint(checkpoint_path)
