"""Demo data service for serving pre-generated structures when real API fails."""

from __future__ import annotations

import os
import random
import uuid
from pathlib import Path
from typing import Any

from config import get_settings
from models.api import GenerationRequest, StructureSummary
from services.naming import get_systematic_name


# Map property types to demo data folder names
# Available in all modes
PROPERTY_TO_FOLDER: dict[str, str] = {
    "band_gap": "band_gap",
    "bulk_modulus": "bulk_modulus",
    "chemical_system": "chemical_system",
    "hhi_score": "hhi_score",
    "magnetic_density": "magnetic_density",
    "space_group": "space_group",
}

# Properties available only in specific modes
MODE_SPECIFIC_PROPERTIES: dict[str, dict[str, str]] = {
    "production": {
        "energy_above_hull": "energy_above_hull",
    },
}

# Multi-property combinations that have dedicated folders
# Available in all modes
MULTI_PROPERTY_FOLDERS: dict[frozenset[str], str] = {
    frozenset(["magnetic_density", "hhi_score"]): "magnetic_density_hhi_score",
}

# Multi-property combinations available only in specific modes
MODE_SPECIFIC_MULTI_FOLDERS: dict[str, dict[frozenset[str], str]] = {
    "production": {
        frozenset(
            ["chemical_system", "energy_above_hull"]
        ): "chemical_system_energy_above_hull",
    },
}


def get_property_folders_for_mode(mode: str) -> dict[str, str]:
    """Get the property-to-folder mapping for the current mode."""
    folders = PROPERTY_TO_FOLDER.copy()
    if mode in MODE_SPECIFIC_PROPERTIES:
        folders.update(MODE_SPECIFIC_PROPERTIES[mode])
    return folders


def get_multi_property_folders_for_mode(mode: str) -> dict[frozenset[str], str]:
    """Get the multi-property folder mapping for the current mode."""
    folders = MULTI_PROPERTY_FOLDERS.copy()
    if mode in MODE_SPECIFIC_MULTI_FOLDERS:
        folders.update(MODE_SPECIFIC_MULTI_FOLDERS[mode])
    return folders


def get_demo_data_path() -> Path:
    """Get the path to the demo data directory."""
    # Relative to backend directory
    return Path(__file__).parent.parent / "data" / "demo_data"


def extract_formula_from_cif(cif_content: str) -> str:
    """Extract formula from CIF file content."""
    for line in cif_content.split("\n"):
        if line.startswith("_chemical_formula_structural"):
            # Format: _chemical_formula_structural       Formula
            parts = line.split()
            if len(parts) >= 2:
                return parts[-1]
    return "Unknown"


def extract_composition_from_cif(cif_content: str) -> str:
    """Extract composition from CIF file content."""
    for line in cif_content.split("\n"):
        if line.startswith("_chemical_formula_sum"):
            # Format: _chemical_formula_sum              "Element1 Element2 ..."
            # Remove the field name and quotes
            parts = line.split(None, 1)
            if len(parts) >= 2:
                return parts[1].strip().strip('"')
    return "Unknown"


def match_properties_to_folder(properties: dict[str, Any]) -> str | None:
    """
    Match the requested properties to the best demo data folder.

    Returns the folder name or None if no match found.
    """
    settings = get_settings()
    mode = settings.app_mode

    property_folders = get_property_folders_for_mode(mode)
    multi_property_folders = get_multi_property_folders_for_mode(mode)

    if not properties:
        # No properties specified - return a random folder from available ones
        return random.choice(list(property_folders.values()))

    property_keys = set(properties.keys())

    # First, check for multi-property combinations
    for combo, folder in multi_property_folders.items():
        if combo.issubset(property_keys):
            return folder

    # Fall back to single property match (use the first matching property)
    for prop in properties.keys():
        if prop in property_folders:
            return property_folders[prop]

    # No match found - return a random folder as fallback
    return random.choice(list(property_folders.values()))


def load_demo_structures(
    request: GenerationRequest,
) -> list[StructureSummary]:
    """
    Load demo structures based on the generation request.

    Matches the requested properties to a demo folder and returns
    random structures from that folder.
    """
    demo_path = get_demo_data_path()
    folder_name = match_properties_to_folder(request.properties_to_condition_on)

    if folder_name is None:
        raise ValueError("Could not match properties to demo data folder")

    folder_path = demo_path / folder_name

    if not folder_path.exists():
        raise FileNotFoundError(f"Demo data folder not found: {folder_path}")

    # Load all CIF files from the folder
    cif_files = list(folder_path.glob("*.cif"))

    if not cif_files:
        raise FileNotFoundError(f"No CIF files found in {folder_path}")

    # Always return 2 structures in demo mode
    num_to_return = min(2, len(cif_files))
    selected_files = random.sample(cif_files, num_to_return)

    structures: list[StructureSummary] = []

    for index, cif_file in enumerate(selected_files):
        cif_content = cif_file.read_text()
        formula = extract_formula_from_cif(cif_content)
        composition = extract_composition_from_cif(cif_content)

        # Generate IUPAC systematic name
        systematic_name = get_systematic_name(composition)

        structure = StructureSummary(
            id=f"demo-{uuid.uuid4()}",
            job_id=f"demo-{uuid.uuid4()}",
            index=index,
            formula=formula,
            composition=composition,
            systematic_name=systematic_name,
            has_trajectory=False,
            cif=cif_content,
        )
        structures.append(structure)

    return structures
