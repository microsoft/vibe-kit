"""Command-line interface for Aurora model evaluation."""

import argparse
from pathlib import Path

from vibe_tune_aurora.config import TARGET_VAR_PRESETS
from vibe_tune_aurora.data_processing.extract_data_from_grib import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.evaluation import evaluate_model, load_model


def main():
    """Command-line interface for Aurora model evaluation."""
    parser = argparse.ArgumentParser(
        description="Evaluate finetuned Aurora model on ERA5 test data"
    )

    # Required arguments
    parser.add_argument(
        "--checkpoint",
        type=Path,
        required=True,
        help="Path to model checkpoint file",
    )
    parser.add_argument(
        "--single_level_file",
        type=Path,
        required=True,
        help="Path to ERA5 single-level GRIB file",
    )
    parser.add_argument(
        "--pressure_level_file",
        type=Path,
        required=True,
        help="Path to ERA5 pressure-level GRIB file",
    )
    parser.add_argument(
        "--loss_type",
        type=str,
        required=True,
        choices=list(TARGET_VAR_PRESETS.keys()),
        help="Loss function type: '4_vars' for all 4 variables (tcc,tclw,uvb,ssrdc), "
        "'2_cloud_vars' for cloud variables only (tcc,tclw), "
        "'2t_var' for 2-meter temperature only (2t), "
        "'uvb_var' for UV radiation only (uvb)",
    )

    # Optional arguments
    parser.add_argument(
        "--output_json",
        type=Path,
        default="evaluation_results.json",
        help="Path to save evaluation results as JSON (default: evaluation_results.json)",
    )
    parser.add_argument(
        "--patch_size",
        type=int,
        default=4,
        help="Patch size for Aurora model - spatial dimensions will be cropped to multiples (default: 4). Units are in grid cells, i.e. path size of 4 refers to a patch of 4 grid cells by 4 grid cells.",
    )
    parser.add_argument(
        "--skip_first_n_timesteps",
        type=int,
        default=0,
        help="Number of initial timesteps to skip before creating training pairs (default: 0)",
    )

    args = parser.parse_args()

    # Get target variables from preset
    target_vars = TARGET_VAR_PRESETS[args.loss_type]

    # Extract training data from GRIB files
    print(f"Extracting training data from GRIB files...")
    training_data_pairs = extract_training_data_from_grib(
        single_level_file=args.single_level_file,
        pressure_level_file=args.pressure_level_file,
        patch_size=args.patch_size,
        skip_first_n_timesteps=args.skip_first_n_timesteps,
    )

    # Print configuration
    print(f"Model evaluation with loss type: {args.loss_type}")
    print(f"Target variables: {target_vars}")

    # Run evaluation
    _ = evaluate_model(
        aurora_lightning_module=load_model(args.checkpoint),
        evaluation_data_pairs=training_data_pairs,
        target_vars=target_vars,
        output_json=args.output_json,
    )

    print("\nEvaluation completed!")


if __name__ == "__main__":
    main()
