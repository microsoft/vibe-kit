"""
Local BioEmu inference module.

Runs BioEmu model locally instead of via Azure endpoint.
Requires: pip install bioemu (Linux only, Python 3.10-3.12)
GPU (CUDA) optional but recommended for reasonable speed.
"""

import base64
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def check_local_bioemu_available():
    """Check if local BioEmu inference is available."""
    errors = []
    warnings = []

    # Check if bioemu package is installed
    try:
        import bioemu  # noqa: F401
    except ImportError:
        errors.append("bioemu package not installed. Run: pip install bioemu")

    # Check PyTorch and GPU availability (GPU is optional but recommended)
    try:
        import torch

        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            logger.info(f"GPU detected: {gpu_name} with {gpu_memory:.1f} GB VRAM")
        else:
            warnings.append(
                "No CUDA GPU detected. BioEmu will run on CPU (much slower)."
            )
            logger.warning("No CUDA GPU available - BioEmu will use CPU (slow)")
    except ImportError:
        errors.append("PyTorch not installed")

    return len(errors) == 0, errors, warnings


def run_local_prediction(sequence: str, num_samples: int = 10) -> dict:
    """
    Run BioEmu prediction locally.

    Args:
        sequence: Amino acid sequence
        num_samples: Number of conformational samples to generate

    Returns:
        Dict with 'pdb_data' and 'xtc_data' as base64-encoded strings,
        matching the Azure endpoint response format.
    """
    # Check availability first
    available, errors, warnings = check_local_bioemu_available()
    if not available:
        raise RuntimeError(f"Local BioEmu not available: {'; '.join(errors)}")
    for warn in warnings:
        logger.warning(warn)

    # Import here to avoid errors if bioemu not installed
    from bioemu.sample import main as bioemu_sample

    logger.info(
        f"Starting local BioEmu prediction for sequence of length {len(sequence)}"
    )
    logger.info(f"Generating {num_samples} samples...")

    # Create temporary directory for output
    with tempfile.TemporaryDirectory() as temp_dir:
        output_dir = Path(temp_dir)

        # Run BioEmu sampling
        # This will create: topology.pdb, samples.xtc, sequence.fasta
        bioemu_sample(
            sequence=sequence,
            num_samples=num_samples,
            output_dir=output_dir,
            # Use default model (bioemu-v1.1)
            model_name="bioemu-v1.1",
        )

        # Read output files
        pdb_path = output_dir / "topology.pdb"
        xtc_path = output_dir / "samples.xtc"

        if not pdb_path.exists():
            raise RuntimeError("BioEmu did not produce topology.pdb")
        if not xtc_path.exists():
            raise RuntimeError("BioEmu did not produce samples.xtc")

        # Read and encode as base64
        with open(pdb_path, "rb") as f:
            pdb_data = base64.b64encode(f.read()).decode("utf-8")

        with open(xtc_path, "rb") as f:
            xtc_data = base64.b64encode(f.read()).decode("utf-8")

        logger.info(
            f"Local BioEmu prediction complete. PDB: {len(pdb_data)} chars, XTC: {len(xtc_data)} chars"
        )

        # Return in same format as Azure endpoint
        return {
            "pdb_data": pdb_data,
            "xtc_data": xtc_data,
            "fasta_data": sequence,
            "source": "local",
        }


def get_local_status() -> dict:
    """Get status of local BioEmu setup."""
    available, errors, warnings = check_local_bioemu_available()

    status = {
        "available": available,
        "mode": "local",
    }

    if errors:
        status["errors"] = errors
        status["message"] = "Local BioEmu not configured: " + "; ".join(errors)
    elif warnings:
        status["warnings"] = warnings
        status["message"] = "Local BioEmu ready (with warnings)"
    else:
        status["message"] = "Local BioEmu ready"

        # Add GPU info
        try:
            import torch

            status["gpu"] = {
                "name": torch.cuda.get_device_name(0),
                "memory_gb": round(
                    torch.cuda.get_device_properties(0).total_memory / (1024**3), 1
                ),
            }
        except Exception:
            pass

    return status
