"""
BioEMU scoring server — runs as an Azure ML managed online endpoint.

Loads the BioEMU 1.3.1 model into GPU memory once at startup, then
accepts protein sequences and returns sampled conformational ensembles
as base64-encoded PDB + XTC files.

The existing bioemu-prototype proxy (server/app.py) calls this server
via AZURE_BIOEMU_ENDPOINT / AZURE_BIOEMU_KEY — no code changes needed
in the proxy; just point those env vars at this endpoint.

Routes
------
GET  /health   Liveness probe — always 200 if the process is alive.
GET  /ready    Readiness probe — 200 only after the model is loaded.
POST /score    Main inference endpoint (auth handled by Azure ML).
"""

import base64
import logging
import os
import tempfile
import time
from pathlib import Path

from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bioemu-score")

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Global state — populated by init_model() at module import time
# ---------------------------------------------------------------------------
_ready = False

# Keep a reference so we can reuse the loaded score_model / SDEs across
# requests instead of reloading on every call.
_score_model = None
_model_config_path = None
_sdes = None


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
def init_model():
    """Load the BioEMU score model + SDEs into GPU memory once at startup."""
    global _score_model, _model_config_path, _sdes, _ready

    model_name = os.environ.get("BIOEMU_MODEL_NAME", "bioemu-v1.1")
    cache_so3 = os.environ.get("BIOEMU_SO3_CACHE", None)
    logger.info("Loading BioEMU model '%s' ...", model_name)

    t0 = time.time()
    from bioemu.model_utils import load_model, load_sdes, maybe_download_checkpoint

    ckpt_path, config_path = maybe_download_checkpoint(
        model_name=model_name, ckpt_path=None, model_config_path=None,
    )
    _score_model = load_model(ckpt_path, config_path)
    _model_config_path = config_path
    _sdes = load_sdes(model_config_path=config_path, cache_so3_dir=cache_so3)

    elapsed = time.time() - t0
    logger.info("Model loaded in %.1f s", elapsed)
    _ready = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.before_request
def _guard():
    """Block scoring requests while the model is still loading."""
    if request.path in ("/health", "/ready"):
        return
    if not _ready:
        return jsonify({"error": "Model still loading"}), 503


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ready" if _ready else "loading"}), 200


@app.route("/ready", methods=["GET"])
def ready():
    if not _ready:
        return jsonify({"status": "loading"}), 503
    return jsonify({"status": "ready"}), 200


@app.route("/score", methods=["POST"])
def score():
    """
    Run BioEMU sampling for a single protein sequence.

    --- Expected request (matches what server/app.py already sends) ---
    {
      "input_data": {
        "sequence": "NLYIQWLKDGGPSSGRPPPS",
        "num_samples": 10
      }
    }

    --- Response ---
    {
      "status": "success",
      "results": {
        "topology.pdb": "<base64-encoded PDB>",
        "samples.xtc":  "<base64-encoded XTC>"
      }
    }
    """
    try:
        body = request.get_json(force=True)
        input_data = body.get("input_data", body)  # tolerate flat payloads too
        sequence = input_data["sequence"].strip().upper()
        num_samples = int(input_data.get("num_samples", 10))

        # Sane caps — the proxy already enforces max 50, but be safe
        num_samples = max(1, min(num_samples, 50))

        logger.info(
            "Scoring request: seq_len=%d, num_samples=%d", len(sequence), num_samples,
        )

        t0 = time.time()
        results = _run_bioemu(sequence, num_samples)
        elapsed = time.time() - t0

        logger.info("Sampling completed in %.1f s", elapsed)
        return jsonify({"status": "success", "results": results})

    except KeyError as exc:
        return jsonify({"status": "failed", "message": f"Missing field: {exc}"}), 400
    except Exception:
        logger.exception("Scoring error")
        return jsonify({"status": "failed", "message": "Internal scoring error"}), 500


# ---------------------------------------------------------------------------
# BioEMU inference helper
# ---------------------------------------------------------------------------
def _run_bioemu(sequence: str, num_samples: int) -> dict[str, str]:
    """
    Call bioemu.sample logic with the already-loaded model, then read
    the output PDB + XTC files and return them as base64-encoded strings.

    Using bioemu.sample.main() would re-load the model from disk on every
    request. Instead we replicate the core loop (generate batches → convert
    to PDB/XTC) while reusing the in-memory model and SDE objects.
    """
    import numpy as np
    import torch
    import yaml
    from bioemu.sample import (
        generate_batch,
        get_context_chemgraph,
        DEFAULT_DENOISER_CONFIG_DIR,
    )
    from bioemu.convert_chemgraph import save_pdb_and_xtc
    from bioemu.seq_io import check_protein_valid
    from bioemu.steering import log_physicality
    from bioemu.utils import format_npz_samples_filename

    check_protein_valid(sequence)

    # Denoiser config (default DPM sampler)
    denoiser_config_path = DEFAULT_DENOISER_CONFIG_DIR / "dpm.yaml"
    with open(denoiser_config_path) as f:
        denoiser_config = yaml.safe_load(f)

    import hydra
    denoiser = hydra.utils.instantiate(denoiser_config)

    # Batch size heuristic from BioEMU: scales quadratically with seq length
    batch_size_100 = int(os.environ.get("BIOEMU_BATCH_SIZE_100", "10"))
    seq_len = len(sequence)
    batch_size = int(batch_size_100 * (100 / seq_len) ** 2)
    batch_size = max(1, min(batch_size, num_samples))

    cache_embeds_dir = os.environ.get("BIOEMU_EMBEDS_CACHE", None)
    msa_host_url = os.environ.get("BIOEMU_MSA_HOST_URL", None)

    base_seed = int(time.time_ns())

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # ---------- generate batches ----------
        all_pos = []
        all_orientations = []
        for start_idx in range(0, num_samples, batch_size):
            n = min(batch_size, num_samples - start_idx)
            seed = base_seed + start_idx
            logger.info(
                "Generating batch: start=%d, size=%d, seed=%d", start_idx, n, seed,
            )
            batch = generate_batch(
                score_model=_score_model,
                sequence=sequence,
                sdes=_sdes,
                batch_size=n,
                seed=seed,
                denoiser=denoiser,
                cache_embeds_dir=cache_embeds_dir,
                msa_file=None,
                msa_host_url=msa_host_url,
                fk_potentials=None,
                steering_config=None,
            )
            all_pos.append(batch["pos"].cpu())
            all_orientations.append(batch["node_orientations"].cpu())

        positions = torch.cat(all_pos, dim=0)
        node_orientations = torch.cat(all_orientations, dim=0)

        # ---------- physicality check + PDB/XTC conversion ----------
        log_physicality(positions, node_orientations, sequence)

        filter_samples = os.environ.get("BIOEMU_FILTER_SAMPLES", "true").lower() == "true"

        save_pdb_and_xtc(
            pos_nm=positions,
            node_orientations=node_orientations,
            topology_path=tmpdir_path / "topology.pdb",
            xtc_path=tmpdir_path / "samples.xtc",
            sequence=sequence,
            filter_samples=filter_samples,
        )

        # ---------- encode outputs ----------
        results: dict[str, str] = {}
        for fname in ("topology.pdb", "samples.xtc"):
            fpath = tmpdir_path / fname
            if fpath.exists():
                results[fname] = base64.b64encode(fpath.read_bytes()).decode("ascii")
            else:
                logger.warning("Expected output file missing: %s", fname)

        if not results:
            raise RuntimeError(
                "BioEMU produced no output files. "
                "All samples may have been filtered as unphysical."
            )

        return results


# ---------------------------------------------------------------------------
# Load model at import time (gunicorn imports the module → model loads once)
# ---------------------------------------------------------------------------
init_model()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
