# Aurora Utility Scripts

Standalone tools for working with Aurora beyond the Norway example.

## Quick Reference

- **setup_region.py** - One-command regional adaptation (creates working prototype with data downloads)
- **quick_verify_netcdf.py** - Fast file inspection (no dependencies)
- **check_aurora_dataset.py** - Validate NetCDF has required Aurora variables
- **download_era5_subset.py** - Automate CDS API downloads for custom regions
- **validate_grid.py** - Confirm your latitude/longitude bounds align with Aurora's 16×16 patch requirement

## When to Use These

**Quick regional adaptation**: Use `setup_region.py` first (see below) for automated prototype creation.

After completing the Norway example, use the other scripts to:
- Download ERA5 data for your own region/timeframe
- Validate custom datasets before running inference
- Debug data issues without running full Aurora model

## Usage

### Regional Adaptation (Recommended Start)

Create a working prototype for any region in one command:

```bash
# 1. Configure CDS credentials (one-time setup)
cd ../
cp .env.example .env
```

Edit `.env` and add your CDS API key:
```bash
CDS_API_KEY=your-api-key-here
```

Then generate the regional prototype:

```bash
# 2. Generate regional prototype
cd scripts
python3 setup_region.py \
    --name "Hawaii" \
    --lat-min 18.5 --lat-max 23.5 \
    --lon-min -161 --lon-max -154

# Creates: ../hawaii-example/ with:
# - Adjusted bounds (grid dimensions divisible by 16)
# - Downloaded ERA5 data (surface, atmospheric, static)
# - Frontend with Hawaii map bounds and observations
# - Ready-to-run inference scripts
```

See [docs/expand-norway-example.md](../../docs/expand-norway-example.md) for complete instructions including CDS account setup.

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
2. Create an account at https://cds.climate.copernicus.eu/ and accept dataset terms.
3. Set credentials in your environment (recommended):
    ```bash
    # .env or shell profile
    CDS_API_KEY="<UID>:<API_KEY>"
    # Optional override if you mirror the endpoint
    # CDS_API_URL="https://cds.climate.copernicus.eu/api"
    ```
    Existing `~/.cdsapirc` files continue to work, but they are no longer required.

See also: [data-integration.md](../../docs/data-integration.md) for the full CDS setup guide.

For atmospheric data, switch to `reanalysis-era5-pressure-levels` and add `--levels` argument.

### Validate Grid Bounds

```bash
python validate_grid.py --lat-min 36.0 --lat-max 48.0 --lon-min 0.0 --lon-max 12.0
```

Shows the total grid cells, Aurora patch layout, and suggested adjustments when a dimension is not divisible by 16. Use this before downloading new data to avoid reshaping issues.

## See Also

- **Norway Example** (`../norway-example/`) - Complete end-to-end tutorial
- **Aurora Documentation** - https://github.com/microsoft/aurora
