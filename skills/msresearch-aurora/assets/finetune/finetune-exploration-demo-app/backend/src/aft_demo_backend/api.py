"""FastAPI backend for Aurora Finetuning Demo."""

from functools import lru_cache
from pathlib import Path

from aft_demo_backend.lmdb_cache import lmdb_cache

import json

import polars as pl
from fastapi import FastAPI, HTTPException

try:
    import torch

    HAS_MODEL_DEPS = True
except ImportError:
    HAS_MODEL_DEPS = False

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Aurora Finetuning Demo API")

# Enable CORS for frontend
# Using "*" to allow all origins for flexibility; tighten for production deployments
# where the frontend is served from a known origin or proxied to the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data on startup
DATA_PATH = Path(__file__).parent.parent.parent.parent / "assets" / "outputs" / "eval_results.csv"
PERSISTENCE_BASELINE_PATH = (
    Path(__file__).parent.parent.parent.parent / "assets" / "outputs" / "persistence_baseline.json"
)

# Heatmap visualization paths
GRIB_DATA_PATH = (
    Path(__file__).parent.parent.parent.parent / "assets" / "grib_data" / "greece_jan1_jan7_2024"
)
VALIDATION_SINGLE_LEVEL = GRIB_DATA_PATH / "era5_single_level_jan1_jan7_2024.grib"
VALIDATION_PRESSURE_LEVEL = GRIB_DATA_PATH / "era5_pressure_level_jan1_jan7_2024.grib"
CHECKPOINT_BASE = Path(__file__).parent.parent.parent.parent / "assets" / "tb_logs" / "finetuning"
CACHE_DIR = Path(__file__).parent.parent.parent.parent / "assets" / "outputs" / "local_database_storage"

# Dataset to checkpoint version mapping (derived from eval_results.csv)
DATASET_TO_VERSION = {
    "dec25_dec31_2023": "version_1",
    "nov1_dec31_2023": "version_2",
    "jul1_dec31_2023": "version_3",
}

# Human-readable labels for training datasets (ordered from least to most data)
DATASET_ORDER = [
    "dec25_dec31_2023",
    "nov1_dec31_2023",
    "jul1_dec31_2023",
]

DATASET_LABELS = {
    "dec25_dec31_2023": "1 week (Dec 25-31, 2023)",
    "nov1_dec31_2023": "2 months (Nov 1 - Dec 31, 2023)",
    "jul1_dec31_2023": "6 months (Jul 1 - Dec 31, 2023)",
}

VARIABLE_LABELS = {
    "tcc": "Total Cloud Cover (tcc)",
}

_df: pl.DataFrame | None = None

# Cache for validation data (loaded once)
_validation_data: list | None = None


def get_validation_data() -> list:
    """Load and cache validation data from GRIB files."""
    global _validation_data
    if _validation_data is None:
        if not HAS_MODEL_DEPS:
            raise HTTPException(
                status_code=503,
                detail="Model dependencies not installed (slim build). This endpoint requires cached data.",
            )
        from vibe_tune_aurora.data_processing.grib_data_processing import (
            extract_training_data_from_grib,
        )

        _validation_data = extract_training_data_from_grib(
            single_level_file=VALIDATION_SINGLE_LEVEL,
            pressure_level_file=VALIDATION_PRESSURE_LEVEL,
            patch_size=4,
            additional_surface_variables=("tcc",),
        )
    return _validation_data


@lru_cache(maxsize=3)
def get_cached_model(checkpoint_path: str):
    """Load and cache Aurora model from checkpoint."""
    if not HAS_MODEL_DEPS:
        raise HTTPException(
            status_code=503,
            detail="Model dependencies not installed (slim build). This endpoint requires cached data.",
        )
    from vibe_tune_aurora.evaluation import load_aurora_lightning_module

    lit_module = load_aurora_lightning_module(Path(checkpoint_path))
    return lit_module.model  # Return Aurora model


def get_checkpoint_path(dataset: str, num_epochs: int) -> Path:
    """Resolve checkpoint path from dataset and number of epochs trained."""
    version = DATASET_TO_VERSION.get(dataset)
    if version is None:
        raise HTTPException(status_code=400, detail=f"Unknown dataset: {dataset}")

    if num_epochs == 0:
        checkpoint_name = "init.ckpt"
    else:
        # epoch_epoch=00.ckpt corresponds to 1 epoch trained
        checkpoint_name = f"epoch_epoch={num_epochs - 1:02d}.ckpt"

    checkpoint_path = CHECKPOINT_BASE / version / "checkpoints" / checkpoint_name
    if not checkpoint_path.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint not found: {checkpoint_path}")

    return checkpoint_path


def extract_heatmap_data(batch, variable: str) -> dict:
    """Extract 2D surface variable data from Aurora Batch for Plotly heatmap."""
    if variable not in batch.surf_vars:
        raise HTTPException(status_code=400, detail=f"Variable '{variable}' not found in batch")

    tensor = batch.surf_vars[variable]
    # tensor shape: (batch, time, lat, lon) -> extract (lat, lon) for last timestep
    data = tensor.detach().cpu().numpy()[0, -1]
    lat = (
        batch.metadata.lat.tolist()
        if hasattr(batch.metadata.lat, "tolist")
        else list(batch.metadata.lat)
    )
    lon = (
        batch.metadata.lon.tolist()
        if hasattr(batch.metadata.lon, "tolist")
        else list(batch.metadata.lon)
    )

    # Get timestamp from metadata
    timestamp = batch.metadata.time[0].isoformat() if batch.metadata.time else ""

    return {
        "data": data.tolist(),
        "lat": lat,
        "lon": lon,
        "timestamp": timestamp,
        "variable": variable,
        "variable_label": VARIABLE_LABELS.get(variable, variable),
        "min_value": float(data.min()),
        "max_value": float(data.max()),
    }


def extract_static_heatmap_data(batch, variable: str) -> dict:
    """Extract 2D static variable data from Aurora Batch for Plotly heatmap."""
    if variable not in batch.static_vars:
        raise HTTPException(
            status_code=400, detail=f"Static variable '{variable}' not found in batch"
        )

    tensor = batch.static_vars[variable]
    # static_vars shape: (lat, lon) - no batch/time dimensions
    data = tensor.detach().cpu().numpy()
    lat = (
        batch.metadata.lat.tolist()
        if hasattr(batch.metadata.lat, "tolist")
        else list(batch.metadata.lat)
    )
    lon = (
        batch.metadata.lon.tolist()
        if hasattr(batch.metadata.lon, "tolist")
        else list(batch.metadata.lon)
    )

    return {
        "data": data.tolist(),
        "lat": lat,
        "lon": lon,
        "variable": variable,
        "min_value": float(data.min()),
        "max_value": float(data.max()),
    }


def get_data() -> pl.DataFrame:
    """Load and cache the evaluation results data."""
    global _df
    if _df is None:
        if not DATA_PATH.exists():
            raise HTTPException(status_code=500, detail=f"Data file not found: {DATA_PATH}")
        _df = pl.read_csv(DATA_PATH)
    return _df


class DatasetOption(BaseModel):
    """A training dataset option."""

    value: str
    label: str


class VariableOption(BaseModel):
    """A surface variable option."""

    value: str
    label: str


class LossCurvePoint(BaseModel):
    """A single point on the loss curve."""

    num_epochs_trained: int
    train_mae: float
    val_mae: float


class LossCurvesResponse(BaseModel):
    """Response containing loss curves data."""

    dataset: str
    dataset_label: str
    variable: str
    variable_label: str
    points: list[LossCurvePoint]


@app.get("/api/training-datasets", response_model=list[DatasetOption])
def get_training_datasets() -> list[DatasetOption]:
    """Get list of available training datasets, ordered from least to most data."""
    df = get_data()
    available = set(df["data_finetuned_on"].unique().to_list())
    # Return in predefined order, only including available datasets
    return [
        DatasetOption(value=d, label=DATASET_LABELS.get(d, d))
        for d in DATASET_ORDER
        if d in available
    ]


@app.get("/api/surface-variables", response_model=list[VariableOption])
def get_surface_variables() -> list[VariableOption]:
    """Get list of available surface variables."""
    df = get_data()
    variables = df["surface_variable"].unique().sort().to_list()
    return [VariableOption(value=v, label=VARIABLE_LABELS.get(v, v)) for v in variables]


def checkpoint_to_num_epochs(checkpoint_epoch: str) -> int | None:
    """Convert checkpoint epoch string to number of epochs trained.

    - init = 0 (no training yet)
    - epoch0 = 1 (trained for 1 epoch)
    - epoch1 = 2 (trained for 2 epochs)
    - ...
    - last = None (skip, identical to epoch7)
    """
    if checkpoint_epoch == "init":
        return 0
    elif checkpoint_epoch == "last":
        return None  # Skip last, it's identical to epoch7
    else:
        return int(checkpoint_epoch) + 1


@app.get("/api/loss-curves", response_model=LossCurvesResponse)
def get_loss_curves(dataset: str, variable: str) -> LossCurvesResponse:
    """Get train/validation loss curves for a given dataset and variable."""
    df = get_data()

    # Filter for the requested dataset and variable, excluding "last" checkpoint
    filtered = df.filter(
        (pl.col("data_finetuned_on") == dataset)
        & (pl.col("surface_variable") == variable)
        & (pl.col("checkpoint_epoch") != "last")
    )

    if len(filtered) == 0:
        raise HTTPException(
            status_code=404, detail=f"No data found for dataset={dataset}, variable={variable}"
        )

    # Get train and validation data separately
    train_data = filtered.filter(pl.col("dataset_kind") == "train")
    val_data = filtered.filter(pl.col("dataset_kind") == "validation")

    # Build points list
    points = []
    train_by_epoch = {
        row["checkpoint_epoch"]: row["mean_mae"] for row in train_data.iter_rows(named=True)
    }
    val_by_epoch = {
        row["checkpoint_epoch"]: row["mean_mae"] for row in val_data.iter_rows(named=True)
    }

    # Sort by num_epochs_trained order
    epochs = sorted(train_by_epoch.keys(), key=lambda e: checkpoint_to_num_epochs(e) or 0)

    for epoch in epochs:
        num_epochs = checkpoint_to_num_epochs(epoch)
        if num_epochs is not None and epoch in train_by_epoch and epoch in val_by_epoch:
            points.append(
                LossCurvePoint(
                    num_epochs_trained=num_epochs,
                    train_mae=train_by_epoch[epoch],
                    val_mae=val_by_epoch[epoch],
                )
            )

    return LossCurvesResponse(
        dataset=dataset,
        dataset_label=DATASET_LABELS.get(dataset, dataset),
        variable=variable,
        variable_label=VARIABLE_LABELS.get(variable, variable),
        points=points,
    )


class PersistenceBaselineResponse(BaseModel):
    """Response containing persistence baseline value."""

    variable: str
    mean_mae: float


@app.get("/api/persistence-baseline", response_model=PersistenceBaselineResponse)
def get_persistence_baseline(variable: str) -> PersistenceBaselineResponse:
    """Get persistence model baseline MAE for a given variable."""
    if not PERSISTENCE_BASELINE_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Persistence baseline file not found: {PERSISTENCE_BASELINE_PATH}",
        )

    with open(PERSISTENCE_BASELINE_PATH) as f:
        data = json.load(f)

    # Check if the requested variable matches
    if variable not in data.get("target_vars", []):
        raise HTTPException(
            status_code=404, detail=f"No persistence baseline found for variable={variable}"
        )

    return PersistenceBaselineResponse(
        variable=variable,
        mean_mae=data["mean_mae"],
    )


# ============================================================================
# Heatmap Visualization Endpoints
# ============================================================================


class EpochOption(BaseModel):
    """An epoch selection option for heatmap visualization."""

    value: int
    label: str


class SampleCountResponse(BaseModel):
    """Response containing the number of validation samples."""

    count: int


class HeatmapResponse(BaseModel):
    """Response containing heatmap data for Plotly visualization."""

    data: list[list[float]]
    lat: list[float]
    lon: list[float]
    timestamp: str
    variable: str
    variable_label: str
    min_value: float
    max_value: float


class StaticHeatmapResponse(BaseModel):
    """Response containing static variable heatmap data (e.g., land-sea mask)."""

    data: list[list[float]]
    lat: list[float]
    lon: list[float]
    variable: str
    min_value: float
    max_value: float


@app.get("/api/available-epochs", response_model=list[EpochOption])
def get_available_epochs() -> list[EpochOption]:
    """Get list of epoch options for heatmap selection (0-8 epochs trained)."""
    return [
        EpochOption(value=0, label="0 epochs (init)"),
        EpochOption(value=1, label="1 epoch"),
        EpochOption(value=2, label="2 epochs"),
        EpochOption(value=3, label="3 epochs"),
        EpochOption(value=4, label="4 epochs"),
        EpochOption(value=5, label="5 epochs"),
        EpochOption(value=6, label="6 epochs"),
        EpochOption(value=7, label="7 epochs"),
        EpochOption(value=8, label="8 epochs"),
    ]


@app.get("/api/validation-sample-count", response_model=SampleCountResponse)
@lmdb_cache(CACHE_DIR, namespace="v2")
def get_validation_sample_count() -> SampleCountResponse:
    """Get the number of samples in the validation dataset."""
    validation_data = get_validation_data()
    return SampleCountResponse(count=len(validation_data))


@app.get("/api/heatmap/ground-truth", response_model=HeatmapResponse)
@lmdb_cache(CACHE_DIR, namespace="v2")
def get_ground_truth_heatmap(variable: str, sample_index: int) -> HeatmapResponse:
    """Get ground truth heatmap data for a specific sample."""
    validation_data = get_validation_data()

    if sample_index < 0 or sample_index >= len(validation_data):
        raise HTTPException(
            status_code=400,
            detail=f"Sample index {sample_index} out of range [0, {len(validation_data) - 1}]",
        )

    # Get the target batch (ground truth) directly
    data_pair = validation_data[sample_index]
    target_batch = data_pair.target_batch

    return HeatmapResponse(**extract_heatmap_data(target_batch, variable))


@app.get("/api/heatmap/persistence", response_model=HeatmapResponse)
@lmdb_cache(CACHE_DIR, namespace="v2")
def get_persistence_heatmap(variable: str, sample_index: int) -> HeatmapResponse:
    """Get persistence model heatmap data for a specific sample."""
    if not HAS_MODEL_DEPS:
        raise HTTPException(
            status_code=503,
            detail="Model dependencies not installed (slim build). This endpoint requires cached data.",
        )
    from vibe_tune_aurora.evaluation import PersistenceModel

    validation_data = get_validation_data()

    if sample_index < 0 or sample_index >= len(validation_data):
        raise HTTPException(
            status_code=400,
            detail=f"Sample index {sample_index} out of range [0, {len(validation_data) - 1}]",
        )

    data_pair = validation_data[sample_index]
    input_batch = data_pair.input_batch

    # Run persistence model (copies last timestep as prediction)
    persistence_model = PersistenceModel()
    with torch.inference_mode():
        prediction_batch = persistence_model.forward(input_batch)

    return HeatmapResponse(**extract_heatmap_data(prediction_batch, variable))


@app.get("/api/heatmap/prediction", response_model=HeatmapResponse)
@lmdb_cache(CACHE_DIR, namespace="v2")
def get_prediction_heatmap(
    dataset: str,
    variable: str,
    num_epochs: int,
    sample_index: int,
) -> HeatmapResponse:
    """Get finetuned model prediction heatmap data for a specific sample."""
    validation_data = get_validation_data()

    if sample_index < 0 or sample_index >= len(validation_data):
        raise HTTPException(
            status_code=400,
            detail=f"Sample index {sample_index} out of range [0, {len(validation_data) - 1}]",
        )

    # Resolve and load checkpoint
    checkpoint_path = get_checkpoint_path(dataset, num_epochs)
    model = get_cached_model(str(checkpoint_path))

    data_pair = validation_data[sample_index]
    input_batch = data_pair.input_batch

    # Run inference
    with torch.inference_mode():
        prediction_batch = model.forward(input_batch)

    return HeatmapResponse(**extract_heatmap_data(prediction_batch, variable))


@app.get("/api/heatmap/land-sea-mask", response_model=StaticHeatmapResponse)
@lmdb_cache(CACHE_DIR, namespace="v2")
def get_land_sea_mask_heatmap() -> StaticHeatmapResponse:
    """Get land-sea mask heatmap data for geographic context."""
    validation_data = get_validation_data()

    if len(validation_data) == 0:
        raise HTTPException(status_code=500, detail="No validation data available")

    # Get land-sea mask from any batch (it's static, same for all samples)
    data_pair = validation_data[0]
    batch = data_pair.input_batch

    return StaticHeatmapResponse(**extract_static_heatmap_data(batch, "lsm"))


@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
