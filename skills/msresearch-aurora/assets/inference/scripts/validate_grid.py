#!/usr/bin/env python3
"""Validate Aurora grid dimensions for patch divisibility."""

from __future__ import annotations

import argparse
from dataclasses import dataclass


@dataclass
class GridSummary:
    lat_cells: int
    lon_cells: int
    lat_patches: int
    lon_patches: int
    total_points: int
    valid: bool


def _cells(delta: float, resolution: float) -> int:
    # Guard against floating-point rounding (e.g., 47.99999999)
    return int(round(delta / resolution))


def validate_grid(
    *,
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    resolution: float = 0.25,
) -> GridSummary:
    """Check that both dimensions are multiples of 16 and report patch layout."""

    lat_cells = _cells(lat_max - lat_min, resolution)
    lon_cells = _cells(lon_max - lon_min, resolution)

    lat_patches, lon_patches = lat_cells // 16, lon_cells // 16
    total_points = lat_cells * lon_cells
    valid = True

    print(f"Grid: {lat_cells}×{lon_cells} cells ({total_points:,} points)")
    print(f"Patches: {lat_patches}×{lon_patches} (16×16 each)")

    if lat_cells % 16 != 0:
        valid = False
        needed = ((lat_cells // 16) + 1) * 16
        new_max = lat_min + (needed * resolution)
        print(f"❌ Latitude cells {lat_cells} not divisible by 16")
        print(f"   Try lat_max={new_max:.4f} for {needed} cells")

    if lon_cells % 16 != 0:
        valid = False
        needed = ((lon_cells // 16) + 1) * 16
        new_max = lon_min + (needed * resolution)
        print(f"❌ Longitude cells {lon_cells} not divisible by 16")
        print(f"   Try lon_max={new_max:.4f} for {needed} cells")

    if valid:
        print("✅ Grid valid!")

    return GridSummary(
        lat_cells=lat_cells,
        lon_cells=lon_cells,
        lat_patches=lat_patches,
        lon_patches=lon_patches,
        total_points=total_points,
        valid=valid,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lat-min", type=float, required=True)
    parser.add_argument("--lat-max", type=float, required=True)
    parser.add_argument("--lon-min", type=float, required=True)
    parser.add_argument("--lon-max", type=float, required=True)
    parser.add_argument(
        "--resolution",
        type=float,
        default=0.25,
        help="Grid resolution in degrees (default: 0.25)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    summary = validate_grid(
        lat_min=args.lat_min,
        lat_max=args.lat_max,
        lon_min=args.lon_min,
        lon_max=args.lon_max,
        resolution=args.resolution,
    )
    if not summary.valid:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
