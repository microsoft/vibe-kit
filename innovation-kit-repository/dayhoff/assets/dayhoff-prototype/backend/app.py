"""
Dayhoff API - Flask backend for protein sequence generation.

Provides REST API endpoints for the React frontend.
"""

from datetime import datetime

from flask import Flask, request, jsonify, Response
from flask_cors import CORS

from constants import (
    GenerationMode,
    Direction,
    MAX_SEQUENCES,
    MAX_LENGTH,
)
from generator import DayhoffGenerator
from exporters import get_exporter, get_supported_formats


def create_app(generator: DayhoffGenerator | None = None) -> Flask:
    """
    Application factory for Flask app.

    Args:
        generator: Optional pre-initialized generator (for testing/DI)

    Returns:
        Configured Flask application
    """
    app = Flask(__name__)
    CORS(app)

    # Initialize or use provided generator
    if generator is None:
        print("Initializing Dayhoff API...")
        try:
            generator = DayhoffGenerator()
            model_loaded = True
            print("[OK] Dayhoff model loaded successfully!")
        except Exception as e:
            print(f"[FAIL] Failed to load Dayhoff model: {e}")
            generator = None
            model_loaded = False
    else:
        model_loaded = True

    # Store generator in app context
    app.generator = generator
    app.model_loaded = model_loaded

    # Register routes
    _register_routes(app)

    return app


def _register_routes(app: Flask) -> None:
    """Register all API routes."""

    @app.route("/api/health")
    def health_check():
        """Health check endpoint."""
        return jsonify(
            {
                "status": "healthy" if app.model_loaded else "model_not_loaded",
                "model_loaded": app.model_loaded,
                "timestamp": datetime.now().isoformat(),
            }
        )

    @app.route("/api/generate", methods=["POST"])
    def generate_sequences():
        """Generate protein sequences."""
        if not app.model_loaded:
            return jsonify(
                {
                    "error": "Dayhoff model not loaded. Please check console for errors.",
                    "success": False,
                }
            ), 503

        try:
            data = request.json
            prompt = data.get("prompt", "M")
            num_sequences = int(data.get("num_sequences", 3))
            max_length = int(data.get("max_length", 80))
            temperature = float(data.get("temperature", 0.8))
            generation_mode = data.get("generation_mode", GenerationMode.UNCONDITIONAL)
            direction = data.get("direction", Direction.N_TO_C)

            # Validate inputs
            if num_sequences > MAX_SEQUENCES:
                return jsonify(
                    {
                        "error": f"Maximum {MAX_SEQUENCES} sequences allowed",
                        "success": False,
                    }
                ), 400

            if max_length > MAX_LENGTH:
                return jsonify(
                    {
                        "error": f"Maximum length is {MAX_LENGTH} amino acids",
                        "success": False,
                    }
                ), 400

            # Generate sequences
            sequences = app.generator.generate_sequences(
                prompt=prompt,
                num_sequences=num_sequences,
                max_length=max_length,
                temperature=temperature,
                generation_mode=generation_mode,
                direction=direction,
            )

            # Validate sequences
            validation = app.generator.validate_sequences(sequences)

            # Calculate fitness scores
            print("Calculating zero-shot fitness predictions...")
            sequences_with_fitness = []
            fitness_scores = []

            for seq in validation["valid_sequences"]:
                fitness_score = app.generator.calculate_fitness_score(seq)
                fitness_scores.append(fitness_score)
                sequences_with_fitness.append(
                    {
                        "sequence": seq,
                        "fitness_score": round(fitness_score, 1),
                        "length": len(seq),
                    }
                )

            # Sort by fitness (highest first)
            sequences_with_fitness.sort(key=lambda x: x["fitness_score"], reverse=True)

            avg_fitness = (
                sum(fitness_scores) / len(fitness_scores) if fitness_scores else 0
            )

            return jsonify(
                {
                    "success": True,
                    "sequences": [s["sequence"] for s in sequences_with_fitness],
                    "sequences_with_fitness": sequences_with_fitness,
                    "invalid_sequences": validation["invalid_sequences"],
                    "stats": {
                        "total_generated": len(sequences),
                        "valid_count": validation["valid_count"],
                        "invalid_count": validation["invalid_count"],
                        "success_rate": validation["success_rate"],
                        "generation_mode": generation_mode,
                        "direction": direction,
                        "avg_fitness": round(avg_fitness, 1),
                    },
                }
            )

        except Exception as e:
            return jsonify({"error": str(e), "success": False}), 500

    @app.route("/api/validate", methods=["POST"])
    def validate_sequence():
        """Validate a single sequence."""
        try:
            data = request.json
            sequence = data.get("sequence", "").strip().upper()

            validation = app.generator.validate_sequences([sequence])

            return jsonify(
                {
                    "success": True,
                    "is_valid": len(validation["valid_sequences"]) > 0,
                    "sequence": sequence,
                    "length": len(sequence),
                    "errors": [error for _, error in validation["invalid_sequences"]],
                }
            )

        except Exception as e:
            return jsonify({"error": str(e), "success": False}), 500

    @app.route("/api/examples")
    def get_examples():
        """Get example sequences and prompts."""
        return jsonify(
            {
                "prompts": [
                    {
                        "prompt": "M",
                        "description": "Start with methionine (most common start)",
                    },
                    {
                        "prompt": "MK",
                        "description": "Met-Lys start (common in prokaryotes)",
                    },
                    {"prompt": "GAVL", "description": "Hydrophobic sequence start"},
                    {"prompt": "MKLL", "description": "Extended start sequence"},
                    {"prompt": "", "description": "Random generation (empty prompt)"},
                ],
                "sample_outputs": [
                    "MKLLVVVAGLAVALAAQAAGVNPDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV",
                    "MVKLALVGAGAAVALAQAADEGLNPDEVGGEALGRLLLVYPWTQRFFESFGDLSTPD",
                    "GAVLPKLLATTLLAAGLAVVLAAQGSDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAV",
                ],
            }
        )

    @app.route("/api/export/<format_name>", methods=["POST"])
    def export_sequences(format_name: str):
        """Export sequences in various formats."""
        try:
            data = request.json
            sequences = data.get("sequences", [])
            params = data.get("parameters", {})

            # Get exporter (raises ValueError if invalid format)
            try:
                exporter = get_exporter(format_name)
            except ValueError:
                supported = ", ".join(get_supported_formats())
                return jsonify(
                    {
                        "error": f"Invalid format. Supported: {supported}",
                    }
                ), 400

            # Export sequences
            content = exporter.export(sequences, params)
            filename = exporter.get_filename()

            return Response(
                content,
                mimetype=exporter.mimetype,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        except Exception as e:
            return jsonify({"error": str(e), "success": False}), 500


# Entry point
app = create_app()

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Dayhoff API Server Starting")
    print("=" * 60)
    print("API URL: http://localhost:5001/api")
    print("Health check: http://localhost:5001/api/health")
    print("Use Ctrl+C to stop the server")
    print("=" * 60)

    app.run(debug=True, port=5001, host="0.0.0.0")
