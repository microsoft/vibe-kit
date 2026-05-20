#!/usr/bin/env python3
"""Check Aurora forecast predictions for physical plausibility.

Scans each rollout step and flags unrealistic temperature values that
indicate model divergence.  Run after inference to decide whether the
chosen forecast horizon is stable for your grid size.

Usage:
    python check_divergence.py --forecast data/norway_june8_forecast.nc

Exit code 0 when all steps are plausible, 1 when divergence is detected.
"""

from __future__ import annotations

import argparse
import sys

import numpy as np


def check_divergence(
    predictions: list,
    *,
    temp_key: str = "t2m",
    min_celsius: float = -60.0,
    max_celsius: float = 60.0,
) -> bool:
    """Return True if every step stays within realistic bounds.

    Args:
        predictions: list of dicts or Batch-like objects whose
            ``[temp_key]`` entry is a tensor with temperatures in Kelvin.
        temp_key: name of the 2-meter temperature variable.
        min_celsius: lower bound considered realistic.
        max_celsius: upper bound considered realistic.
    """
    all_ok = True
    for i, pred in enumerate(predictions):
        t2m = np.asarray(pred[temp_key]).flatten()
        temp_min = float(t2m.min()) - 273.15
        temp_max = float(t2m.max()) - 273.15

        print(f"Step {i + 1}: {temp_min:.1f} C to {temp_max:.1f} C")

        if temp_min < min_celsius or temp_max > max_celsius:
            print(f"  WARNING: Unrealistic temps at step {i + 1}")
            print(f"  Model likely diverging - reduce num_steps")
            all_ok = False

    if all_ok:
        print("All predictions within realistic bounds")
    return all_ok


def _from_netcdf(path: str, temp_key: str = "t2m") -> list[dict]:
    """Load a forecast NetCDF and return a list of per-step dicts."""
    import xarray as xr

    ds = xr.open_dataset(path, engine="netcdf4")

    # Identify the time/step dimension
    time_dim = None
    for candidate in ("time", "step", "lead_time"):
        if candidate in ds.dims:
            time_dim = candidate
            break
    if time_dim is None:
        # Single step
        return [{temp_key: ds[temp_key].values}]

    steps = []
    for i in range(ds.sizes[time_dim]):
        steps.append({temp_key: ds[temp_key].isel({time_dim: i}).values})
    return steps


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecast", required=True, help="Forecast NetCDF file")
    parser.add_argument(
        "--temp-key",
        default="t2m",
        help="Name of the 2-meter temperature variable (default: t2m)",
    )
    parser.add_argument(
        "--min-celsius",
        type=float,
        default=-60.0,
        help="Lower plausibility bound in Celsius (default: -60)",
    )
    parser.add_argument(
        "--max-celsius",
        type=float,
        default=60.0,
        help="Upper plausibility bound in Celsius (default: 60)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    predictions = _from_netcdf(args.forecast, temp_key=args.temp_key)
    ok = check_divergence(
        predictions,
        temp_key=args.temp_key,
        min_celsius=args.min_celsius,
        max_celsius=args.max_celsius,
    )
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
