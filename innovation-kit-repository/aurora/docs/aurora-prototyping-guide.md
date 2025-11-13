# Building Aurora Prototypes from Scratch

**Start here if you want to understand Aurora fundamentals and build your own application from the ground up.**

> **Which guide should I use?**
> - **This guide (From Scratch):** You want to learn Aurora's core concepts—data requirements, batch construction, inference patterns—and build your own application without starting from an existing example.
> - **[prototyping-guide.md](prototyping-guide.md) (Customization):** You've run the Norway example and want to adapt it for your region. Start with working code and modify incrementally.

> **When to fine-tune Aurora:**
> This guide uses the **pretrained base Aurora model** with your own ERA5 data for inference. The base model works well for general weather forecasting.
> 
> However, if your use case requires:
> - **Domain-specific behavior** (e.g., microclimates, urban heat islands, specialized maritime conditions)
> - **Improved accuracy** for a specific region or phenomenon
> - **Custom variables** not in Aurora's original training set
> 
> → See the **[Aurora Fine-tuning Innovation Kit](../../aurora-finetune/)** to adapt Aurora's weights to your specialized dataset.

---

## Overview

> **Execution reminder:** All code paths in this guide run locally with the bundled checkpoint and ERA5 tiles. 
> When you are ready to offload inference to Azure AI Foundry, export the four `AZURE_AURORA_*` environment variables 
> (documented in `PROTOTYPE-DOCUMENTATION.md`) and the same scripts will call your hosted deployment while falling back to local mode on errors.

This guide walks through building a complete Aurora prototype from scratch. 
Follow these steps to adapt it to your domain.

## Prerequisites

### Environment Setup

```bash
# 1. Clone Aurora repo (optional, for reference)
git clone https://github.com/microsoft/aurora.git
cd aurora

# 2. Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# 3. Install Aurora
pip install microsoft-aurora

# 4. Install supporting libraries
pip install numpy xarray netcdf4 pandas matplotlib torch
```

### Verify Installation

```bash
python -c "from aurora import Aurora, AuroraSmallPretrained; print('✓ Aurora ready')"
```

### Getting Your Data

Before building a prototype, you need **Aurora-compatible data**. Use these official resources:

1. **Download from Copernicus Climate Data Store (CDS)**  
   https://cds.climate.copernicus.eu/
   - Free registration required
   - Search: "ERA5 hourly data on single levels from 1979 to present"
   - Select: Wind (u10, v10), Temperature (t2m), Pressure (msl)
   - Region: Any area of interest globally
   - Format: NetCDF (.nc)
   - Download: Typically 1–10 GB per year depending on region

2. **Reference: Aurora Documentation**  
   https://microsoft.github.io/aurora/usage.html
   - Complete variable specifications
   - Batch construction guide
   - Troubleshooting tips

3. **Validation: Inspect Your Downloaded Data**  
   ```bash
   # After downloading, check compatibility
   python scripts/inspect_data.py --data-path ./your_data_folder
   ```
   This will show:
   - Available variables (u10, v10, t2m, msl, etc.)
   - Data shapes and dimensions
   - Batch construction test result

---

## Phase 1: Understand Your Data

### Step 1.1: Why Aurora Needs 2 Consecutive Timesteps

Aurora requires **2 timesteps exactly 6 hours apart** to make accurate predictions. This is NOT about training data format—it's fundamental to how the model understands atmospheric dynamics.

**What Aurora captures from 2 timesteps:**

1. **Current atmospheric state** (timestep T)
   - Temperature, pressure, wind, humidity at T
   - Spatial distribution of all variables

2. **Atmospheric trends** (difference between T and T-1)
   - Wind acceleration/deceleration
   - Temperature changes (heating/cooling rates)
   - Pressure tendencies (rising/falling)
   - Moisture flux convergence/divergence

**Analogy:** Predicting a car's future position requires knowing both its current location AND its velocity. One timestep = location only. Two timesteps = location + velocity.

This temporal pairing allows Aurora to understand **where the atmosphere is** and **where it's going**, which is essential for forecasting.

---

### Step 1.2: Data Requirements

Aurora expects data in **NetCDF** or **HDF5** format with the following structure:

#### Surface Variables (Required)
```
u10   → 10-meter zonal wind (m/s)
v10   → 10-meter meridional wind (m/s)
t2m   → 2-meter temperature (K)
msl   → Mean sea level pressure (Pa)
```

#### Atmospheric Variables (Optional but Recommended)
```
t     → Temperature at pressure levels (K)
u     → Zonal wind at pressure levels (m/s)
v     → Meridional wind at pressure levels (m/s)
q     → Specific humidity at pressure levels (kg/kg)
z     → Geopotential at pressure levels (m^2/s^2)
```

#### Static Variables (Optional)
```
lsm   → Land-sea mask (0=water, 1=land)
z     → Elevation (m)
slt   → Soil type (categorical)
```

#### Coordinates (Required)
```
latitude  → [-90, 90] (degrees)
longitude → [0, 360] or [-180, 180] (degrees)
time      → ISO 8601 timestamps or numeric time indices
level / pressure_level → Atmospheric pressure levels (hPa) if using atmospheric vars
```

### Step 1.2: Inspect Your Data

```bash
# Use the inspection script
python scripts/inspect_data.py
```

This will:
1. List all `.nc` files in your data directory
2. Show dimensions, variables, and coordinates
3. Check Aurora compatibility
4. Sample wind speeds from your data
5. Test Aurora Batch construction

### Step 1.3: Example: CDS ERA5 Data

If you downloaded from Copernicus Climate Data Store:

```bash
# Download via CDS API
cds-retrieve 'reanalysis-era5-single-levels' {
  'year': '2025',
  'month': '08',
  'day': '01',
  'time': '12:00',
  'variable': ['10m_u_component_of_wind', '10m_v_component_of_wind',
               '2m_temperature', 'mean_sea_level_pressure']
  'format': 'netcdf'
}
```

**Variable Mapping (CDS → Aurora):**
```python
cds_var_map = {
    '10m_u_component_of_wind': 'u10',
    '10m_v_component_of_wind': 'v10',
    '2m_temperature': 't2m',
    'mean_sea_level_pressure': 'msl',
}
```

---

## Phase 2: Load Data into Aurora Format

### Step 2.1: Create a Batch Loader

The `Batch` object is Aurora's data container. It requires:
- **surf_vars**: Surface variables (dict of torch tensors)
- **static_vars**: Static features (dict of torch tensors)
- **atmos_vars**: Atmospheric profiles (dict of torch tensors)
- **metadata**: Lat/lon/time information

### Step 2.2: Load Example

```python
import torch
import xarray as xr
import numpy as np
from aurora import Batch, Metadata
from pathlib import Path

def load_era5_batch(file_path):
    """Load ERA5 NetCDF into Aurora Batch."""
    
    # 1. Open with xarray
    ds = xr.open_dataset(file_path, engine="netcdf4")
    
    # 2. Extract surface variables (required)
    surf_vars = {}
    for key in ("u10", "v10", "t2m", "msl"):
        if key in ds:
            data = ds[key].values.astype(np.float32)
            
            # Ensure 4D shape: (batch, time, lat, lon)
            if data.ndim == 3:
                data = data[np.newaxis, :, :, :]  # Add batch
            elif data.ndim == 2:
                data = data[np.newaxis, np.newaxis, :, :]  # Add batch + time
            
            surf_vars[key] = torch.from_numpy(data)
    
    # 3. Extract static variables (optional, can use dummy)
    static_vars = {}
    for key in ("lsm", "z", "slt"):
        if key in ds:
            data = ds[key].values.astype(np.float32)
            if data.ndim == 3:
                data = data[0, :, :]  # Take first time step
            static_vars[key] = torch.from_numpy(data)
        else:
            # Use dummy if not available
            lat_size = surf_vars["u10"].shape[2]
            lon_size = surf_vars["u10"].shape[3]
            static_vars[key] = torch.randn(lat_size, lon_size)
    
    # 4. Extract atmospheric variables (optional, can use dummy)
    atmos_vars = {}
    for key in ("t", "u", "v", "q", "z"):
        if key in ds:
            data = ds[key].values.astype(np.float32)
            if data.ndim == 4:  # (time, level, lat, lon)
                data = data[np.newaxis, :, :, :, :]  # Add batch
            elif data.ndim == 3:  # (level, lat, lon)
                data = data[np.newaxis, np.newaxis, :, :, :]  # Add batch + time
            atmos_vars[key] = torch.from_numpy(data)
        else:
            # Use dummy
            batch = surf_vars["u10"].shape[0]
            time = surf_vars["u10"].shape[1]
            lat = surf_vars["u10"].shape[2]
            lon = surf_vars["u10"].shape[3]
            atmos_vars[key] = torch.randn(batch, time, 4, lat, lon)
    
    # 5. Extract metadata
    lat = torch.from_numpy(ds["latitude"].values.astype(np.float32"))
    lon = torch.from_numpy(ds["longitude"].values.astype(np.float32"))
    
    # Convert time if available
    time_tuple = ()
    if "time" in ds:
        from datetime import datetime
        times = ds["time"].values
        time_tuple = tuple(datetime.utcfromtimestamp(int(t) / 1e9) for t in times[:1])
    
    atmos_levels = (100, 250, 500, 850)  # hPa
    
    # 6. Construct Batch
    batch = Batch(
        surf_vars=surf_vars,
        static_vars=static_vars,
        atmos_vars=atmos_vars,
        metadata=Metadata(
            lat=lat,
            lon=lon,
            time=time_tuple,
            atmos_levels=atmos_levels,
        ),
    )
    
    return batch

# Usage
batch = load_era5_batch("./data/era5_data.nc")
print(f"Batch shape: {batch.surf_vars['u10'].shape}")  # (batch, time, lat, lon)
```

---

## Phase 3: Run Aurora Forecast

### Step 3.1: Load Model

```python
import torch
from aurora import AuroraSmallPretrained, rollout

# Create model
model = AuroraSmallPretrained()

# Load checkpoint (first run: ~500 MB download)
model.load_checkpoint()  # Default: microsoft/aurora, aurora-0.25-small-pretrained.ckpt

# Move to GPU if available
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device).eval()

print(f"Model on {device}: {next(model.parameters()).device}")
```

### Step 3.2: Single-Step Prediction

```python
import torch

# Move batch to device
batch = batch.to(device)

# Run forward pass
with torch.inference_mode():
    prediction = model.forward(batch)

# Extract predictions
u10_pred = prediction.surf_vars["u10"]  # (batch, time, lat, lon)
v10_pred = prediction.surf_vars["v10"]
t2m_pred = prediction.surf_vars["t2m"]

print(f"U10 prediction shape: {u10_pred.shape}")
print(f"U10 mean: {u10_pred.mean().item():.2f} m/s")
```

### Step 3.3: Multi-Step Forecast (Autoregressive)

```python
# Forecast 4 steps ahead (each step = 6 hours typically)
with torch.inference_mode():
    forecasts = [pred.to("cpu") for pred in rollout(model, batch, steps=4)]

# Extract wind speeds from each step
wind_speeds = []
for i, pred in enumerate(forecasts):
    u10 = pred.surf_vars["u10"][0, 0].numpy()  # [lat, lon]
    v10 = pred.surf_vars["v10"][0, 0].numpy()
    
    wind_speed = np.sqrt(u10**2 + v10**2).mean()  # Spatial mean
    wind_speeds.append(wind_speed)
    print(f"Step {i+1}: {wind_speed:.2f} m/s")

wind_speeds = np.array(wind_speeds)
```

---

## Phase 4: Apply Domain Logic

### Step 4.1: Extract & Transform Data

For operational forecasting:

```python
def extract_weather_features(forecasts):
    """Extract wind speed and direction from Aurora predictions."""
    
    results = []
    
    for step_idx, pred in enumerate(forecasts):
        # Extract 10-meter wind
        u10 = pred.surf_vars["u10"][0, 0].numpy()  # (lat, lon)
        v10 = pred.surf_vars["v10"][0, 0].numpy()
        
        # Compute wind speed and direction
        wind_speed = np.sqrt(u10**2 + v10**2)
        wind_direction = np.arctan2(v10, u10) * 180 / np.pi  # degrees
        
        # Farm-level statistics (spatial mean)
        ws_mean = wind_speed.mean()
        wd_mean = wind_direction.mean()
        
        results.append({
            'step': step_idx + 1,
            'wind_speed_ms': ws_mean,
            'wind_direction_deg': wd_mean,
            'wind_speed_field': wind_speed,  # Full grid for spatial analysis
            'wind_direction_field': wind_direction,
        })
    
    return results
```

### Step 4.2: Apply Power Curve & Control Logic

```python
def apply_turbine_control(wind_speed):
    """Siemens 5MW power curve + blade pitch control."""
    
    power_kw = np.zeros_like(wind_speed, dtype=np.float32)
    
    # Region I: Cut-in (3 m/s)
    mask_i = (wind_speed >= 3.0) & (wind_speed < 5.0)
    power_kw[mask_i] = ((wind_speed[mask_i] - 3.0) / 2.0) ** 2 * 1000.0
    
    # Region II: Aerodynamic (5–13 m/s)
    mask_ii = (wind_speed >= 5.0) & (wind_speed < 13.0)
    power_kw[mask_ii] = (wind_speed[mask_ii] ** 3 / 13.0 ** 3) * 4500.0
    
    # Region III: Pitch-controlled (13–25 m/s)
    mask_iii = (wind_speed >= 13.0) & (wind_speed < 25.0)
    power_kw[mask_iii] = 5000.0
    
    # Blade pitch
    pitch_deg = np.zeros_like(wind_speed)
    pitch_deg[mask_i | mask_ii] = 0.0  # Optimal for aerodynamic
    pitch_deg[mask_iii] = (wind_speed[mask_iii] - 13.0) / (25.0 - 13.0) * 27.0
    pitch_deg[wind_speed >= 25.0] = 90.0  # Feathered (cut-out)
    
    return power_kw, pitch_deg
```

> **Grid-safe vs target power:** Pair the raw `power_kw` output with a ramp limiter (`apply_power_ramp_limit`) so the turbine eases toward the target setpoint. In the energy prototype this cap is `MAX_RAMP_RATE_KW_PER_MIN × 360 min` (ERA5’s 6‑hour step), producing the `power_limited_kw` values surfaced in dashboards and CSV exports.

---

## Phase 5: Output & Visualization

### Step 5.1: Export Results

```python
import pandas as pd
from datetime import datetime

results_df = pd.DataFrame({
    'lead_time_min': [15, 30, 45, 60],
    'wind_speed_ms': wind_speeds,
    'power_kw': power_output,
    'pitch_deg': pitch_angles,
})

# Save
output_file = f"forecast_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
results_df.to_csv(output_file, index=False)

print(results_df)
```

### Step 5.2: Visualize

```python
import matplotlib.pyplot as plt

fig, axes = plt.subplots(3, 1, figsize=(10, 9))

# Wind speed
axes[0].plot(results_df['lead_time_min'], results_df['wind_speed_ms'], 'o-')
axes[0].set_ylabel('Wind Speed (m/s)')
axes[0].set_title('Aurora Forecast')

# Power
axes[1].plot(results_df['lead_time_min'], results_df['power_kw'], 'o-')
axes[1].set_ylabel('Power (kW)')

# Pitch
axes[2].plot(results_df['lead_time_min'], results_df['pitch_deg'], 'o-')
axes[2].set_ylabel('Blade Pitch (°)')
axes[2].set_xlabel('Lead Time (min)')

plt.tight_layout()
plt.savefig('aurora_forecast.png', dpi=150)
```

---

## Phase 6: Production Integration

For production deployment patterns, see:
- [performance-guide.md](performance-guide.md) - Hardware sizing and optimization
- [application-patterns.md](application-patterns.md) - Domain-specific workflow templates

---

## Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'aurora'`
**Solution**: Install Aurora: `pip install microsoft-aurora`

### Issue: GPU out of memory
**Solution**: 
- Use `AuroraSmallPretrained` instead of `Aurora` (smaller model)
- Reduce spatial resolution or batch size
- Use CPU: no GPU needed, just slower

### Issue: Data variables not found
**Solution**:
- Run `python scripts/inspect_data.py` to check variable names
- Verify your data has required variables (u10, v10, t2m, msl)
- Use dummy tensors if variables are missing

### Issue: Data shape mismatch
**Solution**:
- Aurora expects 4D tensors: (batch, time, lat, lon)
- Check your data has these dimensions
- Use `data.reshape()` or `np.expand_dims()` as needed

---

## Template: Your First Prototype

Use this template to build your own:

```python
#!/usr/bin/env python3
"""
YOUR_DOMAIN Aurora Prototype

Replace with your domain-specific variables (e.g., flood risk, crop conditions, energy demand, etc.)
"""

import torch
import numpy as np
from pathlib import Path
from aurora import AuroraSmallPretrained, rollout, Batch, Metadata

# 1. Load your data
def load_your_data(file_path):
    # TODO: Implement for your data format
    pass

# 2. Build domain logic
def apply_your_domain_logic(forecasts):
    # TODO: Extract features relevant to your domain
    pass

# 3. Main workflow
if __name__ == "__main__":
    # Setup
    model = AuroraSmallPretrained()
    model.load_checkpoint()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device).eval()
    
    # Load data
    batch = load_your_data("./data/your_data.nc")
    batch = batch.to(device)
    
    # Run forecast
    with torch.inference_mode():
        forecasts = [pred.to("cpu") for pred in rollout(model, batch, steps=4)]
    
    # Apply domain logic
    results = apply_your_domain_logic(forecasts)
    
    # Export
    print(results)
```

---

## References

- **Aurora GitHub**: https://github.com/microsoft/aurora
- **Aurora Docs**: https://microsoft.github.io/aurora/usage.html
- **Paper**: Nature 2025, "A Foundation Model for the Earth System"
- **CDS API**: https://cds.climate.copernicus.eu/how-to-api
- **Torch Documentation**: https://pytorch.org/docs/

---

## Next Steps

1. ✅ Understand your data format
2. ✅ Load data into Aurora Batch
3. ✅ Run Aurora forecast on your domain
4. ✅ Apply your domain-specific logic
5. ✅ Validate forecast accuracy
6. ✅ Deploy to production

Questions? Open an issue on [GitHub](https://github.com/microsoft/aurora/issues).
