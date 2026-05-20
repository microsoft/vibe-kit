from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class GenerationRequest(BaseModel):
    diffusion_guidance_factor: Optional[float] = Field(
        default=None,
        description="Optional guidance factor if supported by hosted endpoint",
    )
    properties_to_condition_on: dict[str, Any] = Field(
        default_factory=dict,
        description="Property prompts passed through to MatterGen",
    )
    adapter_name: Optional[str] = Field(
        default=None,
        description="Optional adapter/checkpoint label (informational)",
    )


JobStatus = Literal["queued", "running", "succeeded", "failed"]


class GenerationJob(BaseModel):
    id: str
    status: JobStatus
    created_at: datetime
    finished_at: Optional[datetime] = None
    request: GenerationRequest
    artifact_uri: Optional[str] = None


class StructureSummary(BaseModel):
    id: str
    job_id: str
    index: int
    composition: str
    formula: str
    systematic_name: str | None = (
        None  # IUPAC systematic name (e.g., "Iron(III) oxide")
    )
    has_trajectory: bool = False
    metrics: dict[str, Any] | None = None
    cif: str | None = None  # CIF content for the structure


class GenerationJobWithStructures(BaseModel):
    job: GenerationJob
    structures: list[StructureSummary]


# --- Evaluation Models (MatterSim) ---


class StructureInput(BaseModel):
    """A structure to evaluate."""

    id: str = Field(description="Unique identifier for the structure")
    cif: str = Field(description="CIF content of the structure")


class EvaluationRequest(BaseModel):
    """Request to evaluate one or more structures with MatterSim."""

    structures: list[StructureInput] = Field(
        description="List of structures to evaluate"
    )
    relax: bool = Field(
        default=True, description="Whether to relax structures before evaluation"
    )


class EvaluationMetrics(BaseModel):
    """Evaluation metrics for a single structure."""

    energyAboveHull: Optional[float] = Field(
        default=None,
        description="Energy above hull in eV/atom (requires reference dataset)",
    )
    energyPerAtom: Optional[float] = Field(
        default=None, description="Energy per atom in eV (raw MatterSim output)"
    )
    totalEnergy: Optional[float] = Field(default=None, description="Total energy in eV")
    isStable: Optional[bool] = Field(
        default=None, description="Whether structure is thermodynamically stable"
    )
    isNovel: Optional[bool] = Field(
        default=None, description="Whether structure is novel (not in training data)"
    )
    isUnique: Optional[bool] = Field(
        default=None, description="Whether structure is unique in this batch"
    )
    forces: Optional[list[list[float]]] = Field(
        default=None, description="Atomic forces in eV/A"
    )
    stress: Optional[list[list[float]]] = Field(
        default=None, description="Stress tensor (3x3 matrix) in GPa"
    )


class EvaluationResult(BaseModel):
    """Evaluation result for a single structure."""

    structureId: str = Field(description="ID of the evaluated structure")
    metrics: EvaluationMetrics = Field(description="Computed metrics")
    relaxedCif: Optional[str] = Field(
        default=None, description="CIF content of relaxed structure"
    )


class EvaluationResponse(BaseModel):
    """Response containing evaluation results for all structures."""

    results: list[EvaluationResult] = Field(
        description="Evaluation results for each structure"
    )
    errors: Optional[list[str]] = Field(
        default=None, description="Any errors encountered during evaluation"
    )


# --- Property Metadata Models ---


class PropertyMetadata(BaseModel):
    """Metadata describing a property that can be used for conditioning."""

    id: str = Field(description="Property identifier used in API calls")
    label: str = Field(description="Human-readable display label")
    type: Literal["numeric", "integer", "chemical_system"] = Field(
        description="Value type for validation"
    )
    description: str = Field(description="Detailed description of the property")
    operators: list[str] = Field(
        description="Valid comparison operators (e.g., '>=', '<=', '=')"
    )
    example: str = Field(description="Example value string")
    unit: Optional[str] = Field(default=None, description="Unit of measurement")
    min: Optional[float] = Field(default=None, description="Minimum valid value")
    max: Optional[float] = Field(default=None, description="Maximum valid value")
    group: Optional[str] = Field(
        default=None, description="Property group (mechanical, electronic, etc.)"
    )
    checkpoint: Optional[str] = Field(
        default=None, description="Checkpoint that supports this property"
    )
    compatibleWith: Optional[list[str]] = Field(
        default=None, description="Other properties this can be combined with"
    )
    requiresProperty: Optional[str] = Field(
        default=None,
        description="Property ID that must be selected before this one can be used",
    )
    # Internal fields for mode filtering (not exposed to frontend)
    modes: Optional[list[str]] = Field(
        default=None,
        description="Modes where this property is available (if null, available in all)",
    )
    requiresPropertyModes: Optional[list[str]] = Field(
        default=None,
        description="Modes where requiresProperty constraint applies",
    )
    compatibleWithModes: Optional[list[str]] = Field(
        default=None,
        description="Modes where compatibleWith list applies",
    )


class PropertyGroup(BaseModel):
    """A group/category of properties."""

    id: str = Field(description="Group identifier")
    label: str = Field(description="Human-readable display label")
    description: str = Field(description="Description of the property group")


class CheckpointInfo(BaseModel):
    """Information about a model checkpoint."""

    name: str = Field(description="Checkpoint directory name")
    description: str = Field(description="Human-readable description")
    properties: list[str] = Field(description="Properties supported by this checkpoint")
    modes: Optional[list[str]] = Field(
        default=None,
        description="Modes where this checkpoint is available (if null, available in all)",
    )


class PropertiesConfig(BaseModel):
    """Full configuration for the properties system."""

    properties: list[PropertyMetadata] = Field(
        description="List of available properties"
    )
    groups: list[PropertyGroup] = Field(description="Property groups/categories")
    checkpoints: dict[str, CheckpointInfo] = Field(
        description="Available checkpoints and their capabilities"
    )
    supportedElements: list[str] = Field(
        description="Element symbols supported for chemical_system property"
    )
    unsupportedElements: list[str] = Field(
        description="Element symbols NOT supported (for UI display)"
    )
    appMode: str = Field(
        default="research",
        description="Application mode affecting available features",
    )
    demoMode: bool = Field(
        default=False,
        description="Whether to fall back to demo data when endpoint fails",
    )


class PropertyListResponse(BaseModel):
    """Response containing available properties for conditioning."""

    properties: list[PropertyMetadata] = Field(
        description="List of available properties"
    )
