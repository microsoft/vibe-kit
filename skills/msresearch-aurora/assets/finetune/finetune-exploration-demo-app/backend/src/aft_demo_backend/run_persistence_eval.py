"""Run persistence model evaluation on validation dataset."""

import argparse
import json
from pathlib import Path

from vibe_tune_aurora.data_processing.grib_data_processing import extract_training_data_from_grib
from vibe_tune_aurora.evaluation import evaluate_model, PersistenceModel


# Additional surface variables to extract (includes tcc for cloud cover prediction)
ADDITIONAL_SURFACE_VARS = ("tcc",)


def run_persistence_evaluation(
    single_level_path: Path,
    pressure_level_path: Path,
    target_vars: tuple[str, ...],
    patch_size: int = 4,
) -> float:
    """
    Run persistence model evaluation.

    Args:
        single_level_path: Path to single-level GRIB file
        pressure_level_path: Path to pressure-level GRIB file
        target_vars: Target variables for evaluation
        patch_size: Patch size for data processing

    Returns:
        Mean MAE loss value
    """
    # Extract data pairs from GRIB files
    data_pairs = extract_training_data_from_grib(
        single_level_file=single_level_path,
        pressure_level_file=pressure_level_path,
        patch_size=patch_size,
        additional_surface_variables=ADDITIONAL_SURFACE_VARS,
    )

    # Create persistence model
    model = PersistenceModel()

    # Run evaluation
    result = evaluate_model(
        aurora_model=model,
        evaluation_data_pairs=data_pairs,
        target_vars=target_vars,
    )

    return result.mean_mae


def main() -> None:
    """Main entry point for running persistence model evaluation."""
    # Default paths relative to this script
    script_dir = Path(__file__).parent
    demo_app_dir = script_dir.parent.parent.parent
    grib_data_dir = demo_app_dir / "assets" / "grib_data" / "greece_jan1_jan7_2024"
    default_single_level = grib_data_dir / "era5_single_level_jan1_jan7_2024.grib"
    default_pressure_level = grib_data_dir / "era5_pressure_level_jan1_jan7_2024.grib"
    default_output = demo_app_dir / "assets" / "outputs" / "persistence_baseline.json"

    parser = argparse.ArgumentParser(
        description="Run persistence model evaluation on validation dataset"
    )
    parser.add_argument(
        "--single-level",
        type=Path,
        default=default_single_level,
        help=f"Path to single-level GRIB file (default: {default_single_level})",
    )
    parser.add_argument(
        "--pressure-level",
        type=Path,
        default=default_pressure_level,
        help=f"Path to pressure-level GRIB file (default: {default_pressure_level})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help=f"Path to output JSON file (default: {default_output})",
    )
    parser.add_argument(
        "--target-vars",
        type=str,
        default="tcc",
        help="Comma-separated target variables (default: tcc)",
    )
    parser.add_argument(
        "--patch-size",
        type=int,
        default=4,
        help="Patch size for data processing (default: 4)",
    )

    args = parser.parse_args()

    # Parse target vars
    target_vars = tuple(args.target_vars.split(","))

    print("=" * 60)
    print("Persistence Model Evaluation")
    print("=" * 60)
    print(f"Single-level GRIB: {args.single_level}")
    print(f"Pressure-level GRIB: {args.pressure_level}")
    print(f"Target variables: {target_vars}")
    print(f"Patch size: {args.patch_size}")

    # Run evaluation
    mean_mae = run_persistence_evaluation(
        single_level_path=args.single_level,
        pressure_level_path=args.pressure_level,
        target_vars=target_vars,
        patch_size=args.patch_size,
    )

    # Save result
    result = {
        "model": "persistence",
        "dataset": "validation",
        "target_vars": list(target_vars),
        "mean_mae": mean_mae,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Persistence Model MAE: {mean_mae:.6f}")
    print(f"Results saved to: {args.output}")
    print("=" * 60)


if __name__ == "__main__":
    main()
