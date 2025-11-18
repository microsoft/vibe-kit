from pathlib import Path

from vibe_tune_aurora.config import TrainingConfig
from vibe_tune_aurora.data_processing.extract_data_from_grib import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.training import train_era5_model

TESTS_DIR = Path(__file__).parent


def test_finetuning_2t_var_pretrained():
    """Test fine-tuning with 2t variable, pretrained model, cosine annealing scheduler."""
    single_level_training = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_level_training = TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"
    single_level_validation = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_8_to_14.grib"
    pressure_level_validation = (
        TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_8_to_14.grib"
    )

    # Extract training data from GRIB
    training_data_pairs = extract_training_data_from_grib(
        single_level_training,
        pressure_level_training,
    )
    validation_data_pairs = extract_training_data_from_grib(
        single_level_validation,
        pressure_level_validation,
    )

    config = TrainingConfig(
        max_epochs=1,
        learning_rate=1e-3,
        init_mode="pretrained",
        lr_scheduler="cosine_annealing",
        log_dir=TESTS_DIR / "outputs/tb_logs",
    )

    model = train_era5_model(
        training_data_pairs=training_data_pairs,
        validation_data_pairs=validation_data_pairs,
        target_vars=("2t",),
        config=config,
    )

    assert model is not None
