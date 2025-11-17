#!/usr/bin/env python3
"""Interactive script to set up Aurora for a new region."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def validate_bounds(lat_min, lat_max, lon_min, lon_max):
    """Validate and adjust bounds to Aurora requirements (divisible by 16)."""
    lat_range = lat_max - lat_min
    lon_range = lon_max - lon_min

    lat_cells = int(lat_range / 0.25)
    lon_cells = int(lon_range / 0.25)

    # Snap to nearest 16-divisible grid
    lat_cells_adj = ((lat_cells + 15) // 16) * 16
    lon_cells_adj = ((lon_cells + 15) // 16) * 16

    lat_max_adj = lat_min + (lat_cells_adj * 0.25)
    lon_max_adj = lon_min + (lon_cells_adj * 0.25)

    return lat_min, lat_max_adj, lon_min, lon_max_adj, lat_cells_adj, lon_cells_adj


def copy_template(
    region_slug, region_name, lat_min, lat_max, lon_min, lon_max, lat_cells, lon_cells
):
    """Copy Norway example and adapt for new region."""
    script_dir = Path(__file__).parent
    norway_dir = script_dir.parent / "norway-example"
    region_dir = script_dir.parent / f"{region_slug}-example"

    if region_dir.exists():
        print(f"\nWarning: {region_dir} already exists.")
        response = input("Overwrite? (y/n): ").lower()
        if response != "y":
            print("Cancelled.")
            sys.exit(0)
        shutil.rmtree(region_dir)

    print(f"\nCopying template to {region_slug}-example...")
    shutil.copytree(norway_dir, region_dir)

    # Clean up Norway-specific files
    for f in (region_dir / "data").glob("norway_*"):
        f.unlink()
    for f in (region_dir / "frontend" / "src" / "data").glob("*.ts"):
        f.unlink()

    # Update App.tsx with new bounds
    app_tsx = region_dir / "frontend" / "src" / "App.tsx"
    content = app_tsx.read_text()

    # Calculate center
    center_lat = (lat_min + lat_max) / 2
    center_lon = (lon_min + lon_max) / 2

    # Replace bounds and center (works from Norway template)
    bounds_var_name = region_slug.replace("-", "") + "Bounds"
    content = content.replace(
        "const norwayBounds: [[number, number], [number, number]] = [\n  [57, 4],\n  [72.75, 31.75],\n];",
        f"const {bounds_var_name}: [[number, number], [number, number]] = [\n  [{lat_min}, {lon_min}],\n  [{lat_max}, {lon_max}],\n];",
    )
    content = content.replace(
        "const mapCenter: [number, number] = [64.875, 17.875];",
        f"const mapCenter: [number, number] = [{center_lat:.2f}, {center_lon:.2f}];",
    )
    # Replace variable name references in MapContainer bounds props
    content = content.replace("bounds={norwayBounds}", f"bounds={{{bounds_var_name}}}")
    content = content.replace(
        "maxBounds={norwayBounds}", f"maxBounds={{{bounds_var_name}}}"
    )
    # Replace region name strings
    content = content.replace("Norway", region_name)
    content = content.replace("norway", region_slug.replace("-", ""))

    # Replace subtitle with region-specific grid dimensions
    content = content.replace(
        "Learn to use Aurora&apos;s weather forecasting AI. Start with ERA5\n            observations, run your first inference, and visualize\n            predictions—all in one interactive prototype covering Norway&apos;s\n            mainland (64×112 grid, 6-hour steps).",
        f"Learn to use Aurora&apos;s weather forecasting AI. Start with ERA5\n            observations, run your first inference, and visualize\n            predictions—all in one interactive prototype covering {region_name}\n            ({lat_cells}×{lon_cells} grid, 6-hour steps).",
    )

    app_tsx.write_text(content)

    return region_dir


def download_data(region_dir, region_slug, lat_min, lat_max, lon_min, lon_max):
    """Download ERA5 data for the region."""
    script_dir = Path(__file__).parent
    download_script = script_dir / "download_era5_subset.py"
    data_dir = region_dir / "data"

    print("\nDownloading ERA5 data (this may take 5-10 minutes)...")

    # Surface data
    print("\n[1/3] Surface variables...")
    subprocess.run(
        [
            sys.executable,
            str(download_script),
            "--dataset",
            "reanalysis-era5-single-levels",
            "--variables",
            "2m_temperature",
            "10m_u_component_of_wind",
            "10m_v_component_of_wind",
            "mean_sea_level_pressure",
            "--year",
            "2025",
            "--month",
            "06",
            "--days",
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "--hours",
            "00",
            "06",
            "12",
            "18",
            "--area",
            str(lat_max),
            str(lon_min),
            str(lat_min),
            str(lon_max),
            "--target",
            str(data_dir / f"{region_slug}_surface.nc"),
        ],
        check=True,
    )

    # Atmospheric data
    print("\n[2/3] Atmospheric variables...")
    subprocess.run(
        [
            sys.executable,
            str(download_script),
            "--dataset",
            "reanalysis-era5-pressure-levels",
            "--variables",
            "geopotential",
            "specific_humidity",
            "temperature",
            "u_component_of_wind",
            "v_component_of_wind",
            "--levels",
            "1000",
            "925",
            "850",
            "700",
            "--year",
            "2025",
            "--month",
            "06",
            "--days",
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "--hours",
            "00",
            "06",
            "12",
            "18",
            "--area",
            str(lat_max),
            str(lon_min),
            str(lat_min),
            str(lon_max),
            "--target",
            str(data_dir / f"{region_slug}_atmospheric.nc"),
        ],
        check=True,
    )

    # Static data
    print("\n[3/3] Static variables...")
    subprocess.run(
        [
            sys.executable,
            str(download_script),
            "--dataset",
            "reanalysis-era5-single-levels",
            "--variables",
            "geopotential",
            "land_sea_mask",
            "soil_type",
            "--year",
            "2025",
            "--month",
            "06",
            "--days",
            "01",
            "--hours",
            "00",
            "--area",
            str(lat_max),
            str(lon_min),
            str(lat_min),
            str(lon_max),
            "--target",
            str(data_dir / f"{region_slug}_static.nc"),
        ],
        check=True,
    )


def generate_frontend_data(region_dir, region_slug, region_name):
    """Generate TypeScript modules from downloaded data."""
    print("\nGenerating frontend visualization...")

    build_script = region_dir / "scripts" / "build_forecast_module.py"
    data_dir = region_dir / "data"
    frontend_data = region_dir / "frontend" / "src" / "data"

    subprocess.run(
        [
            sys.executable,
            str(build_script),
            str(data_dir / f"{region_slug}_surface.nc"),
            "--output",
            str(frontend_data / "auroraForecast.ts"),
            "--region-name",
            f"{region_name} ERA5: June 1-7, 2025",
            "--max-steps",
            "28",
        ],
        check=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Set up Aurora for a new region")
    parser.add_argument(
        "--name", required=True, help="Region name (e.g., 'California')"
    )
    parser.add_argument(
        "--lat-min", type=float, required=True, help="Southern latitude"
    )
    parser.add_argument(
        "--lat-max", type=float, required=True, help="Northern latitude"
    )
    parser.add_argument(
        "--lon-min", type=float, required=True, help="Western longitude"
    )
    parser.add_argument(
        "--lon-max", type=float, required=True, help="Eastern longitude"
    )
    parser.add_argument(
        "--skip-download", action="store_true", help="Skip data download"
    )

    args = parser.parse_args()

    region_name = args.name
    region_slug = region_name.lower().replace(" ", "-")

    print(f"\nAurora Region Setup: {region_name}")
    print("=" * 60)

    # Validate and adjust bounds
    lat_min, lat_max, lon_min, lon_max, lat_cells, lon_cells = validate_bounds(
        args.lat_min, args.lat_max, args.lon_min, args.lon_max
    )

    print(
        f"\nAdjusted grid to {lat_cells}x{lon_cells} (Aurora requires multiples of 16)"
    )
    print(f"Coverage: {lat_min}N to {lat_max}N, {lon_min}E to {lon_max}E")
    print()

    # Copy and adapt template
    region_dir = copy_template(
        region_slug,
        region_name,
        lat_min,
        lat_max,
        lon_min,
        lon_max,
        lat_cells,
        lon_cells,
    )

    # Download data
    if not args.skip_download:
        download_data(region_dir, region_slug, lat_min, lat_max, lon_min, lon_max)
        generate_frontend_data(region_dir, region_slug, region_name)

    print(f"\nSetup complete! Your {region_name} prototype is ready.")
    print("\nNext steps:")
    print(f"  cd {region_dir}/frontend")
    print("  npm install && npm run dev")
    print("\nThen open http://localhost:5174")


if __name__ == "__main__":
    main()
