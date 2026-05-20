"""
Fetching data from Copernicus Climate Data Store.
The utilities here require setting up CDS_API_KEY as an environment variable, which is described in
the README.
"""

import os
from typing import Any
from ecmwf.datastores.processing import Results
from pathlib import Path
import cdsapi
from dotenv import load_dotenv

load_dotenv()
CDS_API_URL = "https://cds.climate.copernicus.eu/api"
CDS_API_KEY = os.environ.get("CDS_API_KEY")


# Example dataset names for downloading
# "Single levels data" refers to the weather variables data at the surface level of Earth
DATASET_NAME__SINGLE_LEVELS = "reanalysis-era5-single-levels"
# "Pressure levels data" refers to weather variable data at selected pressure levels (loosely
# corresponding to heights above the Earth surface). For example, 1000 hPa corresponds to roughly
# the height of the Earth surface, and 900 hPa corresponds to a height slightly higher in the
# atmosphere.
DATASET_NAME__PRESSURE_LEVELS = "reanalysis-era5-pressure-levels"


# Example request configs for downloading
EXAMPLE_REQUEST__SINGLE_LEVELS_DATA = {
    # The "Reanalysis"dataset: atmospheric data was retrospectively analyzed to give best estimate
    # of the state of the atmosphere
    "product_type": ["reanalysis"],
    # Selecting the minimum set of surface level (single level) and static variables required for
    # feeding into Aurora
    "variable": [
        "10m_u_component_of_wind",
        "10m_v_component_of_wind",
        "2m_temperature",
        "mean_sea_level_pressure",
        "soil_type",
        "geopotential",
        "land_sea_mask",
    ],
    "year": ["2025"],
    "month": ["01"],
    "day": ["01", "02"],
    # Setting time points to match the times that the Aurora model was pretrained with.
    "time": ["00:00", "06:00", "12:00", "18:00"],
    "data_format": "grib",
    "download_format": "unarchived",
    # Defines the locational region bounding box. Specified as a list of latitude/longitude limits
    # (units of degrees)in the following order:
    # [north (maximum latitude), west (minimum longitude), south (minimum latitude), east (maximum
    # longitude)]
    # For example, the full global region is: [90, -180, -90, 180]
    "area": [5, -10, -5, 10],
}
EXAMPLE_REQUEST__PRESSURE_LEVELS_DATA = {
    "product_type": ["reanalysis"],
    "variable": [
        "geopotential",
        "specific_humidity",
        "temperature",
        "u_component_of_wind",
        "v_component_of_wind",
    ],
    "year": ["2025"],
    "month": ["01"],
    "day": ["01", "02"],
    "time": ["00:00", "06:00", "12:00", "18:00"],
    "pressure_level": ["700", "850", "925", "1000"],
    "data_format": "grib",
    "download_format": "unarchived",
    "area": [5, -10, -5, 10],
}


def fetch_cds_data(
    dataset_name: str,
    request: dict[str, Any],
) -> Results:
    """
    Download data from Climate Data Store (CDS), and save to output_path.
    For specification of `dataset_name` and `request`, see the example constants at top of this
    file, or ssee the ECMWF CDS API documentation online:
    https://cds.climate.copernicus.eu/how-to-api
    """
    if CDS_API_KEY is None:
        raise ValueError(
            f"The `CDS_API_KEY` env variable must be set, ideally in `.env` file. Currently the "
            f"value is: {CDS_API_KEY}"
        )

    client = cdsapi.Client(
        url=CDS_API_URL,
        key=CDS_API_KEY,
    )

    result = client.retrieve(dataset_name, request)
    return result


def download_cds_data_to_path(
    output_path: Path,
    dataset_name: str,
    request: dict[str, Any],
) -> None:
    """
    Download CDS data to an output file path.
    """
    result = fetch_cds_data(dataset_name, request)
    result.download(str(output_path))
