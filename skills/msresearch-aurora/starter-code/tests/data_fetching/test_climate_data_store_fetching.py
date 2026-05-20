"""
Unit tests for climate_data_store_fetching.py
"""

import pytest
from pathlib import Path
from ecmwf.datastores.processing import Results
from vibe_tune_aurora.data_fetching.climate_data_store_fetching import (
    fetch_cds_data,
    download_cds_data_to_path,
    DATASET_NAME__SINGLE_LEVELS,
    DATASET_NAME__PRESSURE_LEVELS,
    EXAMPLE_REQUEST__SINGLE_LEVELS_DATA,
    EXAMPLE_REQUEST__PRESSURE_LEVELS_DATA,
)


@pytest.mark.requires_cds_api_key
def test_fetch_cds_data():
    result = fetch_cds_data(
        dataset_name=DATASET_NAME__SINGLE_LEVELS,
        request=EXAMPLE_REQUEST__SINGLE_LEVELS_DATA,
    )

    assert isinstance(result, Results)


@pytest.mark.requires_cds_api_key
def test_download_cds_data_to_path():
    """
    Test downloading CDS pressure levels data to a file path.

    This test verifies that the download_cds_data_to_path function successfully
    downloads data and creates a file at the specified location.
    """
    # Setup: Create outputs directory if it doesn't exist
    outputs_dir = Path(__file__).parent / "outputs"
    outputs_dir.mkdir(exist_ok=True)

    # Create temp file path
    output_path = outputs_dir / "temp_pressure_levels.grib"

    try:
        # Download the data
        download_cds_data_to_path(
            output_path=output_path,
            dataset_name=DATASET_NAME__PRESSURE_LEVELS,
            request=EXAMPLE_REQUEST__PRESSURE_LEVELS_DATA,
        )

        # Verify the file was created
        assert output_path.exists(), f"Downloaded file not found at {output_path}"
        assert output_path.stat().st_size > 0, "Downloaded file is empty"

    finally:
        # Cleanup: Delete the temp file if it exists
        if output_path.exists():
            output_path.unlink()
