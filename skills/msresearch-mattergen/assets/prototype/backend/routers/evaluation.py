from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from config import Settings, get_settings
from models.api import (
    EvaluationRequest,
    EvaluationResponse,
    EvaluationResult,
    EvaluationMetrics,
)
from services.mattersim_inference import evaluate_structures, MatterSimError

# Configure logging to show INFO level
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.post("", response_model=EvaluationResponse)
async def evaluate(
    request: EvaluationRequest,
    settings: Settings = Depends(get_settings),
) -> EvaluationResponse:
    """Evaluate crystal structures using MatterSim.

    Accepts a list of structures (with CIF content) and returns
    evaluation metrics including energy above hull, stability,
    novelty, and uniqueness.
    """
    logger.info("=" * 60)
    logger.info("EVALUATION REQUEST RECEIVED")
    logger.info("=" * 60)

    if not request.structures:
        logger.error("No structures provided in request")
        raise HTTPException(status_code=400, detail="No structures provided")

    logger.info(f"Number of structures to evaluate: {len(request.structures)}")
    for i, s in enumerate(request.structures):
        cif_preview = s.cif[:100] + "..." if len(s.cif) > 100 else s.cif
        logger.info(f"  Structure {i + 1}: id={s.id}, cif_length={len(s.cif)}")
        logger.debug(f"    CIF preview: {cif_preview}")

    # Convert request to format expected by inference service
    structures_input = [{"id": s.id, "cif": s.cif} for s in request.structures]

    logger.info(f"Endpoint URL configured: {bool(settings.mattersim_endpoint_url)}")
    if settings.mattersim_endpoint_url:
        logger.info(f"Endpoint: {settings.mattersim_endpoint_url}")
    logger.info(f"Using Entra ID auth: {settings.mattersim_use_entra_auth}")

    try:
        logger.info("Calling evaluate_structures service...")
        raw_results = await evaluate_structures(settings, structures_input)
        logger.info(f"Service returned {len(raw_results)} results")
    except MatterSimError as e:
        logger.error(f"MatterSim evaluation failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during evaluation")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")

    # Convert raw results to response model
    results = []
    for i, raw in enumerate(raw_results):
        metrics_data = raw.get("metrics", {})
        logger.info(f"Result {i + 1} for structure {raw['structureId']}:")
        logger.info(f"  energyAboveHull: {metrics_data.get('energyAboveHull')}")
        logger.info(f"  energyPerAtom: {metrics_data.get('energyPerAtom')}")
        logger.info(f"  totalEnergy: {metrics_data.get('totalEnergy')}")
        logger.info(f"  isStable: {metrics_data.get('isStable')}")
        logger.info(f"  isNovel: {metrics_data.get('isNovel')}")
        logger.info(f"  isUnique: {metrics_data.get('isUnique')}")
        logger.info(f"  hasRelaxedCif: {bool(raw.get('relaxedCif'))}")

        results.append(
            EvaluationResult(
                structureId=raw["structureId"],
                metrics=EvaluationMetrics(
                    energyAboveHull=metrics_data.get("energyAboveHull"),
                    energyPerAtom=metrics_data.get("energyPerAtom"),
                    totalEnergy=metrics_data.get("totalEnergy"),
                    isStable=metrics_data.get("isStable"),
                    isNovel=metrics_data.get("isNovel"),
                    isUnique=metrics_data.get("isUnique"),
                    forces=metrics_data.get("forces"),
                    stress=metrics_data.get("stress"),
                ),
                relaxedCif=raw.get("relaxedCif"),
            )
        )

    logger.info("=" * 60)
    logger.info(f"EVALUATION COMPLETE - Returning {len(results)} results")
    logger.info("=" * 60)

    return EvaluationResponse(results=results)


@router.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    """Check if MatterSim endpoint is configured."""
    logger.info("Health check requested")
    if settings.mattersim_endpoint_url:
        logger.info(f"Endpoint configured: {settings.mattersim_endpoint_url}")
        return {
            "status": "configured",
            "endpoint": settings.mattersim_endpoint_url,
            "entra_auth": str(settings.mattersim_use_entra_auth),
        }
    logger.warning("Endpoint NOT configured - evaluation will fail!")
    return {
        "status": "not_configured",
        "message": "MATTERSIM_ENDPOINT_URL not set - evaluation will fail",
    }
