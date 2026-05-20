"""Command-line interface for Aurora model evaluation."""

import argparse
from pathlib import Path

from vibe_tune_aurora.defaults.default_configs import (
    TARGET_VAR_PRESETS,
)
from vibe_tune_aurora.data_processing.grib_data_processing import (
    extract_training_data_from_grib,
)
from vibe_tune_aurora.evaluation import (
    evaluate_model,
    load_aurora_lightning_module,
    PersistenceModel,
)


def main():
    """Command-line interface for Aurora model evaluation."""
    parser = argparse.ArgumentParser(
        description="Evaluate finetuned Aurora model on ERA5 test data"
    )

    # Required arguments
    parser.add_argument(
        "--model_kind",
        type=str,
        required=True,
        choices=["persistence", "checkpoint"],
        help="Model type: 'persistence' for baseline persistence model,"
        "'checkpoint' for trained model from checkpoint file. Note: the persistence model is "
        "a simple baseline model that copies the current timestep as the predicted "
        "timestep (persisting it as the prediction). ",
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
        "--checkpoint",
        type=Path,
        required=False,
        help="Path to model checkpoint file. Required if model_kind is set to 'checkpoint'.",
    )
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
        help=(
            "Patch size for Aurora model - spatial dimensions will be cropped to multiples "
            "(default: 4). Units are in grid cells, i.e. path size of 4 refers to a patch of 4 "
            "grid cells by 4 grid cells."
        ),
    )
    parser.add_argument(
        "--skip_first_n_timesteps",
        type=int,
        default=0,
        help="Number of initial timesteps to skip before creating training pairs (default: 0)",
    )
    parser.add_argument(
        "--data_additional_surf_vars",
        type=lambda x: x.split(","),
        default=[],
        help="List (input as comma-separated list of variable names, with no spaces between "
        "commas) of additional surface variables (beyond defaults) to extract from raw data",
    )

    args = parser.parse_args()

    # Get target variables from preset
    target_vars = TARGET_VAR_PRESETS[args.loss_type]

    # Identify additional surface vars to extract from raw data
    additional_surface_variables = tuple(args.data_additional_surf_vars)

    # Extract training data from GRIB files
    print("Extracting training data from GRIB files...")
    training_data_pairs = extract_training_data_from_grib(
        single_level_file=args.single_level_file,
        pressure_level_file=args.pressure_level_file,
        patch_size=args.patch_size,
        skip_first_n_timesteps=args.skip_first_n_timesteps,
        additional_surface_variables=additional_surface_variables,
    )

    # Print configuration
    print(f"Model evaluation with loss type: {args.loss_type}")
    print(f"Target variables: {target_vars}")

    # Load model based on model_kind
    if args.model_kind == "persistence":
        aurora_model = PersistenceModel()
    else:  # checkpoint
        if args.checkpoint is None:
            raise ValueError("--checkpoint is required when model_kind is 'checkpoint'")
        aurora_model = load_aurora_lightning_module(args.checkpoint).model

    # Run evaluation
    _ = evaluate_model(
        aurora_model=aurora_model,
        evaluation_data_pairs=training_data_pairs,
        target_vars=target_vars,
        output_json=args.output_json,
    )

    print("\nEvaluation completed!")


if __name__ == "__main__":
    main()
