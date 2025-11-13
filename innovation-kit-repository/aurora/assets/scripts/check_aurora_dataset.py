#!/usr/bin/env python3
"""Inspect ERA5/Climate Data Store NetCDF files for Aurora compatibility."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict, Tuple

REQUIRED_SURFACE = ("u10", "v10", "t2m", "msl")
OPTIONAL_STATIC = ("lsm", "z", "slt")
OPTIONAL_ATMOS = ("t", "u", "v", "q", "z")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check that NetCDF files contain the variables Aurora expects."
    )
    parser.add_argument(
        "--data-dir",
        default=str(Path.cwd() / "data"),
        help="Directory containing NetCDF files (default: ./data relative to CWD).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of sample variables to display per file (default: 5).",
    )
    return parser.parse_args()


def ensure_packages() -> None:
    import importlib

    try:
        importlib.import_module("numpy")
        print("✓ numpy available")
    except ImportError as exc:  # pragma: no cover - guidance path
        print("✗ numpy not available. Install with: pip install numpy")
        raise SystemExit(1) from exc

    try:
        importlib.import_module("xarray")
        print("✓ xarray available")
    except ImportError as exc:
        print("✗ xarray not available. Install with: pip install xarray netcdf4")
        raise SystemExit(1) from exc

    try:
        importlib.import_module("h5py")
        print("✓ h5py available (optional)")
    except ImportError:
        print("⚠ h5py not installed. Install with: pip install h5py (optional)")


def list_files(data_dir: Path) -> Tuple[Path, ...]:
    nc_files = tuple(sorted(data_dir.glob("*.nc")))
    print(f"\n[Step 1] Found {len(nc_files)} NetCDF file(s) in {data_dir}:")
    for path in nc_files:
        size_mb = path.stat().st_size / 1e6
        print(f"  • {path.name} ({size_mb:.1f} MB)")
    if not nc_files:
        print("ERROR: no .nc files discovered. Confirm the download path.")
        raise SystemExit(1)
    return nc_files


def describe_dataset(path: Path, limit: int) -> Dict[str, Any]:
    import importlib

    xr = importlib.import_module("xarray")

    summary: Dict[str, Any] = {}
    ds = xr.open_dataset(path, engine="netcdf4")
    summary[path.name] = ds

    print(f"\nFile: {path.name}")
    print("-" * 70)
    print(f"Dimensions: {dict(ds.dims)}")
    print(f"Data variables: {list(ds.data_vars.keys())}")
    print(f"Coordinates: {list(ds.coords.keys())}")

    print("\nVariable samples:")
    for var_name in list(ds.data_vars.keys())[:limit]:
        var = ds[var_name]
        print(f"  {var_name:20s} {str(var.shape):30s} {var.dtype}")

    print("\nAurora compatibility check:")
    for label, expected in (
        ("surface", REQUIRED_SURFACE),
        ("static", OPTIONAL_STATIC),
        ("atmospheric", OPTIONAL_ATMOS),
    ):
        present = [v for v in expected if v in ds.data_vars]
        print(f"  {label:15s}: {present}")

    if "u10" in ds and "v10" in ds:
        selector = {}
        if "time" in ds.dims:
            selector["time"] = 0
        if "latitude" in ds.dims:
            selector["latitude"] = 0
        if "lat" in ds.dims and "latitude" not in ds.dims:
            selector["lat"] = 0
        if "longitude" in ds.dims:
            selector["longitude"] = 0
        if "lon" in ds.dims and "longitude" not in ds.dims:
            selector["lon"] = 0
        u10_cell = ds["u10"].isel(**selector).values
        v10_cell = ds["v10"].isel(**selector).values
        try:
            u10_sample = float(u10_cell)
            v10_sample = float(v10_cell)
            wind_speed = (u10_sample**2 + v10_sample**2) ** 0.5
            print(f"\nSample wind magnitude (first cell): {wind_speed:.2f} m/s")
        except TypeError:
            print("⚠ Unable to compute wind magnitude for preview cell.")

    return summary


def attempt_batch(summary: Dict[str, Any]) -> None:
    import importlib

    np = importlib.import_module("numpy")
    torch = importlib.import_module("torch")
    aurora = importlib.import_module("aurora")
    Batch = getattr(aurora, "Batch")
    Metadata = getattr(aurora, "Metadata")

    if not summary:
        print("No datasets were opened; skipping batch construction test.")
        return

    ds = next(iter(summary.values()))
    missing = [key for key in REQUIRED_SURFACE if key not in ds.data_vars]
    if missing:
        print(f"Skipping batch construction; missing surface vars: {missing}")
        return

    print("\n[Step 4] Testing Aurora Batch construction:")

    surf_vars = {}
    for key in REQUIRED_SURFACE:
        data = ds[key].values.astype("float32")
        if data.ndim == 2:
            data = data[np.newaxis, np.newaxis, :, :]
        elif data.ndim == 3:
            data = data[np.newaxis, :, :, :]
        surf_vars[key] = torch.from_numpy(data)
        print(f"  {key}: {surf_vars[key].shape}")

    lat_coord = None
    for candidate in ("latitude", "lat"):
        if candidate in ds:
            lat_coord = torch.from_numpy(ds[candidate].values.astype("float32"))
            break
    lon_coord = None
    for candidate in ("longitude", "lon"):
        if candidate in ds:
            lon_coord = torch.from_numpy(ds[candidate].values.astype("float32"))
            break

    if lat_coord is None or lon_coord is None:
        print("⚠ Missing latitude/longitude coordinates; generated dummy grid.")
        spatial_shape = surf_vars["u10"].shape[-2:]
        lat_coord = torch.linspace(90.0, -90.0, spatial_shape[0])
        lon_coord = torch.linspace(0.0, 360.0, spatial_shape[1], endpoint=False)

    metadata_kwargs = {
        "lat": lat_coord,
        "lon": lon_coord,
        "time": tuple(),
        "atmos_levels": tuple(),
    }

    batch = Batch(
        surf_vars={
            "u10": surf_vars["u10"],
            "v10": surf_vars["v10"],
            "t2m": surf_vars["t2m"],
            "msl": surf_vars["msl"],
        },
        static_vars={},
        atmos_vars={},
        metadata=Metadata(**metadata_kwargs),
    )
    print("\n✓ Aurora Batch created successfully:")
    print(f"  shape: {batch.surf_vars['u10'].shape}")


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir).expanduser().resolve()

    print("=" * 70)
    print("AURORA DATASET CHECKER")
    print("=" * 70)

    ensure_packages()
    if not data_dir.exists():
        print(f"ERROR: data directory does not exist: {data_dir}")
        raise SystemExit(1)

    nc_files = list_files(data_dir)
    datasets: Dict[str, Any] = {}
    for path in nc_files:
        datasets.update(describe_dataset(path, limit=args.limit))

    try:
        attempt_batch(datasets)
    finally:
        for ds in datasets.values():
            ds.close()

    print("\nInspection complete — see notes above for next steps.")


if __name__ == "__main__":
    main()
