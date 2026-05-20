"""Construct configuration CSV for Aurora finetuning demo evaluation."""

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

import polars as pl


@dataclass
class VersionConfig:
    """Configuration for a finetuning version."""

    version_name: str
    data_label: str
    grib_folder: str
    single_level_file: str
    pressure_level_file: str


# Mapping of tb_logs versions to their corresponding training datasets
VERSION_CONFIGS = {
    "version_1": VersionConfig(
        version_name="version_1",
        data_label="dec25_dec31_2023",
        grib_folder="greece_dec25_dec31_2023",
        single_level_file="era5_single_level_train.grib",
        pressure_level_file="era5_pressure_level_train.grib",
    ),
    "version_2": VersionConfig(
        version_name="version_2",
        data_label="nov1_dec31_2023",
        grib_folder="greece_nov1_dec31_2023",
        single_level_file="era5_single_level_nov1_dec31_2023.grib",
        pressure_level_file="era5_pressure_level_nov1_dec31_2023.grib",
    ),
    "version_3": VersionConfig(
        version_name="version_3",
        data_label="jul1_dec31_2023",
        grib_folder="greece_jul1_dec31_2023",
        single_level_file="era5_single_level_jul1_dec31_2023.grib",
        pressure_level_file="era5_pressure_level_jul1_dec31_2023.grib",
    ),
}

# Validation dataset configuration
VALIDATION_CONFIG = {
    "grib_folder": "greece_jan1_jan7_2024",
    "single_level_file": "era5_single_level_jan1_jan7_2024.grib",
    "pressure_level_file": "era5_pressure_level_jan1_jan7_2024.grib",
}


def parse_epoch_from_filename(filename: str) -> str:
    """
    Parse the epoch label from a checkpoint filename.

    Args:
        filename: Checkpoint filename (e.g., "epoch_epoch=03.ckpt", "init.ckpt", "last.ckpt")

    Returns:
        Epoch label as string ("init", "0", "1", ..., "7", "last")
    """
    if filename == "init.ckpt":
        return "init"
    if filename == "last.ckpt":
        return "last"

    # Parse epoch number from "epoch_epoch=XX.ckpt" format
    match = re.match(r"epoch_epoch=(\d+)\.ckpt", filename)
    if match:
        return str(int(match.group(1)))  # Remove leading zeros

    raise ValueError(f"Could not parse epoch from filename: {filename}")


def get_checkpoint_info(checkpoints_dir: Path) -> list[tuple[Path, str]]:
    """
    Get all checkpoint paths and their epoch labels from a checkpoints directory.

    Args:
        checkpoints_dir: Path to the checkpoints directory

    Returns:
        List of (checkpoint_path, epoch_label) tuples, sorted by epoch order
    """
    checkpoint_files = list(checkpoints_dir.glob("*.ckpt"))
    results = []

    for ckpt_path in checkpoint_files:
        epoch_label = parse_epoch_from_filename(ckpt_path.name)
        results.append((ckpt_path, epoch_label))

    # Sort by epoch order: init first, then 0-7, then last
    def sort_key(item: tuple[Path, str]) -> tuple[int, int]:
        epoch = item[1]
        if epoch == "init":
            return (0, 0)
        elif epoch == "last":
            return (2, 0)
        else:
            return (1, int(epoch))

    return sorted(results, key=sort_key)


def construct_config_dataframe(
    tb_logs_root: Path,
    grib_data_root: Path,
) -> pl.DataFrame:
    """
    Construct the configuration DataFrame with all evaluation combinations.

    Args:
        tb_logs_root: Root path to tb_logs/finetuning directory
        grib_data_root: Root path to grib_data directory

    Returns:
        Polars DataFrame with evaluation configuration
    """
    rows: list[dict] = []

    # Validation dataset paths (same for all models)
    val_single_level = grib_data_root / VALIDATION_CONFIG["grib_folder"] / VALIDATION_CONFIG["single_level_file"]
    val_pressure_level = grib_data_root / VALIDATION_CONFIG["grib_folder"] / VALIDATION_CONFIG["pressure_level_file"]

    for version_name, config in VERSION_CONFIGS.items():
        version_dir = tb_logs_root / version_name
        checkpoints_dir = version_dir / "checkpoints"

        if not checkpoints_dir.exists():
            print(f"Warning: Checkpoints directory not found: {checkpoints_dir}")
            continue

        # Training dataset paths for this version
        train_single_level = grib_data_root / config.grib_folder / config.single_level_file
        train_pressure_level = grib_data_root / config.grib_folder / config.pressure_level_file

        # Get all checkpoints for this version
        checkpoint_info = get_checkpoint_info(checkpoints_dir)

        for ckpt_path, epoch_label in checkpoint_info:
            # Row for training dataset evaluation
            rows.append({
                "eval_single_level_path": str(train_single_level),
                "eval_pressure_level_path": str(train_pressure_level),
                "model_checkpoint_path": str(ckpt_path),
                "data_finetuned_on": config.data_label,
                "dataset_kind": "train",
                "surface_variable": "tcc",
                "checkpoint_epoch": epoch_label,
            })

            # Row for validation dataset evaluation
            rows.append({
                "eval_single_level_path": str(val_single_level),
                "eval_pressure_level_path": str(val_pressure_level),
                "model_checkpoint_path": str(ckpt_path),
                "data_finetuned_on": config.data_label,
                "dataset_kind": "validation",
                "surface_variable": "tcc",
                "checkpoint_epoch": epoch_label,
            })

    return pl.DataFrame(rows)


def validate_paths(df: pl.DataFrame) -> list[str]:
    """
    Validate that all paths in the DataFrame exist.

    Args:
        df: Configuration DataFrame

    Returns:
        List of error messages for missing paths
    """
    errors = []

    # Check unique paths
    path_columns = ["eval_single_level_path", "eval_pressure_level_path", "model_checkpoint_path"]

    for col in path_columns:
        unique_paths = df[col].unique().to_list()
        for path_str in unique_paths:
            if not Path(path_str).exists():
                errors.append(f"Missing {col}: {path_str}")

    return errors


def main() -> None:
    """Main entry point for constructing the config CSV."""
    # Default paths relative to this script
    # script_dir = .../assets/demo-app/backend/src/aft_demo_backend/
    # .parent.parent.parent = .../assets/demo-app/
    script_dir = Path(__file__).parent
    demo_app_dir = script_dir.parent.parent.parent
    default_tb_logs = demo_app_dir / "assets" / "tb_logs" / "finetuning"
    default_grib_data = demo_app_dir / "assets" / "grib_data"
    default_output = demo_app_dir / "assets" / "outputs" / "eval_config.csv"

    parser = argparse.ArgumentParser(
        description="Construct configuration CSV for Aurora finetuning demo evaluation"
    )
    parser.add_argument(
        "--tb-logs-root",
        type=Path,
        default=default_tb_logs,
        help=f"Root path to tb_logs/finetuning directory (default: {default_tb_logs})",
    )
    parser.add_argument(
        "--grib-data-root",
        type=Path,
        default=default_grib_data,
        help=f"Root path to grib_data directory (default: {default_grib_data})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help=f"Output CSV path (default: {default_output})",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate that all paths exist",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Constructing Evaluation Config CSV")
    print("=" * 60)
    print(f"TB Logs Root: {args.tb_logs_root}")
    print(f"GRIB Data Root: {args.grib_data_root}")
    print(f"Output: {args.output}")

    # Construct the DataFrame
    df = construct_config_dataframe(args.tb_logs_root, args.grib_data_root)

    print(f"\nGenerated {len(df)} rows")
    print(f"Columns: {df.columns}")

    # Show summary
    print("\nSummary by data_finetuned_on:")
    print(df.group_by("data_finetuned_on").len())

    print("\nSummary by dataset_kind:")
    print(df.group_by("dataset_kind").len())

    print("\nSummary by checkpoint_epoch:")
    print(df.group_by("checkpoint_epoch").len())

    # Validate paths if requested
    if args.validate:
        print("\nValidating paths...")
        errors = validate_paths(df)
        if errors:
            print(f"Found {len(errors)} missing paths:")
            for error in errors:
                print(f"  - {error}")
            raise SystemExit(1)
        else:
            print("All paths exist!")

    # Save to CSV
    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.write_csv(args.output)
    print(f"\nConfig CSV saved to: {args.output}")


if __name__ == "__main__":
    main()
