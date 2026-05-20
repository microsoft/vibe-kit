from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

import httpx
from pymatgen.core import Structure

from config import Settings
from models.api import GenerationRequest, StructureSummary
from services.naming import get_systematic_name
from services.storage import JobPaths

logger = logging.getLogger(__name__)


class MatterGenError(Exception):
    """Base exception for MatterGen errors with user-friendly messages."""

    def __init__(
        self,
        message: str,
        error_code: str,
        user_message: str,
        status_code: int | None = None,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.user_message = user_message
        self.status_code = status_code


class RateLimitError(MatterGenError):
    """Raised when the endpoint returns 429 Too Many Requests."""

    def __init__(self, detail: str = ""):
        super().__init__(
            message=f"Rate limited by MatterGen endpoint. {detail}",
            error_code="rate_limited",
            user_message="This is an experimental site and we're experiencing an increase in demand. Please try again soon!",
            status_code=429,
        )


class AuthenticationError(MatterGenError):
    """Raised when authentication fails."""

    def __init__(self, detail: str = ""):
        super().__init__(
            message=f"Authentication failed. {detail}",
            error_code="auth_failed",
            user_message="We're having trouble connecting to the service. Please try again later or contact support if the issue persists.",
            status_code=401,
        )


class ServiceUnavailableError(MatterGenError):
    """Raised when the service is unavailable (502, 503)."""

    def __init__(self, status_code: int, detail: str = ""):
        super().__init__(
            message=f"Service unavailable ({status_code}). {detail}",
            error_code="service_unavailable",
            user_message="The generation service is temporarily unavailable. Please try again in a few minutes.",
            status_code=status_code,
        )


class TimeoutError(MatterGenError):
    """Raised when the request times out."""

    def __init__(self, detail: str = ""):
        super().__init__(
            message=f"Request timed out. {detail}",
            error_code="timeout",
            user_message="The request took too long to complete. The service may be under heavy load. Please try again.",
            status_code=None,
        )


class GenerationError(MatterGenError):
    """Raised for general generation errors."""

    def __init__(self, detail: str = ""):
        super().__init__(
            message=f"Generation failed. {detail}",
            error_code="generation_failed",
            user_message="Something went wrong while generating structures. Please try again.",
            status_code=None,
        )


async def get_auth_token() -> str | None:
    """Get Entra ID token for Azure ML endpoint authentication.

    Uses DefaultAzureCredential which tries multiple auth methods:
    - Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
    - Managed Identity (when running in Azure)
    - Azure CLI (az login)
    - VS Code Azure extension
    """
    logger.info("Attempting to get Entra ID token for MatterGen...")
    try:
        from azure.identity.aio import DefaultAzureCredential

        logger.info("azure-identity package found, creating credential...")
        credential = DefaultAzureCredential()
        logger.info("Requesting token for https://ml.azure.com/.default ...")
        token = await credential.get_token("https://ml.azure.com/.default")
        await credential.close()
        logger.info(f"Token acquired successfully (expires: {token.expires_on})")
        return token.token
    except ImportError:
        logger.error(
            "azure-identity NOT installed. Install with: pip install azure-identity"
        )
        return None
    except Exception as e:
        logger.error(f"Failed to get Entra ID token: {type(e).__name__}: {e}")
        return None


def parse_cif_formula(cif_content: str) -> tuple[str, str]:
    """Extract formula and composition from CIF content.

    Returns (formula, composition) tuple.
    """
    lines = cif_content.split("\n")

    formula = None
    composition = None

    for line in lines:
        line = line.strip()
        if line.startswith("_chemical_formula_structural"):
            parts = line.split(None, 1)
            if len(parts) >= 2:
                formula = parts[1].strip().strip("'\"")
        elif line.startswith("_chemical_formula_sum"):
            parts = line.split(None, 1)
            if len(parts) >= 2:
                composition = parts[1].strip().strip("'\"")

    # Fall back to composition if formula not found
    if not formula and composition:
        formula = composition
    elif not formula:
        formula = "Unknown"

    if not composition:
        composition = formula

    return formula, composition


async def run_mattergen(
    settings: Settings,
    job_paths: JobPaths,
    request: GenerationRequest,
) -> tuple[str | None, list[StructureSummary]]:
    """Call hosted MatterGen endpoint and parse returned structures.

    The endpoint format varies by mode:
    - Production: Direct payload with num_samples support
    - Research: Wrapped in input_data, no num_samples (always returns 2)

    Response format:
    {
        "status": "success",
        "result": {
            "checkpoint_name": "ml_bulk_modulus",
            "structures": ["# CIF string 1", "# CIF string 2", ...]
        }
    }
    """
    if settings.app_mode == "production":
        # Production endpoint expects direct payload with num_samples
        payload: dict[str, Any] = {
            "num_samples": 2,
            "batch_size": 2,
            "properties_to_condition_on": request.properties_to_condition_on,
        }
        if request.diffusion_guidance_factor is not None:
            payload["diffusion_guidance_factor"] = request.diffusion_guidance_factor
    else:
        # Research endpoint expects input_data wrapper, no num_samples
        inner_payload: dict[str, Any] = {
            "properties_to_condition_on": request.properties_to_condition_on,
        }
        if request.diffusion_guidance_factor is not None:
            inner_payload["diffusion_guidance_factor"] = (
                request.diffusion_guidance_factor
            )
        payload = {"input_data": inner_payload}

    headers = {
        "Content-Type": "application/json",
    }
    if settings.mattergen_deployment_name:
        headers["azureml-model-deployment"] = settings.mattergen_deployment_name

    # Use Entra ID authentication
    if settings.mattergen_use_entra_auth:
        # Use Entra ID authentication
        logger.info("Using Entra ID authentication for MatterGen")
        token = await get_auth_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        else:
            raise AuthenticationError(
                "Failed to get Entra ID token. Ensure you're logged in with 'az login'."
            )
    else:
        logger.warning("No authentication configured for MatterGen endpoint")

    logger.info(f"Calling MatterGen endpoint: {settings.mattergen_endpoint_url}")
    logger.info(f"Payload: {json.dumps(payload)}")

    try:
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                settings.mattergen_endpoint_url,
                headers=headers,
                content=json.dumps(payload),
            )

            logger.info(f"Response status: {resp.status_code}")
            logger.info(f"Response headers: {dict(resp.headers)}")

            response_text = resp.text
            if resp.status_code >= 400:
                logger.error(f"Error response body: {response_text[:2000]}")

            if resp.status_code == 401:
                raise AuthenticationError(response_text[:500])

            if resp.status_code == 403:
                raise AuthenticationError(f"Access forbidden: {response_text[:500]}")

            if resp.status_code == 429:
                raise RateLimitError(response_text[:500])

            if resp.status_code == 502:
                raise ServiceUnavailableError(502, response_text[:500])

            if resp.status_code == 503:
                raise ServiceUnavailableError(503, response_text[:500])

            if resp.status_code == 504:
                raise TimeoutError(response_text[:500])

            if resp.status_code >= 400:
                raise GenerationError(f"HTTP {resp.status_code}: {response_text[:500]}")

            data = resp.json()
    except httpx.TimeoutException as e:
        raise TimeoutError(str(e)) from e
    except httpx.RequestError as e:
        raise GenerationError(f"Network error: {str(e)}") from e

    # Persist raw response for debugging
    raw_response_path = job_paths.raw_dir / "mattergen_response.json"
    raw_response_path.write_text(json.dumps(data, indent=2))

    # Handle error response from endpoint (may return 200 with status: "error")
    if isinstance(data, dict) and data.get("status") == "error":
        raise GenerationError(data.get("message", "Unknown error"))

    # Parse structures from response
    # Supported formats:
    # - Internal endpoint: {"status": "success", "result": {"checkpoint_name": "...", "structures": [...]}}
    # - Azure AI Foundry: {"num_generated": ..., "checkpoint_used": "...", "structures": [...]}
    # Note: structures may be raw CIF strings OR dicts with {"filename": "...", "cif": "..."}
    structures: list[StructureSummary] = []
    job_id = job_paths.root.name
    checkpoint_name = None

    def extract_cif_strings(raw_structures: list) -> list[str]:
        """Extract CIF strings from structures that may be strings or dicts."""
        cif_strings = []
        for s in raw_structures:
            if isinstance(s, dict):
                # Azure AI Foundry format: {"filename": "...", "cif": "..."}
                cif_strings.append(s.get("cif", ""))
            else:
                # Raw CIF string
                cif_strings.append(s)
        return cif_strings

    if isinstance(data, dict):
        if data.get("status") == "success":
            # Internal endpoint format
            result = data.get("result", {})
            raw_structures = result.get("structures", [])
            cif_strings = extract_cif_strings(raw_structures)
            checkpoint_name = result.get("checkpoint_name")
        elif "structures" in data:
            # Azure AI Foundry format
            raw_structures = data.get("structures", [])
            cif_strings = extract_cif_strings(raw_structures)
            checkpoint_name = data.get("checkpoint_used")
        else:
            cif_strings = []
            logger.warning(f"Unexpected response format: {list(data.keys())}")
        logger.info(f"MatterGen checkpoint: {checkpoint_name}")
    else:
        cif_strings = []
        logger.warning(f"Unexpected response type: {type(data)}")

    num_generated = len(cif_strings)
    logger.info(f"MatterGen returned {num_generated} structures")

    for idx, cif_content in enumerate(cif_strings):
        filename = f"structure_{idx}.cif"

        # Save individual CIF file
        cif_path = job_paths.raw_dir / filename
        cif_path.write_text(cif_content)

        # Parse formula from CIF using pymatgen
        try:
            pymatgen_structure = Structure.from_str(cif_content, fmt="cif")
            formula = pymatgen_structure.composition.reduced_formula
            composition = str(pymatgen_structure.composition)
        except Exception as e:
            logger.warning(f"Failed to parse CIF with pymatgen: {e}")
            # Fall back to regex parsing
            formula, composition = parse_cif_formula(cif_content)

        # Generate IUPAC systematic name
        systematic_name = get_systematic_name(composition)

        structure = StructureSummary(
            id=str(uuid.uuid4()),
            job_id=job_id,
            index=idx,
            formula=formula,
            composition=composition,
            systematic_name=systematic_name,
            has_trajectory=False,
            metrics=None,
            cif=cif_content,
        )
        structures.append(structure)

    if not structures:
        logger.warning("MatterGen returned 0 structures")

    return None, structures
