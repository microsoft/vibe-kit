# Aurora Finetune Demo — Backend

FastAPI backend for the Aurora Finetune Exploration Demo. Serves pre-computed evaluation results and cached model predictions to visualize how training data size affects Aurora weather model performance.

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/training-datasets` | Available training dataset options (1 week, 2 months, 6 months) |
| `GET /api/surface-variables` | Available weather variables (e.g., Total Cloud Cover) |
| `GET /api/available-epochs` | Training epochs available for selection (0–8) |
| `GET /api/loss-curves?dataset=&variable=` | Training/validation MAE loss curves |
| `GET /api/persistence-baseline?variable=` | Naive persistence model baseline MAE |
| `GET /api/validation-sample-count` | Number of validation samples |
| `GET /api/heatmap/prediction?dataset=&variable=&num_epochs=&sample_index=` | Finetuned model prediction heatmap |
| `GET /api/heatmap/persistence?variable=&sample_index=` | Persistence baseline heatmap |
| `GET /api/heatmap/ground-truth?variable=&sample_index=` | Ground truth observation heatmap |
| `GET /api/heatmap/land-sea-mask` | Static land-sea mask for geographic context |

## Project Structure

```
backend/
├── src/aft_demo_backend/
│   ├── api.py                        # FastAPI app with all endpoints
│   ├── lmdb_cache.py                 # Persistent LMDB caching decorator
│   ├── check_data.py                 # GRIB file validation CLI
│   ├── construct_config_csv.py       # Generate evaluation config matrix
│   ├── run_evaluation.py             # Run model evaluations across configs
│   ├── run_persistence_eval.py       # Compute persistence baseline metrics
│   ├── execute_prediction_queries.py # Warm prediction cache via API calls
│   └── execute_validation_queries.py # Warm validation cache via API calls
├── Dockerfile
└── pyproject.toml
```

## Running Locally

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
uv run uvicorn aft_demo_backend.api:app --host 0.0.0.0 --port 8000
```

The API serves at `http://localhost:8000`. Docs are available at `/docs` (Swagger UI).

## LMDB Cache

Heatmap endpoints use persistent disk-backed caching (`lmdb_cache.py`) to avoid recomputing expensive model inferences. Cache files live in `../assets/outputs/local_database_storage/`. The cache survives server restarts. Bump the `namespace` parameter in the decorator to invalidate stale entries.

## CLI Utilities

These scripts generate the pre-computed data the API serves:

```bash
# Validate GRIB data files
uv run python -m aft_demo_backend.check_data

# Generate evaluation config matrix
uv run python -m aft_demo_backend.construct_config_csv

# Compute persistence baseline
uv run python -m aft_demo_backend.run_persistence_eval

# Run all model evaluations (requires model dependencies)
uv run python -m aft_demo_backend.run_evaluation

# Warm the LMDB cache (start the API server first)
uv run python -m aft_demo_backend.execute_validation_queries
uv run python -m aft_demo_backend.execute_prediction_queries
```

## Docker

Two build modes, controlled by `INSTALL_MODEL_DEPS`:

```bash
# Slim build — serves cached results only (~4–5 GB)
docker build --build-arg INSTALL_MODEL_DEPS=false \
  -f backend/Dockerfile -t aurora-finetune-backend:slim ../../../

# Full build — includes PyTorch + model inference (~13 GB)
docker build --build-arg INSTALL_MODEL_DEPS=true \
  -f backend/Dockerfile -t aurora-finetune-backend:full ../../../
```

Build context must be the `aurora-finetune/` directory (three levels up from `backend/`).
