from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter

from config import get_settings
from models.api import (
    CheckpointInfo,
    PropertiesConfig,
    PropertyGroup,
    PropertyListResponse,
    PropertyMetadata,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/properties", tags=["properties"])

# Load property metadata from JSON file at module load time
_PROPERTIES_FILE = Path(__file__).parent.parent / "data" / "properties.json"


def _load_properties_config() -> dict:
    """Load the full properties configuration from JSON file."""
    try:
        with open(_PROPERTIES_FILE) as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load properties from {_PROPERTIES_FILE}: {e}")
        return {
            "properties": [],
            "groups": [],
            "checkpoints": {},
            "supportedElements": [],
            "unsupportedElements": [],
        }


def _filter_properties_for_mode(
    properties: list[dict], mode: str
) -> list[PropertyMetadata]:
    """Filter properties based on the current app mode and adjust constraints."""
    filtered = []
    for prop in properties:
        prop_modes = prop.get("modes")
        # If property has mode restrictions, check if current mode is allowed
        if prop_modes is not None and mode not in prop_modes:
            continue

        # Create a copy to modify
        prop_copy = prop.copy()

        # Handle requiresPropertyModes - only apply requiresProperty in specified modes
        requires_modes = prop_copy.get("requiresPropertyModes")
        if requires_modes is not None:
            if mode not in requires_modes:
                # Remove the requirement in this mode
                prop_copy["requiresProperty"] = None
            # Clean up the internal field
            prop_copy.pop("requiresPropertyModes", None)

        # Handle compatibleWithModes - only apply compatibleWith in specified modes
        compatible_modes = prop_copy.get("compatibleWithModes")
        if compatible_modes is not None:
            if mode not in compatible_modes:
                # Clear compatibleWith in this mode
                prop_copy["compatibleWith"] = []
            # Clean up the internal field
            prop_copy.pop("compatibleWithModes", None)

        # Remove internal modes field before creating the model
        prop_copy.pop("modes", None)

        filtered.append(PropertyMetadata(**prop_copy))

    return filtered


def _filter_checkpoints_for_mode(
    checkpoints: dict, mode: str
) -> dict[str, CheckpointInfo]:
    """Filter checkpoints based on the current app mode."""
    filtered = {}
    for name, info in checkpoints.items():
        checkpoint_modes = info.get("modes")
        # If checkpoint has mode restrictions, check if current mode is allowed
        if checkpoint_modes is not None and mode not in checkpoint_modes:
            continue

        # Create a copy without the modes field
        info_copy = info.copy()
        info_copy.pop("modes", None)
        filtered[name] = CheckpointInfo(**info_copy)

    return filtered


# Cache raw configuration at startup (before mode filtering)
_CACHED_CONFIG: dict = _load_properties_config()


@router.get("", response_model=PropertyListResponse)
async def get_properties() -> PropertyListResponse:
    """Return list of available properties for conditioning MatterGen generation.

    These properties can be used in the `properties_to_condition_on` field
    when creating a generation job. Each property includes metadata about
    valid operators, value ranges, and example usage.
    """
    settings = get_settings()
    mode = settings.app_mode
    properties = _filter_properties_for_mode(_CACHED_CONFIG.get("properties", []), mode)
    return PropertyListResponse(properties=properties)


@router.get("/config", response_model=PropertiesConfig)
async def get_properties_config() -> PropertiesConfig:
    """Return full properties configuration including groups, checkpoints, and elements.

    This endpoint provides comprehensive information about:
    - Available properties with their constraints and compatibility
    - Property groups for UI organization
    - Available checkpoints and which properties they support
    - Supported elements for chemical_system property
    """
    settings = get_settings()
    mode = settings.app_mode
    properties = _filter_properties_for_mode(_CACHED_CONFIG.get("properties", []), mode)
    checkpoints = _filter_checkpoints_for_mode(
        _CACHED_CONFIG.get("checkpoints", {}), mode
    )

    return PropertiesConfig(
        properties=properties,
        groups=[PropertyGroup(**g) for g in _CACHED_CONFIG.get("groups", [])],
        checkpoints=checkpoints,
        supportedElements=_CACHED_CONFIG.get("supportedElements", []),
        unsupportedElements=_CACHED_CONFIG.get("unsupportedElements", []),
        appMode=mode,
        demoMode=settings.demo_mode,
    )
