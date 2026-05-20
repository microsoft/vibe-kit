"""Molecule naming API endpoints.

Provides deterministic IUPAC systematic naming for chemical compounds.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.naming import get_systematic_name

router = APIRouter(prefix="/api/naming", tags=["naming"])


class NamingRequest(BaseModel):
    """Request body for systematic name generation."""

    formula: str = Field(
        ...,
        description="Chemical formula (e.g., 'Fe2O3', 'NaCl', 'CuSO4')",
        examples=["Fe2O3", "NaCl", "LiCoO2"],
    )


class NamingResponse(BaseModel):
    """Response body with generated systematic name."""

    formula: str = Field(..., description="Input chemical formula")
    systematic_name: str = Field(
        ..., description="IUPAC systematic name (e.g., 'Iron(III) oxide')"
    )


@router.post("/systematic", response_model=NamingResponse)
async def generate_systematic_name(request: NamingRequest) -> NamingResponse:
    """Generate IUPAC systematic name for a chemical formula.

    This endpoint produces deterministic, IUPAC-compliant names for inorganic
    compounds based on their composition and inferred oxidation states.

    **Examples:**
    - Fe2O3 -> "Iron(III) oxide"
    - NaCl -> "Sodium chloride"
    - CuSO4 -> "Copper(II) sulfate"
    - LiCoO2 -> "Lithium cobalt(III) oxide"
    - KNO3 -> "Potassium nitrate"
    - Ca3(PO4)2 -> "Calcium phosphate"

    **Naming Rules Applied:**
    - Cations are named first, anions second
    - Transition metals include Roman numeral oxidation states (e.g., Iron(III))
    - Alkali/alkaline earth metals omit oxidation states (e.g., Sodium, not Sodium(I))
    - Polyatomic anions are recognized (sulfate, nitrate, phosphate, etc.)
    - Monatomic anions use -ide suffix (oxide, chloride, etc.)
    """
    try:
        systematic_name = get_systematic_name(request.formula)
        return NamingResponse(
            formula=request.formula,
            systematic_name=systematic_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid formula: {e}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Naming failed: {e}") from e
