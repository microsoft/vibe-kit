# Aurora Utility Scripts

Standalone tools for working with Aurora beyond the Norway example.

## Contents

- [Quick Reference](#quick-reference)
- [When to Use These](#when-to-use-these)
- [Usage](#usage)
  - [Regional Adaptation](#regional-adaptation-recommended-start)
  - [Quick Verification](#quick-verification-no-dependencies)
  - [Dataset Validation](#dataset-validation)
  - [Download ERA5 Data](#download-era5-data)
  - [Validate Grid Bounds](#validate-grid-bounds)
  - [Check Forecast Divergence](#check-forecast-divergence)
  - [Validate Forecast Accuracy](#validate-forecast-accuracy)
  - [Prototype Template](#prototype-template)

## Quick Reference

| Script | Purpose |
|--------|---------|
| `setup_region.py` | One-command regional adaptation with data downloads |
| `quick_verify_netcdf.py` | Fast file inspection (no heavy dependencies) |
| `check_aurora_dataset.py` | Validate NetCDF has required Aurora variables |
| `download_era5_subset.py` | Automate CDS API downloads for custom regions |
| `validate_grid.py` | Confirm lat/lon bounds align with Aurora's 16x16 patch requirement |
| `check_divergence.py` | Flag unrealistic predictions indicating model divergence |
| `validate_forecast.py` | Compute RMSE/MAE/bias/correlation against observations |
| `aurora_prototype_template.py` | Starter script for building domain-specific prototypes |

## When to Use These

Use `setup_region.py` first for automated prototype creation. After completing the Norway example, use the other scripts to:

- Download ERA5 data for your own region/timeframe
- Validate custom datasets before running inference
- Check forecast quality and stability
- Scaffold new domain-specific prototypes

## Usage

### Regional Adaptation (Recommended Start)

Create a working prototype for any region in one command:

```bash
# 1. Configure CDS credentials (one-time setup)
cd ../
cp .env.example .env
# Edit .env and set: CDS_API_KEY=your-api-key-here
```

```bash
# 2. Generate regional prototype
cd scripts
python3 setup_region.py \
    --name "Hawaii" \
    --lat-min 18.5 --lat-max 23.5 \
    --lon-min -161 --lon-max -154
```

See [docs/customization-guide.md](../../docs/customization-guide.md) for complete instructions including CDS account setup.

### Quick Verification (No Dependencies)

```bash
python quick_verify_netcdf.py --data-dir ./data
```

Lists NetCDF files and their dimensions/variables without requiring heavy packages.

### Dataset Validation

```bash
python check_aurora_dataset.py --data-dir ./data --limit 5
```

Checks that NetCDF files contain the required surface variables (`u10`, `v10`, `t2m`, `msl`) and optional atmospheric/static variables Aurora expects.

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
3. Set credentials via `.env` file (recommended) or `~/.cdsapirc`:
    ```bash
    CDS_API_KEY=your-api-key-here
    ```

For atmospheric data, switch to `reanalysis-era5-pressure-levels` and add `--levels` argument.

### Validate Grid Bounds

```bash
python validate_grid.py --lat-min 36.0 --lat-max 48.0 --lon-min 0.0 --lon-max 12.0
```

Shows grid cells, Aurora patch layout, and suggested adjustments when a dimension is not divisible by 16. Run before downloading data to avoid reshaping issues.

### Check Forecast Divergence

```bash
python check_divergence.py --forecast data/norway_june8_forecast.nc
```

Scans each rollout step for unrealistic temperature values. Exit code 1 when divergence is detected. Use to verify forecast horizon stability for your grid size.

### Validate Forecast Accuracy

```bash
python validate_forecast.py \
    --forecast data/norway_june8_forecast.nc \
    --observations data/norway_june8_observations.nc \
    --plot forecast_comparison.png
```

Computes RMSE, MAE, bias, and Pearson correlation against ERA5 observations.

### Prototype Template

Copy the template to start a new domain-specific prototype:

```bash
cp aurora_prototype_template.py my_prototype.py
# Edit my_prototype.py — replace the TODO sections with your domain logic
python my_prototype.py --data ./data/your_data.nc
```

## See Also

- **Norway Example** (`../norway-example/`) — Complete end-to-end tutorial
- **Aurora Documentation** — https://github.com/microsoft/aurora
- **Technical Reference** — [docs/technical-reference.md](../../docs/technical-reference.md)
