"""
Dayhoff scoring server — runs inside the Azure ML GPU container.

Loads all 4 Dayhoff model variants into GPU memory.
Accepts POST /score with JSON payload, returns generated sequences.

Azure ML custom container requirements:
- Liveness: GET /health returns 200
- Readiness: GET /health returns 200 (after models loaded)
- Scoring: POST /score accepts JSON, returns JSON
"""

import os
import logging

from flask import Flask, request, jsonify

from generator import DayhoffGenerator
from constants import AVAILABLE_MODELS, MAX_SEQUENCES, MAX_LENGTH

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dayhoff-score")

app = Flask(__name__)

# Global state
generator: DayhoffGenerator | None = None
ready = False


@app.before_request
def check_ready():
    """Block scoring requests until models are loaded."""
    if request.path == "/health":
        return  # Always allow health checks
    if not ready:
        return jsonify({"error": "Models still loading"}), 503


@app.route("/health", methods=["GET"])
def health():
    """Liveness probe — always returns 200 if the process is running.

    Azure ML checks this to verify the container hasn't crashed.
    Must return 200 even while models are still loading.
    """
    return jsonify({
        "status": "ready" if ready else "loading",
        "ready": ready,
        "models": list(generator.models.keys()) if generator else [],
    }), 200


@app.route("/ready", methods=["GET"])
def readiness():
    """Readiness probe — returns 200 only after models are loaded.

    Azure ML checks this before routing scoring traffic.
    Returns 503 while models are still loading.
    """
    if not ready:
        return jsonify({"status": "loading"}), 503
    return jsonify({
        "status": "ready",
        "models": list(generator.models.keys()),
    }), 200


@app.route("/score", methods=["POST"])
def score():
    """Main scoring endpoint. Azure ML routes traffic here.

    Request format:
    {
        "prompt": "M",
        "model": "3b-GR-HM-c",        // optional, defaults to first loaded
        "num_sequences": 5,
        "max_length": 256,
        "temperature": 1.0,
        "direction": "n_to_c",
        "generation_mode": "unconditional",
        "calculate_fitness": true       // optional, default true
    }

    Response format:
    {
        "sequences_with_fitness": [
            {"sequence": "MKTL...", "fitness_score": 72.3, "length": 128}
        ],
        "stats": {
            "total_generated": 5,
            "valid_count": 5,
            "model": "3b-GR-HM-c"
        }
    }
    """
    try:
        data = request.get_json(force=True)

        # Azure ML managed online endpoints only expose one scoring route.
        # Dispatch variant-scoring requests by payload shape so a single
        # /score URL serves both generation and variant scoring.
        if data.get("action") == "score_variants" or (
            isinstance(data.get("sequences"), list) and "prompt" not in data
        ):
            return _do_score_variants(data)

        # Parse and validate parameters
        prompt = data.get("prompt", "M")
        model_key = data.get("model", None)
        num_sequences = min(int(data.get("num_sequences", 3)), MAX_SEQUENCES)
        max_length = min(int(data.get("max_length", 80)), MAX_LENGTH)
        # Defaults match microsoft/dayhoff @ main (see constants.py).
        temperature = float(data.get("temperature", 1.0))
        min_p = float(data.get("min_p", 0.05))
        direction = data.get("direction", "n_to_c")
        generation_mode = data.get("generation_mode", "unconditional")
        calculate_fitness = data.get("calculate_fitness", True)

        # Validate model key
        if model_key and model_key not in generator.models:
            return jsonify({
                "error": f"Model '{model_key}' not available. "
                         f"Choose from: {list(generator.models.keys())}",
            }), 400

        # Validate homolog support
        homologs = data.get("homologs")
        if homologs and model_key:
            config = AVAILABLE_MODELS.get(model_key, {})
            if not config.get("supports_homologs", False):
                return jsonify({
                    "error": f"Model '{model_key}' does not support homolog "
                             f"conditioning. Use 3b-GR-HM-c or 3b-GR-HM.",
                }), 400

        active_key = model_key or generator.default_model_key
        logger.info(
            "Generating %d seqs with %s, mode=%s, temp=%.1f",
            num_sequences, active_key, generation_mode, temperature,
        )

        # Generate
        sequences = generator.generate_sequences(
            prompt=prompt,
            num_sequences=num_sequences,
            max_length=max_length,
            temperature=temperature,
            generation_mode=generation_mode,
            direction=direction,
            model_key=model_key,
            homologs=homologs if homologs else None,
            min_p=min_p,
        )

        # Validate
        validation = generator.validate_sequences(sequences)

        # Fitness scoring (optional — adds latency)
        # Uses official Dayhoff scoring: forward + backward avg log-likelihood
        # See: github.com/microsoft/dayhoff/blob/main/examples/score.py
        results = []
        for seq in validation["valid_sequences"]:
            entry = {"sequence": seq, "length": len(seq)}
            if calculate_fitness:
                entry["fitness_score"] = round(
                    generator.calculate_fitness_score(seq, model_key=model_key), 1,
                )
            results.append(entry)

        # Sort by fitness if calculated
        if calculate_fitness:
            results.sort(key=lambda x: x.get("fitness_score", 0), reverse=True)

        return jsonify({
            "sequences_with_fitness": results,
            "stats": {
                "total_generated": len(sequences),
                "valid_count": validation["valid_count"],
                "invalid_count": validation["invalid_count"],
                "success_rate": validation["success_rate"],
                "model": active_key,
                "generation_mode": generation_mode,
                "direction": direction,
            },
        })

    except Exception:
        logger.exception("Scoring error")
        return jsonify({"error": "Internal scoring error"}), 500


@app.route("/score_variants", methods=["POST"])
def score_variants():
    """Score user-supplied variants without generating new sequences.

    Note: Azure ML managed online endpoints only proxy the configured
    scoring_route (/score). This route is kept for local development and for
    any future deployment that exposes additional paths. In production the
    same payload shape is dispatched via /score (see the action='score_variants'
    branch above).
    """
    try:
        data = request.get_json(force=True)
        return _do_score_variants(data)
    except Exception:
        logger.exception("Variant scoring error")
        return jsonify({"error": "Internal variant scoring error"}), 500


def _do_score_variants(data):
    """Shared variant-scoring implementation."""
    sequences = data.get("sequences", [])
    model_key = data.get("model", None)

    if model_key and model_key not in generator.models:
        return jsonify({
            "error": f"Model '{model_key}' not available. "
                     f"Choose from: {list(generator.models.keys())}",
        }), 400

    active_key = model_key or generator.default_model_key
    logger.info("Scoring %d variants with %s", len(sequences), active_key)

    variants = []
    for index, sequence in enumerate(sequences, start=1):
        score_value = round(
            generator.calculate_fitness_score(sequence, model_key=model_key), 1,
        )
        variants.append({
            "rank": index,
            "input_index": index,
            "sequence": sequence,
            "length": len(sequence),
            "fitness_score": score_value,
        })

    variants.sort(key=lambda item: item["fitness_score"], reverse=True)
    for rank, item in enumerate(variants, start=1):
        item["rank"] = rank

    return jsonify({
        "success": True,
        "model": active_key,
        "variants": variants,
    })


def init_models():
    """Load all models at startup."""
    global generator, ready
    logger.info("Loading all Dayhoff models...")
    generator = DayhoffGenerator(load_all=True)
    ready = True
    logger.info("All models loaded: %s", list(generator.models.keys()))


# Load models when module is imported (gunicorn --preload runs this in master)
init_models()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
