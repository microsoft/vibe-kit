#!/usr/bin/env python3
"""Run Aurora inference for June 8 forecast using last 2 CDS timesteps as input."""

from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import xarray as xr
from aurora import Aurora, Batch, Metadata, rollout

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SPATIAL_PATCH_SIZE = 16  # Aurora requirement - dimensions must be divisible by 16


def load_era5_input(surf_path: Path, atmos_path: Path, static_path: Path) -> Batch:
    """Load last 2 timesteps from ERA5 files as Aurora input."""

    print(f"Loading surface variables from: {surf_path.name}")
    ds_surf = xr.open_dataset(surf_path)

    print(f"Loading atmospheric variables from: {atmos_path.name}")
    ds_atmos = xr.open_dataset(atmos_path)

    print(f"Loading static variables from: {static_path.name}")
    ds_static = xr.open_dataset(static_path)

    # Get last 2 timesteps (indices -2, -1)
    time_indices = slice(-2, None)

    print("\nUsing timesteps:")
    print(f"  {ds_surf['valid_time'].isel(valid_time=-2).values}")
    print(f"  {ds_surf['valid_time'].isel(valid_time=-1).values}")

    # Extract SURFACE variables (File 1)
    print("\nExtracting surface variables...")
    surf_vars = {}
    for key, var_name in [
        ("10u", "u10"),
        ("10v", "v10"),
        ("2t", "t2m"),
        ("msl", "msl"),
    ]:
        data = ds_surf[var_name].isel(valid_time=time_indices).values.astype(np.float32)
        # Shape: (2, lat, lon) -> need (1, 2, lat, lon) - batch dimension FIRST
        if data.ndim == 3:
            data = data[np.newaxis, :, :, :]
        surf_vars[key] = torch.from_numpy(data)
        print(f"  {key}: {surf_vars[key].shape}")

    # Extract STATIC variables (separate file) - no time dimension
    print("\nExtracting static variables...")
    static_vars = {}
    for key, var_name in [("lsm", "lsm"), ("z", "z"), ("slt", "slt")]:
        data = ds_static[var_name].values.astype(np.float32)
        # Remove any extra dimensions
        if data.ndim == 3:
            data = data[0, :, :]  # Take first time/batch if present
        elif data.ndim == 4:
            data = data[0, 0, :, :]
        static_vars[key] = torch.from_numpy(data)
        print(f"  {key}: {static_vars[key].shape}")

    # Extract ATMOSPHERIC variables (File 2)
    print("\nExtracting atmospheric variables...")
    atmos_vars = {}
    for key in ["z", "q", "t", "u", "v"]:
        if key in ds_atmos:
            data = ds_atmos[key].isel(valid_time=time_indices).values.astype(np.float32)
            # Shape: (2, 4_levels, lat, lon) -> need (1, 2, 4, lat, lon) - batch dimension FIRST
            if data.ndim == 4:
                data = data[np.newaxis, :, :, :, :]
            atmos_vars[key] = torch.from_numpy(data)
            print(f"  {key}: {atmos_vars[key].shape}")

    # Spatial cropping for Aurora patch size requirement
    lat_size, lon_size = surf_vars["2t"].shape[-2:]
    lat_crop = (lat_size // SPATIAL_PATCH_SIZE) * SPATIAL_PATCH_SIZE
    lon_crop = (lon_size // SPATIAL_PATCH_SIZE) * SPATIAL_PATCH_SIZE

    if lat_crop != lat_size or lon_crop != lon_size:
        print(
            f"\nCropping spatial dimensions: {lat_size}×{lon_size} → {lat_crop}×{lon_crop}"
        )

    # Apply cropping to all variables
    for key in surf_vars:
        surf_vars[key] = surf_vars[key][..., :lat_crop, :lon_crop]
    for key in static_vars:
        static_vars[key] = static_vars[key][:lat_crop, :lon_crop]
    for key in atmos_vars:
        atmos_vars[key] = atmos_vars[key][..., :lat_crop, :lon_crop]

    # Metadata
    lat = torch.from_numpy(ds_surf["latitude"].values[:lat_crop].astype(np.float32))
    lon_raw = ds_surf["longitude"].values[:lon_crop].astype(np.float32)
    # Convert negative longitudes to 0-360 range (Aurora requirement)
    lon_raw = np.where(lon_raw < 0, lon_raw + 360, lon_raw)
    lon = torch.from_numpy(lon_raw)

    # atmos_levels must be tuple of ints per official docs
    atmos_levels = tuple(int(level) for level in ds_atmos["pressure_level"].values)

    # Convert numpy.datetime64 to Python datetime
    # NOTE: time must be tuple with ONE element (the SECOND timestep) per Aurora docs
    times_np = ds_surf["valid_time"].isel(valid_time=time_indices).values
    second_time = datetime.utcfromtimestamp(
        int(times_np[1].astype("datetime64[ns]").astype(np.int64)) / 1e9
    )

    metadata = Metadata(
        lat=lat,
        lon=lon,
        time=(second_time,),  # Tuple with ONE element for batch size 1
        atmos_levels=atmos_levels,
    )

    batch = Batch(
        surf_vars=surf_vars,
        static_vars=static_vars,
        atmos_vars=atmos_vars,
        metadata=metadata,
    )

    ds_surf.close()
    ds_atmos.close()

    return batch


def run_forecast(input_batch: Batch, num_steps: int = 8) -> list[Batch]:
    """Run Aurora rollout for num_steps (28 = 7 days at 6hr intervals)."""
    print(f"\nLoading Aurora model on {DEVICE}...")
    print("Preparing model weights; the first run may download them from Hugging Face.")
    sys.stdout.flush()
    model = Aurora(use_lora=False)  # Pretrained version without LoRA
    model.load_checkpoint("microsoft/aurora", "aurora-0.25-pretrained.ckpt")
    model.eval()
    model = model.to(DEVICE)
    print("Model loaded successfully!")

    print(
        f"\nRunning {num_steps}-step forecast ({num_steps * 6} hours = {num_steps * 6 / 24:.1f} days)..."
    )
    print("This may take 5-10 minutes on GPU, longer on CPU...")

    with torch.inference_mode():
        predictions = [
            pred.to("cpu") for pred in rollout(model, input_batch, steps=num_steps)
        ]

    print("✓ Forecast complete!")
    return predictions


def save_forecast_netcdf(
    predictions: list[Batch], output_path: Path, base_time: np.datetime64
):
    """Save Aurora output as NetCDF."""
    print(f"\nSaving forecast to: {output_path}")

    # DEBUG: Check actual shape of predictions
    if predictions:
        first_shape = predictions[0].surf_vars["2t"].shape
        lat_dim, lon_dim = first_shape[-2], first_shape[-1]
        print(f"DEBUG: First prediction shape for '2t': {first_shape}")
        print(
            "DEBUG: Expected shape: (batch=1, time=1, "
            f"lat={lat_dim}, lon={lon_dim}) [cropped to multiples of {SPATIAL_PATCH_SIZE}]"
        )

    # Stack predictions along time dimension
    # Aurora rollout returns list of Batches, each with shape (batch, time=1, lat, lon)
    # Each prediction is a single new timestep (autoregressive rollout)
    # We want index [0, 0] = batch 0, timestep 0 (the single prediction)
    u10_list = [pred.surf_vars["10u"][0, 0].cpu().numpy() for pred in predictions]
    v10_list = [pred.surf_vars["10v"][0, 0].cpu().numpy() for pred in predictions]
    t2m_list = [pred.surf_vars["2t"][0, 0].cpu().numpy() for pred in predictions]
    msl_list = [pred.surf_vars["msl"][0, 0].cpu().numpy() for pred in predictions]

    lat_dim, lon_dim = t2m_list[0].shape
    print(f"DEBUG: Extracted array shape: (lat={lat_dim}, lon={lon_dim})")
    print(
        "DEBUG: Expected lat/lon dimensions derive from ERA5 input: "
        f"{lat_dim}×{lon_dim}"
    )
    print(
        f"DEBUG: Sample values: min={t2m_list[0].min():.2f}, max={t2m_list[0].max():.2f}, mean={t2m_list[0].mean():.2f}"
    )

    # Stack into time series
    u10 = np.stack(u10_list, axis=0)  # (time, lat, lon)
    v10 = np.stack(v10_list, axis=0)
    t2m = np.stack(t2m_list, axis=0)
    msl = np.stack(msl_list, axis=0)

    # Generate time coordinates (6-hour steps from base_time)
    num_steps = len(predictions)
    times = [base_time + np.timedelta64((i + 1) * 6, "h") for i in range(num_steps)]

    # Get spatial coordinates from first prediction
    first_pred = predictions[0]
    lats = first_pred.metadata.lat.cpu().numpy()
    lons = first_pred.metadata.lon.cpu().numpy()
    # Convert longitudes back to -180 to 180 range for visualization (Leaflet expects this)
    lons = np.where(lons > 180, lons - 360, lons)

    # Create xarray Dataset
    ds = xr.Dataset(
        {
            "u10": (["valid_time", "latitude", "longitude"], u10),
            "v10": (["valid_time", "latitude", "longitude"], v10),
            "t2m": (["valid_time", "latitude", "longitude"], t2m),
            "msl": (["valid_time", "latitude", "longitude"], msl),
        },
        coords={
            "latitude": lats,
            "longitude": lons,
            "valid_time": times,
        },
        attrs={
            "description": "Aurora forecast",
            "model": "AuroraSmallPretrained",
            "forecast_start": str(base_time),
            "num_steps": num_steps,
        },
    )

    # Add static variables as coordinates
    if "lsm" in first_pred.static_vars:
        ds["lsm"] = (
            ["latitude", "longitude"],
            first_pred.static_vars["lsm"].cpu().numpy(),
        )
    if "z" in first_pred.static_vars:
        ds["z"] = (["latitude", "longitude"], first_pred.static_vars["z"].cpu().numpy())
    if "slt" in first_pred.static_vars:
        ds["slt"] = (
            ["latitude", "longitude"],
            first_pred.static_vars["slt"].cpu().numpy(),
        )

    ds.to_netcdf(output_path)
    print(f"✓ Saved {output_path.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    import sys

    # Parse command-line arguments or use defaults
    if len(sys.argv) >= 9 and sys.argv[1] == "--surf":
        surf_nc = Path(sys.argv[2])
        atmos_nc = Path(sys.argv[4])  # after --atmos
        static_nc = Path(sys.argv[6])  # after --static
        output_nc = Path(sys.argv[8])  # after --output
    else:
        # Default paths (Norway example bundled data)
        surf_nc = Path("data/norway_surface.nc")
        atmos_nc = Path("data/norway_atmospheric.nc")
        static_nc = Path("data/norway_static.nc")
        output_nc = Path("data/norway_june8_forecast.nc")

    print("=" * 70)
    print("Aurora Inference: Norway Regional Forecast")
    print("=" * 70)
    print(f"\nDevice: {DEVICE}")
    print(
        "\nHang tight -- initializing Aurora dependencies. The first progress update can take several minutes or more, depending on your hardware."
    )
    sys.stdout.flush()

    # Load input data
    print("\n" + "=" * 70)
    print("PHASE 1: Loading ERA5 Input Data")
    print("=" * 70)
    batch = load_era5_input(surf_nc, atmos_nc, static_nc)

    print("\n✓ Input batch prepared:")
    print(f"  Surface vars: {batch.surf_vars['2t'].shape}")
    print(f"  Atmospheric vars: {batch.atmos_vars['t'].shape}")
    print(f"  Grid: {len(batch.metadata.lat)}×{len(batch.metadata.lon)}")
    print(f"  Pressure levels: {batch.metadata.atmos_levels}")

    # Run Aurora inference
    print("\n" + "=" * 70)
    print("PHASE 2: Running Aurora Forecast")
    print("=" * 70)
    forecast = run_forecast(batch, num_steps=4)

    # Save results
    print("\n" + "=" * 70)
    print("PHASE 3: Saving Results")
    print("=" * 70)
    # Convert Python datetime back to numpy.datetime64 for NetCDF
    base_time = np.datetime64(batch.metadata.time[-1])
    save_forecast_netcdf(forecast, output_nc, base_time)

    print("\n" + "=" * 70)
    print("✅ Aurora Inference Complete!")
    print("=" * 70)
    print(f"\nForecast output: {output_nc}")
    print(f"Time range: {base_time} + 4 steps (1 day)")
    print("\nNext step: Convert to TypeScript for visualization")
    print(f"  python3 scripts/build_forecast_module.py {output_nc} \\")
    print("    --output frontend/src/data/auroraForecastPredictions.ts \\")
    print("    --region-name 'Aurora Forecast: Norway June 8' \\")
    print("    --max-steps 4")
