from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flag to track if MatterGen evaluation is available
_mattergen_evaluation_available: bool | None = None


def _try_import_mattergen_evaluation():
    """Try to import MatterGen evaluation service, return None if unavailable."""
    global _mattergen_evaluation_available

    if _mattergen_evaluation_available is False:
        return None

    try:
        from services.mattergen_evaluation import compute_metrics_batch

        _mattergen_evaluation_available = True
        return compute_metrics_batch
    except Exception as e:
        logger.warning(f"MatterGen evaluation unavailable: {e}")
        _mattergen_evaluation_available = False
        return None


class MatterSimError(Exception):
    """Error from MatterSim endpoint."""

    pass


async def get_auth_token() -> str | None:
    """Get Entra ID token for Azure ML endpoint authentication.

    Uses DefaultAzureCredential which tries multiple auth methods:
    - Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
    - Managed Identity (when running in Azure)
    - Azure CLI (az login)
    - VS Code Azure extension
    """
    logger.info("Attempting to get Entra ID token...")
    try:
        from azure.identity.aio import DefaultAzureCredential

        logger.info("azure-identity package found, creating credential...")
        credential = DefaultAzureCredential()
        logger.info("Requesting token for https://ml.azure.com/.default ...")
        token = await credential.get_token("https://ml.azure.com/.default")
        await credential.close()
        logger.info(f"Token acquired successfully (expires: {token.expires_on})")
        # Log first/last few chars of token for debugging (not the full token for security)
        token_preview = f"{token.token[:10]}...{token.token[-10:]}"
        logger.debug(f"Token preview: {token_preview}")
        return token.token
    except ImportError:
        logger.error(
            "azure-identity NOT installed. Install with: pip install azure-identity"
        )
        return None
    except Exception as e:
        logger.error(f"Failed to get Entra ID token: {type(e).__name__}: {e}")
        return None


async def evaluate_structures(
    settings: Settings,
    structures: list[dict[str, Any]],
    workflow: str = "singlepoint",
) -> list[dict[str, Any]]:
    """Call MatterSim endpoint to evaluate crystal structures.

    Args:
        settings: Application settings with endpoint URL
        structures: List of structure dicts with 'id' and 'cif' keys
        workflow: MatterSim workflow - one of:
            - "singlepoint": Single point energy/force calculation
            - "relax_structure": Structure relaxation
            - "phonon": Phonon calculation
            - "molecular_dynamics": MD simulation

    Returns:
        List of evaluation results with metrics for each structure

    Raises:
        MatterSimError: If endpoint is not configured or request fails
    """
    logger.info("-" * 50)
    logger.info("evaluate_structures called")
    logger.info(f"Number of structures: {len(structures)}")
    logger.info(f"Workflow: {workflow}")

    # FAIL if endpoint not configured - no mock data
    if not settings.mattersim_endpoint_url:
        logger.error("MATTERSIM_ENDPOINT_URL is NOT configured!")
        logger.error(
            "Set the environment variable: export MATTERSIM_ENDPOINT_URL='https://...'"
        )
        raise MatterSimError(
            "MATTERSIM_ENDPOINT_URL not configured. "
            "Set the environment variable to your Azure ML endpoint URL."
        )

    logger.info(f"Endpoint URL: {settings.mattersim_endpoint_url}")

    # Build MatterSim MLflow pyfunc payload format
    # The endpoint expects the Azure ML MLflow format:
    # {"input_data": {"columns": ["data"], "data": [[<JSON string>]]}}
    #
    # Where the JSON string contains: {"workflow": "...", "structure_data": ["cif1", "cif2", ...]}
    #
    # See: mattersim/src/mattersim/utils/mlflow_utils.py line 58:
    #   data = json.loads(model_input["data"].item())
    inner_data = {
        "workflow": workflow,
        "structure_data": [s.get("cif", "") for s in structures],
    }

    # The outer payload wraps the inner data as a JSON string in MLflow format
    payload = {
        "input_data": {
            "columns": ["data"],
            "data": [[json.dumps(inner_data)]],
        }
    }

    logger.info("Request payload structure (MatterSim MLflow format):")
    logger.info(f"  workflow: {workflow}")
    logger.info(f"  structure_data count: {len(inner_data['structure_data'])}")
    for i, cif in enumerate(inner_data["structure_data"]):
        cif_len = len(cif) if cif else 0
        logger.info(f"    Structure {i}: cif_length={cif_len}")

    headers = {
        "Content-Type": "application/json",
    }

    # Get Entra ID token if configured
    if settings.mattersim_use_entra_auth:
        logger.info("Entra ID authentication is ENABLED")
        token = await get_auth_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
            logger.info("Authorization header set with Bearer token")
        else:
            logger.warning("Failed to get Entra ID token!")
            logger.warning(
                "Attempting request without auth (will likely fail with 401)"
            )
    else:
        logger.info("Entra ID authentication is DISABLED")

    try:
        logger.info("Creating HTTP client with 300s timeout...")
        async with httpx.AsyncClient(timeout=300) as client:
            logger.info(f"POST request to: {settings.mattersim_endpoint_url}")
            logger.info(f"Headers: {list(headers.keys())}")
            logger.info(f"Payload: {json.dumps(payload)[:500]}...")

            resp = await client.post(
                settings.mattersim_endpoint_url,
                headers=headers,
                content=json.dumps(payload),
            )

            logger.info(f"Response status code: {resp.status_code}")
            logger.info(f"Response headers: {dict(resp.headers)}")

            if resp.status_code == 401:
                logger.error("401 Unauthorized - Authentication failed!")
                raise MatterSimError(
                    "Authentication failed (401). Ensure you're logged in with 'az login' "
                    "or have proper Azure credentials configured."
                )

            if resp.status_code == 403:
                logger.error("403 Forbidden - Access denied!")
                raise MatterSimError(
                    "Access denied (403). Check that your Azure account has the required "
                    "permissions to access the MatterSim endpoint."
                )

            resp.raise_for_status()

            response_text = resp.text
            logger.info(f"Response body length: {len(response_text)} chars")
            logger.info(f"Response body preview: {response_text[:500]}...")

            data = resp.json()
            logger.info(f"Response parsed as JSON, type: {type(data).__name__}")

        parsed_results = _parse_endpoint_response(data, structures)
        logger.info(f"Parsed {len(parsed_results)} results from response")
        return parsed_results

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        logger.error(f"Response body: {e.response.text}")
        raise MatterSimError(
            f"Endpoint returned {e.response.status_code}: {e.response.text}"
        )
    except httpx.RequestError as e:
        logger.error(f"Request error: {type(e).__name__}: {e}")
        raise MatterSimError(f"Failed to connect to endpoint: {e}")


def _parse_endpoint_response(
    data: Any, structures: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Parse MatterSim endpoint response into standardized evaluation results.

    MatterSim returns results in one of these formats:

    1. Singlepoint workflow - list of dicts with parallel arrays:
       [{"energy": [...], "energy_per_atom": [...], "forces": [...], "stress": [...]}]

    2. Relax workflow - list of dicts with:
       [{"energy": ..., "relaxed_structure": ...}]

    3. Direct list format (one dict per structure):
       [{"energy": -123.4, "energy_per_atom": -5.1, ...}, ...]
    """
    logger.info("-" * 50)
    logger.info("Parsing endpoint response...")
    logger.info(f"Response data type: {type(data)}")

    results = []

    # Handle list response (MatterSim MLflow pyfunc returns a list)
    if isinstance(data, list):
        logger.info(f"Response is list with {len(data)} items")

        if len(data) > 0:
            first_item = data[0]
            logger.info(f"First item type: {type(first_item)}")
            if isinstance(first_item, dict):
                logger.info(f"First item keys: {list(first_item.keys())}")

            # Check if this is the parallel arrays format (singlepoint)
            # e.g., [{"energy": [e1, e2], "energy_per_atom": [epa1, epa2], ...}]
            if isinstance(first_item, dict) and "energy" in first_item:
                energies = first_item.get("energy", [])

                # Check if energies is a list (parallel arrays) or single value
                if isinstance(energies, list):
                    logger.info(
                        f"Detected parallel arrays format with {len(energies)} results"
                    )
                    return _parse_parallel_arrays_response(first_item, structures)
                else:
                    # Single structure result as list
                    logger.info("Detected single-item list format")
                    return _parse_list_of_dicts_response(data, structures)
            else:
                # List of dicts, one per structure
                return _parse_list_of_dicts_response(data, structures)

    # Handle dict response with predictions/results key
    elif isinstance(data, dict):
        logger.info(f"Response is dict with keys: {list(data.keys())}")

        if "predictions" in data:
            return _parse_endpoint_response(data["predictions"], structures)
        elif "results" in data:
            return _parse_endpoint_response(data["results"], structures)
        elif "error" in data:
            logger.error(f"Endpoint returned error: {data['error']}")
            raise MatterSimError(f"MatterSim error: {data['error']}")
        else:
            # Single dict with parallel arrays
            if "energy" in data:
                return _parse_parallel_arrays_response(data, structures)

    logger.warning(f"Could not parse response format: {type(data)}")
    # Return empty results for each structure
    for structure in structures:
        results.append(
            {
                "structureId": structure["id"],
                "metrics": {
                    "energyAboveHull": None,
                    "energyPerAtom": None,
                    "totalEnergy": None,
                    "isStable": None,
                    "isNovel": None,
                    "isUnique": None,
                    "forces": None,
                    "stress": None,
                },
                "relaxedCif": None,
            }
        )
    return results


def _parse_parallel_arrays_response(
    data: dict[str, Any], structures: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Parse MatterSim response with parallel arrays (singlepoint format).

    Input format:
    {
        "energy": [e1, e2, ...],
        "energy_per_atom": [epa1, epa2, ...],
        "forces": [f1, f2, ...],
        "stress": [s1, s2, ...],
        "stress_GPa": [sg1, sg2, ...],
        "structure": [struct1, struct2, ...]  # pymatgen Structure dicts
    }
    """
    logger.info("Parsing parallel arrays response format")

    energies = data.get("energy", [])
    energies_per_atom = data.get("energy_per_atom", [])
    forces_list = data.get("forces", [])
    stress_list = data.get("stress_GPa", data.get("stress", []))
    structure_list = data.get(
        "structure", []
    )  # pymatgen Structure dicts from MatterSim

    logger.info(
        f"Response contains {len(structure_list)} structure dicts from MatterSim"
    )

    # Convert numpy arrays to lists if needed
    def to_list(val):
        if hasattr(val, "tolist"):
            return val.tolist()
        return val

    # Prepare data for MatterGen evaluation using structures from MatterSim response
    structures_for_eval = []
    for i, structure in enumerate(structures):
        energy = energies[i] if i < len(energies) else None
        # Use structure dict from MatterSim response (preferred) or fallback to None
        structure_dict = structure_list[i] if i < len(structure_list) else None

        if structure_dict is not None and energy is not None:
            structures_for_eval.append(
                {
                    "id": structure["id"],
                    "structure": structure_dict,  # pymatgen Structure dict
                    "total_energy": energy,
                }
            )
        elif energy is not None:
            logger.warning(
                f"Structure {structure['id']}: no structure dict in response, skipping evaluation"
            )

    # Try to compute metrics using MatterGen's MetricsEvaluator
    compute_metrics = _try_import_mattergen_evaluation()
    metrics_by_id: dict[str, dict[str, Any]] = {}

    if compute_metrics and structures_for_eval:
        logger.info(
            f"Computing metrics for {len(structures_for_eval)} structures using MatterGen"
        )
        try:
            metrics_by_id = compute_metrics(structures_for_eval)
            logger.info("MatterGen metrics computed successfully")
        except Exception as e:
            logger.warning(f"MatterGen evaluation failed: {e}")
    else:
        if not compute_metrics:
            logger.warning(
                "MatterGen evaluation unavailable - "
                "returning energyPerAtom only, other metrics will be null"
            )

    results = []
    for i, structure in enumerate(structures):
        energy = energies[i] if i < len(energies) else None
        energy_per_atom = energies_per_atom[i] if i < len(energies_per_atom) else None
        forces = to_list(forces_list[i]) if i < len(forces_list) else None
        stress = to_list(stress_list[i]) if i < len(stress_list) else None

        # Get metrics from MatterGen evaluation (or empty if unavailable)
        mattergen_metrics = metrics_by_id.get(structure["id"], {})
        energy_above_hull = mattergen_metrics.get("energyAboveHull")
        is_stable = mattergen_metrics.get("isStable")
        is_novel = mattergen_metrics.get("isNovel")
        is_unique = mattergen_metrics.get("isUnique")

        # Fallback: if no stability info, use simple heuristic
        if is_stable is None and energy_per_atom is not None:
            is_stable = energy_per_atom < 0

        result = {
            "structureId": structure["id"],
            "metrics": {
                "energyAboveHull": energy_above_hull,
                "energyPerAtom": energy_per_atom,
                "totalEnergy": energy,
                "isStable": is_stable,
                "isNovel": is_novel,
                "isUnique": is_unique,
                "forces": forces,
                "stress": stress,
            },
            "relaxedCif": None,
        }

        logger.info(
            f"Result for {structure['id']}: energy={energy}, "
            f"energy_per_atom={energy_per_atom}, e_above_hull={energy_above_hull}, "
            f"stable={is_stable}, novel={is_novel}, unique={is_unique}"
        )
        results.append(result)

    return results


def _parse_list_of_dicts_response(
    data: list[dict[str, Any]], structures: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Parse response as a list of dicts, one per structure."""
    logger.info(f"Parsing list of {len(data)} dicts")

    # Prepare data for MatterGen evaluation using structures from MatterSim response
    structures_for_eval = []
    for i, structure in enumerate(structures):
        pred = data[i] if i < len(data) else {}
        energy = pred.get("energy") or pred.get("total_energy")
        # Use structure dict from MatterSim response (preferred)
        structure_dict = pred.get("structure")

        if structure_dict is not None and energy is not None:
            structures_for_eval.append(
                {
                    "id": structure["id"],
                    "structure": structure_dict,  # pymatgen Structure dict
                    "total_energy": energy,
                }
            )
        elif energy is not None:
            logger.warning(
                f"Structure {structure['id']}: no structure dict in response, skipping evaluation"
            )

    # Try to compute metrics using MatterGen's MetricsEvaluator
    compute_metrics = _try_import_mattergen_evaluation()
    metrics_by_id: dict[str, dict[str, Any]] = {}

    if compute_metrics and structures_for_eval:
        logger.info(
            f"Computing metrics for {len(structures_for_eval)} structures using MatterGen"
        )
        try:
            metrics_by_id = compute_metrics(structures_for_eval)
            logger.info("MatterGen metrics computed successfully")
        except Exception as e:
            logger.warning(f"MatterGen evaluation failed: {e}")

    results = []
    for i, structure in enumerate(structures):
        pred = data[i] if i < len(data) else {}

        if isinstance(pred, dict):
            logger.info(f"Prediction {i} keys: {list(pred.keys())}")

        # Extract values with various naming conventions
        energy = pred.get("energy") or pred.get("total_energy")
        energy_per_atom = pred.get("energy_per_atom")

        # Convert numpy arrays to lists
        forces = pred.get("forces")
        if hasattr(forces, "tolist"):
            forces = forces.tolist()

        stress = pred.get("stress_GPa") or pred.get("stress")
        if hasattr(stress, "tolist"):
            stress = stress.tolist()

        # Get metrics from MatterGen evaluation (or empty if unavailable)
        mattergen_metrics = metrics_by_id.get(structure["id"], {})
        energy_above_hull = mattergen_metrics.get("energyAboveHull")

        # Use MatterGen metrics if available, otherwise fall back to pred values
        is_stable = mattergen_metrics.get("isStable")
        if is_stable is None:
            is_stable = pred.get("is_stable")

        is_novel = mattergen_metrics.get("isNovel")
        if is_novel is None:
            is_novel = pred.get("is_novel", pred.get("novel"))

        is_unique = mattergen_metrics.get("isUnique")
        if is_unique is None:
            is_unique = pred.get("is_unique", pred.get("unique"))

        # Fallback stability check
        if is_stable is None and energy_per_atom is not None:
            is_stable = energy_per_atom < 0

        result = {
            "structureId": structure["id"],
            "metrics": {
                "energyAboveHull": energy_above_hull,
                "energyPerAtom": energy_per_atom,
                "totalEnergy": energy,
                "isStable": is_stable,
                "isNovel": is_novel,
                "isUnique": is_unique,
                "forces": forces,
                "stress": stress,
            },
            "relaxedCif": pred.get("relaxed_cif") or pred.get("relaxed_structure"),
        }

        logger.info(
            f"Result for {structure['id']}: energy={energy}, "
            f"energy_per_atom={energy_per_atom}, e_above_hull={energy_above_hull}, "
            f"stable={is_stable}, novel={is_novel}, unique={is_unique}"
        )
        results.append(result)

    return results
