"""Demo data router for serving pre-generated structures."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.api import (
    GenerationJob,
    GenerationJobWithStructures,
    GenerationRequest,
)
from services.demo_service import load_demo_structures


router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/generate", response_model=GenerationJobWithStructures)
async def generate_demo_structures(
    request: GenerationRequest,
) -> GenerationJobWithStructures:
    """
    Generate demo structures based on the request properties.

    This endpoint is used as a fallback when the real MatterGen API fails
    and demo mode is enabled.
    """
    try:
        structures = load_demo_structures(request)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Create a fake job for consistency with the real endpoint
    job = GenerationJob(
        id=f"demo-{uuid.uuid4()}",
        status="succeeded",
        created_at=datetime.now(timezone.utc),
        finished_at=datetime.now(timezone.utc),
        request=request,
        artifact_uri=None,
    )

    return GenerationJobWithStructures(job=job, structures=structures)
