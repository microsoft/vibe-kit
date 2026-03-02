from pathlib import Path

from vibe_tune_aurora.aurora_module import create_default_aurora_lightning_module
from vibe_tune_aurora.data_processing.grib_data_processing import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.evaluation import EvaluationResult, evaluate_model, PersistenceModel

TESTS_DIR = Path(__file__).parent


def test_evaluation_pretrained_model_2t_var():
    """Test evaluation with 2t variable on pretrained model."""
    # Input paths
    single_level = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_level = TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"

    # Extract training data from GRIB
    training_data_pairs = extract_training_data_from_grib(single_level, pressure_level)

    # Output path
    output_json = TESTS_DIR / "outputs/evaluation_results_test.json"

    # Run evaluation
    results = evaluate_model(
        aurora_model=create_default_aurora_lightning_module(
            log_dir=TESTS_DIR / "outputs/tb_logs",
            num_training_samples=len(training_data_pairs),
        ).model,
        evaluation_data_pairs=training_data_pairs,
        target_vars=("2t",),
        output_json=output_json,
    )

    # Assertions
    assert results is not None, "Results should not be None"
    assert isinstance(results, EvaluationResult), "Results should be an EvaluationResult"
    assert output_json.exists(), "Output JSON file should be created"

    # Check that we evaluated some samples
    assert results.num_samples > 0, "Should have evaluated at least one sample"

    # Check that target_vars matches what we requested
    assert results.target_vars == ["2t"], "Target vars should be ['2t']"

    # Check that MAE values are reasonable (non-negative, finite)
    assert results.mean_mae >= 0, "Mean MAE should be non-negative"
    assert results.std_mae >= 0, "Std MAE should be non-negative"
    assert results.min_mae >= 0, "Min MAE should be non-negative"
    assert results.max_mae >= 0, "Max MAE should be non-negative"


def test_evaluate_persistence_model():
    """Test evaluation with persistence model baseline."""
    # Input paths
    single_level = TESTS_DIR / "inputs/era5_single_level_western_usa_jan_1_to_7.grib"
    pressure_level = TESTS_DIR / "inputs/era5_pressure_level_western_usa_jan_1_to_7.grib"

    # Extract training data from GRIB
    training_data_pairs = extract_training_data_from_grib(single_level, pressure_level)

    # Output path
    output_json = TESTS_DIR / "outputs/evaluation_results_persistence_test.json"

    # Run evaluation with persistence model
    persistence_model = PersistenceModel()
    results = evaluate_model(
        aurora_model=persistence_model,
        evaluation_data_pairs=training_data_pairs,
        target_vars=("2t",),
        output_json=output_json,
    )

    # Assertions
    assert results is not None, "Results should not be None"
    assert isinstance(results, EvaluationResult), "Results should be an EvaluationResult"
    assert output_json.exists(), "Output JSON file should be created"

    # Check that we evaluated some samples
    assert results.num_samples > 0, "Should have evaluated at least one sample"

    # Check that target_vars matches what we requested
    assert results.target_vars == ["2t"], "Target vars should be ['2t']"

    # Check that MAE values are reasonable (non-negative, finite)
    assert results.mean_mae >= 0, "Mean MAE should be non-negative"
    assert results.std_mae >= 0, "Std MAE should be non-negative"
    assert results.min_mae >= 0, "Min MAE should be non-negative"
    assert results.max_mae >= 0, "Max MAE should be non-negative"
