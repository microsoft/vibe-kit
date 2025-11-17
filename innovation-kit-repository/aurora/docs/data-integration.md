# Aurora Data Integration

## Supported Formats

**ERA5 NetCDF**: Medium-resolution (0.25°) weather reanalysis. Download via CDS API. (source: example_era5.html)

**WeatherBench2 Zarr/NetCDF**: HRES T0 and analysis at 0.25°/0.1° stored in Google Cloud buckets. (source: example_hres_t0.html; example_hres_0.1.html)

**CAMS NetCDF ZIP**: Air-pollution forecasts (0.4°) fetched from the Atmosphere Data Store; static features served from Hugging Face. _(Not bundled; download manually before running the example.)_ (source: example_cams.html)

**ECMWF MARS GRIB**: HRES-WAM ocean wave analyses for 0.25° inference. _(Not bundled; request through ECMWF MARS.)_ (source: example_wave.html)

> **Why we still need ERA5:** The bundled Hurricane Erin track files are derived summaries for the cyclone use case; they don’t include the gridded tensors that `aurora.Batch` expects. To run the end-to-end quick start or fine-tune workflows, you still need to pull ERA5 (or CAMS/WeatherBench2) slices directly from Copernicus using the script below.

> *Optional dependency*: Fetching static pickles or notebooks from Hugging Face requires `huggingface_hub`. Install it when needed via `pip install huggingface_hub`.

## Bundled hello-world sample

| **File**                                       | **Contents**                                                                    | **Source**                                                |
|------------------------------------------------|---------------------------------------------------------------------------------|-----------------------------------------------------------|
| `.vibe-kit/innovation-kits/aurora/assets/samples/era5-surface-20250801.nc`  | 24 hourly global slices (2m temperature, 10m winds, mean sea-level pressure) | Copernicus ERA5 reanalysis, 2025-08-01, 0.25° resolution |
| `.vibe-kit/innovation-kits/aurora/assets/samples/era5-pressure-20250801.nc` | 00/06/12/18 UTC pressure-level cube for `t/u/v/q/z` across 1000–100 hPa      | Aligns with Aurora's default atmospheric channels        |
| `.vibe-kit/innovation-kits/aurora/assets/samples/era5-static-20250801.nc`   | Orography (`z`), land/sea mask (`lsm`), soil type (`slt`)                    | Take the first (and only) timestamp as static features   |

- **License:** Copernicus ERA5, single-use licence already accepted when generating the sample; downstream users must review the [terms](https://cds.climate.copernicus.eu/cdsapp#!/terms/climate-data-store-terms-licence).
- **Usage:** The quick start loads these files via `xarray` → `torch`; see [`quick-start.md`](./quick-start.md) for the full snippet.
- **Visualise:** Run `python .vibe-kit/innovation-kits/aurora/assets/samples/plot_era5_quicklook.py` to generate Plotly heatmaps for any bundled timestep.
- **Run Aurora:** Follow [quick-start Step 3](./quick-start.md#step-3-load-the-era5-bundle-and-run-a-forward-pass) to execute `AuroraSmallPretrained` on the bundled tensors, then use [Step 5](./quick-start.md#step-5-persist-forecasts-for-visualization-optional) to save outputs for plotting.
- **Energy scenario tip:** When modelling wind assets, collect a coastal ERA5 subset (surface + pressure) sized for your ramp detection interval. Reuse the inspection helpers in `.vibe-kit/innovation-kits/aurora/assets/scripts/` or adapt your own tooling to mirror Aurora’s variable mapping.

## Download Your Own ERA5 Data

When adapting the Norway example to your region or time period, use the provided download script:

### Quick Method: Use download_era5_subset.py

#### **Prerequisites:**

1. **Get CDS credentials** (free, takes 2 minutes):
   - Create account at https://cds.climate.copernicus.eu
   - Visit https://cds.climate.copernicus.eu/api-how-to after email verification
   - Copy your API key (long alphanumeric string)

2. **Configure credentials** (recommended method):
   ```bash
   cd .vibe-kit/innovation-kits/aurora/assets
   cp .env.example .env
   ```
    Instruct user:
    - Edit .env locally and set: CDS_API_KEY=your-api-key-here
    - Keep this file private—never paste keys into chat or source control.
   
   The `.env` file is gitignored, keeping your credentials local.
   
   **Alternative**: Legacy `~/.cdsapirc` file still works if you already have one from other projects.

3. **Install the CDS API client**: `pip install cdsapi` (or use provided `requirements.txt`)

**Download surface data:**
```bash
python .vibe-kit/innovation-kits/aurora/assets/scripts/download_era5_subset.py \
    --dataset reanalysis-era5-single-levels \
    --variables 2m_temperature 10m_u_component_of_wind 10m_v_component_of_wind mean_sea_level_pressure \
    --year 2025 --month 06 --days 01 02 03 04 05 06 07 \
    --hours 00 06 12 18 \
    --area 72.75 4 57 31.75 \
    --target data/my-region-surface.nc
```
The command picks up `CDS_API_KEY` automatically (mirroring the Aurora Finetune helper utilities) while still honouring credentials from `~/.cdsapirc` if present.

### Manual Method: CDS Web Interface

Alternatively, use the [CDS web interface](https://cds.climate.copernicus.eu/datasets) to download data:
   - Select dataset: `reanalysis-era5-single-levels` or `reanalysis-era5-pressure-levels`
   - Choose variables: `2m_temperature`, `10m_u_component_of_wind`, `10m_v_component_of_wind`, `mean_sea_level_pressure`
   - Set date range and download as NetCDF
   
   Or use the Python API directly (see CDS documentation for examples).

## Loading ERA5 (primary prototype path)

```python
from pathlib import Path
import cdsapi
import torch
import xarray as xr
from aurora import Batch, Metadata

download_dir = Path("~/downloads/era5").expanduser()
download_dir.mkdir(parents=True, exist_ok=True)

c = cdsapi.Client()
if not (download_dir / "static.nc").exists():
    c.retrieve(
        "reanalysis-era5-single-levels",
        {
            "product_type": "reanalysis",
            "variable": ["geopotential", "land_sea_mask", "soil_type"],
            "year": "2023",
            "month": "01",
            "day": "01",
            "time": "00:00",
            "format": "netcdf",
        },
        str(download_dir / "static.nc"),
    )
# repeat for surface/atmospheric files per example docs

static_ds = xr.open_dataset(download_dir / "static.nc", engine="netcdf4")
surf_ds = xr.open_dataset(download_dir / "2023-01-01-surface-level.nc", engine="netcdf4")
atmos_ds = xr.open_dataset(download_dir / "2023-01-01-atmospheric.nc", engine="netcdf4")

batch = Batch(
    surf_vars={
        "2t": torch.from_numpy(surf_ds["t2m"].values[:2][None]),
        "10u": torch.from_numpy(surf_ds["u10"].values[:2][None]),
        "10v": torch.from_numpy(surf_ds["v10"].values[:2][None]),
        "msl": torch.from_numpy(surf_ds["msl"].values[:2][None]),
    },
    static_vars={
        "z": torch.from_numpy(static_ds["z"].values[0]),
        "slt": torch.from_numpy(static_ds["slt"].values[0]),
        "lsm": torch.from_numpy(static_ds["lsm"].values[0]),
    },
    atmos_vars={
        "t": torch.from_numpy(atmos_ds["t"].values[:2][None]),
        "u": torch.from_numpy(atmos_ds["u"].values[:2][None]),
        "v": torch.from_numpy(atmos_ds["v"].values[:2][None]),
        "q": torch.from_numpy(atmos_ds["q"].values[:2][None]),
        "z": torch.from_numpy(atmos_ds["z"].values[:2][None]),
    },
    metadata=Metadata(
        lat=torch.from_numpy(surf_ds.latitude.values),
        lon=torch.from_numpy(surf_ds.longitude.values),
        time=(surf_ds.valid_time.values.astype("datetime64[s]").tolist()[1],),
        atmos_levels=tuple(int(level) for level in atmos_ds.pressure_level.values),
    ),
)

## Aurora Small (local) checklist

1. From the `backend` directory, install dependencies via `pip install -r requirements.txt`.
2. Obtain the **Aurora Small wheel** (`aurora_small-*.whl`) from the research team and install it with `pip install <wheel>`. Until the distribution URL is published, treat this as a **blocker**.
3. (Optional) Pre-download checkpoints into a shared cache and pass `--checkpoint` to `python .vibe-kit/innovation-kits/aurora/assets/scripts/run_aurora_small_local.py` to avoid repeated 500 MB transfers.
4. Execute the helper script to produce `npz` tensors:
   ```bash
   python .vibe-kit/innovation-kits/aurora/assets/scripts/run_aurora_small_local.py
   ```
5. Feed the resulting `npz` tensors into dashboards or convert them to NetCDF for downstream sharing.

> Optional offload: If you later provision an Azure AI Foundry deployment, follow the switch-over recipe in [quick-start.md](./quick-start.md) to submit the same batches remotely. Until then, treat the local workflow above as the default path.
```

## Loading CAMS (air quality)

> **Heads-up:** The Aurora kit does *not* ship CAMS NetCDF samples. Download the ZIP payload from the Atmosphere Data Store first, then follow the steps below.

```python
from huggingface_hub import hf_hub_download
import cdsapi
import pickle
import xarray as xr

static_path = hf_hub_download("microsoft/aurora", "aurora-0.4-air-pollution-static.pickle")
with open(static_path, "rb") as f:
    static_vars = pickle.load(f)

c = cdsapi.Client(url="https://ads.atmosphere.copernicus.eu/api")
# retrieve "cams-global-atmospheric-composition-forecasts" with format "netcdf_zip"

# unzip data_sfc.nc and data_plev.nc, then convert to Batch per example_cams.html
```

## Validation

```python
def validate_batch(batch: Batch) -> bool:
    expected_surf = {"2t", "10u", "10v", "msl"}
    assert expected_surf.issubset(batch.surf_vars)
    assert batch.surf_vars["2t"].ndim == 5  # (B, T, C, H, W)
    assert batch.metadata.time and isinstance(batch.metadata.time[0], datetime)
    return True
```

## Common Issues

**401 from CDS/ADS**: Accept dataset terms and ensure the correct API URL in `$HOME/.cdsapirc` vs `$HOME/.adsapirc`. (source: docs examples)  
**Mismatched latitude orientation**: Flip `latitude` arrays from WeatherBench2 when converting to tensors (see `_prepare` helper in HRES examples).  
**Large downloads (>5 GB)**: Use `download_era5_subset.py` with `--area` filter to subset by region, or use CDS web interface to limit scope.

## Data Sources

**ERA5**: https://cds.climate.copernicus.eu/ (NetCDF, 0.25°)  
**WeatherBench2 (HRES)**: gs://weatherbench2/datasets/hres_t0 (Zarr/NetCDF)  
**CAMS**: https://ads.atmosphere.copernicus.eu/ (NetCDF ZIP)  
**ECMWF MARS (HRES-WAM)**: https://api.ecmwf.int/ (GRIB)
