# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

"""
MatterGen evaluation service using the official MetricsEvaluator.

This module uses MatterGen's built-in evaluation framework to compute:
- Energy above hull (thermodynamic stability)
- Novelty (structure not in reference dataset)
- Uniqueness (structure not duplicated in batch)
- Stability (energy above hull < threshold)
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

# Add mattergen package to Python path for local evaluation
_mattergen_path = Path(__file__).parent.parent.parent / "mattergen"
if str(_mattergen_path) not in sys.path:
    sys.path.insert(0, str(_mattergen_path))

from pymatgen.core import Structure

logger = logging.getLogger(__name__)

# Lazy-loaded singleton for the reference dataset
_reference_dataset = None
_metrics_evaluator_available: bool | None = None


def _get_reference_dataset():
    """Get the reference dataset singleton (lazy-loaded)."""
    global _reference_dataset
    if _reference_dataset is None:
        logger.info("Loading MatterGen reference dataset (MP2020 correction)...")
        from mattergen.evaluation.reference.presets import ReferenceMP2020Correction

        _reference_dataset = ReferenceMP2020Correction()
        logger.info(f"Reference dataset loaded: {_reference_dataset.name}")
    return _reference_dataset


def _structure_from_dict(structure_dict: dict[str, Any]) -> Structure | None:
    """Convert pymatgen Structure dict (from MatterSim response) to Structure object.

    MatterSim returns structures as pymatgen dicts via AseAtomsAdaptor.get_structure().as_dict()
    which have the format: {"@module": "pymatgen.core.structure", "@class": "Structure", ...}
    """
    try:
        # Use pymatgen's from_dict which handles the @module/@class format
        return Structure.from_dict(structure_dict)
    except Exception as e:
        logger.warning(f"Failed to convert structure dict: {e}")
        return None


def compute_metrics_batch(
    structures_data: list[dict[str, Any]],
    stability_threshold: float = 0.1,
) -> dict[str, dict[str, Any]]:
    """Compute evaluation metrics for a batch of structures using MatterGen's MetricsEvaluator.

    Args:
        structures_data: List of dicts with keys:
            - id: structure identifier
            - structure: pymatgen Structure dict (from MatterSim response) OR Structure object
            - total_energy: total energy in eV (from MatterSim)
        stability_threshold: Energy above hull threshold for stability (eV/atom)

    Returns:
        Dict mapping structure_id to metrics dict with:
            - energyAboveHull: float or None
            - isStable: bool or None
            - isNovel: bool or None
            - isUnique: bool or None
    """
    global _metrics_evaluator_available

    # Check if we can import the evaluator
    if _metrics_evaluator_available is False:
        logger.warning("MetricsEvaluator unavailable, returning empty metrics")
        return {s["id"]: _empty_metrics() for s in structures_data}

    try:
        from mattergen.evaluation.metrics.evaluator import MetricsEvaluator

        _metrics_evaluator_available = True
    except ImportError as e:
        logger.warning(f"MetricsEvaluator import failed: {e}")
        _metrics_evaluator_available = False
        return {s["id"]: _empty_metrics() for s in structures_data}

    # Parse structures and collect valid ones
    valid_structures: list[Structure] = []
    valid_energies: list[float] = []
    valid_ids: list[str] = []
    failed_ids: list[str] = []

    for item in structures_data:
        structure_id = item["id"]
        structure_data = item.get("structure")
        total_energy = item.get("total_energy")

        if structure_data is None or total_energy is None:
            logger.warning(
                f"Structure {structure_id}: missing structure or energy, skipping"
            )
            failed_ids.append(structure_id)
            continue

        # Handle both Structure objects and dicts
        if isinstance(structure_data, Structure):
            structure = structure_data
        elif isinstance(structure_data, dict):
            structure = _structure_from_dict(structure_data)
        else:
            logger.warning(
                f"Structure {structure_id}: invalid structure type {type(structure_data)}, skipping"
            )
            failed_ids.append(structure_id)
            continue

        if structure is None:
            logger.warning(
                f"Structure {structure_id}: failed to parse structure, skipping"
            )
            failed_ids.append(structure_id)
            continue

        valid_structures.append(structure)
        valid_energies.append(total_energy)
        valid_ids.append(structure_id)

    if not valid_structures:
        logger.warning("No valid structures to evaluate")
        return {s["id"]: _empty_metrics() for s in structures_data}

    # Create evaluator with MatterGen's reference dataset
    try:
        from mattergen.evaluation.metrics.energy import EnergyMetricsCapability

        reference = _get_reference_dataset()
        evaluator = MetricsEvaluator.from_structures_and_energies(
            structures=valid_structures,
            energies=valid_energies,
            reference=reference,
            stability_threshold=stability_threshold,
        )

        # Check if energy capability is available.
        # It may be absent when the MP2020 reference dataset lacks terminal
        # element entries for the chemical systems in the batch
        # (MissingTerminalsError is caught silently in the evaluator).
        has_energy = EnergyMetricsCapability in evaluator.available_capability_types

        if has_energy:
            energy_above_hull = evaluator.energy_capability.energy_above_hull
            is_stable = evaluator.is_stable
        else:
            logger.warning(
                "EnergyMetricsCapability not available for this batch - "
                "energy above hull will be null. This typically means the "
                "MP2020 reference dataset is missing terminal elements for "
                "one or more chemical systems in the batch."
            )
            energy_above_hull = [None] * len(valid_ids)
            is_stable = [None] * len(valid_ids)

        # Structure metrics (novelty/uniqueness) are always available
        is_novel = evaluator.is_novel
        is_unique = evaluator.is_unique

        # Build results dict
        results = {}
        for i, structure_id in enumerate(valid_ids):
            raw_hull = energy_above_hull[i]
            raw_stable = is_stable[i]
            e_hull: float | None = float(raw_hull) if raw_hull is not None else None
            stable: bool | None = bool(raw_stable) if raw_stable is not None else None
            results[structure_id] = {
                "energyAboveHull": e_hull,
                "isStable": stable,
                "isNovel": bool(is_novel[i]),
                "isUnique": bool(is_unique[i]),
            }
            logger.info(
                f"Structure {structure_id}: e_above_hull={e_hull}, "
                f"stable={stable}, novel={is_novel[i]}, unique={is_unique[i]}"
            )

        # Add empty metrics for failed structures
        for structure_id in failed_ids:
            results[structure_id] = _empty_metrics()

        return results

    except Exception as e:
        logger.exception(f"MetricsEvaluator failed: {e}")
        return {s["id"]: _empty_metrics() for s in structures_data}


def _empty_metrics() -> dict[str, Any]:
    """Return empty metrics dict for failed structures."""
    return {
        "energyAboveHull": None,
        "isStable": None,
        "isNovel": None,
        "isUnique": None,
    }
