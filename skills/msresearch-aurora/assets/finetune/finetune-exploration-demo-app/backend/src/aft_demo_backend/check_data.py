"""Automated validation of GRIB data files for the Aurora finetuning demo."""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import pygrib


@dataclass
class ExpectedDateRange:
    """Expected date range for a dataset."""

    name: str
    start_date: datetime
    end_date: datetime


@dataclass
class GribFileInfo:
    """Information extracted from a GRIB file."""

    file_path: Path
    min_time: datetime
    max_time: datetime
    num_timesteps: int
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    lat_shape: tuple[int, int]
    variables: list[str]


@dataclass
class DatasetPairInfo:
    """Information about a single-level and pressure-level GRIB file pair."""

    name: str
    single_level: GribFileInfo
    pressure_level: GribFileInfo


@dataclass
class ValidationResult:
    """Result of a single validation check."""

    passed: bool
    message: str


def extract_grib_info(file_path: Path) -> GribFileInfo:
    """
    Extract metadata from a GRIB file.

    Args:
        file_path: Path to the GRIB file

    Returns:
        GribFileInfo with extracted metadata
    """
    if not file_path.exists():
        raise FileNotFoundError(f"GRIB file not found: {file_path}")

    times: set[datetime] = set()
    variables: set[str] = set()
    lats: np.ndarray | None = None
    lons: np.ndarray | None = None

    grbs = pygrib.open(str(file_path))
    for grb in grbs:
        times.add(grb.validDate)
        variables.add(grb.shortName)
        if lats is None:
            lats, lons = grb.latlons()
    grbs.close()

    if lats is None or lons is None:
        raise ValueError(f"Could not extract lat/lon from {file_path}")

    sorted_times = sorted(times)

    return GribFileInfo(
        file_path=file_path,
        min_time=sorted_times[0],
        max_time=sorted_times[-1],
        num_timesteps=len(sorted_times),
        lat_min=float(lats.min()),
        lat_max=float(lats.max()),
        lon_min=float(lons.min()),
        lon_max=float(lons.max()),
        lat_shape=lats.shape,
        variables=sorted(variables),
    )


def validate_date_range(
    info: GribFileInfo,
    expected: ExpectedDateRange,
) -> ValidationResult:
    """
    Validate that a GRIB file contains data within the expected date range.

    Args:
        info: Extracted GRIB file information
        expected: Expected date range

    Returns:
        ValidationResult indicating pass/fail and details
    """
    # Check if data starts on or before expected start
    start_ok = info.min_time.date() <= expected.start_date.date()
    # Check if data ends on or after expected end
    end_ok = info.max_time.date() >= expected.end_date.date()

    if start_ok and end_ok:
        return ValidationResult(
            passed=True,
            message=(
                f"Date range OK: {info.min_time.date()} to {info.max_time.date()} "
                f"(expected {expected.start_date.date()} to {expected.end_date.date()})"
            ),
        )
    else:
        issues = []
        if not start_ok:
            issues.append(
                f"starts at {info.min_time.date()}, expected {expected.start_date.date()} or earlier"
            )
        if not end_ok:
            issues.append(
                f"ends at {info.max_time.date()}, expected {expected.end_date.date()} or later"
            )
        return ValidationResult(
            passed=False,
            message=f"Date range MISMATCH: {'; '.join(issues)}",
        )


def validate_bounding_boxes_match(
    dataset_pairs: list[DatasetPairInfo],
    tolerance: float = 1e-6,
) -> list[ValidationResult]:
    """
    Validate that all datasets have identical lat/lon bounding boxes.

    Args:
        dataset_pairs: List of dataset pair information
        tolerance: Floating point tolerance for comparison

    Returns:
        List of ValidationResults for each comparison
    """
    results = []

    if len(dataset_pairs) < 2:
        results.append(
            ValidationResult(
                passed=True,
                message="Only one dataset, no bounding box comparison needed",
            )
        )
        return results

    # Use first dataset as reference
    reference = dataset_pairs[0]
    ref_single = reference.single_level
    ref_pressure = reference.pressure_level

    for other in dataset_pairs[1:]:
        other_single = other.single_level
        other_pressure = other.pressure_level

        # Compare single level files
        single_match = (
            abs(ref_single.lat_min - other_single.lat_min) < tolerance
            and abs(ref_single.lat_max - other_single.lat_max) < tolerance
            and abs(ref_single.lon_min - other_single.lon_min) < tolerance
            and abs(ref_single.lon_max - other_single.lon_max) < tolerance
            and ref_single.lat_shape == other_single.lat_shape
        )

        if single_match:
            results.append(
                ValidationResult(
                    passed=True,
                    message=(
                        f"Single-level bounding box matches between '{reference.name}' "
                        f"and '{other.name}'"
                    ),
                )
            )
        else:
            results.append(
                ValidationResult(
                    passed=False,
                    message=(
                        f"Single-level bounding box MISMATCH between '{reference.name}' "
                        f"and '{other.name}':\n"
                        f"  Reference: lat=[{ref_single.lat_min:.4f}, {ref_single.lat_max:.4f}], "
                        f"lon=[{ref_single.lon_min:.4f}, {ref_single.lon_max:.4f}], "
                        f"shape={ref_single.lat_shape}\n"
                        f"  Other:     lat=[{other_single.lat_min:.4f}, {other_single.lat_max:.4f}], "
                        f"lon=[{other_single.lon_min:.4f}, {other_single.lon_max:.4f}], "
                        f"shape={other_single.lat_shape}"
                    ),
                )
            )

        # Compare pressure level files
        pressure_match = (
            abs(ref_pressure.lat_min - other_pressure.lat_min) < tolerance
            and abs(ref_pressure.lat_max - other_pressure.lat_max) < tolerance
            and abs(ref_pressure.lon_min - other_pressure.lon_min) < tolerance
            and abs(ref_pressure.lon_max - other_pressure.lon_max) < tolerance
            and ref_pressure.lat_shape == other_pressure.lat_shape
        )

        if pressure_match:
            results.append(
                ValidationResult(
                    passed=True,
                    message=(
                        f"Pressure-level bounding box matches between '{reference.name}' "
                        f"and '{other.name}'"
                    ),
                )
            )
        else:
            results.append(
                ValidationResult(
                    passed=False,
                    message=(
                        f"Pressure-level bounding box MISMATCH between '{reference.name}' "
                        f"and '{other.name}':\n"
                        f"  Reference: lat=[{ref_pressure.lat_min:.4f}, {ref_pressure.lat_max:.4f}], "
                        f"lon=[{ref_pressure.lon_min:.4f}, {ref_pressure.lon_max:.4f}], "
                        f"shape={ref_pressure.lat_shape}\n"
                        f"  Other:     lat=[{other_pressure.lat_min:.4f}, {other_pressure.lat_max:.4f}], "
                        f"lon=[{other_pressure.lon_min:.4f}, {other_pressure.lon_max:.4f}], "
                        f"shape={other_pressure.lat_shape}"
                    ),
                )
            )

    return results


def validate_variables_match(
    dataset_pairs: list[DatasetPairInfo],
) -> list[ValidationResult]:
    """
    Validate that all datasets have the same variables.

    Args:
        dataset_pairs: List of dataset pair information

    Returns:
        List of ValidationResults
    """
    results = []

    if len(dataset_pairs) < 2:
        return results

    reference = dataset_pairs[0]

    for other in dataset_pairs[1:]:
        # Compare single level variables
        if set(reference.single_level.variables) == set(other.single_level.variables):
            results.append(
                ValidationResult(
                    passed=True,
                    message=(
                        f"Single-level variables match between '{reference.name}' "
                        f"and '{other.name}'"
                    ),
                )
            )
        else:
            ref_vars = set(reference.single_level.variables)
            other_vars = set(other.single_level.variables)
            missing = ref_vars - other_vars
            extra = other_vars - ref_vars
            results.append(
                ValidationResult(
                    passed=False,
                    message=(
                        f"Single-level variables MISMATCH between '{reference.name}' "
                        f"and '{other.name}':\n"
                        f"  Missing in '{other.name}': {missing}\n"
                        f"  Extra in '{other.name}': {extra}"
                    ),
                )
            )

        # Compare pressure level variables
        if set(reference.pressure_level.variables) == set(other.pressure_level.variables):
            results.append(
                ValidationResult(
                    passed=True,
                    message=(
                        f"Pressure-level variables match between '{reference.name}' "
                        f"and '{other.name}'"
                    ),
                )
            )
        else:
            ref_vars = set(reference.pressure_level.variables)
            other_vars = set(other.pressure_level.variables)
            missing = ref_vars - other_vars
            extra = other_vars - ref_vars
            results.append(
                ValidationResult(
                    passed=False,
                    message=(
                        f"Pressure-level variables MISMATCH between '{reference.name}' "
                        f"and '{other.name}':\n"
                        f"  Missing in '{other.name}': {missing}\n"
                        f"  Extra in '{other.name}': {extra}"
                    ),
                )
            )

    return results


def print_dataset_summary(pair: DatasetPairInfo) -> None:
    """Print a summary of a dataset pair."""
    print(f"\n{'='*60}")
    print(f"Dataset: {pair.name}")
    print(f"{'='*60}")

    sl = pair.single_level
    print(f"\nSingle-level file: {sl.file_path.name}")
    print(f"  Date range: {sl.min_time} to {sl.max_time}")
    print(f"  Timesteps: {sl.num_timesteps}")
    print(f"  Lat range: [{sl.lat_min:.4f}, {sl.lat_max:.4f}]")
    print(f"  Lon range: [{sl.lon_min:.4f}, {sl.lon_max:.4f}]")
    print(f"  Grid shape: {sl.lat_shape}")
    print(f"  Variables ({len(sl.variables)}): {sl.variables}")

    pl = pair.pressure_level
    print(f"\nPressure-level file: {pl.file_path.name}")
    print(f"  Date range: {pl.min_time} to {pl.max_time}")
    print(f"  Timesteps: {pl.num_timesteps}")
    print(f"  Lat range: [{pl.lat_min:.4f}, {pl.lat_max:.4f}]")
    print(f"  Lon range: [{pl.lon_min:.4f}, {pl.lon_max:.4f}]")
    print(f"  Grid shape: {pl.lat_shape}")
    print(f"  Variables ({len(pl.variables)}): {pl.variables}")


def run_validation(grib_data_root: Path) -> bool:
    """
    Run all validation checks on the GRIB data.

    Args:
        grib_data_root: Root directory containing the GRIB data subdirectories

    Returns:
        True if all validations pass, False otherwise
    """
    # Define expected datasets and their date ranges
    expected_datasets = [
        {
            "name": "dec25_dec31",
            "folder": "greece_dec25_dec31_2023",
            "single_level": "era5_single_level_train.grib",
            "pressure_level": "era5_pressure_level_train.grib",
            "expected_range": ExpectedDateRange(
                name="dec25_dec31",
                start_date=datetime(2023, 12, 25),
                end_date=datetime(2023, 12, 31),
            ),
        },
        {
            "name": "nov1_dec31",
            "folder": "greece_nov1_dec31_2023",
            "single_level": "era5_single_level_nov1_dec31_2023.grib",
            "pressure_level": "era5_pressure_level_nov1_dec31_2023.grib",
            "expected_range": ExpectedDateRange(
                name="nov1_dec31",
                start_date=datetime(2023, 11, 1),
                end_date=datetime(2023, 12, 31),
            ),
        },
        {
            "name": "jul1_dec31",
            "folder": "greece_jul1_dec31_2023",
            "single_level": "era5_single_level_jul1_dec31_2023.grib",
            "pressure_level": "era5_pressure_level_jul1_dec31_2023.grib",
            "expected_range": ExpectedDateRange(
                name="jul1_dec31",
                start_date=datetime(2023, 7, 1),
                end_date=datetime(2023, 12, 31),
            ),
        },
        {
            "name": "jan1_jan7_val",
            "folder": "greece_jan1_jan7_2024",
            "single_level": "era5_single_level_jan1_jan7_2024.grib",
            "pressure_level": "era5_pressure_level_jan1_jan7_2024.grib",
            "expected_range": ExpectedDateRange(
                name="jan1_jan7_val",
                start_date=datetime(2024, 1, 1),
                end_date=datetime(2024, 1, 7),
            ),
        },
    ]

    print("=" * 60)
    print("GRIB Data Validation")
    print("=" * 60)
    print(f"\nData root: {grib_data_root}")

    # Extract info from all datasets
    dataset_pairs: list[DatasetPairInfo] = []
    all_results: list[ValidationResult] = []

    for dataset_config in expected_datasets:
        folder_path = grib_data_root / dataset_config["folder"]
        single_level_path = folder_path / dataset_config["single_level"]
        pressure_level_path = folder_path / dataset_config["pressure_level"]

        print(f"\nProcessing {dataset_config['name']}...")

        # Check files exist
        if not single_level_path.exists():
            all_results.append(
                ValidationResult(
                    passed=False,
                    message=f"Single-level file NOT FOUND: {single_level_path}",
                )
            )
            continue

        if not pressure_level_path.exists():
            all_results.append(
                ValidationResult(
                    passed=False,
                    message=f"Pressure-level file NOT FOUND: {pressure_level_path}",
                )
            )
            continue

        # Extract file info
        single_level_info = extract_grib_info(single_level_path)
        pressure_level_info = extract_grib_info(pressure_level_path)

        pair = DatasetPairInfo(
            name=dataset_config["name"],
            single_level=single_level_info,
            pressure_level=pressure_level_info,
        )
        dataset_pairs.append(pair)

        # Print summary
        print_dataset_summary(pair)

        # Validate date range for single level
        expected_range = dataset_config["expected_range"]
        sl_date_result = validate_date_range(single_level_info, expected_range)
        all_results.append(
            ValidationResult(
                passed=sl_date_result.passed,
                message=f"[{dataset_config['name']}] Single-level: {sl_date_result.message}",
            )
        )

        # Validate date range for pressure level
        pl_date_result = validate_date_range(pressure_level_info, expected_range)
        all_results.append(
            ValidationResult(
                passed=pl_date_result.passed,
                message=f"[{dataset_config['name']}] Pressure-level: {pl_date_result.message}",
            )
        )

    # Validate bounding boxes match across all datasets
    if len(dataset_pairs) > 1:
        bbox_results = validate_bounding_boxes_match(dataset_pairs)
        all_results.extend(bbox_results)

        # Validate variables match
        var_results = validate_variables_match(dataset_pairs)
        all_results.extend(var_results)

    # Print validation summary
    print("\n" + "=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)

    passed_count = 0
    failed_count = 0

    for result in all_results:
        status = "✓ PASS" if result.passed else "✗ FAIL"
        print(f"\n{status}: {result.message}")
        if result.passed:
            passed_count += 1
        else:
            failed_count += 1

    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed_count} passed, {failed_count} failed")
    print("=" * 60)

    return failed_count == 0


def main() -> None:
    """Main entry point for the validation script."""
    # Default path relative to this file
    script_dir = Path(__file__).parent
    default_grib_root = script_dir.parent.parent.parent.parent / "assets" / "grib_data"

    # Allow override via command line
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate GRIB data files for the Aurora finetuning demo"
    )
    parser.add_argument(
        "--grib-root",
        type=Path,
        default=default_grib_root,
        help=f"Root directory containing GRIB data folders (default: {default_grib_root})",
    )
    args = parser.parse_args()

    success = run_validation(args.grib_root)

    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
