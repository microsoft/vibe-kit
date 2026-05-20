#!/usr/bin/env python3
"""Compare Aurora forecast predictions against ERA5 observations.

Computes RMSE, MAE, bias, and Pearson correlation for 2-meter temperature
and prints a summary table.

Usage:
    python validate_forecast.py \\
        --forecast data/norway_june8_forecast.nc \\
        --observations data/norway_june8_observations.nc

Requires: numpy, xarray, netcdf4.
Optional: matplotlib (for --plot).
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict

import numpy as np


def validate_forecast(
    forecast_path: str,
    observation_path: str,
    variable: str = "t2m",
    *,
    plot_path: str | None = None,
) -> Dict[str, float]:
    """Return accuracy metrics comparing forecast to observations.

    Args:
        forecast_path: NetCDF file with Aurora predictions.
        observation_path: NetCDF file with ERA5 observations.
        variable: Variable to compare (default: t2m).
        plot_path: If provided, save a 3-panel comparison plot.

    Returns:
        dict with rmse, mae, bias, and correlation.
    """
    import xarray as xr

    pred_ds = xr.open_dataset(forecast_path, engine="netcdf4")
    obs_ds = xr.open_dataset(observation_path, engine="netcdf4")

    # Align grids
    obs_matched = obs_ds.interp_like(pred_ds)

    # Identify time dimension for first step
    pred_var = pred_ds[variable]
    time_dims = [
        d for d in pred_var.dims if d not in ("latitude", "longitude", "lat", "lon")
    ]
    if time_dims:
        pred_vals = pred_var.isel({time_dims[0]: 0}, drop=True).values
        obs_vals = obs_matched[variable].isel({time_dims[0]: 0}, drop=True).values
    else:
        pred_vals = pred_var.values
        obs_vals = obs_matched[variable].values

    diff = pred_vals - obs_vals
    rmse = float(np.sqrt(np.nanmean(diff**2)))
    mae = float(np.nanmean(np.abs(diff)))
    bias = float(np.nanmean(diff))

    pred_flat = pred_vals.flatten()
    obs_flat = obs_vals.flatten()
    mask = ~(np.isnan(pred_flat) | np.isnan(obs_flat))
    if mask.sum() > 1:
        corr = float(np.corrcoef(pred_flat[mask], obs_flat[mask])[0, 1])
    else:
        corr = float("nan")

    metrics = {
        "rmse": rmse,
        "mae": mae,
        "bias": bias,
        "correlation": corr,
    }

    print("Validation Metrics:")
    print(f"  RMSE: {rmse:.2f} K")
    print(f"  MAE:  {mae:.2f} K")
    print(f"  Bias: {bias:.2f} K")
    print(f"  Corr: {corr:.3f}")

    if plot_path:
        _plot(pred_ds, obs_matched, variable, plot_path)

    return metrics


def _plot(pred_ds, obs_ds, variable: str, output_path: str) -> None:
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 3, figsize=(15, 4))

    pred_var = pred_ds[variable]
    time_dims = [
        d for d in pred_var.dims if d not in ("latitude", "longitude", "lat", "lon")
    ]
    sel = {time_dims[0]: 0} if time_dims else {}

    pred_ds[variable].isel(sel).plot(ax=axes[0])
    axes[0].set_title("Aurora Forecast")

    obs_ds[variable].isel(sel).plot(ax=axes[1])
    axes[1].set_title("Observations")

    error = pred_ds[variable] - obs_ds[variable]
    error.isel(sel).plot(ax=axes[2], cmap="RdBu_r")
    axes[2].set_title("Error")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    print(f"Plot saved to {output_path}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--forecast", required=True, help="Forecast NetCDF file")
    parser.add_argument("--observations", required=True, help="Observation NetCDF file")
    parser.add_argument(
        "--variable", default="t2m", help="Variable to compare (default: t2m)"
    )
    parser.add_argument(
        "--plot", default=None, help="Save comparison plot to this path"
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    validate_forecast(
        args.forecast,
        args.observations,
        variable=args.variable,
        plot_path=args.plot,
    )


if __name__ == "__main__":
    main()
