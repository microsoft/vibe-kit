from pathlib import Path

from aurora import Batch
from vibe_tune_aurora.data_processing.extract_data_from_grib import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.types import SupervisedTrainingDataPair

TESTS_DIR = Path(__file__).parent.parent


def test_extract_training_data_from_grib_western_usa():
    """Test extraction of training data from Western USA GRIB files (Jan 1-7)."""
    single_level_file = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_level_file = (
        TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"
    )

    # Extract training data with default parameters
    result = extract_training_data_from_grib(
        single_level_file=single_level_file,
        pressure_level_file=pressure_level_file,
        patch_size=4,
        skip_first_n_timesteps=0,
    )

    # Verify result structure
    assert result is not None, "Result should not be None"
    assert isinstance(result, list), "Result should be a list"
    assert len(result) > 0, "Result should not be empty"

    # Verify structure of first training pair
    first_train_pair = result[0]
    assert isinstance(
        first_train_pair, SupervisedTrainingDataPair
    ), "Training pair should be SupervisedTrainingDataPair"
    assert hasattr(
        first_train_pair, "input_batch"
    ), "Training pair should have input_batch attribute"
    assert hasattr(
        first_train_pair, "target_batch"
    ), "Training pair should have target_batch attribute"

    input_batch = first_train_pair.input_batch
    target_batch = first_train_pair.target_batch

    # Verify batches are Aurora Batch objects
    assert isinstance(input_batch, Batch), "Input batch should be Aurora Batch object"
    assert isinstance(target_batch, Batch), "Target batch should be Aurora Batch object"

    # Verify batch structure
    assert hasattr(input_batch, "surf_vars"), "Input batch should have surf_vars"
    assert hasattr(input_batch, "atmos_vars"), "Input batch should have atmos_vars"
    assert hasattr(input_batch, "static_vars"), "Input batch should have static_vars"
    assert hasattr(input_batch, "metadata"), "Input batch should have metadata"

    assert hasattr(target_batch, "surf_vars"), "Target batch should have surf_vars"
    assert hasattr(target_batch, "atmos_vars"), "Target batch should have atmos_vars"
    assert hasattr(target_batch, "static_vars"), "Target batch should have static_vars"
    assert hasattr(target_batch, "metadata"), "Target batch should have metadata"

    # Verify required surface variables are present
    required_surf_vars = ["2t", "10u", "10v", "msl"]
    for var_name in required_surf_vars:
        assert (
            var_name in input_batch.surf_vars
        ), f"Input batch should have surface variable '{var_name}'"
        assert (
            var_name in target_batch.surf_vars
        ), f"Target batch should have surface variable '{var_name}'"

    # Verify required atmospheric variables are present
    required_atmos_vars = ["t", "u", "v", "q", "z"]
    for var_name in required_atmos_vars:
        assert (
            var_name in input_batch.atmos_vars
        ), f"Input batch should have atmospheric variable '{var_name}'"
        assert (
            var_name in target_batch.atmos_vars
        ), f"Target batch should have atmospheric variable '{var_name}'"

    # Verify time dimensions (input has 2 timesteps, target has 1)
    sample_surf_var = input_batch.surf_vars["2t"]
    assert (
        sample_surf_var.shape[1] == 2
    ), f"Input batch should have 2 timesteps, got {sample_surf_var.shape[1]}"

    sample_target_var = target_batch.surf_vars["2t"]
    assert (
        sample_target_var.shape[1] == 1
    ), f"Target batch should have 1 timestep, got {sample_target_var.shape[1]}"

    # Verify spatial dimensions are multiples of patch_size (4)
    height, width = sample_surf_var.shape[2], sample_surf_var.shape[3]
    assert height % 4 == 0, f"Height should be multiple of 4, got {height}"
    assert width % 4 == 0, f"Width should be multiple of 4, got {width}"

    print(f"Test passed! Generated {len(result)} training pairs")
    print(f"Spatial dimensions: {height}x{width}")
