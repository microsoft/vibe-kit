"""
Dayhoff API - Flask backend for protein sequence generation.

Proxy mode: forwards generation requests to Azure ML scoring endpoint.
No GPU, no models loaded locally. Lightweight container for App Service.
"""

import logging
import os
import re
import threading
import time
import uuid
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import requests as http_requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

from constants import (
    GenerationMode,
    Direction,
    MAX_SEQUENCES,
    MAX_LENGTH,
    MIN_LENGTH,
    AVAILABLE_MODELS,
)
from exporters import get_exporter, get_supported_formats
from sequence_screening import screen_sequence, screen_generated_sequences

logger = logging.getLogger(__name__)

CANONICAL_AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"
AMINO_ACID_PATTERN = re.compile(f"^[{CANONICAL_AMINO_ACIDS}]*$")

# Azure ML endpoint configuration
DAYHOFF_ENDPOINT = os.environ.get("DAYHOFF_ENDPOINT")
DAYHOFF_API_KEY = os.environ.get("DAYHOFF_API_KEY")

# Structure prediction endpoint (ESMFold or compatible service)
# Defaults to the public ESM Atlas ESMFold API; can be overridden with an approved internal endpoint.
DEFAULT_ESMFOLD_ENDPOINT = "https://api.esmatlas.com/foldSequence/v1/pdb/"
ESMFOLD_ENDPOINT = os.environ.get("ESMFOLD_ENDPOINT", DEFAULT_ESMFOLD_ENDPOINT)
ESMFOLD_API_KEY = os.environ.get("ESMFOLD_API_KEY")
# Public ESM Atlas API rejects sequences longer than 400 residues.
# An approved internal endpoint can override this cap via env.
ESMFOLD_MAX_LENGTH = int(os.environ.get("ESMFOLD_MAX_LENGTH", "400"))

# ── C1: in-memory generation progress tracker ──────────────────────────────
# Clients may pass a stable request id via the X-Request-Id header; the
# synchronous /api/generate handler updates this dict at milestones so a
# concurrent client poll to /api/generate/progress/<rid> sees real backend
# phases (validating -> calling_aml -> screening -> done) instead of a pure
# time-based estimate. Entries auto-expire after 10 minutes to bound memory.
_PROGRESS_LOCK = threading.Lock()
_PROGRESS: dict[str, dict] = {}
_PROGRESS_TTL_S = 600


def _progress_update(rid: str | None, phase: str, **extra) -> None:
    if not rid:
        return
    now = time.monotonic()
    with _PROGRESS_LOCK:
        _PROGRESS[rid] = {"phase": phase, "t": now, **extra}
        # Opportunistic GC of stale entries.
        if len(_PROGRESS) > 64:
            cutoff = now - _PROGRESS_TTL_S
            stale = [k for k, v in _PROGRESS.items() if v.get("t", 0) < cutoff]
            for k in stale:
                _PROGRESS.pop(k, None)


def _progress_read(rid: str) -> dict | None:
    with _PROGRESS_LOCK:
        entry = _PROGRESS.get(rid)
        return dict(entry) if entry else None


def normalize_amino_acid_sequence(sequence: str) -> str:
    """Normalize user-entered protein sequence text for validation/generation."""
    return re.sub(r"\s+", "", sequence or "").upper()


def invalid_amino_acids(sequence: str) -> list[str]:
    """Return sorted invalid residue/token characters from a protein sequence."""
    normalized = normalize_amino_acid_sequence(sequence)
    return sorted({char for char in normalized if char not in CANONICAL_AMINO_ACIDS})


def validation_error_for_prompt(prompt: str, max_length: int) -> str | None:
    """Validate a generation prompt while still allowing an empty de novo prompt."""
    normalized = normalize_amino_acid_sequence(prompt)
    invalid = invalid_amino_acids(normalized)
    if invalid:
        residue_list = ", ".join(invalid)
        phrase = "is not a valid amino acid" if len(invalid) == 1 else "are not valid amino acids"
        return (
            f"{residue_list} {phrase}. Use only the 20 "
            f"canonical amino acids: {CANONICAL_AMINO_ACIDS}."
        )
    if len(normalized) > max_length:
        return f"Prompt length {len(normalized)} exceeds max length {max_length}."
    return None


def parse_variant_sequences(raw: str | list[str]) -> list[str]:
    """Parse pasted variants from FASTA, newline, comma, or JSON list input."""
    if isinstance(raw, list):
        return [normalize_amino_acid_sequence(item) for item in raw if normalize_amino_acid_sequence(item)]

    text = str(raw or "")
    sequences: list[str] = []
    current: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(">"):
            if current:
                sequences.append(normalize_amino_acid_sequence("".join(current)))
                current = []
            continue
        if "," in stripped and not current:
            sequences.extend(normalize_amino_acid_sequence(part) for part in stripped.split(",") if normalize_amino_acid_sequence(part))
        else:
            current.append(stripped)

    if current:
        sequences.append(normalize_amino_acid_sequence("".join(current)))

    return [seq for seq in sequences if seq]


def _detect_tandem_repeat(tail: str) -> str | None:
    """Detect a short tandem-repeated motif covering most of `tail`.

    Catches the autoregressive seed-tile failure mode where the model loops a
    motif (e.g. 32-aa polymerase active site) ~5\u201310x in a row because EOS
    suppression / max_new_tokens prevented natural termination.

    Returns a human-readable warning string, or None if no significant repeat
    is found. Considers motif lengths 4\u201340 aa; flags when a motif repeats
    \u22653x consecutively and covers >40% of the tail.
    """
    n = len(tail)
    if n < 30:
        return None
    best: tuple[int, int, int] | None = None  # (covered, repeats, motif_len)
    for motif_len in range(4, min(41, n // 3 + 1)):
        # Scan every possible motif start; stop once we find one that repeats.
        for start in range(0, n - motif_len * 3 + 1):
            motif = tail[start : start + motif_len]
            repeats = 1
            pos = start + motif_len
            while pos + motif_len <= n and tail[pos : pos + motif_len] == motif:
                repeats += 1
                pos += motif_len
            if repeats >= 3:
                covered = repeats * motif_len
                if best is None or covered > best[0]:
                    best = (covered, repeats, motif_len)
                # Short-circuit: any 3+ repeat at this length is enough; move on.
                break
    if best is None:
        return None
    covered, repeats, motif_len = best
    if covered / n <= 0.40:
        return None
    return (
        f"Tail dominated by {repeats}\u00d7 repetition of a "
        f"{motif_len}-aa motif ({covered}/{n} aa). "
        "Likely a degenerate sample\u2014regenerate or try a different model."
    )


def score_variants_endpoint() -> str | None:
    """Return the scoring URL for variant requests.

    Azure ML managed online endpoints expose only one scoring route per
    deployment, so variant scoring is dispatched through /score with an
    `action: 'score_variants'` discriminator (see score_server.py). Local
    standalone Flask containers can still expose /score_variants directly,
    so we honour an explicit DAYHOFF_SCORE_VARIANTS_ENDPOINT override.
    """
    override = os.getenv("DAYHOFF_SCORE_VARIANTS_ENDPOINT")
    if override:
        return override
    return DAYHOFF_ENDPOINT


def create_app() -> Flask:
    """Application factory for Flask app (proxy mode)."""
    # BASE_URL is the public URL prefix the SPA + API are served under at
    # the edge (nginx / reverse proxy). Default '/' (root deploy / local dev).
    # For sub-path deployments, BASE_URL is the prefix the reverse proxy
    # routes traffic under. We use WSGI middleware below to strip the prefix
    # from incoming requests so all Flask routes can stay defined as bare
    # paths (e.g. '/api/health').
    base_url = os.environ.get("BASE_URL", "/").rstrip("/")
    # static_url_path matches BASE_URL so vite-baked asset URLs resolve.
    # The middleware below converts an incoming '<base_url>/assets/foo.js'
    # into a bare '/assets/foo.js' before Flask sees it, so Flask's static
    # handler (mounted at '/') serves it correctly. Setting static_url_path=''
    # is therefore correct in all cases.
    app = Flask(__name__, static_folder="static", static_url_path="")
    CORS(app)

    _register_routes(app, base_url)

    if base_url:
        # Wrap the WSGI app so requests with the BASE_URL prefix are stripped
        # before Flask routing. Lets the same code work at both root ('/...')
        # and sub-path ('<base_url>/...') deployments.
        app.wsgi_app = _PrefixStripMiddleware(app.wsgi_app, base_url)

    return app


class _PrefixStripMiddleware:
    """Strip a fixed URL prefix from incoming WSGI requests.

    Maps ``<prefix>/foo`` -> ``/foo`` and ``<prefix>`` (no trailing slash)
    -> ``/``. Anything not under ``<prefix>`` passes through unchanged so
    direct probes like ``/healthz`` or origin-level App Service checks still
    reach Flask. SCRIPT_NAME is set so url_for() generates correct absolute
    URLs back to the client.
    """

    def __init__(self, wsgi_app, prefix: str) -> None:
        self._wsgi_app = wsgi_app
        self._prefix = prefix

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path == self._prefix or path.startswith(self._prefix + "/"):
            environ["SCRIPT_NAME"] = environ.get("SCRIPT_NAME", "") + self._prefix
            environ["PATH_INFO"] = path[len(self._prefix):] or "/"
        return self._wsgi_app(environ, start_response)


def _register_routes(app: Flask, base_url: str = "") -> None:
    """Register all API routes.

    base_url is the deployment sub-path (no trailing slash; '' for root).
    Used only by the index/redirect handlers; /api/* routes are kept bare
    because the WSGI middleware strips the sub-path before Flask routing.
    """

    @app.route("/api/health")
    def health_check():
        """Health check endpoint."""
        endpoint_configured = bool(DAYHOFF_ENDPOINT and DAYHOFF_API_KEY)
        return jsonify({
            "status": "healthy" if endpoint_configured else "endpoint_not_configured",
            "model_loaded": endpoint_configured,
            "endpoint_configured": endpoint_configured,
            "structure_prediction_configured": bool(ESMFOLD_ENDPOINT),
            "esmfold_max_length": ESMFOLD_MAX_LENGTH,
            "available_models": list(AVAILABLE_MODELS.keys()),
            "timestamp": datetime.now().isoformat(),
        })

    @app.route("/api/models")
    def list_models():
        """List available Dayhoff model variants."""
        models = []
        for key, config in AVAILABLE_MODELS.items():
            models.append({
                "key": key,
                "params": config["params"],
                "description": config["description"],
                "supports_homologs": config["supports_homologs"],
                "loaded": True,
            })
        return jsonify({
            "models": models,
            "default": list(AVAILABLE_MODELS.keys())[0],
        })

    @app.route("/api/generate", methods=["POST"])
    def generate_sequences():
        """Generate protein sequences via Azure ML endpoint."""
        request_id = uuid.uuid4().hex[:12]
        client_rid = request.headers.get("X-Request-Id")  # C1: optional client-supplied id for progress polling
        _progress_update(client_rid, "received")
        t_start = time.monotonic()

        if not DAYHOFF_ENDPOINT or not DAYHOFF_API_KEY:
            return jsonify({
                "error": "Scoring endpoint not configured.",
                "success": False,
            }), 503

        try:
            data = request.json
            prompt = normalize_amino_acid_sequence(data.get("prompt", "M"))
            num_sequences = int(data.get("num_sequences", 3))
            max_length = int(data.get("max_length", 512))
            temperature = float(data.get("temperature", 1.0))
            min_p = float(data.get("min_p", 0.05))
            generation_mode = data.get("generation_mode", GenerationMode.UNCONDITIONAL)
            direction = data.get("direction", Direction.N_TO_C)
            model_key = data.get("model", None)
            raw_homologs = data.get("homologs")

            # ── Parse and validate homolog context (optional) ──
            homolog_sequences: list[str] = []
            if raw_homologs:
                try:
                    homolog_sequences = parse_variant_sequences(raw_homologs)
                except Exception:
                    return jsonify({
                        "error": "Could not parse homolog sequences. Provide FASTA or one sequence per line.",
                        "success": False,
                    }), 400
                # Validate each homolog: canonical residues, length bounds, screening
                for idx, hseq in enumerate(homolog_sequences, start=1):
                    if len(hseq) < MIN_LENGTH:
                        return jsonify({
                            "error": f"Homolog #{idx} is {len(hseq)} aa. Minimum length is {MIN_LENGTH} aa.",
                            "success": False,
                        }), 400
                    if len(hseq) > MAX_LENGTH:
                        return jsonify({
                            "error": f"Homolog #{idx} is {len(hseq)} aa. Maximum length is {MAX_LENGTH} aa.",
                            "success": False,
                        }), 400
                    invalid = invalid_amino_acids(hseq)
                    if invalid:
                        return jsonify({
                            "error": f"Homolog #{idx}: {', '.join(invalid)} not a valid amino acid.",
                            "success": False,
                        }), 400
                    block_reason = screen_sequence(hseq)
                    if block_reason is not None:
                        logger.warning(
                            "SECURITY_BLOCK: endpoint=/api/generate type=homolog "
                            "index=%d reason=%s len=%d",
                            idx, block_reason, len(hseq),
                        )
                        return jsonify({
                            "error": f"Homolog #{idx} cannot be processed.",
                            "success": False,
                        }), 400

            logger.info(
                "GENERATE_REQUEST: request_id=%s model=%s mode=%s direction=%s "
                "prompt_len=%d max_length=%d num_sequences=%d temperature=%.2f",
                request_id, model_key, generation_mode, direction,
                len(prompt), max_length, num_sequences, temperature,
            )

            # Validate model key
            if model_key and model_key not in AVAILABLE_MODELS:
                return jsonify({
                    "error": f"Model '{model_key}' not available. Choose from: {list(AVAILABLE_MODELS.keys())}",
                    "success": False,
                }), 400

            # Validate inputs
            if num_sequences > MAX_SEQUENCES:
                return jsonify({
                    "error": f"Maximum {MAX_SEQUENCES} sequences allowed",
                    "success": False,
                }), 400

            if max_length > MAX_LENGTH:
                return jsonify({
                    "error": f"Maximum length is {MAX_LENGTH} amino acids",
                    "success": False,
                }), 400

            prompt_error = validation_error_for_prompt(prompt, max_length)
            if prompt_error:
                return jsonify({
                    "error": prompt_error,
                    "success": False,
                }), 400

            # ── Mode/model compatibility: family_guided requires homolog-capable model ──
            if generation_mode == GenerationMode.FAMILY_GUIDED:
                resolved_model = model_key or list(AVAILABLE_MODELS.keys())[0]
                if resolved_model in AVAILABLE_MODELS and not AVAILABLE_MODELS[resolved_model].get("supports_homologs"):
                    generation_mode = GenerationMode.UNCONDITIONAL
                    homolog_sequences = []  # discard homologs if model can't use them
                    logger.info(
                        "MODE_FALLBACK: request_id=%s model=%s family_guided->unconditional "
                        "(model does not support homolog conditioning)",
                        request_id, resolved_model,
                    )
            # ── If homologs provided on a homolog-capable model, auto-promote to family_guided ──
            elif homolog_sequences:
                resolved_model = model_key or list(AVAILABLE_MODELS.keys())[0]
                if resolved_model in AVAILABLE_MODELS and AVAILABLE_MODELS[resolved_model].get("supports_homologs"):
                    generation_mode = GenerationMode.FAMILY_GUIDED
                    logger.info(
                        "MODE_AUTO_PROMOTE: request_id=%s model=%s unconditional->family_guided "
                        "(homolog context provided, n=%d)",
                        request_id, resolved_model, len(homolog_sequences),
                    )
                else:
                    homolog_sequences = []

            # ── Safety screening: block long prompts matching toxins ──
            if len(prompt) >= 20:
                block_reason = screen_sequence(prompt)
                if block_reason is not None:
                    logger.warning(
                        "SECURITY_BLOCK: endpoint=/api/generate type=input_prompt "
                        "reason=%s prompt_len=%d",
                        block_reason, len(prompt),
                    )
                    return jsonify({
                        "error": "This request cannot be processed.",
                        "success": False,
                    }), 403

            # Forward to Azure ML scoring endpoint
            payload = {
                "prompt": prompt,
                "model": model_key,
                "num_sequences": num_sequences,
                "max_length": max_length,
                "temperature": temperature,
                "min_p": min_p,
                "direction": direction,
                "generation_mode": generation_mode,
                "calculate_fitness": True,
            }
            if homolog_sequences:
                payload["homologs"] = homolog_sequences

            try:
                _progress_update(client_rid, "calling_aml", model=model_key)
                response = http_requests.post(
                    DAYHOFF_ENDPOINT,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {DAYHOFF_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    # 3B models take ~150s on a warm A100; allow generous headroom
                    # for cold-start + queueing without surfacing a fake 504.
                    timeout=360,
                )
            except http_requests.Timeout:
                return jsonify({
                    "error": "High demand. Please try again shortly.",
                    "success": False,
                }), 504
            except http_requests.RequestException:
                return jsonify({
                    "error": "Prediction service unavailable.",
                    "success": False,
                }), 503

            if response.status_code == 429:
                return jsonify({
                    "error": "High demand. Please try again shortly.",
                    "success": False,
                }), 429
            if response.status_code != 200:
                return jsonify({
                    "error": "Prediction service unavailable.",
                    "success": False,
                }), 503

            # Transform scoring response to frontend format
            _progress_update(client_rid, "validating_output")
            result = response.json()
            sequences_with_fitness = result.get("sequences_with_fitness", [])
            stats = result.get("stats", {})

            # ── Post-generation validation: strip non-canonical residues ──
            validated = []
            for entry in sequences_with_fitness:
                seq = entry.get("sequence", "")
                # Remove any non-canonical characters the model may have produced
                cleaned = re.sub(f"[^{CANONICAL_AMINO_ACIDS}]", "", seq)
                if len(cleaned) >= MIN_LENGTH:
                    entry["sequence"] = cleaned
                    entry["length"] = len(cleaned)
                    validated.append(entry)
            sequences_with_fitness = validated

            # ── Plausibility filters: flag biologically implausible sequences ──
            plausible = []
            for entry in sequences_with_fitness:
                seq = entry.get("sequence", "")
                # Reject if >60% single amino acid (low complexity)
                if seq:
                    most_common_count = max(seq.count(aa) for aa in CANONICAL_AMINO_ACIDS)
                    if most_common_count / len(seq) > 0.6:
                        continue
                    # Reject if any single-residue run >20 (degenerate repeat)
                    if re.search(r"(.)\1{19,}", seq):
                        continue
                plausible.append(entry)
            filtered_count = len(sequences_with_fitness) - len(plausible)
            sequences_with_fitness = plausible

            # ── Tandem-repeat detector: flag (don't drop) sequences whose generated
            #    tail is dominated by a short repeated motif. Catches the
            #    "seed-tile" failure mode where an autoregressive LM loops a
            #    motif because it can't emit STOP. Appends a `repetition_warning`
            #    field consumed by the UI to surface a low-diversity badge.
            #
            #    If *every* surviving sequence is flagged, attempt up to 2
            #    resamples before giving up (the user still sees the warning
            #    on whatever we return, but at least we tried).
            MAX_RESAMPLE = 2
            for _resample in range(MAX_RESAMPLE + 1):
                seed_len = len(prompt)
                flagged = 0
                for entry in sequences_with_fitness:
                    seq = entry.get("sequence", "")
                    tail = seq[seed_len:] if len(seq) > seed_len else ""
                    warning = _detect_tandem_repeat(tail)
                    if warning:
                        entry["repetition_warning"] = warning
                        flagged += 1
                # If at least one clean sequence exists, or we've exhausted retries, break.
                if flagged < len(sequences_with_fitness) or _resample >= MAX_RESAMPLE:
                    break
                # All sequences are degenerate — resample.
                logger.info(
                    "RESAMPLE: request_id=%s attempt=%d/%d all %d sequences flagged as tandem repeats",
                    request_id, _resample + 1, MAX_RESAMPLE, flagged,
                )
                try:
                    resp2 = http_requests.post(
                        DAYHOFF_ENDPOINT,
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {DAYHOFF_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        timeout=360,
                    )
                    if resp2.status_code == 200:
                        r2 = resp2.json()
                        new_swf = r2.get("sequences_with_fitness", [])
                        # Re-apply validation + plausibility filters
                        v2 = []
                        for e in new_swf:
                            s = re.sub(f"[^{CANONICAL_AMINO_ACIDS}]", "", e.get("sequence", ""))
                            if len(s) >= MIN_LENGTH:
                                e["sequence"] = s
                                e["length"] = len(s)
                                v2.append(e)
                        p2 = []
                        for e in v2:
                            s = e.get("sequence", "")
                            if s and max(s.count(aa) for aa in CANONICAL_AMINO_ACIDS) / len(s) <= 0.6 and not re.search(r"(.)\1{19,}", s):
                                p2.append(e)
                        if p2:
                            sequences_with_fitness = p2
                except Exception:
                    break  # Don't let resample failures crash the request

            # ── Safety screening: filter generated sequences against toxin DB ──
            _progress_update(client_rid, "screening")
            sequences_with_fitness, blocked_count = screen_generated_sequences(
                sequences_with_fitness
            )

            latency_ms = round((time.monotonic() - t_start) * 1000)

            if not sequences_with_fitness:
                logger.warning(
                    "GENERATE_EMPTY: request_id=%s model=%s mode=%s "
                    "valid=0 blocked=%d filtered=%d latency_ms=%d",
                    request_id, model_key, generation_mode,
                    blocked_count, filtered_count, latency_ms,
                )
                return jsonify({
                    "error": (
                        "Generation produced no valid canonical protein sequences. "
                        "Try a lower temperature, a known protein prefix, or a different model."
                    ),
                    "success": False,
                    "sequences": [],
                    "sequences_with_fitness": [],
                    "invalid_sequences": result.get("invalid_sequences", []),
                    "stats": {
                        "total_generated": stats.get("total_generated", blocked_count),
                        "valid_count": 0,
                        "invalid_count": stats.get("invalid_count", 0) + blocked_count,
                        "success_rate": 0,
                        "generation_mode": generation_mode,
                        "direction": direction,
                        "avg_fitness": 0,
                        "model": stats.get("model", model_key or list(AVAILABLE_MODELS.keys())[0]),
                    },
                }), 502

            # Calculate avg fitness (after filtering)
            fitness_scores = [s.get("fitness_score", 0) for s in sequences_with_fitness]
            avg_fitness = sum(fitness_scores) / len(fitness_scores) if fitness_scores else 0

            logger.info(
                "GENERATE_OK: request_id=%s model=%s mode=%s "
                "valid=%d blocked=%d avg_fitness=%.1f latency_ms=%d",
                request_id, model_key, generation_mode,
                len(sequences_with_fitness), blocked_count,
                avg_fitness, latency_ms,
            )
            _progress_update(client_rid, "done", latency_ms=latency_ms, valid=len(sequences_with_fitness))

            return jsonify({
                "success": True,
                "sequences": [s["sequence"] for s in sequences_with_fitness],
                "sequences_with_fitness": sequences_with_fitness,
                "invalid_sequences": [],
                "stats": {
                    "total_generated": stats.get("total_generated", len(sequences_with_fitness) + blocked_count),
                    "valid_count": stats.get("valid_count", len(sequences_with_fitness)),
                    "invalid_count": stats.get("invalid_count", 0) + blocked_count,
                    "success_rate": stats.get("success_rate", 100.0),
                    "generation_mode": generation_mode,
                    "direction": direction,
                    "avg_fitness": round(avg_fitness, 1),
                    "model": stats.get("model", model_key or list(AVAILABLE_MODELS.keys())[0]),
                },
            })

        except Exception:
            logger.exception("GENERATE_ERROR: request_id=%s", request_id)
            _progress_update(client_rid, "error")
            return jsonify({"error": "Internal server error", "success": False}), 500

    @app.route("/api/generate/progress/<rid>", methods=["GET"])
    def generate_progress(rid: str):
        """C1: return live phase for an in-flight /api/generate request.

        Clients pass an `X-Request-Id` header to /api/generate and poll this
        endpoint in parallel for real backend phase updates. Returns 404 until
        the server has recorded the first phase for this rid.
        """
        # Reject anything that isn't a short hex/ascii id to avoid using this
        # as a memory probe.
        if not rid or not re.match(r"^[A-Za-z0-9_-]{1,64}$", rid):
            return jsonify({"error": "invalid request id"}), 400
        entry = _progress_read(rid)
        if not entry:
            return jsonify({"phase": "unknown"}), 404
        return jsonify(entry)

    @app.route("/api/validate", methods=["POST"])
    def validate_sequence():
        """Validate a single sequence (local — no GPU needed)."""
        try:
            data = request.json
            sequence = normalize_amino_acid_sequence(data.get("sequence", ""))

            is_valid = bool(AMINO_ACID_PATTERN.match(sequence)) and MIN_LENGTH <= len(sequence) <= MAX_LENGTH
            errors = []
            invalid = invalid_amino_acids(sequence)
            if invalid:
                residue_list = ", ".join(invalid)
                phrase = "is not a valid amino acid" if len(invalid) == 1 else "are not valid amino acids"
                errors.append(f"{residue_list} {phrase}")
            if len(sequence) < MIN_LENGTH or len(sequence) > MAX_LENGTH:
                errors.append(f"Length {len(sequence)} outside range {MIN_LENGTH}-{MAX_LENGTH}")

            return jsonify({
                "success": True,
                "is_valid": is_valid,
                "sequence": sequence,
                "length": len(sequence),
                "errors": errors,
            })

        except Exception:
            return jsonify({"error": "Validation error", "success": False}), 500

    @app.route("/api/predict-structure", methods=["POST"])
    def predict_structure():
        """Predict a protein structure through an optional ESMFold-compatible endpoint."""
        request_id = uuid.uuid4().hex[:12]

        try:
            data = request.json or {}
            sequence = normalize_amino_acid_sequence(data.get("sequence", ""))

            if not sequence:
                return jsonify({"error": "Provide a protein sequence to predict structure.", "success": False}), 400

            prompt_error = validation_error_for_prompt(sequence, MAX_LENGTH)
            if prompt_error:
                return jsonify({"error": prompt_error, "success": False}), 400

            if len(sequence) < MIN_LENGTH:
                return jsonify({
                    "error": f"Length {len(sequence)} outside range {MIN_LENGTH}-{MAX_LENGTH}",
                    "success": False,
                }), 400

            block_reason = screen_sequence(sequence)
            if block_reason is not None:
                logger.warning(
                    "SECURITY_BLOCK: endpoint=/api/predict-structure reason=%s sequence_len=%d",
                    block_reason, len(sequence),
                )
                return jsonify({"error": "This sequence cannot be processed.", "success": False}), 400

            if len(sequence) > ESMFOLD_MAX_LENGTH:
                return jsonify({
                    "error": f"Sequence is {len(sequence)} aa. ESMFold supports up to {ESMFOLD_MAX_LENGTH} aa per request.",
                    "success": False,
                }), 400

            headers = {}
            if ESMFOLD_API_KEY:
                headers["Authorization"] = f"Bearer {ESMFOLD_API_KEY}"

            logger.info(
                "STRUCTURE_REQUEST: request_id=%s sequence_len=%d",
                request_id, len(sequence),
            )

            try:
                if "foldSequence" in ESMFOLD_ENDPOINT:
                    response = http_requests.post(
                        ESMFOLD_ENDPOINT,
                        data=sequence,
                        headers={**headers, "Content-Type": "text/plain"},
                        timeout=240,
                    )
                else:
                    response = http_requests.post(
                        ESMFOLD_ENDPOINT,
                        json={"sequence": sequence},
                        headers={**headers, "Content-Type": "application/json"},
                        timeout=240,
                    )
            except http_requests.Timeout:
                return jsonify({"error": "Structure prediction timed out. Please try again shortly.", "success": False}), 504
            except http_requests.RequestException as exc:
                logger.warning("STRUCTURE_REQUEST_FAILED: request_id=%s error=%s", request_id, exc)
                return jsonify({"error": "Could not reach ESMFold service. Please try again shortly.", "success": False}), 503

            if response.status_code != 200:
                upstream_text = (response.text or "").strip()[:200]
                if response.status_code == 429:
                    msg = "ESMFold is rate-limiting requests. Wait a few seconds and try again."
                elif response.status_code in (400, 422):
                    msg = f"ESMFold rejected the sequence: {upstream_text or 'invalid input'}"
                elif response.status_code in (502, 503, 504):
                    msg = "ESMFold service is temporarily unavailable. Please try again shortly."
                else:
                    msg = f"ESMFold returned HTTP {response.status_code}."
                logger.warning(
                    "STRUCTURE_REQUEST_UPSTREAM_ERROR: request_id=%s status=%d body=%s",
                    request_id, response.status_code, upstream_text,
                )
                return jsonify({"error": msg, "success": False}), 502

            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                payload = response.json()
                pdb = payload.get("pdb") or payload.get("pdb_text") or payload.get("structure")
            else:
                pdb = response.text

            if not pdb:
                return jsonify({"error": "Structure prediction response did not include PDB content.", "success": False}), 502

            return jsonify({
                "success": True,
                "sequence_length": len(sequence),
                "format": "pdb",
                "pdb": pdb,
            })

        except Exception:
            logger.exception("STRUCTURE_ERROR: request_id=%s", request_id)
            return jsonify({"error": "Internal server error", "success": False}), 500

    @app.route("/api/score-variants", methods=["POST"])
    def score_variants():
        """Score pasted protein variants using Dayhoff likelihood without generating new sequences."""
        request_id = uuid.uuid4().hex[:12]
        t_start = time.monotonic()

        if not DAYHOFF_ENDPOINT or not DAYHOFF_API_KEY:
            return jsonify({
                "error": "Scoring endpoint not configured.",
                "success": False,
            }), 503

        try:
            data = request.json or {}
            model_key = data.get("model", None)
            sequences = parse_variant_sequences(data.get("sequences", ""))

            if model_key and model_key not in AVAILABLE_MODELS:
                return jsonify({
                    "error": f"Model '{model_key}' not available. Choose from: {list(AVAILABLE_MODELS.keys())}",
                    "success": False,
                }), 400

            if not sequences:
                return jsonify({"error": "Paste at least one protein sequence or FASTA record.", "success": False}), 400
            if len(sequences) > MAX_SEQUENCES:
                return jsonify({"error": f"Maximum {MAX_SEQUENCES} variants allowed", "success": False}), 400

            invalid_entries = []
            valid_sequences = []
            for index, sequence in enumerate(sequences, start=1):
                prompt_error = validation_error_for_prompt(sequence, MAX_LENGTH)
                if prompt_error:
                    invalid_entries.append({"index": index, "sequence": sequence, "error": prompt_error})
                    continue
                if len(sequence) < MIN_LENGTH:
                    invalid_entries.append({"index": index, "sequence": sequence, "error": f"Length {len(sequence)} outside range {MIN_LENGTH}-{MAX_LENGTH}"})
                    continue
                block_reason = screen_sequence(sequence)
                if block_reason is not None:
                    logger.warning(
                        "SECURITY_BLOCK: endpoint=/api/score-variants type=variant "
                        "reason=%s sequence_len=%d",
                        block_reason, len(sequence),
                    )
                    invalid_entries.append({"index": index, "sequence": "", "error": "This sequence cannot be processed."})
                    continue
                valid_sequences.append(sequence)

            if not valid_sequences:
                return jsonify({
                    "error": "No valid canonical variants to score.",
                    "success": False,
                    "invalid_sequences": invalid_entries,
                }), 400

            endpoint = score_variants_endpoint()
            payload = {
                "action": "score_variants",
                "sequences": valid_sequences,
                "model": model_key,
            }
            logger.info(
                "VARIANT_SCORE_REQUEST: request_id=%s model=%s variants=%d",
                request_id, model_key, len(valid_sequences),
            )

            try:
                response = http_requests.post(
                    endpoint,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {DAYHOFF_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=360,
                )
            except http_requests.Timeout:
                return jsonify({"error": "High demand. Please try again shortly.", "success": False}), 504
            except http_requests.RequestException:
                return jsonify({"error": "Variant scoring service unavailable.", "success": False}), 503

            if response.status_code == 404:
                return jsonify({
                    "error": "Variant scoring is not enabled on the current scoring endpoint yet.",
                    "success": False,
                }), 501
            if response.status_code != 200:
                return jsonify({"error": "Variant scoring service unavailable.", "success": False}), 503

            result = response.json()
            # Detect old container revisions that don't have the variant
            # dispatcher: they'll return a generation response (sequences_with_fitness)
            # instead of the variant response (variants). Surface a clear error
            # rather than silently passing through misleading data.
            if "variants" not in result:
                return jsonify({
                    "error": "Variant scoring is not enabled on this scoring container. Build and push a score image that includes the variant-scoring code path.",
                    "success": False,
                }), 501
            scored = result.get("variants", [])
            latency_ms = round((time.monotonic() - t_start) * 1000)
            logger.info(
                "VARIANT_SCORE_OK: request_id=%s model=%s variants=%d latency_ms=%d",
                request_id, model_key, len(scored), latency_ms,
            )

            return jsonify({
                "success": True,
                "variants": scored,
                "invalid_sequences": invalid_entries,
                "stats": {
                    "total_submitted": len(sequences),
                    "scored_count": len(scored),
                    "invalid_count": len(invalid_entries),
                    "model": result.get("model", model_key or list(AVAILABLE_MODELS.keys())[0]),
                },
            })

        except Exception:
            logger.exception("VARIANT_SCORE_ERROR: request_id=%s", request_id)
            return jsonify({"error": "Internal server error", "success": False}), 500

    @app.route("/api/examples")
    def get_examples():
        """Get example sequences and prompts."""
        return jsonify({
            "prompts": [
                {"prompt": "MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSG", "description": "Cas9 nuclease prefix"},
                {"prompt": "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKT", "description": "Human insulin precursor prefix"},
                {"prompt": "MSKRKAPQETLNGGITDMLTELANFEKNVSQAIHK", "description": "Human DNA polymerase beta prefix"},
                {"prompt": "MFVFLVLLPLVSSQCVNLTTRTQLPPAYTNSFTRGVYYPDKVFRSSVLHSTQDLFLPFF", "description": "Coronavirus spike protein prefix"},
                {"prompt": "", "description": "De novo generation from a blank/custom seed"},
            ],
            "sample_outputs": [
                "MKLLVVVAGLAVALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV",
                "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPD",
                "GAVLPKLLATTLLAAGLAVVLAAQGSDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV",
            ],
        })

    @app.route("/api/export/<format_name>", methods=["POST"])
    def export_sequences(format_name: str):
        """Export sequences in various formats (local — no GPU needed)."""
        try:
            data = request.json
            sequences = data.get("sequences", [])
            params = data.get("parameters", {})

            try:
                exporter = get_exporter(format_name)
            except ValueError:
                supported = ", ".join(get_supported_formats())
                return jsonify({"error": f"Invalid format. Supported: {supported}"}), 400

            content = exporter.export(sequences, params)
            filename = exporter.get_filename()

            return Response(
                content,
                mimetype=exporter.mimetype,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        except Exception:
            return jsonify({"error": "Export error", "success": False}), 500

    @app.route("/")
    def index():
        """Serve the React frontend.

        When BASE_URL is set, the WSGI middleware strips the prefix before
        we get here, so '<base_url>/' arrives as '/' and we serve the SPA.
        For root deploys, '/' just serves the SPA directly.
        """
        return app.send_static_file("index.html")

    @app.errorhandler(404)
    def not_found(e):
        """SPA fallback — serve index.html for client-side routing."""
        return app.send_static_file("index.html")


# Entry point
app = create_app()

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Dayhoff API Server Starting (Proxy Mode)")
    print("=" * 60)
    print(f"Scoring endpoint: {DAYHOFF_ENDPOINT or 'NOT CONFIGURED'}")
    print("API URL: http://localhost:8000/api")
    print("Health check: http://localhost:8000/api/health")
    print("=" * 60)

    app.run(debug=True, port=8000, host="0.0.0.0")
