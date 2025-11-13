# Norway Technical Guide: Aurora Inference Deep Dive

**Understand how Aurora generates 24-hour weather forecasts for Norway's coastal region.**

This technical guide explains Aurora's architecture, data requirements, and inference mechanics using the Norway example. After reading, you'll understand every line of `run_aurora_inference.py` and why design decisions were made.

---

## Overview

**What this guide covers:**
- Aurora's input/output requirements (why 2 timesteps, why 48×48 grid)
- Script architecture (`run_aurora_inference.py` internals)
- Model mechanics (patch encoder, rollout loop, autoregressive prediction)
- Stability analysis (why 24h works, why 7 days diverges)
- NetCDF structure and variable mappings

**Prerequisites:** Complete [quick-start.md](quick-start.md) first to have working example.

---

## 1. Aurora Model Specifications

### Model Details

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Model variant** | AuroraSmall | 1.3B parameters, 5.03GB checkpoint |
| **Patch size** | 16×16 cells | Grid dimensions MUST be divisible by 16 |
| **Input timesteps** | 2 consecutive | 6 hours apart (e.g., 12:00 + 18:00) |
| **Output per step** | 1 timestep | 6 hours ahead of last input |
| **Autoregressive** | Yes | Output becomes input for next step |
| **Training data** | Global ERA5 | 1979-2023, 0.25° resolution |

### Norway Example Configuration

| Parameter | Value |
|-----------|-------|
| **Grid size** | 48×48 cells (2,304 points) |
| **Resolution** | 0.25° (~28km at 60°N) |
| **Coverage** | 58.25-70°N, 5-16.75°E |
| **Forecast steps** | 4 (24 hours: 00:00, 06:00, 12:00, 18:00 on June 8) |
| **Input data** | June 7 at 12:00 and 18:00 (CDS ERA5) |

---

## 2. Why 2 Input Timesteps?

### Atmospheric State vs Trends

Aurora requires **2 consecutive timesteps exactly 6 hours apart** to capture:

**Timestep 1 (T-6h, e.g., June 7 12:00):**
- Temperature distribution
- Pressure field
- Wind field
- Humidity profile

**Timestep 2 (T, e.g., June 7 18:00):**
- Same variables, 6 hours later

**Derived information (T2 - T1):**
- **Wind acceleration:** Is the jet stream strengthening or weakening?
- **Temperature trends:** Heating or cooling? How fast?
- **Pressure tendencies:** Rising (fair weather) or falling (storm approaching)?
- **Moisture flux:** Convergence (precipitation forming) or divergence?

**Analogy:** Predicting where a car will be in 1 hour requires:
1. Current position (Timestep 2)
2. Velocity (difference between Timestep 2 and Timestep 1)

One timestep = position only → Can't predict motion  
Two timesteps = position + velocity → Can extrapolate trajectory

### Common Misconception

**WRONG:** "Aurora outputs 2 timesteps per forecast step, so it needs 2 inputs"  
**CORRECT:** Aurora outputs **1 timestep** per rollout step. It needs 2 inputs to understand atmospheric dynamics (state + trends).

---

## 3. Grid Constraints: Why 48×48?

### Patch Size Requirement

Aurora's encoder divides the grid into **16×16 patches**:

```
Input grid: 48×48 cells
↓
Divided into: (48÷16) × (48÷16) = 3×3 = 9 patches
↓
Each patch: 16×16 = 256 cells processed together
```

**Critical constraint:** Grid dimensions MUST be divisible by 16.

**Valid grid sizes:**
- 48×48 (3×3 patches) - Small regional, used in Norway example
- 64×64 (4×4 patches) - Medium regional
- 80×80 (5×5 patches) - Larger regions, better boundary conditions
- 128×128 (8×8 patches) - Very large regional or small continental

**Invalid sizes cause errors:**
- 50×50 → `ValueError: Grid dimensions must be divisible by 16`
- 60×60 → Same error
- 45×45 → Same error

### Why Not Larger Grids?

**Trade-offs:**

| Grid Size | Points | Patches | Pros | Cons |
|-----------|--------|---------|------|------|
| **48×48** | 2,304 | 9 | Fast inference (5-10 min) | Limited boundary context |
| **64×64** | 4,096 | 16 | Better boundaries | Slower (8-15 min) |
| **80×80** | 6,400 | 25 | Good boundaries, stable | Much slower (15-25 min) |
| **128×128** | 16,384 | 64 | Excellent boundaries | Very slow (30-60 min), high VRAM |

**Norway example uses 48×48** for:
- Fast prototyping (5-10 min on GPU)
- Easy local development (works on laptops)
- Still demonstrates Aurora's capabilities

**Production systems** might use 64×64 or 80×80 for better accuracy.

---

## 4. Why Only 24-Hour Forecasts?

### Model Stability Analysis

Aurora was trained on **global grids** with boundary conditions from all sides. On **small regional grids** (48×48), predictions diverge after 24-48 hours.

**Tested forecast horizons:**

| Steps | Hours | Result | Temp Range | Notes |
|-------|-------|--------|------------|-------|
| **4** | **24h** | ✅ **Stable** | 0-15°C | Realistic, smooth evolution |
| 8 | 48h | ⚠️ Marginal | -5 to 20°C | Some boundary artifacts |
| 16 | 96h | ❌ Diverged | -30 to 50°C | Unrealistic extremes |
| 28 | 168h (7d) | ❌ Badly diverged | -100 to 228°C | Vertical striping, model breakdown |

### Why Divergence Happens

**Problem:** Small regional grids lack surrounding atmospheric context.

**Global forecast (Aurora's training data):**
```
[Ocean] → [Europe] → [Asia]
   ↓         ↓         ↓
Full atmospheric circulation context
```

**Regional forecast (Norway 48×48):**
```
[???] → [Norway] → [???]
          ↓
Limited context, artificial boundaries
```

**What goes wrong:**
1. **Boundary errors:** Aurora extrapolates from edges without knowing what's beyond
2. **Error accumulation:** Each 6-hour step compounds boundary artifacts
3. **Atmospheric imbalance:** Energy/momentum conservation breaks down at edges
4. **Feedback loops:** Small errors amplify through autoregressive prediction

**Solutions for longer forecasts:**
- **Larger grids** (64×64, 80×80) - More boundary buffer
- **Boundary relaxation** - Blend with global forecast at edges (not implemented in example)
- **Ensemble methods** - Run multiple forecasts, average results
- **Hybrid approach** - Aurora for first 24h, traditional NWP for days 2-7

---

## 5. Script Architecture: `run_aurora_inference.py`

### High-Level Flow

```python
1. Load Aurora model checkpoint (5.03 GB)
2. Load 2 input timesteps from NetCDF files
3. Convert to Aurora's Batch format
4. Run rollout loop (4 iterations):
   a. Model predicts next 6-hour state
   b. Extract prediction [0,0] (first timestep of first batch)
   c. Append to output
   d. Use last 2 states as input for next iteration
5. Save predictions to NetCDF
```

### Key Functions

#### `load_aurora_model(device='cuda')`

```python
def load_aurora_model(device='cuda'):
    """Load Aurora model from HuggingFace."""
    model = AuroraSmall()
    checkpoint = torch.hub.load_state_dict_from_url(
        "https://huggingface.co/microsoft/aurora/resolve/main/aurora-0.25-small-pretrained.ckpt",
        map_location=device
    )
    model.load_state_dict(checkpoint)
    model.eval()
    return model.to(device)
```

**What happens:**
1. Initialize AuroraSmall architecture (1.3B parameters)
2. Download checkpoint from HuggingFace (5.03GB, cached locally)
3. Load weights into model
4. Set to evaluation mode (disable dropout, batch norm)
5. Move to GPU or CPU

**First run:** Downloads checkpoint (~10 min on slow connection)  
**Subsequent runs:** Loads from cache (`~/.cache/huggingface/`)

#### `load_era5_input(surf_file, atmos_file, start_time, grid_bounds)`

```python
def load_era5_input(surf_file, atmos_file, start_time, grid_bounds):
    """Load 2 consecutive timesteps from CDS ERA5 data."""
    # Read NetCDF files
    surf_ds = xr.open_dataset(surf_file)
    atmos_ds = xr.open_dataset(atmos_file)
    
    # Extract spatial subset
    lat_slice = slice(grid_bounds['lat_max'], grid_bounds['lat_min'])
    lon_slice = slice(grid_bounds['lon_min'], grid_bounds['lon_max'])
    
    # Get 2 consecutive timesteps (6 hours apart)
    time1 = start_time
    time2 = start_time + timedelta(hours=6)
    
    # Extract variables at both times
    batch = create_aurora_batch(surf_ds, atmos_ds, [time1, time2], 
                                  lat_slice, lon_slice)
    return batch
```

**Steps:**
1. Open NetCDF files (surface + atmospheric)
2. Crop to region (58.25-70°N, 5-16.75°E)
3. Extract timesteps T and T+6h
4. Organize into Aurora's Batch format

**Critical:** Ensures exactly 2 timesteps, 6 hours apart, with all required variables.

#### `run_forecast(model, initial_batch, num_steps=4)`

```python
def run_forecast(model, initial_batch, num_steps=4):
    """Run autoregressive forecast rollout."""
    predictions = []
    current_batch = initial_batch
    
    for step in range(num_steps):
        with torch.no_grad():
            # Predict next timestep
            pred_batch = model.forward(current_batch)
            
            # Extract prediction (first timestep of first sample)
            pred_state = pred_batch[0, 0]  # Shape: [variables, lat, lon]
            predictions.append(pred_state)
            
            # Update batch: [timestep_2, prediction] becomes new input
            current_batch = create_batch_from_states(
                current_batch[0, 1],  # Previous timestep 2
                pred_state             # New prediction
            )
    
    return predictions
```

**Autoregressive loop:**
```
Input:  [T-6h, T]    → Predict [T+6h]
Input:  [T, T+6h]    → Predict [T+12h]
Input:  [T+6h, T+12h] → Predict [T+18h]
Input:  [T+12h, T+18h] → Predict [T+24h]
```

**Key details:**
- `torch.no_grad()` - Disable gradient computation (inference only)
- `pred_batch[0, 0]` - Extract first timestep (Aurora outputs 1 step per rollout)
- Sliding window - Last 2 states always form next input

#### `save_forecast_netcdf(predictions, output_path, metadata)`

```python
def save_forecast_netcdf(predictions, output_path, metadata):
    """Save predictions to NetCDF file."""
    # Convert predictions to numpy arrays
    temp_data = np.stack([p['t2m'].cpu().numpy() for p in predictions])
    u_wind_data = np.stack([p['u10'].cpu().numpy() for p in predictions])
    v_wind_data = np.stack([p['v10'].cpu().numpy() for p in predictions])
    
    # Create xarray Dataset
    ds = xr.Dataset({
        't2m': (['time', 'lat', 'lon'], temp_data),
        'u10': (['time', 'lat', 'lon'], u_wind_data),
        'v10': (['time', 'lat', 'lon'], v_wind_data),
    }, coords={
        'time': metadata['times'],
        'lat': metadata['lats'],
        'lon': metadata['lons'],
    })
    
    # Add metadata
    ds.attrs['forecast_reference_time'] = metadata['ref_time']
    ds.attrs['model'] = 'Aurora-0.25-small'
    
    # Save to NetCDF
    ds.to_netcdf(output_path)
```

**Output structure:**
```
aurora_forecast_june8.nc
├── Dimensions: time=4, lat=48, lon=48
├── Variables:
│   ├── t2m[time, lat, lon] - 2m temperature (K)
│   ├── u10[time, lat, lon] - 10m U wind (m/s)
│   └── v10[time, lat, lon] - 10m V wind (m/s)
└── Metadata:
    ├── forecast_reference_time: "2025-06-07T18:00:00"
    └── model: "Aurora-0.25-small"
```

---

## 6. Required Variables Explained

### Surface Variables

**File:** `4d2238a45558de23ef37ca2e27a0315.nc`

| Variable | Name | Units | Role |
|----------|------|-------|------|
| **u10** | 10m U-wind | m/s | East-west wind component |
| **v10** | 10m V-wind | m/s | North-south wind component |
| **t2m** | 2m temperature | K | Near-surface temperature |
| **msl** | Mean sea level pressure | Pa | Surface pressure field |

**Static variables (time-independent):**

| Variable | Name | Units | Role |
|----------|------|-------|------|
| **lsm** | Land-sea mask | 0-1 | 0=ocean, 1=land |
| **z** | Surface geopotential | m²/s² | Terrain elevation |
| **slt** | Soil type | category | Land surface properties |

### Atmospheric Variables

**File:** `4a1f46cd2447ab83c1f564af59d53023.nc`

**4 pressure levels:** 1000, 925, 850, 700 hPa

| Variable | Name | Units | Role |
|----------|------|-------|------|
| **z** | Geopotential height | m²/s² | Height of pressure surface |
| **q** | Specific humidity | kg/kg | Water vapor content |
| **t** | Temperature | K | Air temperature |
| **u** | U-wind | m/s | East-west wind |
| **v** | V-wind | m/s | North-south wind |

**Why multiple levels?**

```
700 hPa (~3000m) - Upper level winds, jet streams
850 hPa (~1500m) - Mid-level moisture, temperature inversions
925 hPa (~750m)  - Lower atmosphere, boundary layer
1000 hPa (surface) - Surface conditions
```

Aurora models **3D atmospheric structure** - critical for:
- Wind shear (turbulence, storm formation)
- Temperature inversions (fog, pollution trapping)
- Moisture transport (precipitation formation)
- Jet stream dynamics (storm tracks)

---

## 7. NetCDF Structure Details

### Input File Format (CDS ERA5)

**Surface file structure:**
```python
<xarray.Dataset>
Dimensions:  (time: 28, lat: 61, lon: 61)
Coordinates:
  * time     (time) datetime64[ns] 2025-06-01 ... 2025-06-07T18:00
  * lat      (lat) float32 70.0 69.75 69.5 ... 58.5 58.25
  * lon      (lon) float32 5.0 5.25 5.5 ... 16.5 16.75
Data variables:
    u10      (time, lat, lon) float32 ...
    v10      (time, lat, lon) float32 ...
    t2m      (time, lat, lon) float32 ...
    msl      (time, lat, lon) float32 ...
    lsm      (lat, lon) float32 ...          # No time dimension
    z        (lat, lon) float32 ...
    slt      (lat, lon) float32 ...
```

**Atmospheric file structure:**
```python
<xarray.Dataset>
Dimensions:  (time: 28, level: 4, lat: 61, lon: 61)
Coordinates:
  * time     (time) datetime64[ns] 2025-06-01 ... 2025-06-07T18:00
  * level    (level) int32 1000 925 850 700
  * lat      (lat) float32 70.0 69.75 ... 58.25
  * lon      (lon) float32 5.0 5.25 ... 16.75
Data variables:
    z        (time, level, lat, lon) float32 ...
    q        (time, level, lat, lon) float32 ...
    t        (time, level, lat, lon) float32 ...
    u        (time, level, lat, lon) float32 ...
    v        (time, level, lat, lon) float32 ...
```

### Output File Format (Aurora Predictions)

**Cropped to 48×48 with only forecasted variables:**

```python
<xarray.Dataset>
Dimensions:  (time: 4, lat: 48, lon: 48)
Coordinates:
  * time     (time) datetime64[ns] 2025-06-08 ... 2025-06-08T18:00
  * lat      (lat) float32 70.0 69.75 ... 58.5 58.25
  * lon      (lon) float32 5.0 5.25 ... 16.5 16.75
Data variables:
    t2m      (time, lat, lon) float32 ...    # Temperature only
    u10      (time, lat, lon) float32 ...    # U-wind
    v10      (time, lat, lon) float32 ...    # V-wind
Attributes:
    forecast_reference_time: 2025-06-07T18:00:00
    model: Aurora-0.25-small
```

**Why only 3 variables?** Frontend visualizes temperature. Wind components included for potential wind speed/direction display.

---

## 8. Performance Analysis

### Computational Cost

**GPU (NVIDIA A100 40GB):**
```
Model loading:     30 sec
Data loading:      15 sec
Inference (4 steps): 3 min
Saving output:     10 sec
Total:            ~5 min
```

**CPU (16-core Xeon):**
```
Model loading:     45 sec
Data loading:      20 sec
Inference (4 steps): 16 min
Saving output:     15 sec
Total:            ~18 min
```

### Memory Requirements

**GPU:**
- VRAM: 8-12 GB
- System RAM: 4 GB

**CPU:**
- System RAM: 6-8 GB

**Disk:**
- Model checkpoint: 5.03 GB
- Input data: 4.7 MB
- Output data: 187 KB

---

## 9. Common Issues & Solutions

### Grid Dimension Errors

**Error:**
```
ValueError: Grid dimensions (50, 50) not divisible by patch_size (16)
```

**Solution:** Adjust region to make dimensions divisible by 16:
```python
# BAD: 50×50 grid
lat_range = (58.0, 70.5)  # 50 cells at 0.25°

# GOOD: 48×48 grid
lat_range = (58.25, 70.0)  # 48 cells at 0.25°
```

### Model Divergence

**Symptom:** Temperatures < -50°C or > 50°C

**Causes:**
- Too many forecast steps (>8 for 48×48 grid)
- Missing input variables
- Corrupted input data

**Solution:**
```python
# Reduce forecast horizon
num_steps = 4  # 24h - stable
# num_steps = 8  # 48h - test carefully
# num_steps = 16  # 96h - likely diverges on small grids
```

### CUDA Out of Memory

**Error:**
```
RuntimeError: CUDA out of memory
```

**Solutions:**
1. **Reduce batch size** (line 40 in script):
   ```python
   batch_size = 1  # Already minimal in example
   ```

2. **Use CPU:**
   ```bash
   python3 run_aurora_inference.py --device cpu
   ```

3. **Clear GPU memory:**
   ```python
   torch.cuda.empty_cache()
   ```

---

## 10. Extending the Example

### Change Region

Modify `run_aurora_inference.py` lines 25-30:

```python
# Original: Norway coastal
grid_bounds = {
    'lat_min': 58.25, 'lat_max': 70.0,   # 48 cells
    'lon_min': 5.0,   'lon_max': 16.75   # 48 cells
}

# Example: North Sea (must be divisible by 16)
grid_bounds = {
    'lat_min': 52.0, 'lat_max': 60.0,    # 32 cells (32÷16=2)
    'lon_min': 0.0,  'lon_max': 8.0      # 32 cells
}
```

**Verify:**
```python
lat_cells = int((lat_max - lat_min) / 0.25)
lon_cells = int((lon_max - lon_min) / 0.25)
assert lat_cells % 16 == 0, f"Lat cells {lat_cells} not divisible by 16"
assert lon_cells % 16 == 0, f"Lon cells {lon_cells} not divisible by 16"
```

### Add Variables

To output additional variables (e.g., pressure, humidity):

1. **Modify `save_forecast_netcdf()`** to include more variables from predictions
2. **Update `build_forecast_module.py`** to extract new variables
3. **Update frontend colormap** in `HeatmapOverlay.tsx`

### Extend Forecast Horizon

```python
# Test incrementally
num_steps = 6  # 36h
num_steps = 8  # 48h
num_steps = 12  # 72h (3 days)
```

**Watch for divergence:** Check output temperatures stay within realistic bounds (-20°C to 40°C for summer Norway).

---

## 11. Validation & Debugging

### Check Input Data

```bash
python3 scripts/quick_inspect.py data/4d2238a45558de23ef37ca2e27a0315.nc
```

**Output:**
```
File: 4d2238a45558de23ef37ca2e27a0315.nc
Dimensions: time=28, lat=61, lon=61
Variables: u10, v10, t2m, msl, lsm, z, slt
Time range: 2025-06-01 00:00 to 2025-06-07 18:00
Grid: 58.25-70.0°N, 5.0-16.75°E
✓ All required surface variables present
```

### Visualize Predictions

```python
import xarray as xr
import matplotlib.pyplot as plt

# Load forecast
ds = xr.open_dataset('data/aurora_forecast_june8.nc')

# Plot temperature at first timestep
plt.figure(figsize=(10, 8))
ds.t2m.isel(time=0).plot()
plt.title('Aurora Forecast: June 8, 00:00')
plt.savefig('forecast_t0.png')
```

### Compare Against Observations

Download actual June 8 observations from CDS and compute RMSE:

```python
obs = xr.open_dataset('data/cds_june8_observations.nc')
pred = xr.open_dataset('data/aurora_forecast_june8.nc')

# Align grids
obs_matched = obs.interp_like(pred)

# Compute RMSE
rmse = np.sqrt(((pred.t2m - obs_matched.t2m) ** 2).mean())
print(f"Temperature RMSE: {rmse:.2f} K")
```

---

## 12. Further Reading

**Aurora paper:** [Aurora: A Foundation Model of the Atmosphere](https://www.microsoft.com/en-us/research/publication/aurora/)  
**HuggingFace model:** [microsoft/aurora](https://huggingface.co/microsoft/aurora)  
**CDS ERA5 docs:** [ERA5 hourly data](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels)  
**NetCDF guide:** [Xarray documentation](https://docs.xarray.dev/)

---

## Summary

**Key takeaways:**
- Aurora needs **2 timesteps** to capture atmospheric state + trends
- Grid dimensions **must be divisible by 16** (patch encoder requirement)
- **24-hour forecasts** stable on 48×48 grid; longer horizons may diverge
- Input requires **surface + atmospheric variables** at multiple levels
- Autoregressive rollout: Each prediction becomes input for next step

**Next steps:**
- [prototyping-guide.md](prototyping-guide.md) - Adapt for your scenario
- [application-patterns.md](application-patterns.md) - Explore use cases
- [emergency-fixes.md](emergency-fixes.md) - Troubleshooting reference

---

**Part of:** [Aurora Innovation Kit](.vibe-kit/innovation-kits/aurora/INNOVATION_KIT.md)  
**Reference code:** [assets/norway-example/scripts/run_aurora_inference.py](.vibe-kit/innovation-kits/aurora/assets/norway-example/scripts/run_aurora_inference.py)
