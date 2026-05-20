"""ESMFold scoring server — runs inside an Azure ML GPU container.

Single AML scoring route at POST /score that accepts:
    {"sequence": "MDKK..."}                  # plain ESMFold call
    {"action": "fold", "sequence": "MDKK..."}  # discriminator-style call (compat)

Returns:
    {"success": true, "pdb": "<pdb text>", "sequence_length": N, "max_plddt": float}

Liveness:  GET /health  → 200 once process is up
Readiness: GET /ready   → 200 once model is loaded
"""

from __future__ import annotations

import logging
import os
import re
import time
import threading
from typing import Optional

import torch
from flask import Flask, jsonify, request
from transformers import AutoTokenizer, EsmForProteinFolding
from transformers.models.esm.openfold_utils.feats import atom14_to_atom37
from transformers.models.esm.openfold_utils.protein import Protein, to_pdb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dayhoff-fold")

MODEL_ID = os.environ.get("FOLD_MODEL_ID", "facebook/esmfold_v1")
# Hard cap to prevent OOM on a single A100 80GB. ESMFold attention is O(L^2);
# at L=1500 inference uses ~55GB activations on top of ~5GB weights.
MAX_SEQUENCE_LENGTH = int(os.environ.get("FOLD_MAX_LENGTH", "1500"))
# Smaller chunks reduce peak memory for long sequences at a small speed cost.
CHUNK_SIZE = int(os.environ.get("FOLD_CHUNK_SIZE", "64"))
CANONICAL = re.compile(r"[^ACDEFGHIKLMNPQRSTVWY]")

app = Flask(__name__)

_model: Optional[EsmForProteinFolding] = None
_tokenizer = None
_ready = False
_lock = threading.Lock()


def _load_model() -> None:
    """Load ESMFold onto GPU in fp16 once at startup."""
    global _model, _tokenizer, _ready
    t0 = time.time()
    logger.info("Loading %s ...", MODEL_ID)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = EsmForProteinFolding.from_pretrained(MODEL_ID, low_cpu_mem_usage=True)
    if torch.cuda.is_available():
        model = model.cuda()
        # Half-precision the language-model trunk to halve memory; the structure
        # module stays fp32 because openfold's matrix ops are not numerically
        # stable in fp16.
        model.esm = model.esm.half()
        torch.backends.cuda.matmul.allow_tf32 = True
    model.trunk.set_chunk_size(CHUNK_SIZE)
    model.eval()
    _model = model
    _tokenizer = tokenizer
    _ready = True
    logger.info("ESMFold loaded in %.1fs (chunk=%d, fp16=%s)", time.time() - t0, CHUNK_SIZE, torch.cuda.is_available())


def _convert_outputs_to_pdb(outputs) -> tuple[str, float, float]:
    """Convert ESMFold model outputs into a single-chain PDB string.

    Returns (pdb_text, mean_plddt, max_plddt). pLDDT in 0–100 range.
    """
    final_atom_positions = atom14_to_atom37(outputs["positions"][-1], outputs)
    outputs = {k: v.to("cpu").numpy() for k, v in outputs.items()}
    final_atom_positions = final_atom_positions.cpu().numpy()
    final_atom_mask = outputs["atom37_atom_exists"]
    plddt = outputs["plddt"][0]  # (L,)
    pred = Protein(
        aatype=outputs["aatype"][0],
        atom_positions=final_atom_positions[0],
        atom_mask=final_atom_mask[0],
        residue_index=outputs["residue_index"][0] + 1,
        b_factors=outputs["plddt"][0],
        chain_index=outputs["chain_index"][0] if "chain_index" in outputs else None,
    )
    return to_pdb(pred), float(plddt.mean()), float(plddt.max())


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ready" if _ready else "loading",
        "ready": _ready,
        "model": MODEL_ID,
        "max_length": MAX_SEQUENCE_LENGTH,
    }), 200


@app.route("/ready", methods=["GET"])
def ready():
    if not _ready:
        return jsonify({"status": "loading"}), 503
    return jsonify({"status": "ready", "model": MODEL_ID, "max_length": MAX_SEQUENCE_LENGTH}), 200


@app.route("/score", methods=["POST"])
def score():
    if not _ready:
        return jsonify({"error": "Model still loading", "success": False}), 503

    data = request.get_json(silent=True) or {}
    sequence = (data.get("sequence") or "").strip().upper()
    if not sequence:
        return jsonify({"error": "Missing 'sequence' in request body.", "success": False}), 400

    cleaned = CANONICAL.sub("", sequence)
    if not cleaned:
        return jsonify({"error": "Sequence contains no canonical amino acids.", "success": False}), 400
    if len(cleaned) > MAX_SEQUENCE_LENGTH:
        return jsonify({
            "error": f"Sequence is {len(cleaned)} aa. This ESMFold instance supports up to {MAX_SEQUENCE_LENGTH} aa per request.",
            "success": False,
        }), 400

    t0 = time.time()
    # Serialize requests per instance: ESMFold is GPU-bound and concurrent calls
    # cause OOM on long inputs. AML's max_concurrent_requests_per_instance
    # already enforces this, but we belt-and-suspenders here for local runs.
    with _lock:
        try:
            tokenized = _tokenizer([cleaned], return_tensors="pt", add_special_tokens=False)
            input_ids = tokenized["input_ids"]
            if torch.cuda.is_available():
                input_ids = input_ids.cuda()
            with torch.no_grad():
                outputs = _model(input_ids)
            pdb, mean_plddt, max_plddt = _convert_outputs_to_pdb(outputs)
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            logger.warning("OOM folding sequence_len=%d", len(cleaned))
            return jsonify({
                "error": f"GPU ran out of memory folding {len(cleaned)} aa. Try a shorter sequence.",
                "success": False,
            }), 507
        except Exception as exc:
            logger.exception("Fold error sequence_len=%d", len(cleaned))
            return jsonify({"error": f"Fold failed: {exc}", "success": False}), 500

    elapsed = time.time() - t0
    logger.info("FOLDED len=%d elapsed=%.1fs mean_plddt=%.1f", len(cleaned), elapsed, mean_plddt)
    return jsonify({
        "success": True,
        "pdb": pdb,
        "sequence_length": len(cleaned),
        "mean_plddt": mean_plddt,
        "max_plddt": max_plddt,
        "elapsed_seconds": round(elapsed, 2),
        "model": MODEL_ID,
    }), 200


# Warm the model in a background thread so /health returns 200 immediately
# while the GPU load runs concurrently — AML's liveness probe wants 200 fast.
threading.Thread(target=_load_model, daemon=True).start()
