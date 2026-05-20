from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from config import Settings, get_settings
from models.api import GenerationJob, GenerationJobWithStructures, GenerationRequest
from services import azure_foundry_inference
from services.azure_foundry_inference import MatterGenError
from services.storage import (
    get_job_with_structures,
    init_job_storage,
    job_paths,
    save_job,
    save_structures,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generation", tags=["generation"])


@router.post("/jobs", response_model=GenerationJobWithStructures)
async def create_generation_job(
    request: GenerationRequest,
    settings: Settings = Depends(get_settings),
) -> GenerationJobWithStructures:
    job_id = str(uuid.uuid4())
    job = init_job_storage(settings.results_root, job_id, request)
    paths = job_paths(settings.results_root, job_id)

    # Mark job as running
    job.status = "running"
    save_job(paths, job)

    try:
        artifact_uri, structures = await azure_foundry_inference.run_mattergen(
            settings=settings,
            job_paths=paths,
            request=request,
        )
        job.artifact_uri = artifact_uri
        job.status = "succeeded"
        job.finished_at = datetime.now(timezone.utc)
        save_job(paths, job)
        save_structures(paths, structures)
    except MatterGenError as exc:
        # Structured error with user-friendly message
        job.status = "failed"
        job.finished_at = datetime.now(timezone.utc)
        save_job(paths, job)
        logger.error(f"MatterGen error: {exc.error_code} - {str(exc)}")
        return JSONResponse(
            status_code=exc.status_code or 502,
            content={
                "error_code": exc.error_code,
                "message": exc.user_message,
                "detail": str(exc),
            },
        )
    except Exception as exc:  # noqa: BLE001
        # Fallback for unexpected errors
        job.status = "failed"
        job.finished_at = datetime.now(timezone.utc)
        save_job(paths, job)
        logger.exception(f"Unexpected error during generation: {exc}")
        return JSONResponse(
            status_code=502,
            content={
                "error_code": "unexpected_error",
                "message": "Something went wrong while generating structures. Please try again.",
                "detail": str(exc),
            },
        )

    return get_job_with_structures(settings.results_root, job_id)


@router.get("/jobs/{job_id}", response_model=GenerationJobWithStructures)
async def get_generation_job(
    job_id: str,
    settings: Settings = Depends(get_settings),
) -> GenerationJobWithStructures:
    try:
        return get_job_with_structures(settings.results_root, job_id)
    except FileNotFoundError as exc:  # pragma: no cover - simple 404 path
        raise HTTPException(status_code=404, detail="Job not found") from exc
