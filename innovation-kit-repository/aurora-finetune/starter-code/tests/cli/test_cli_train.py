"""Tests for the train CLI script."""

import subprocess
from pathlib import Path

# Get project and tests directories
TESTS_DIR = Path(__file__).parent.parent
PROJECT_ROOT = TESTS_DIR.parent


def test_cli_train_2t_var_pretrained():
    """Test train CLI with 2t variable, pretrained model, cosine annealing scheduler."""
    # Construct paths
    train_script = PROJECT_ROOT / "src/vibe_tune_aurora/cli/train.py"
    single_levels_training_file = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_levels_training_file = (
        TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"
    )
    single_levels_validation_file = (
        TESTS_DIR / "inputs/era5_single_level_western_usa_jan_8_to_14.grib"
    )
    pressure_levels_validation_file = (
        TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_8_to_14.grib"
    )

    log_dir = TESTS_DIR / "outputs/tb_logs_cli"

    # Build command
    cmd = [
        "uv",
        "run",
        "python",
        str(train_script),
        "--single_levels_training_file",
        str(single_levels_training_file),
        "--pressure_levels_training_file",
        str(pressure_levels_training_file),
        "--single_levels_validation_file",
        str(single_levels_validation_file),
        "--pressure_levels_validation_file",
        str(pressure_levels_validation_file),
        "--loss_type",
        "2t_var",
        "--max_epochs",
        "1",
        "--learning_rate",
        "1e-3",
        "--init-mode",
        "pretrained",
        "--lr_scheduler",
        "cosine_annealing",
        "--log_dir",
        str(log_dir),
    ]

    # Run the CLI script
    result = subprocess.run(cmd, capture_output=True, text=True)

    # Check that the command succeeded
    assert result.returncode == 0, f"CLI command failed with error:\n{result.stderr}"
