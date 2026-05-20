# Aurora Finetune Exploration Demo

An interactive web app for exploring how training data size affects Aurora weather model predictions. The UI lets you select a training dataset (1 week / 2 months / 6 months), a weather variable, a training epoch, and a validation sample, then compares the finetuned model's prediction against a persistence baseline and ground truth observations on synchronized heatmaps.

This is the **low-commitment entry point** for the Aurora Fine-Tuning skill — explore Aurora outputs without writing code, downloading data, or training anything.

## Quick launch

From this directory:

```bash
docker compose up --build
```

Then open <http://localhost:8101> in your browser.

The first build takes a few minutes (Python + Node + Nginx images). Subsequent launches reuse the built images.

To stop:

```bash
docker compose down
```

## What's bundled

This demo ships with pre-computed evaluation results and a warmed LMDB cache of model predictions. Everything the React UI exposes is served from disk — no GPU, no raw GRIB data, and no model checkpoints required.

| Bundled | Not bundled |
|---|---|
| `assets/outputs/eval_results.csv` (loss curves) | `assets/grib_data/` (raw ERA5 GRIB) |
| `assets/outputs/persistence_baseline.json` | `assets/tb_logs/` (model checkpoints) |
| `assets/outputs/local_database_storage/*.lmdb` (heatmap cache, ~28 MB) | PyTorch + CUDA + `vibe-tune-aurora` |

The default Docker build runs in **slim mode** (`INSTALL_MODEL_DEPS=false`), which serves cached results only. Endpoints that would require live inference return HTTP 503 and aren't exercised by the bundled UI flows.

## Enabling live inference (advanced)

To rebuild with model inference enabled (adds ~9 GB to the backend image and requires you to supply your own GRIB data and checkpoints):

```bash
INSTALL_MODEL_DEPS=true docker compose build --build-arg INSTALL_MODEL_DEPS=true
docker compose up
```

You will also need to populate `assets/grib_data/greece_jan1_jan7_2024/` with the expected GRIB files and `assets/tb_logs/finetuning/version_*/` with checkpoints. See `backend/README.md` for details.

## Local development (no Docker)

If you want to iterate on the React or FastAPI code, run the services directly. See:

- [`backend/README.md`](backend/README.md) — FastAPI setup with `uv`, Swagger UI, CLI utilities
- [`frontend/README.md`](frontend/README.md) — Vite dev server, proxy configuration, project structure

## Ports

| Service | Container port | Host port | URL |
|---|---|---|---|
| Frontend (Nginx) | 80 | 8101 | <http://localhost:8101> |
| Backend (FastAPI) | 8000 | 8100 | <http://localhost:8100> (`/docs` for Swagger) |

## Next steps

When you're ready to fine-tune Aurora yourself, see [`docs/finetune-demo.md`](../../../docs/finetune-demo.md) and [`docs/quick-start-finetune.md`](../../../docs/quick-start-finetune.md) at the skill root.
