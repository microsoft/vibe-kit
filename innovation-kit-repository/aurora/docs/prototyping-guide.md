# Customization Guide: Adapt the Norway Example

**Start here if you want to modify the working Norway example for your own region and requirements.**

> **Which guide should I use?**
> - **This guide (Customization):** You've run the Norway example and want to adapt it—change the region, adjust variables, or deploy it. Start with working code and modify incrementally.
> - **[aurora-prototyping-guide.md](aurora-prototyping-guide.md) (From Scratch):** You want to build your own Aurora application from fundamentals—understand data loading, batch construction, and inference patterns without starting from an example.

> **When to fine-tune Aurora:**
> This guide uses the **pretrained base Aurora model** with your own ERA5 data for inference. The base model works well for general weather forecasting.
> 
> However, if your use case requires:
> - **Domain-specific behavior** (e.g., microclimates, urban heat islands, specialized maritime conditions)
> - **Improved accuracy** for a specific region or phenomenon
> - **Custom variables** not in Aurora's original training set
> 
> → See the **[Aurora Fine-tuning Innovation Kit](../../aurora-finetune/)** to adapt Aurora's weights to your specialized dataset.

**Prerequisites:** Complete [quick-start.md](quick-start.md) and understand [technical details](norway-technical-guide.md).

---

## Overview

**What you'll learn:**
- Change geographic region and grid size
- Fetch your own CDS ERA5 data
- Adjust forecast horizon and timesteps
- Add/modify variables (precipitation, humidity, etc.)
- Optimize performance (CPU vs GPU, batch sizes)
- Deploy as a web service
- Validate predictions against observations

---

## 1. Change Geographic Region

### Step 1: Choose Your Region

**Critical constraint:** Grid dimensions must be divisible by 16.

**Calculate grid cells:**
```python
resolution = 0.25  # degrees (Aurora's training resolution)

# Example: Western Europe
lat_min, lat_max = 40.0, 60.0   # 20° range
lon_min, lon_max = -10.0, 10.0  # 20° range

lat_cells = int((lat_max - lat_min) / resolution)  # 80 cells
lon_cells = int((lon_max - lon_min) / resolution)  # 80 cells

# Check divisibility
assert lat_cells % 16 == 0, f"Lat cells {lat_cells} not divisible by 16"
assert lon_cells % 16 == 0, f"Lon cells {lon_cells} not divisible by 16"
```

**Valid examples:**

| Region | Lat Range | Lon Range | Grid | Patches |
|--------|-----------|-----------|------|---------|
| **Norway (original)** | 58.25-70°N | 5-16.75°E | 48×48 | 3×3 |
| **North Sea** | 52-60°N | 0-8°E | 32×32 | 2×2 |
| **Mediterranean** | 36-48°N | 0-12°E | 48×48 | 3×3 |
| **US Northeast** | 36-52°N | -80 to -64°W | 64×64 | 4×4 |
| **Australia East** | -38 to -22°S | 146-162°E | 64×64 | 4×4 |

### Step 2: Modify `run_aurora_inference.py`

Edit lines 25-30:

```python
# Original Norway region
GRID_BOUNDS = {
    'lat_min': 58.25,
    'lat_max': 70.0,
    'lon_min': 5.0,
    'lon_max': 16.75
}

# Replace with your region (example: Mediterranean)
GRID_BOUNDS = {
    'lat_min': 36.0,   # Southern edge
    'lat_max': 48.0,   # Northern edge
    'lon_min': 0.0,    # Western edge
    'lon_max': 12.0    # Eastern edge
}
```

**Verify grid size:**
```python
lat_cells = int((GRID_BOUNDS['lat_max'] - GRID_BOUNDS['lat_min']) / 0.25)
lon_cells = int((GRID_BOUNDS['lon_max'] - GRID_BOUNDS['lon_min']) / 0.25)
print(f"Grid: {lat_cells}×{lon_cells}")
print(f"Patches: {lat_cells//16}×{lon_cells//16}")
```

### Step 3: Update Frontend Map Bounds

Edit `frontend/src/App.tsx` lines 35-40:

```typescript
// Original Norway bounds
const MAP_BOUNDS = {
  north: 70.0,
  south: 58.25,
  west: 5.0,
  east: 16.75
};

// Update to match your region
const MAP_BOUNDS = {
  north: 48.0,
  south: 36.0,
  west: 0.0,
  east: 12.0
};
```

### Step 4: Test Grid Divisibility

Run this validation script before fetching data:

```python
# scripts/validate_grid.py
def validate_grid(lat_min, lat_max, lon_min, lon_max, resolution=0.25):
    lat_cells = int((lat_max - lat_min) / resolution)
    lon_cells = int((lon_max - lon_min) / resolution)
    
    print(f"Grid: {lat_cells}×{lon_cells} cells")
    print(f"Patches: {lat_cells//16}×{lon_cells//16}")
    print(f"Total points: {lat_cells * lon_cells:,}")
    
    if lat_cells % 16 != 0:
        print(f"❌ ERROR: Lat cells {lat_cells} not divisible by 16")
        # Suggest fix
        needed = ((lat_cells // 16) + 1) * 16
        new_max = lat_min + (needed * resolution)
        print(f"   Try lat_max={new_max:.2f} for {needed} cells")
        return False
    
    if lon_cells % 16 != 0:
        print(f"❌ ERROR: Lon cells {lon_cells} not divisible by 16")
        needed = ((lon_cells // 16) + 1) * 16
        new_max = lon_min + (needed * resolution)
        print(f"   Try lon_max={new_max:.2f} for {needed} cells")
        return False
    
    print("✅ Grid valid!")
    return True

# Test your region
validate_grid(36.0, 48.0, 0.0, 12.0)
```

---

## 2. Fetch Your Own CDS Data

### Prerequisites

1. **CDS Account:** Register at [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu)
2. **Accept ERA5 Terms:** Navigate to ERA5 datasets and accept license
3. **API Key:** Create `~/.cdsapirc`:
   ```
   url: https://cds.climate.copernicus.eu/api/v2
   key: YOUR_UID:YOUR_API_KEY
   ```

### Step 1: Install CDS API

```bash
pip install cdsapi
```

### Step 2: Create Data Download Script

```python
# scripts/fetch_cds_data.py
import cdsapi
from datetime import datetime, timedelta

def fetch_era5_data(
    start_date,
    end_date,
    lat_min, lat_max,
    lon_min, lon_max,
    output_dir='data'
):
    """Fetch ERA5 data for Aurora inference."""
    c = cdsapi.Client()
    
    # Generate hourly timestamps
    times = []
    current = start_date
    while current <= end_date:
        times.append(current.strftime('%H:%M'))
        current += timedelta(hours=6)
    
    # Fetch surface variables
    print("Fetching surface variables...")
    c.retrieve(
        'reanalysis-era5-single-levels',
        {
            'product_type': 'reanalysis',
            'variable': [
                '10m_u_component_of_wind',
                '10m_v_component_of_wind',
                '2m_temperature',
                'mean_sea_level_pressure',
            ],
            'year': start_date.year,
            'month': [f'{m:02d}' for m in range(start_date.month, end_date.month+1)],
            'day': [f'{d:02d}' for d in range(1, 32)],
            'time': times,
            'area': [lat_max, lon_min, lat_min, lon_max],  # N, W, S, E
            'format': 'netcdf',
        },
        f'{output_dir}/era5_surface.nc'
    )
    
    # Fetch atmospheric variables
    print("Fetching atmospheric variables...")
    c.retrieve(
        'reanalysis-era5-pressure-levels',
        {
            'product_type': 'reanalysis',
            'variable': [
                'geopotential',
                'specific_humidity',
                'temperature',
                'u_component_of_wind',
                'v_component_of_wind',
            ],
            'pressure_level': ['1000', '925', '850', '700'],
            'year': start_date.year,
            'month': [f'{m:02d}' for m in range(start_date.month, end_date.month+1)],
            'day': [f'{d:02d}' for d in range(1, 32)],
            'time': times,
            'area': [lat_max, lon_min, lat_min, lon_max],
            'format': 'netcdf',
        },
        f'{output_dir}/era5_pressure.nc'
    )
    
    # Fetch static variables (one-time)
    print("Fetching static variables...")
    c.retrieve(
        'reanalysis-era5-single-levels',
        {
            'product_type': 'reanalysis',
            'variable': [
                'land_sea_mask',
                'geopotential',
                'soil_type',
            ],
            'year': start_date.year,
            'month': start_date.month,
            'day': start_date.day,
            'time': '00:00',
            'area': [lat_max, lon_min, lat_min, lon_max],
            'format': 'netcdf',
        },
        f'{output_dir}/era5_static.nc'
    )
    
    print("✅ Data download complete!")

# Example usage
if __name__ == '__main__':
    fetch_era5_data(
        start_date=datetime(2025, 6, 1),
        end_date=datetime(2025, 6, 7),
        lat_min=36.0, lat_max=48.0,
        lon_min=0.0, lon_max=12.0
    )
```

### Step 3: Run Download

```bash
python3 scripts/fetch_cds_data.py
```

**Download time:** 5-15 minutes depending on region size and CDS queue.

**File sizes:**
- Surface: ~500KB - 2MB
- Pressure levels: ~2MB - 8MB
- Static: ~100KB - 500KB

---

## 3. Adjust Forecast Horizon

### Understanding Stability Limits

| Grid Size | Stable Horizon | Marginal | Diverges |
|-----------|----------------|----------|----------|
| **32×32** | 12-18h | 24h | 36h+ |
| **48×48** | 24h | 48h | 72h+ |
| **64×64** | 48h | 72h | 96h+ |
| **80×80** | 72h | 96h | 120h+ |

### Modify Number of Steps

Edit `run_aurora_inference.py` line 134:

```python
# Original: 4 steps = 24 hours
num_steps = 4

# Try longer forecasts (test stability)
num_steps = 6   # 36h
num_steps = 8   # 48h
num_steps = 12  # 72h (3 days)
```

### Detect Divergence

Add validation after inference:

```python
def check_divergence(predictions):
    """Check if model predictions are physically realistic."""
    for i, pred in enumerate(predictions):
        t2m = pred['t2m'].cpu().numpy()
        
        temp_min = t2m.min() - 273.15  # Convert K to °C
        temp_max = t2m.max() - 273.15
        
        print(f"Step {i+1}: {temp_min:.1f}°C to {temp_max:.1f}°C")
        
        # Realistic bounds for most regions
        if temp_min < -60 or temp_max > 60:
            print(f"⚠️  WARNING: Unrealistic temps at step {i+1}")
            print(f"   Model likely diverging - reduce num_steps")
            return False
    
    print("✅ All predictions within realistic bounds")
    return True

# After run_forecast()
predictions = run_forecast(model, initial_batch, num_steps=8)
check_divergence(predictions)
```

---

## 4. Add/Modify Variables

### Available ERA5 Variables

**Surface variables:**
- `total_precipitation` - Accumulated precipitation
- `surface_pressure` - Surface pressure
- `total_cloud_cover` - Cloud fraction
- `surface_solar_radiation_downwards` - Solar irradiance
- `surface_thermal_radiation_downwards` - Longwave radiation
- `2m_dewpoint_temperature` - Dewpoint (for humidity)

**Pressure level variables:**
- `relative_humidity` - RH at pressure levels
- `vertical_velocity` - Updrafts/downdrafts (omega)
- `potential_vorticity` - For cyclone tracking
- `divergence` - Wind divergence field

### Step 1: Fetch Additional Variables

Modify `fetch_cds_data.py` to include new variables:

```python
c.retrieve(
    'reanalysis-era5-single-levels',
    {
        'variable': [
            '10m_u_component_of_wind',
            '10m_v_component_of_wind',
            '2m_temperature',
            'mean_sea_level_pressure',
            'total_precipitation',        # ADD
            'total_cloud_cover',          # ADD
        ],
        # ... rest of config
    }
)
```

### Step 2: Modify Aurora Input Batch

Edit `run_aurora_inference.py` to include new variables in input batch:

```python
# If Aurora was trained on these variables, include them
# Check Aurora documentation for supported variables
batch = create_aurora_batch(
    surf_ds, atmos_ds,
    times=[time1, time2],
    extra_vars=['total_precipitation', 'total_cloud_cover']
)
```

**Note:** Aurora was trained on specific variables. Adding variables it wasn't trained on won't improve predictions. Check [Aurora docs](https://huggingface.co/microsoft/aurora) for supported variables.

### Step 3: Extract Additional Output Variables

Modify `save_forecast_netcdf()`:

```python
def save_forecast_netcdf(predictions, output_path, metadata):
    """Save predictions with additional variables."""
    # Original variables
    temp_data = np.stack([p['t2m'].cpu().numpy() for p in predictions])
    u_wind_data = np.stack([p['u10'].cpu().numpy() for p in predictions])
    v_wind_data = np.stack([p['v10'].cpu().numpy() for p in predictions])
    
    # Add new variables (if Aurora predicts them)
    precip_data = np.stack([p['tp'].cpu().numpy() for p in predictions])
    cloud_data = np.stack([p['tcc'].cpu().numpy() for p in predictions])
    
    ds = xr.Dataset({
        't2m': (['time', 'lat', 'lon'], temp_data),
        'u10': (['time', 'lat', 'lon'], u_wind_data),
        'v10': (['time', 'lat', 'lon'], v_wind_data),
        'tp': (['time', 'lat', 'lon'], precip_data),
        'tcc': (['time', 'lat', 'lon'], cloud_data),
    }, coords={
        'time': metadata['times'],
        'lat': metadata['lats'],
        'lon': metadata['lons'],
    })
    
    ds.to_netcdf(output_path)
```

### Step 4: Update Frontend Visualization

Modify `build_forecast_module.py` to extract new variables:

```python
# Add --variables flag
parser.add_argument('--variables', nargs='+', 
                   default=['t2m'],
                   help='Variables to extract')

# Generate module with multiple variables
variables_data = {}
for var in args.variables:
    variables_data[var] = extract_variable(ds, var)

# Write TypeScript with all variables
write_typescript_module(variables_data, output_path)
```

Update `App.tsx` to allow variable selection:

```typescript
const [selectedVariable, setSelectedVariable] = useState<string>('t2m');

// Variable selector dropdown
<Dropdown
  options={[
    { key: 't2m', text: 'Temperature' },
    { key: 'tp', text: 'Precipitation' },
    { key: 'tcc', text: 'Cloud Cover' },
  ]}
  selectedKey={selectedVariable}
  onChange={(_, option) => setSelectedVariable(option.key as string)}
/>

// Pass to HeatmapOverlay
<HeatmapOverlay
  data={forecastData[selectedVariable]}
  colormap={getColormapForVariable(selectedVariable)}
/>
```

---

## 5. Performance Optimization

### GPU vs CPU

**When to use GPU:**
- Available VRAM ≥ 8GB
- Inference time critical
- Running multiple forecasts

**When to use CPU:**
- No GPU available
- VRAM < 8GB
- Single forecast, time not critical

**Force CPU mode:**

```python
# In run_aurora_inference.py
device = torch.device('cpu')
model = load_aurora_model(device=device)
```

Or add CLI argument:

```bash
python3 run_aurora_inference.py --device cpu
```

### Reduce Memory Usage

**Option 1: Mixed precision**

```python
# Use FP16 instead of FP32
model = model.half()  # Convert to FP16
batch = batch.half()  # Convert input

# Run inference
with torch.cuda.amp.autocast():
    predictions = model(batch)
```

**Memory savings:** ~40% reduction  
**Accuracy impact:** Minimal for weather forecasting

**Option 2: Gradient checkpointing**

```python
# Trade compute for memory
model.gradient_checkpointing_enable()
```

**Memory savings:** ~30% reduction  
**Speed impact:** ~20% slower

**Option 3: Smaller grids**

```python
# 32×32 instead of 48×48
grid_size = 32  # Reduces points from 2,304 → 1,024
```

**Memory savings:** ~55% reduction  
**Accuracy impact:** Less spatial context, shorter stable horizon

### Batch Multiple Forecasts

If running forecasts for multiple regions or times:

```python
def batch_forecasts(model, input_batches):
    """Run multiple forecasts efficiently."""
    # Stack all inputs
    combined_batch = torch.cat(input_batches, dim=0)
    
    # Single model pass
    with torch.no_grad():
        combined_output = model(combined_batch)
    
    # Split outputs
    batch_size = input_batches[0].shape[0]
    outputs = torch.split(combined_output, batch_size, dim=0)
    
    return outputs

# Example: Forecast for 4 different regions
regions = [region1_batch, region2_batch, region3_batch, region4_batch]
results = batch_forecasts(model, regions)
```

**Speedup:** 2-3× faster than sequential for 4+ forecasts

---

## 6. Deploy as Web Service

### Option 1: FastAPI Backend

```python
# backend/forecast_service.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from aurora import AuroraSmall

app = FastAPI()

# Load model at startup
model = None

@app.on_event("startup")
async def load_model():
    global model
    model = AuroraSmall()
    checkpoint = torch.load('aurora_checkpoint.ckpt')
    model.load_state_dict(checkpoint)
    model.eval()

class ForecastRequest(BaseModel):
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    start_time: str
    num_steps: int = 4

@app.post("/forecast")
async def generate_forecast(request: ForecastRequest):
    """Generate Aurora forecast for specified region."""
    try:
        # Validate grid
        lat_cells = int((request.lat_max - request.lat_min) / 0.25)
        lon_cells = int((request.lon_max - request.lon_min) / 0.25)
        
        if lat_cells % 16 != 0 or lon_cells % 16 != 0:
            raise HTTPException(400, "Grid not divisible by 16")
        
        # Load data (from cache or CDS)
        input_batch = load_era5_for_region(
            request.lat_min, request.lat_max,
            request.lon_min, request.lon_max,
            request.start_time
        )
        
        # Run inference
        predictions = run_forecast(model, input_batch, request.num_steps)
        
        # Convert to JSON
        forecast_json = predictions_to_json(predictions)
        
        return forecast_json
    
    except Exception as e:
        raise HTTPException(500, str(e))

# Run with: uvicorn backend.forecast_service:app --reload
```

### Option 2: Docker Container

```dockerfile
# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY scripts/ ./scripts/
COPY backend/ ./backend/
COPY data/ ./data/

# Download Aurora checkpoint
RUN python3 -c "from aurora import AuroraSmall; m = AuroraSmall()"

EXPOSE 8000

CMD ["uvicorn", "backend.forecast_service:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build and run:**

```bash
docker build -t aurora-forecast .
docker run -p 8000:8000 aurora-forecast
```

### Option 3: Azure Container Apps

```bash
# Deploy to Azure
az containerapp up \
  --name aurora-forecast \
  --resource-group aurora-rg \
  --location eastus \
  --source . \
  --target-port 8000 \
  --ingress external
```

---

## 7. Validate Predictions

### Compare Against Observations

```python
# scripts/validate_forecast.py
import xarray as xr
import numpy as np
import matplotlib.pyplot as plt

def validate_forecast(forecast_file, observation_file):
    """Compare Aurora predictions against actual observations."""
    
    # Load data
    pred = xr.open_dataset(forecast_file)
    obs = xr.open_dataset(observation_file)
    
    # Align grids (interpolate if needed)
    obs_matched = obs.interp_like(pred)
    
    # Compute metrics
    metrics = {}
    
    # RMSE
    rmse = np.sqrt(((pred.t2m - obs_matched.t2m) ** 2).mean())
    metrics['rmse_kelvin'] = float(rmse.values)
    metrics['rmse_celsius'] = float(rmse.values)
    
    # MAE
    mae = np.abs(pred.t2m - obs_matched.t2m).mean()
    metrics['mae_kelvin'] = float(mae.values)
    
    # Bias
    bias = (pred.t2m - obs_matched.t2m).mean()
    metrics['bias_kelvin'] = float(bias.values)
    
    # Correlation
    pred_flat = pred.t2m.values.flatten()
    obs_flat = obs_matched.t2m.values.flatten()
    corr = np.corrcoef(pred_flat, obs_flat)[0, 1]
    metrics['correlation'] = float(corr)
    
    # Print results
    print("Validation Metrics:")
    print(f"  RMSE: {metrics['rmse_celsius']:.2f} K")
    print(f"  MAE:  {metrics['mae_kelvin']:.2f} K")
    print(f"  Bias: {metrics['bias_kelvin']:.2f} K")
    print(f"  Corr: {metrics['correlation']:.3f}")
    
    # Plot comparison
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    
    # Forecast
    pred.t2m.isel(time=0).plot(ax=axes[0])
    axes[0].set_title('Aurora Forecast')
    
    # Observations
    obs_matched.t2m.isel(time=0).plot(ax=axes[1])
    axes[1].set_title('Actual Observations')
    
    # Error
    error = pred.t2m - obs_matched.t2m
    error.isel(time=0).plot(ax=axes[2], cmap='RdBu_r')
    axes[2].set_title('Forecast Error')
    
    plt.tight_layout()
    plt.savefig('forecast_validation.png', dpi=150)
    
    return metrics

# Run validation
metrics = validate_forecast(
    'data/aurora_forecast_june8.nc',
    'data/era5_observations_june8.nc'
)
```

### Download Verification Data

```python
# Fetch actual observations for forecast period
fetch_era5_data(
    start_date=datetime(2025, 6, 8),
    end_date=datetime(2025, 6, 8, 18),  # 24 hours
    lat_min=58.25, lat_max=70.0,
    lon_min=5.0, lon_max=16.75,
    output_file='data/era5_observations_june8.nc'
)
```

### Benchmark Against Other Models

Compare Aurora against:
- **Persistence** - Assume conditions don't change
- **Climatology** - Historical averages for this date
- **GFS** - NOAA operational model
- **ECMWF** - European operational model

```python
def compare_models(aurora_pred, gfs_pred, obs):
    """Compare Aurora against GFS."""
    aurora_rmse = compute_rmse(aurora_pred, obs)
    gfs_rmse = compute_rmse(gfs_pred, obs)
    
    print(f"Aurora RMSE: {aurora_rmse:.2f} K")
    print(f"GFS RMSE:    {gfs_rmse:.2f} K")
    
    if aurora_rmse < gfs_rmse:
        print(f"✅ Aurora {(gfs_rmse/aurora_rmse - 1)*100:.1f}% better")
    else:
        print(f"❌ GFS {(aurora_rmse/gfs_rmse - 1)*100:.1f}% better")
```

---

## 8. Common Patterns & Recipes

### Pattern 1: Multi-Region Comparison

Run forecasts for multiple regions simultaneously:

```python
regions = {
    'norway': {'lat': (58.25, 70.0), 'lon': (5.0, 16.75)},
    'uk': {'lat': (50.0, 59.0), 'lon': (-8.0, 2.0)},
    'spain': {'lat': (36.0, 44.0), 'lon': (-10.0, 4.0)},
}

for name, bounds in regions.items():
    print(f"Running forecast for {name}...")
    predictions = run_forecast_for_region(**bounds)
    save_forecast(predictions, f'output/{name}_forecast.nc')
```

### Pattern 2: Ensemble Forecasts

Run multiple forecasts with perturbed inputs:

```python
def ensemble_forecast(model, base_batch, num_members=10):
    """Generate ensemble of forecasts."""
    forecasts = []
    
    for i in range(num_members):
        # Add small random perturbation
        perturbed_batch = base_batch + torch.randn_like(base_batch) * 0.01
        
        # Run forecast
        pred = run_forecast(model, perturbed_batch, num_steps=4)
        forecasts.append(pred)
    
    # Compute ensemble mean and spread
    ensemble_mean = torch.stack(forecasts).mean(dim=0)
    ensemble_std = torch.stack(forecasts).std(dim=0)
    
    return ensemble_mean, ensemble_std

# Use ensemble for uncertainty quantification
mean, uncertainty = ensemble_forecast(model, input_batch)
```

### Pattern 3: Real-Time Updates

Continuously fetch new data and run forecasts:

```python
import schedule
import time

def run_latest_forecast():
    """Fetch latest data and run forecast."""
    # Get current time
    now = datetime.utcnow()
    start = now - timedelta(hours=12)  # Last 12 hours
    
    # Fetch latest ERA5 (6-hour delay for reanalysis)
    if now.hour >= 6:
        fetch_cds_data(start, now)
        
        # Run forecast
        predictions = run_aurora_inference()
        
        # Update frontend
        update_visualization(predictions)
        
        print(f"✅ Forecast updated at {now}")

# Schedule every 6 hours
schedule.every(6).hours.do(run_latest_forecast)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### Pattern 4: Seasonal Adaptation

Adjust parameters by season:

```python
def get_seasonal_config(date):
    """Adjust forecast config by season."""
    month = date.month
    
    if month in [12, 1, 2]:  # Winter
        return {
            'num_steps': 6,  # Longer stable horizon
            'variables': ['t2m', 'u10', 'v10', 'msl', 'tp'],
            'description': 'Winter - Include precipitation'
        }
    elif month in [6, 7, 8]:  # Summer
        return {
            'num_steps': 4,  # Shorter due to convection
            'variables': ['t2m', 'tcc', 'ssr'],  # Add solar/cloud
            'description': 'Summer - Include radiation'
        }
    else:  # Spring/Fall
        return {
            'num_steps': 4,
            'variables': ['t2m', 'u10', 'v10', 'msl'],
            'description': 'Transition season'
        }

config = get_seasonal_config(datetime.now())
predictions = run_forecast(num_steps=config['num_steps'])
```

---

## 9. Troubleshooting Advanced Issues

### Issue: Grid Edge Artifacts

**Symptom:** Unrealistic values near edges of domain

**Solution 1 - Larger domain:**
```python
# Instead of 48×48, use 64×64 or 80×80
# Gives more boundary buffer
```

**Solution 2 - Edge blending:**
```python
def blend_edges(predictions, blend_width=4):
    """Smooth predictions near domain edges."""
    for pred in predictions:
        # Create weight mask (1 in center, 0 at edges)
        weight = np.ones_like(pred)
        weight[:blend_width, :] *= np.linspace(0, 1, blend_width)[:, None]
        weight[-blend_width:, :] *= np.linspace(1, 0, blend_width)[:, None]
        weight[:, :blend_width] *= np.linspace(0, 1, blend_width)
        weight[:, -blend_width:] *= np.linspace(1, 0, blend_width)
        
        # Apply smoothing near edges
        pred *= weight
    
    return predictions
```

### Issue: Temporal Discontinuities

**Symptom:** Jumps between timesteps

**Solution - Temporal smoothing:**
```python
def smooth_temporal(predictions, alpha=0.3):
    """Apply temporal smoothing to predictions."""
    smoothed = [predictions[0]]  # Keep first unchanged
    
    for i in range(1, len(predictions)):
        # Blend with previous timestep
        smoothed_pred = (alpha * predictions[i-1] + 
                        (1-alpha) * predictions[i])
        smoothed.append(smoothed_pred)
    
    return smoothed
```

### Issue: Slow CDS Downloads

**Solution - Parallel downloads:**
```python
from concurrent.futures import ThreadPoolExecutor

def parallel_cds_fetch(date_ranges):
    """Download multiple date ranges in parallel."""
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for start, end in date_ranges:
            future = executor.submit(fetch_cds_data, start, end)
            futures.append(future)
        
        results = [f.result() for f in futures]
    
    return results
```

---

## 10. Production Checklist

**Before deploying your Aurora forecast service:**

- [ ] **Grid validation** - All dimensions divisible by 16
- [ ] **Forecast stability** - Tested at target horizon, no divergence
- [ ] **Data pipeline** - Automated CDS fetching with error handling
- [ ] **API rate limits** - CDS request throttling implemented
- [ ] **Model caching** - Aurora checkpoint loaded once at startup
- [ ] **Error monitoring** - Logging, alerts for failed forecasts
- [ ] **Validation metrics** - Regular comparison against observations
- [ ] **Backup data** - Local cache of recent ERA5 data
- [ ] **Performance testing** - Load tested for expected traffic
- [ ] **Documentation** - API docs, usage examples
- [ ] **Version pinning** - Locked dependency versions
- [ ] **Rollback plan** - Previous model checkpoint available

---

## 11. Example Use Cases

### Use Case 1: Wind Farm Operations

```python
# Predict 48h wind speeds for turbine control
def wind_farm_forecast(farm_lat, farm_lon):
    # 64×64 grid centered on farm
    grid_bounds = {
        'lat_min': farm_lat - 4,
        'lat_max': farm_lat + 4,
        'lon_min': farm_lon - 4,
        'lon_max': farm_lon + 4,
    }
    
    # 48h forecast (8 steps)
    predictions = run_aurora_inference(grid_bounds, num_steps=8)
    
    # Extract wind speed at farm location
    wind_speed = compute_wind_speed(predictions, farm_lat, farm_lon)
    
    # Optimize turbine settings
    setpoints = optimize_turbines(wind_speed)
    
    return setpoints
```

### Use Case 2: Solar Energy Forecasting

```python
# Predict cloud cover for PV output estimation
def solar_forecast(panel_locations):
    predictions = run_aurora_inference(
        variables=['t2m', 'tcc', 'ssr']  # Add cloud cover, solar radiation
    )
    
    # Estimate PV output for each location
    pv_output = []
    for loc in panel_locations:
        cloud = extract_at_point(predictions['tcc'], loc)
        solar = extract_at_point(predictions['ssr'], loc)
        output = estimate_pv_output(cloud, solar)
        pv_output.append(output)
    
    return pv_output
```

### Use Case 3: Emergency Response

```python
# Issue frost warnings for agriculture
def frost_warning_system(region_bounds):
    # 24h forecast
    predictions = run_aurora_inference(region_bounds, num_steps=4)
    
    # Check for sub-zero temperatures
    frost_risk = []
    for i, pred in enumerate(predictions):
        temp_celsius = pred['t2m'] - 273.15
        frost_mask = temp_celsius < 0
        
        if frost_mask.any():
            frost_risk.append({
                'timestep': i,
                'affected_area': frost_mask.sum(),
                'min_temp': temp_celsius.min(),
            })
    
    # Send alerts
    if frost_risk:
        send_frost_alerts(frost_risk)
    
    return frost_risk
```

---

## Summary

**You've learned:**
- ✅ Change region (grid divisibility, boundary considerations)
- ✅ Fetch CDS data (API setup, download scripts)
- ✅ Adjust forecast horizon (stability analysis, divergence detection)
- ✅ Add variables (ERA5 catalog, Aurora compatibility)
- ✅ Optimize performance (GPU/CPU, memory, batching)
- ✅ Deploy services (FastAPI, Docker, Azure)
- ✅ Validate predictions (metrics, comparisons, benchmarks)
- ✅ Production patterns (ensemble, real-time, seasonal)

**Next steps:**
- Start with small modifications to Norway example
- Test thoroughly before production deployment
- Share feedback and improvements with community

**Need help?** Ask Copilot with specific error messages or requirements.

---

**Part of:** [Aurora Innovation Kit](.vibe-kit/innovation-kits/aurora/INNOVATION_KIT.md)  
**Reference code:** [assets/norway-example/](.vibe-kit/innovation-kits/aurora/assets/norway-example/)  
**Previous:** [norway-technical-guide.md](norway-technical-guide.md)
