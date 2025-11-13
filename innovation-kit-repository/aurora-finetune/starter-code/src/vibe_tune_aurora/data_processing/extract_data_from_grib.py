"""Extract training data from ERA5 GRIB files for Aurora fine-tuning."""

from datetime import datetime
from pathlib import Path

import numpy as np
import pygrib
import torch
from aurora import Batch, Metadata

from vibe_tune_aurora.types import SupervisedTrainingDataPair


def _crop_to_patch_size(tensor: torch.Tensor, patch_size: int) -> torch.Tensor:
    """
    Crop tensor spatial dimensions to be multiples of patch_size.
    Specifically, it takes the largest multiple of patch_size for both height and width dimensions
    of the tensor, and crops the tensor to match those new heights and widths, so that the resultant
    tensor will be evenly divisible into patches.

    Args:
        tensor: Input tensor with spatial dimensions at the end (e.g., [..., height, width])
        patch_size: Patch size to make dimensions compatible with

    Returns:
        Cropped tensor with spatial dimensions as multiples of patch_size
    """
    if len(tensor.shape) < 2:
        return tensor

    height, width = tensor.shape[-2:]
    new_height = (height // patch_size) * patch_size
    new_width = (width // patch_size) * patch_size

    if new_height == height and new_width == width:
        return tensor

    # Crop based on tensor dimensionality
    if len(tensor.shape) == 2:  # (height, width)
        return tensor[:new_height, :new_width]
    elif len(tensor.shape) == 4:  # (batch, time, height, width)
        return tensor[:, :, :new_height, :new_width]
    elif len(tensor.shape) == 5:  # (batch, time, levels, height, width)
        return tensor[:, :, :, :new_height, :new_width]

    return tensor


def extract_raw_data_from_grib_files(
    single_level_file: Path,
    pressure_level_file: Path,
) -> dict[str, dict | list | np.ndarray]:
    """
    Load ERA5 GRIB files into structured dictionaries.

    Args:
        single_level_file: Path to single-level GRIB file
        pressure_level_file: Path to pressure-level GRIB file

    Returns:
        Dict with keys:
        - surf_data: Dict mapping variable name -> time -> 2D array
        - atmos_data: Dict mapping variable name -> (time, pressure) -> 2D array
        - sorted_times: List of datetime objects in chronological order
        - lats: 2D coordinate array for latitudes
        - lons: 2D coordinate array for longitudes
        - pressure_levels: List of pressure levels in descending order (high to low)
    """
    if not single_level_file.exists():
        raise FileNotFoundError(f"Single-level file not found: {single_level_file}")
    if not pressure_level_file.exists():
        raise FileNotFoundError(f"Pressure-level file not found: {pressure_level_file}")

    surf_data: dict[str, dict[datetime, np.ndarray]] = {}
    atmos_data: dict[str, dict[tuple[datetime, int], np.ndarray]] = {}
    times: set[datetime] = set()
    pressure_levels: set[int] = set()
    lats: np.ndarray | None = None
    lons: np.ndarray | None = None

    # Load single-level data
    print(f"Loading single-level GRIB: {single_level_file}")
    grbs_surf = pygrib.open(str(single_level_file))
    for grb in grbs_surf:
        param_name = grb.shortName
        valid_time = grb.validDate
        times.add(valid_time)

        if lats is None:
            lats, lons = grb.latlons()

        if param_name not in surf_data:
            surf_data[param_name] = {}
        surf_data[param_name][valid_time] = grb.values

    grbs_surf.close()

    # Load pressure-level data
    print(f"Loading pressure-level GRIB: {pressure_level_file}")
    grbs_atmos = pygrib.open(str(pressure_level_file))
    for grb in grbs_atmos:
        param_name = grb.shortName
        valid_time = grb.validDate
        pressure_level = grb.level
        times.add(valid_time)
        pressure_levels.add(pressure_level)

        if param_name not in atmos_data:
            atmos_data[param_name] = {}

        atmos_data[param_name][(valid_time, pressure_level)] = grb.values

    grbs_atmos.close()

    sorted_times = sorted(times)
    sorted_pressure_levels = sorted(pressure_levels, reverse=True)

    print(f"Loaded {len(sorted_times)} timesteps from {sorted_times[0]} to {sorted_times[-1]}")
    print(f"Surface variables: {sorted(surf_data.keys())}")
    print(f"Atmospheric variables: {sorted(atmos_data.keys())}")
    print(f"Pressure levels: {sorted_pressure_levels}")

    if lats is None or lons is None:
        raise ValueError("Failed to extract lat/lon coordinates from GRIB files")

    return {
        "surf_data": surf_data,
        "atmos_data": atmos_data,
        "sorted_times": sorted_times,
        "lats": lats,
        "lons": lons,
        "pressure_levels": sorted_pressure_levels,
    }


def _create_batch(
    surf_data: dict[str, dict[datetime, np.ndarray]],
    atmos_data: dict[str, dict[tuple[datetime, int], np.ndarray]],
    timesteps: list[datetime],
    lats: np.ndarray,
    lons: np.ndarray,
    pressure_levels: list[int],
    current_time: datetime,
    patch_size: int,
) -> Batch:
    """
    Create Aurora Batch from specified timesteps.

    Args:
        surf_data: Surface variable data dict: Dict mapping variable name -> time -> 2D array
        atmos_data: Atmospheric variable data dict: Dict mapping variable name ->
            (time, pressure) -> 2D array
        timesteps: List of timesteps to include in batch
        lats: Latitude coordinates (2D array)
        lons: Longitude coordinates (2D array)
        pressure_levels: List of pressure levels
        current_time: Current timestep for metadata
        patch_size: Patch size for cropping

    Returns:
        Aurora Batch object with cropped dimensions
    """
    height, width = lats.shape
    surf_vars: dict[str, torch.Tensor] = {}
    static_vars: dict[str, torch.Tensor] = {}
    atmos_vars: dict[str, torch.Tensor] = {}

    # Surface variables to extract
    surf_var_names = {
        "2t": "2t",  # 2-meter temperature
        "10u": "10u",  # 10-meter u-wind
        "10v": "10v",  # 10-meter v-wind
        "msl": "msl",  # Mean sea level pressure
    }

    # Extract surface variables
    for aurora_name, grib_name in surf_var_names.items():
        if grib_name not in surf_data:
            raise ValueError(f"Required surface variable '{grib_name}' not found in GRIB data")

        data_tensor = torch.zeros(1, len(timesteps), height, width)
        for t_idx, time in enumerate(timesteps):
            if time not in surf_data[grib_name]:
                raise ValueError(f"Missing timestep {time} for variable '{grib_name}'")
            data_tensor[0, t_idx, :, :] = torch.from_numpy(surf_data[grib_name][time])

        surf_vars[aurora_name] = data_tensor

    # Static variables (land-sea mask, geopotential, soil type)
    static_var_names = {"lsm": "lsm", "z": "z", "slt": "slt"}

    for aurora_name, grib_name in static_var_names.items():
        if grib_name in surf_data:
            # Use first available timestep
            for time in timesteps:
                if time in surf_data[grib_name]:
                    static_vars[aurora_name] = torch.from_numpy(surf_data[grib_name][time])
                    break

    # Atmospheric variables
    atmos_var_names = {
        "t": "t",  # Temperature
        "u": "u",  # Eastward wind
        "v": "v",  # Northward wind
        "q": "q",  # Specific humidity
        "z": "z",  # Geopotential
    }

    for aurora_name, grib_name in atmos_var_names.items():
        if grib_name not in atmos_data:
            raise ValueError(f"Required atmospheric variable '{grib_name}' not found in GRIB data")

        data_tensor = torch.zeros(1, len(timesteps), len(pressure_levels), height, width)
        for t_idx, time in enumerate(timesteps):
            for p_idx, pressure in enumerate(pressure_levels):
                key = (time, pressure)
                if key not in atmos_data[grib_name]:
                    raise ValueError(
                        f"Missing timestep {time} at pressure {pressure} for variable '{grib_name}'"
                    )
                data_tensor[0, t_idx, p_idx, :, :] = torch.from_numpy(atmos_data[grib_name][key])

        atmos_vars[aurora_name] = data_tensor

    # Crop all variables to patch-compatible size
    for var_name in surf_vars:
        surf_vars[var_name] = _crop_to_patch_size(surf_vars[var_name], patch_size)

    for var_name in static_vars:
        static_vars[var_name] = _crop_to_patch_size(static_vars[var_name], patch_size)

    for var_name in atmos_vars:
        atmos_vars[var_name] = _crop_to_patch_size(atmos_vars[var_name], patch_size)

    # Crop coordinates to match data
    if len(surf_vars) > 0:
        sample_var = next(iter(surf_vars.values()))
        new_height, new_width = sample_var.shape[-2:]
        lats = lats[:new_height, :new_width]
        lons = lons[:new_height, :new_width]

    # Create metadata with proper coordinate ordering
    lat_1d = torch.from_numpy(lats[:, 0])  # First column
    # If data shows increasing latitudes, reverse it because a larger latitude index in the matrix
    # (tensor) should correspond to lower latitude value
    if lat_1d[0] < lat_1d[-1]:
        lat_1d = torch.flip(lat_1d, [0])
        # Flip all data arrays
        for key in surf_vars:
            surf_vars[key] = torch.flip(surf_vars[key], [2])
        for key in static_vars:
            static_vars[key] = torch.flip(static_vars[key], [0])
        for key in atmos_vars:
            atmos_vars[key] = torch.flip(atmos_vars[key], [3])

    lon_1d = torch.from_numpy(lons[0, :])  # First row
    if lon_1d.min() < 0:  # Convert [-180, 180] to [0, 360)
        lon_1d = torch.where(lon_1d < 0, lon_1d + 360, lon_1d)

    metadata = Metadata(
        lat=lat_1d,
        lon=lon_1d,
        time=(current_time,),
        atmos_levels=tuple(pressure_levels),
    )

    return Batch(
        surf_vars=surf_vars,
        static_vars=static_vars,
        atmos_vars=atmos_vars,
        metadata=metadata,
    )


def _generate_training_pairs(
    surf_data: dict[str, dict[datetime, np.ndarray]],
    atmos_data: dict[str, dict[tuple[datetime, int], np.ndarray]],
    sorted_times: list[datetime],
    lats: np.ndarray,
    lons: np.ndarray,
    pressure_levels: list[int],
    patch_size: int,
    skip_first_n_timesteps: int,
) -> list[SupervisedTrainingDataPair]:
    """
    Generate training pairs from timesteps.

    Each training pair consists of:
    - Input batch: 2 consecutive timesteps [t-1, t]
    - Target batch: 1 next timestep [t+1]

    Args:
        surf_data: Surface variable data dict
        atmos_data: Atmospheric variable data dict
        sorted_times: Sorted list of timesteps
        lats: Latitude coordinates
        lons: Longitude coordinates
        pressure_levels: List of pressure levels
        patch_size: Patch size for cropping
        skip_first_n_timesteps: Number of initial timesteps to skip

    Returns:
        List of SupervisedTrainingDataPair objects with input_batch and target_batch
    """
    # Skip first N timesteps if requested
    if skip_first_n_timesteps > 0:
        if skip_first_n_timesteps >= len(sorted_times):
            raise ValueError(
                f"Cannot skip {skip_first_n_timesteps} timesteps from {len(sorted_times)} total"
            )
        print(f"Skipping first {skip_first_n_timesteps} timesteps")
        sorted_times = sorted_times[skip_first_n_timesteps:]

    n_timesteps = len(sorted_times)
    n_pairs = n_timesteps - 2  # Need 3 consecutive timesteps per pair

    if n_pairs <= 0:
        raise ValueError(f"Need at least 3 timesteps to create training pairs, got {n_timesteps}")

    print(f"Generating {n_pairs} training pairs from {n_timesteps} timesteps")

    training_pairs = []

    for i in range(1, n_timesteps - 1):
        prev_time = sorted_times[i - 1]
        curr_time = sorted_times[i]
        next_time = sorted_times[i + 1]

        # Input batch: [previous, current]
        input_batch = _create_batch(
            surf_data,
            atmos_data,
            [prev_time, curr_time],
            lats,
            lons,
            pressure_levels,
            curr_time,
            patch_size,
        )

        # Target batch: [next]
        target_batch = _create_batch(
            surf_data,
            atmos_data,
            [next_time],
            lats,
            lons,
            pressure_levels,
            next_time,
            patch_size,
        )

        training_pairs.append(
            SupervisedTrainingDataPair(
                input_batch=input_batch,
                target_batch=target_batch,
            )
        )

    return training_pairs


def extract_training_data_from_grib(
    single_level_file: Path,
    pressure_level_file: Path,
    patch_size: int = 4,
    skip_first_n_timesteps: int = 0,
) -> list[SupervisedTrainingDataPair]:
    """
    Extract training data from ERA5 GRIB files.

    This function:
    1. Loads ERA5 single-level and pressure-level GRIB files
    2. Generates training pairs (input/target batches) from consecutive timesteps
    3. Crops spatial dimensions to be compatible with specified patch size

    Args:
        single_level_file: Path to ERA5 single-level GRIB file
        pressure_level_file: Path to ERA5 pressure-level GRIB file
        patch_size: Patch size for Aurora model (spatial dimensions will be cropped
                   to multiples of this value). Default: 4
        skip_first_n_timesteps: Number of initial timesteps to skip before creating
                               training pairs. Default: 0

    Returns:
        List of SupervisedTrainingDataPair objects. Each pair contains input_batch
        and target_batch Aurora Batch objects.

    Raises:
        FileNotFoundError: If GRIB files don't exist
        ValueError: If invalid parameters or insufficient data
    """
    print("=== Extracting Training Data from GRIB ===")
    print(f"Single-level file: {single_level_file}")
    print(f"Pressure-level file: {pressure_level_file}")
    print(f"Patch size: {patch_size}")
    print(f"Skip first N timesteps: {skip_first_n_timesteps}")

    # Load GRIB files
    grib_data = extract_raw_data_from_grib_files(
        single_level_file,
        pressure_level_file,
    )
    surf_data = grib_data["surf_data"]
    atmos_data = grib_data["atmos_data"]
    sorted_times = grib_data["sorted_times"]
    lats = grib_data["lats"]
    lons = grib_data["lons"]
    pressure_levels = grib_data["pressure_levels"]

    # Generate training pairs
    data_pairs = _generate_training_pairs(
        surf_data,
        atmos_data,
        sorted_times,
        lats,
        lons,
        pressure_levels,
        patch_size,
        skip_first_n_timesteps,
    )

    print(f"\nGenerated {len(data_pairs)} training pairs")

    return data_pairs
