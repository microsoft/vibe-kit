"""Run evaluation for all configurations in the config CSV."""

import argparse
from pathlib import Path

import polars as pl

from vibe_tune_aurora.data_processing.grib_data_processing import extract_training_data_from_grib
from vibe_tune_aurora.evaluation import evaluate_model, load_aurora_lightning_module


# Default additional surface variables to extract (includes tcc for cloud cover prediction)
ADDITIONAL_SURFACE_VARS = ("tcc",)


def evaluate_single_config(
    single_level_path: Path,
    pressure_level_path: Path,
    checkpoint_path: Path,
    target_vars: tuple[str, ...],
    patch_size: int = 4,
) -> float:
    """
    Run evaluation for a single configuration.

    Args:
        single_level_path: Path to single-level GRIB file
        pressure_level_path: Path to pressure-level GRIB file
        checkpoint_path: Path to model checkpoint
        target_vars: Target variables for evaluation (e.g., ("tcc",))
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

    # Load model from checkpoint
    lit_module = load_aurora_lightning_module(checkpoint_path)
    model = lit_module.model

    # Run evaluation
    result = evaluate_model(
        aurora_model=model,
        evaluation_data_pairs=data_pairs,
        target_vars=target_vars,
    )

    return result.mean_mae


def run_all_evaluations(
    config_csv_path: Path,
    output_csv_path: Path,
    target_vars: tuple[str, ...] = ("tcc",),
    patch_size: int = 4,
    limit: int | None = None,
) -> pl.DataFrame:
    """
    Run evaluation for all configurations in the config CSV.

    Args:
        config_csv_path: Path to input config CSV
        output_csv_path: Path to output results CSV
        target_vars: Target variables for evaluation
        patch_size: Patch size for data processing
        limit: Optional limit on number of configurations to evaluate

    Returns:
        DataFrame with evaluation results
    """
    # Read config CSV
    df = pl.read_csv(config_csv_path)
    total_configs = len(df)
    print(f"Loaded {total_configs} configurations from {config_csv_path}")

    # Apply limit if specified
    if limit is not None and limit < total_configs:
        df = df.head(limit)
        print(f"Limiting to first {limit} configurations")

    # Run evaluation for each row
    mae_values: list[float] = []

    for i, row in enumerate(df.iter_rows(named=True)):
        print(f"\n{'='*60}")
        print(f"Evaluating config {i+1}/{len(df)}")
        print(f"  Checkpoint: {Path(row['model_checkpoint_path']).name}")
        print(f"  Data finetuned on: {row['data_finetuned_on']}")
        print(f"  Dataset kind: {row['dataset_kind']}")
        print(f"  Epoch: {row['checkpoint_epoch']}")
        print(f"{'='*60}")

        mae = evaluate_single_config(
            single_level_path=Path(row["eval_single_level_path"]),
            pressure_level_path=Path(row["eval_pressure_level_path"]),
            checkpoint_path=Path(row["model_checkpoint_path"]),
            target_vars=target_vars,
            patch_size=patch_size,
        )

        mae_values.append(mae)
        print(f"\n>>> MAE for this config: {mae:.6f}")

    # Add MAE column to DataFrame
    df = df.with_columns(pl.Series("mean_mae", mae_values))

    # Save results
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.write_csv(output_csv_path)
    print(f"\n{'='*60}")
    print(f"Results saved to: {output_csv_path}")
    print(f"{'='*60}")

    return df


def main() -> None:
    """Main entry point for running evaluations."""
    # Default paths relative to this script
    script_dir = Path(__file__).parent
    demo_app_dir = script_dir.parent.parent.parent
    default_config_csv = demo_app_dir / "assets" / "outputs" / "eval_config.csv"
    default_output_csv = demo_app_dir / "assets" / "outputs" / "eval_results.csv"

    parser = argparse.ArgumentParser(
        description="Run evaluation for all configurations in the config CSV"
    )
    parser.add_argument(
        "--config-csv",
        type=Path,
        default=default_config_csv,
        help=f"Path to input config CSV (default: {default_config_csv})",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=default_output_csv,
        help=f"Path to output results CSV (default: {default_output_csv})",
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
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of configurations to evaluate (for testing)",
    )

    args = parser.parse_args()

    # Parse target vars
    target_vars = tuple(args.target_vars.split(","))

    print("=" * 60)
    print("Aurora Finetuning Demo - Evaluation Runner")
    print("=" * 60)
    print(f"Config CSV: {args.config_csv}")
    print(f"Output CSV: {args.output_csv}")
    print(f"Target variables: {target_vars}")
    print(f"Patch size: {args.patch_size}")
    if args.limit:
        print(f"Limit: {args.limit} configurations")

    # Run evaluations
    df = run_all_evaluations(
        config_csv_path=args.config_csv,
        output_csv_path=args.output_csv,
        target_vars=target_vars,
        patch_size=args.patch_size,
        limit=args.limit,
    )

    # Print summary
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print(f"\nTotal configurations evaluated: {len(df)}")

    print("\nMAE by data_finetuned_on and dataset_kind:")
    summary = df.group_by(["data_finetuned_on", "dataset_kind"]).agg(
        pl.col("mean_mae").mean().alias("avg_mae"),
        pl.col("mean_mae").min().alias("min_mae"),
        pl.col("mean_mae").max().alias("max_mae"),
    )
    print(summary)


if __name__ == "__main__":
    main()
