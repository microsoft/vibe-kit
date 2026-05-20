"""Extract training data from ERA5 GRIB files for Aurora fine-tuning."""

from datetime import datetime
from pathlib import Path

import numpy as np
import pygrib
import torch
from aurora import Batch, Metadata

from vibe_tune_aurora.custom_types import SupervisedTrainingDataPair
from dataclasses import dataclass
from vibe_tune_aurora.defaults.default_configs import (
    DEFAULT_SURFACE_VARIABLE_NAMES,
    DEFAULT_STATIC_VARIABLE_NAMES,
    DEFAULT_ATMOSPHERIC_VARIABLE_NAMES,
)


@dataclass
class ExtractedGribDataObject:
    """
    Represents the data from grib file pair (single level data file + pressure level data file) in a
    python object
    """

    # The single level data contains both surface variable data and static variable data
    single_level_data: dict[str, dict[datetime, np.ndarray]]
    # The pressure level data contains the atmospheric variable data
    pressure_level_data: dict[str, dict[tuple[datetime, int], np.ndarray]]
    sorted_times: list[datetime]
    latitudes: np.ndarray
    longitudes: np.ndarray
    sorted_pressure_levels: list[int]


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


def extract_data_from_grib_files(
    single_level_data_file: Path,
    pressure_level_data_file: Path,
) -> ExtractedGribDataObject:
    """
    Load ERA5 GRIB files into structured data objects.

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
    if not single_level_data_file.exists():
        raise FileNotFoundError(f"Single-level file not found: {single_level_data_file}")
    if not pressure_level_data_file.exists():
        raise FileNotFoundError(f"Pressure-level file not found: {pressure_level_data_file}")

    single_level_data: dict[str, dict[datetime, np.ndarray]] = {}
    pressure_level_data: dict[str, dict[tuple[datetime, int], np.ndarray]] = {}
    times: set[datetime] = set()
    pressure_levels: set[int] = set()
    lats: np.ndarray | None = None
    lons: np.ndarray | None = None

    # Load single-level data
    print(f"Loading single-level GRIB: {single_level_data_file}")
    grib_items_single_level = pygrib.open(str(single_level_data_file))
    for grib_item in grib_items_single_level:
        param_name = grib_item.shortName
        valid_time = grib_item.validDate
        times.add(valid_time)

        if lats is None:
            lats, lons = grib_item.latlons()

        if param_name not in single_level_data:
            single_level_data[param_name] = {}
        single_level_data[param_name][valid_time] = grib_item.values

    grib_items_single_level.close()

    # Load pressure-level data
    print(f"Loading pressure-level GRIB: {pressure_level_data_file}")
    grib_items_pressure_level = pygrib.open(str(pressure_level_data_file))
    for grib_item in grib_items_pressure_level:
        param_name = grib_item.shortName
        valid_time = grib_item.validDate
        pressure_level = grib_item.level
        times.add(valid_time)
        pressure_levels.add(pressure_level)

        if param_name not in pressure_level_data:
            pressure_level_data[param_name] = {}

        pressure_level_data[param_name][(valid_time, pressure_level)] = grib_item.values

    grib_items_pressure_level.close()

    sorted_times = list(sorted(times))
    sorted_pressure_levels = list(sorted(pressure_levels, reverse=True))

    print(f"Loaded {len(sorted_times)} timesteps from {sorted_times[0]} to {sorted_times[-1]}")
    print(f"Surface variables: {sorted(single_level_data.keys())}")
    print(f"Atmospheric variables: {sorted(pressure_level_data.keys())}")
    print(f"Pressure levels: {sorted_pressure_levels}")

    if lats is None or lons is None:
        raise ValueError("Failed to extract lat/lon coordinates from GRIB files")

    return ExtractedGribDataObject(
        single_level_data=single_level_data,
        pressure_level_data=pressure_level_data,
        sorted_times=sorted_times,
        latitudes=lats,
        longitudes=lons,
        sorted_pressure_levels=sorted_pressure_levels,
    )


def _create_batch(
    single_level_data: dict[str, dict[datetime, np.ndarray]],
    pressure_level_data: dict[str, dict[tuple[datetime, int], np.ndarray]],
    timesteps: list[datetime],
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    sorted_pressure_levels: list[int],
    current_time: datetime,
    patch_size: int,
    additional_surface_variables: tuple[str] | None = None,
) -> Batch:
    """
    Create Aurora Batch from specified timesteps.
    Assumes grib variable names (e.g. "2t") are equivalent to the variable names in the
    the Aurora Batch objects.
    Assumes static variable data (e.g. land sea mask, etc) are in the single levels data file;
    we use the first timestep for simplicity since all time steps are assumed to be same.

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
        additional_surface_variables: Selected surface variables (beyond the defaults) to propagate
            into training dataset from grib files.

    Returns:
        Aurora Batch object with cropped dimensions
    """
    if additional_surface_variables is None:
        additional_surface_variables = tuple()

    height, width = latitudes.shape
    surf_vars: dict[str, torch.Tensor] = {}
    static_vars: dict[str, torch.Tensor] = {}
    atmos_vars: dict[str, torch.Tensor] = {}

    # Surface variables to extract
    surf_var_names = DEFAULT_SURFACE_VARIABLE_NAMES + additional_surface_variables

    # Extract surface variables
    for var_name in surf_var_names:
        if var_name not in single_level_data:
            raise ValueError(f"Required surface variable '{var_name}' not found in GRIB data")

        data_tensor = torch.zeros(1, len(timesteps), height, width)
        for t_idx, time in enumerate(timesteps):
            if time not in single_level_data[var_name]:
                raise ValueError(f"Missing timestep {time} for variable '{var_name}'")
            data_tensor[0, t_idx, :, :] = torch.from_numpy(single_level_data[var_name][time])

        surf_vars[var_name] = data_tensor

    # Static variables (e.g. land-sea mask, geopotential, soil type)
    for var_name in DEFAULT_STATIC_VARIABLE_NAMES:
        if var_name in single_level_data:
            # Use first available timestep, since assuming all time steps have same static var
            # data (by definition)
            for time in timesteps:
                if time in single_level_data[var_name]:
                    static_vars[var_name] = torch.from_numpy(single_level_data[var_name][time])
                    break

    # Atmospheric variables
    for var_name in DEFAULT_ATMOSPHERIC_VARIABLE_NAMES:
        if var_name not in pressure_level_data:
            raise ValueError(f"Required atmospheric variable '{var_name}' not found in GRIB data")

        data_tensor = torch.zeros(1, len(timesteps), len(sorted_pressure_levels), height, width)
        for t_idx, time in enumerate(timesteps):
            for p_idx, pressure in enumerate(sorted_pressure_levels):
                key = (time, pressure)
                if key not in pressure_level_data[var_name]:
                    raise ValueError(
                        f"Missing timestep {time} at pressure {pressure} for variable '{var_name}'"
                    )
                data_tensor[0, t_idx, p_idx, :, :] = torch.from_numpy(
                    pressure_level_data[var_name][key]
                )

        atmos_vars[var_name] = data_tensor

    # Crop all variables to patch-compatible size
    for var_name in surf_vars:
        surf_vars[var_name] = _crop_to_patch_size(surf_vars[var_name], patch_size)

    for var_name in static_vars:
        static_vars[var_name] = _crop_to_patch_size(static_vars[var_name], patch_size)

    for var_name in atmos_vars:
        atmos_vars[var_name] = _crop_to_patch_size(atmos_vars[var_name], patch_size)

    # Crop lat/lon coordinates to match data
    if len(surf_vars) > 0:
        sample_var = next(iter(surf_vars.values()))
        new_height, new_width = sample_var.shape[-2:]
        latitudes = latitudes[:new_height, :new_width]
        longitudes = longitudes[:new_height, :new_width]

    # Create metadata with proper coordinate ordering
    lat_1d = torch.from_numpy(latitudes[:, 0])  # First column
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

    lon_1d = torch.from_numpy(longitudes[0, :])  # First row
    if lon_1d.min() < 0:  # Convert [-180, 180] to [0, 360)
        lon_1d = torch.where(lon_1d < 0, lon_1d + 360, lon_1d)

    metadata = Metadata(
        lat=lat_1d,
        lon=lon_1d,
        time=(current_time,),
        atmos_levels=tuple(sorted_pressure_levels),
    )

    return Batch(
        surf_vars=surf_vars,
        static_vars=static_vars,
        atmos_vars=atmos_vars,
        metadata=metadata,
    )


def _generate_training_pairs(
    single_level_data: dict[str, dict[datetime, np.ndarray]],
    pressure_level_data: dict[str, dict[tuple[datetime, int], np.ndarray]],
    sorted_times: list[datetime],
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    sorted_pressure_levels: list[int],
    patch_size: int,
    skip_first_n_timesteps: int,
    additional_surface_variables: tuple[str] | None = None,
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
        additional_surface_variables: Selected surface variables (beyond the defaults) to propagate
            into training dataset from grib files.

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

    training_data_pairs = []

    for i in range(1, n_timesteps - 1):
        prev_time = sorted_times[i - 1]
        curr_time = sorted_times[i]
        next_time = sorted_times[i + 1]

        # Input batch: [previous, current]
        input_batch = _create_batch(
            single_level_data,
            pressure_level_data,
            [prev_time, curr_time],
            latitudes,
            longitudes,
            sorted_pressure_levels,
            curr_time,
            patch_size,
            additional_surface_variables=additional_surface_variables,
        )

        # Target batch: [next]
        target_batch = _create_batch(
            single_level_data,
            pressure_level_data,
            [next_time],
            latitudes,
            longitudes,
            sorted_pressure_levels,
            next_time,
            patch_size,
            additional_surface_variables=additional_surface_variables,
        )

        training_data_pairs.append(
            SupervisedTrainingDataPair(
                input_batch=input_batch,
                target_batch=target_batch,
            )
        )

    return training_data_pairs


def extract_training_data_from_grib(
    single_level_file: Path,
    pressure_level_file: Path,
    patch_size: int = 4,
    skip_first_n_timesteps: int = 0,
    additional_surface_variables: tuple[str] | None = None,
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
        additional_surface_variables: Selected surface variables (beyond the defaults) to propagate
            into training dataset from grib files.

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
    grib_data = extract_data_from_grib_files(
        single_level_file,
        pressure_level_file,
    )

    # Generate training pairs
    data_pairs = _generate_training_pairs(
        single_level_data=grib_data.single_level_data,
        pressure_level_data=grib_data.pressure_level_data,
        sorted_times=grib_data.sorted_times,
        latitudes=grib_data.latitudes,
        longitudes=grib_data.longitudes,
        sorted_pressure_levels=grib_data.sorted_pressure_levels,
        patch_size=patch_size,
        skip_first_n_timesteps=skip_first_n_timesteps,
        additional_surface_variables=additional_surface_variables,
    )

    print(f"\nGenerated {len(data_pairs)} training pairs")

    return data_pairs
