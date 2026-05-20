"""
Pre-download all model assets at Docker build time.

BioEMU requires two sets of weights that are fetched lazily on first run:
1. BioEMU model checkpoint (~few hundred MB) from HuggingFace
2. AlphaFold2 model parameters (~3.5 GB) used by the inlined ColabFold
   MSA embedding pipeline

Downloading at build time avoids a 5-10 min cold-start penalty on the
first request and prevents liveness/readiness probes from timing out.
"""

import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("download_models")

# ---------------------------------------------------------------------------
# 1. BioEMU checkpoint
# ---------------------------------------------------------------------------
def download_bioemu_checkpoint():
    """
    Trigger the HuggingFace checkpoint download via BioEMU's own helper.
    This writes model files into HF_HOME (set in Dockerfile).
    """
    logger.info("Downloading BioEMU checkpoint (bioemu-v1.1, default)...")
    try:
        from bioemu.model_utils import maybe_download_checkpoint

        ckpt_path, config_path = maybe_download_checkpoint(
            model_name="bioemu-v1.1",
            ckpt_path=None,
            model_config_path=None,
        )
        logger.info("  checkpoint: %s", ckpt_path)
        logger.info("  config:     %s", config_path)
    except Exception:
        logger.exception("Failed to download BioEMU checkpoint")
        sys.exit(1)


# ---------------------------------------------------------------------------
# 2. AlphaFold2 weights (used by inlined ColabFold for MSA embeddings)
# ---------------------------------------------------------------------------
def download_alphafold_weights():
    """
    Attempt to trigger the AlphaFold2 parameter download that ColabFold
    performs on first use.  The exact mechanism depends on the BioEMU
    version — we try the most likely paths in order.
    """
    cache_dir = os.environ.get("COLABFOLD_CACHE", str(Path.home() / ".cache" / "colabfold"))
    logger.info("Downloading AlphaFold2 weights to %s ...", cache_dir)
    os.makedirs(cache_dir, exist_ok=True)

    # Try 1: bioemu may expose a direct download helper
    try:
        from bioemu.get_embeds import _download_alphafold_params  # type: ignore
        _download_alphafold_params(cache_dir=cache_dir)
        logger.info("  Downloaded via bioemu.get_embeds._download_alphafold_params")
        return
    except (ImportError, AttributeError):
        pass

    # Try 2: ColabFold's own download utility
    try:
        from bioemu.colabfold_inline.download import download_alphafold_params  # type: ignore
        download_alphafold_params(Path(cache_dir))
        logger.info("  Downloaded via bioemu.colabfold_inline.download")
        return
    except (ImportError, AttributeError):
        pass

    # Try 3: Direct HuggingFace download of AF2 params
    try:
        from huggingface_hub import snapshot_download
        snapshot_download(
            "google/alphafold-v2",
            cache_dir=cache_dir,
            ignore_patterns=["*.md", "*.txt"],
        )
        logger.info("  Downloaded via huggingface_hub")
        return
    except Exception:
        pass

    # If none worked, log a warning — the weights will download on first
    # request instead (acceptable, but cold-start will be slow).
    logger.warning(
        "Could not pre-download AlphaFold2 weights. "
        "They will be fetched on the first inference request. "
        "Expect a ~5-10 min delay on first call."
    )


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    download_bioemu_checkpoint()
    download_alphafold_weights()
    logger.info("Model download complete.")
