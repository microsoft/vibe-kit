#!/usr/bin/env python3
"""
YOUR_DOMAIN Aurora Prototype

Copy this template and replace the TODO sections with your domain-specific
logic (e.g., flood risk scoring, crop condition estimation, energy demand
forecasting).

Usage:
    cp aurora_prototype_template.py my_prototype.py
    # Edit my_prototype.py with your domain logic
    python my_prototype.py --data ./data/your_data.nc
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
from aurora import AuroraSmallPretrained, Batch, Metadata, rollout


# ---------------------------------------------------------------------------
# 1. Data loading — adapt for your data format
# ---------------------------------------------------------------------------


def load_your_data(file_path: str) -> Batch:
    """Load input data into an Aurora Batch.

    TODO: Replace this with your data loading logic.
    See ``assets/inference/norway-example/scripts/run_aurora_inference.py`` for a
    working ERA5 loader you can adapt.
    """
    import xarray as xr

    ds = xr.open_dataset(file_path, engine="netcdf4")

    # TODO: Extract surface variables (required: u10, v10, t2m, msl)
    # TODO: Extract static variables (lsm, z, slt)
    # TODO: Extract atmospheric variables (t, u, v, q, z at pressure levels)
    # TODO: Build Metadata with lat, lon, time, atmos_levels

    raise NotImplementedError(
        "Replace this function with your data loading logic. "
        "See run_aurora_inference.py for a working example."
    )


# ---------------------------------------------------------------------------
# 2. Domain logic — extract the features your application needs
# ---------------------------------------------------------------------------


def apply_your_domain_logic(forecasts: list) -> list[dict]:
    """Convert raw Aurora forecasts into domain-specific metrics.

    TODO: Replace with your domain logic. Examples:
    - Wind farm: compute hub-height wind speed, power curves
    - Agriculture: frost risk indices, growing degree days
    - Emergency: extreme-event thresholds, warning triggers
    """
    results = []
    for step_idx, pred in enumerate(forecasts):
        u10 = pred.surf_vars["10u"][0, 0].cpu().numpy()
        v10 = pred.surf_vars["10v"][0, 0].cpu().numpy()
        t2m = pred.surf_vars["2t"][0, 0].cpu().numpy()

        wind_speed = np.sqrt(u10**2 + v10**2)

        results.append(
            {
                "lead_time_hours": (step_idx + 1) * 6,
                "wind_speed_mean": float(wind_speed.mean()),
                "wind_speed_max": float(wind_speed.max()),
                "temperature_mean_C": float(t2m.mean() - 273.15),
            }
        )

    return results


# ---------------------------------------------------------------------------
# 3. Main workflow
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Path to input NetCDF")
    parser.add_argument(
        "--steps", type=int, default=4, help="Forecast steps (default: 4 = 24h)"
    )
    parser.add_argument("--device", default=None, help="Force device (cpu/cuda)")
    args = parser.parse_args()

    # Setup
    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    model = AuroraSmallPretrained()
    model.load_checkpoint()
    model = model.to(device).eval()
    print(f"Model ready on {device}")

    # Load data
    batch = load_your_data(args.data)
    batch = batch.to(device)

    # Run forecast
    with torch.inference_mode():
        forecasts = [pred.to("cpu") for pred in rollout(model, batch, steps=args.steps)]
    print(f"Generated {len(forecasts)} forecast steps")

    # Apply domain logic
    results = apply_your_domain_logic(forecasts)

    # Output
    for entry in results:
        print(entry)


if __name__ == "__main__":
    main()
