#!/usr/bin/env python3
"""Shallow NetCDF inspection without heavy dependencies."""

from __future__ import annotations

import argparse
from pathlib import Path

AURORA_VARS = {"u10", "v10", "t2m", "msl", "u", "v", "t", "q", "z"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lightweight NetCDF lister")
    parser.add_argument(
        "--data-dir",
        default=str(Path.cwd() / "data"),
        help="Directory containing NetCDF files (default: ./data)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir).expanduser().resolve()

    if not data_dir.exists():
        print(f"❌ Data directory not found: {data_dir}")
        raise SystemExit(1)

    nc_files = sorted(data_dir.glob("*.nc"))
    if not nc_files:
        print(f"❌ No .nc files found in {data_dir}")
        raise SystemExit(1)

    print(f"✓ Found {len(nc_files)} NetCDF file(s):")
    for path in nc_files:
        print(f"  • {path.name} ({path.stat().st_size / 1e6:.1f} MB)")

    try:
        import importlib

        netcdf4 = importlib.import_module("netCDF4")
    except ImportError:
        print("⚠ netCDF4 not installed (pip install netcdf4). File presence verified.")
        return

    for path in nc_files:
        print(f"\nFile: {path.name}")
        with netcdf4.Dataset(path, "r") as ds:  # type: ignore[attr-defined]
            dims = {name: len(dim) for name, dim in ds.dimensions.items()}
            vars_available = list(ds.variables.keys())
            aurora_overlap = sorted(AURORA_VARS & set(vars_available))

            print(f"  Dimensions: {dims}")
            print(f"  Variables: {vars_available}")
            if aurora_overlap:
                print(f"  ✓ Aurora-aligned variables: {aurora_overlap}")
            else:
                print("  ⚠ No standard Aurora variables detected")


if __name__ == "__main__":
    main()
