# Aurora Utility Scripts

Standalone tools for working with Aurora beyond the Norway example.

## Quick Reference

- **quick_verify_netcdf.py** - Fast file inspection (no dependencies)
- **check_aurora_dataset.py** - Validate NetCDF has required Aurora variables
- **download_era5_subset.py** - Automate CDS API downloads for custom regions

## When to Use These

After completing the Norway example, use these scripts to:
- Download ERA5 data for your own region/timeframe
- Validate custom datasets before running inference
- Debug data issues without running full Aurora model

## Usage

### Quick Verification (No Dependencies)

```bash
python quick_verify_netcdf.py --data-dir ./data
```

Lists NetCDF files and their dimensions/variables without requiring heavy packages.

### Dataset Validation

```bash
python check_aurora_dataset.py --data-dir ./data --limit 5
```

Checks that your NetCDF files contain the required surface variables (`u10`, `v10`, `t2m`, `msl`) and optional atmospheric/static variables that Aurora expects.

### Download ERA5 Data

```bash
python download_era5_subset.py \
    --dataset reanalysis-era5-single-levels \
    --variables 2m_temperature 10m_u_component_of_wind 10m_v_component_of_wind mean_sea_level_pressure \
    --year 2024 --month 08 --days 15 16 \
    --hours 00 06 12 18 \
    --area 35 -75 20 -55 \
    --target data/era5-surface.nc
```

**Prerequisites:**
1. Install `cdsapi`: `pip install cdsapi`
2. Create account at https://cds.climate.copernicus.eu/
3. Configure API key in `~/.cdsapirc`

See also: [data-integration.md](../../docs/data-integration.md) for complete CDS setup guide.
3. Accept dataset terms of use
4. Add API key to `~/.cdsapirc`:
   ```
   url: https://cds.climate.copernicus.eu/api
   key: <UID>:<API_KEY>
   ```

For atmospheric data, switch to `reanalysis-era5-pressure-levels` and add `--levels` argument.

## See Also

- **Norway Example** (`../norway-example/`) - Complete end-to-end tutorial
- **Aurora Documentation** - https://github.com/microsoft/aurora
