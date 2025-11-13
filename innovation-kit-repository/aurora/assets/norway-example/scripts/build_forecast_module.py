#!/usr/bin/env python3
"""Build a TypeScript forecast module from an Aurora-compatible NetCDF tile."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import numpy as np
import xarray as xr


def _detect_time_dim(dataset: xr.Dataset) -> str:
    for name in ("time", "valid_time", "step"):
        if name in dataset.dims:
            return name
    raise ValueError(
        "Dataset does not contain a recognised time dimension (time/valid_time/step)"
    )


def _get_coord(dataset: xr.Dataset, *candidates: str) -> np.ndarray:
    for candidate in candidates:
        if candidate in dataset.coords:
            return dataset[candidate].values
    raise KeyError(f"Dataset missing expected coordinate(s): {candidates}")


def _select_time_indices(count: int, max_steps: int | None) -> Sequence[int]:
    if max_steps is None or max_steps >= count:
        return list(range(count))
    if max_steps <= 0:
        raise ValueError("max_steps must be positive when provided")
    # Take consecutive timesteps from the beginning instead of spreading across entire range
    return list(range(min(max_steps, count)))


def _format_summary(
    wind_slice: np.ndarray, temp_slice: np.ndarray, pressure_slice: np.ndarray
) -> str:
    mean_wind = float(np.mean(wind_slice))
    max_wind = float(np.max(wind_slice))
    mean_temp = float(np.mean(temp_slice))
    min_pressure = float(np.min(pressure_slice))
    max_pressure = float(np.max(pressure_slice))
    return (
        f"Mean wind {mean_wind:.1f} m/s with gusts to {max_wind:.1f} m/s. "
        f"Average temperature {mean_temp:+.1f} °C. "
        f"Sea-level pressure spans {min_pressure:.0f}–{max_pressure:.0f} hPa."
    )


def build_forecast_module(
    dataset_path: Path,
    output_path: Path,
    region_name: str,
    max_steps: int | None,
    stride: int,
) -> None:
    dataset = xr.open_dataset(dataset_path)
    time_dim = _detect_time_dim(dataset)

    latitudes = _get_coord(dataset, "latitude", "lat")
    longitudes = _get_coord(dataset, "longitude", "lon")
    times = dataset[time_dim].values

    wind_u = dataset["u10"].values
    wind_v = dataset["v10"].values
    temperature_k = dataset["t2m"].values
    pressure_pa = dataset["msl"].values

    wind_speed = np.sqrt(wind_u**2 + wind_v**2)
    wind_direction = (np.degrees(np.arctan2(wind_v, wind_u)) + 360.0) % 360.0
    temperature_c = temperature_k - 273.15
    pressure_hpa = pressure_pa * 0.01

    lat_indices = np.arange(0, latitudes.size, stride, dtype=int)
    lon_indices = np.arange(0, longitudes.size, stride, dtype=int)

    time_indices = _select_time_indices(len(times), max_steps)

    wind_min = float(np.min(wind_speed[time_indices][:, :, :]))
    wind_max = float(np.max(wind_speed[time_indices][:, :, :]))
    temp_min = float(np.min(temperature_c[time_indices][:, :, :]))
    temp_max = float(np.max(temperature_c[time_indices][:, :, :]))
    pressure_min = float(np.min(pressure_hpa[time_indices][:, :, :]))
    pressure_max = float(np.max(pressure_hpa[time_indices][:, :, :]))

    centre_lat = float(np.mean(latitudes))
    centre_lon = float(np.mean(longitudes))

    steps = []
    for index in time_indices:
        wind_slice = wind_speed[index]
        dir_slice = wind_direction[index]
        temp_slice = temperature_c[index]
        pressure_slice = pressure_hpa[index]

        reduced_wind = wind_slice[np.ix_(lat_indices, lon_indices)]
        reduced_dir = dir_slice[np.ix_(lat_indices, lon_indices)]
        reduced_temp = temp_slice[np.ix_(lat_indices, lon_indices)]
        reduced_pressure = pressure_slice[np.ix_(lat_indices, lon_indices)]

        cells = []
        for lat_pos, lat_idx in enumerate(lat_indices):
            for lon_pos, lon_idx in enumerate(lon_indices):
                cells.append(
                    {
                        "id": f"{index}-{lat_idx}-{lon_idx}",
                        "latitude": float(latitudes[lat_idx]),
                        "longitude": float(longitudes[lon_idx]),
                        "windSpeed": float(reduced_wind[lat_pos, lon_pos]),
                        "windDirection": float(reduced_dir[lat_pos, lon_pos]),
                        "temperature": float(reduced_temp[lat_pos, lon_pos]),
                        "pressure": float(reduced_pressure[lat_pos, lon_pos]),
                    }
                )

        summary = _format_summary(reduced_wind, reduced_temp, reduced_pressure)
        timestamp = np.datetime_as_string(times[index], unit="s")

        steps.append(
            {
                "timestamp": timestamp,
                "summary": summary,
                "cells": cells,
            }
        )

    forecast_payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "region": {
            "name": region_name,
            "center": [centre_lat, centre_lon],
        },
        "variableRanges": {
            "windSpeed": [wind_min, wind_max],
            "temperature": [temp_min, temp_max],
            "pressure": [pressure_min, pressure_max],
        },
        "steps": steps,
    }

    payload_json = json.dumps(forecast_payload, indent=2)

    ts_module = (
        "// Auto-generated from build_forecast_module.py\n"
        "export type ForecastCell = {\n"
        "  id: string;\n"
        "  latitude: number;\n"
        "  longitude: number;\n"
        "  windSpeed: number;\n"
        "  windDirection: number;\n"
        "  temperature: number;\n"
        "  pressure: number;\n"
        "};\n\n"
        "export type ForecastStep = {\n"
        "  timestamp: string;\n"
        "  summary: string;\n"
        "  cells: ForecastCell[];\n"
        "};\n\n"
        "export type Forecast = {\n"
        "  generatedAt: string;\n"
        "  region: { name: string; center: [number, number] };\n"
        "  variableRanges: {\n"
        "    windSpeed: [number, number];\n"
        "    temperature: [number, number];\n"
        "    pressure: [number, number];\n"
        "  };\n"
        "  steps: ForecastStep[];\n"
        "};\n\n"
        f"export const auroraForecast: Forecast = {payload_json} as const;\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_module, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "dataset", type=Path, help="Path to Aurora-compatible NetCDF file"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/src/data/auroraForecast.ts"),
        help="Where to write the generated TypeScript module",
    )
    parser.add_argument(
        "--region-name",
        default="Norway Coastal Corridor",
        help="Region label stored in the payload",
    )
    parser.add_argument(
        "--max-steps",
        type=int,
        default=None,
        help="Maximum number of consecutive time steps to include (default: None = all timesteps)",
    )
    parser.add_argument(
        "--stride",
        type=int,
        default=1,
        help="Spatial stride when sampling the grid (default: 1 for full resolution)",
    )

    args = parser.parse_args()

    build_forecast_module(
        dataset_path=args.dataset,
        output_path=args.output,
        region_name=args.region_name,
        max_steps=args.max_steps,
        stride=args.stride,
    )


if __name__ == "__main__":
    main()
