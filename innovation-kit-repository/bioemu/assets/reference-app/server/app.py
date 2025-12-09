"""
BioEmu Flask Application - Modular Architecture

This is the main Flask application entry point. Route handlers have been
refactored into separate blueprint modules in the `routes/` directory.

Structure:
    app.py              - Flask factory, config, helper functions
    config.py           - Environment variables and constants
    logging_utils.py    - BioEmu logging utilities
    superposition_utils.py - Sequence alignment superposition
    routes/             - Blueprint modules for each endpoint group
"""

from flask import Flask
import os
from flask_cors import CORS
from dotenv import load_dotenv
import logging

# Import configuration and logging utilities
from config import (
    API_ENDPOINT,
    API_KEY,
    BIOEMU_MODE,
    BUILD_DIR,
)
from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
    log_bioemu_timing,
    print_separator,
)

# Import services that route modules need
from uniprot_service import (
    get_protein_sequence_from_uniprot,
    get_protein_info_from_uniprot,
    download_afdb_structure,
    get_uniprot_and_structure_data,
    validate_uniprot_id,
)

from reference_structure_analysis import (
    analyze_reference_structure,
    fetch_pdb_structure,
    compare_md_with_reference,
)

from pdb_service import (
    sequence_from_pdb_id,
    get_pdb_info,
    validate_pdb_id,
    get_available_chains,
)

from copilot_service import get_copilot_response

# Import local BioEmu inference (optional - only used when BIOEMU_MODE=local)
try:
    from local_bioemu import (
        run_local_prediction,
        get_local_status,
        check_local_bioemu_available,
    )
except ImportError:

    def run_local_prediction(*args, **kwargs):
        raise RuntimeError("Local BioEmu module not available")

    def get_local_status():
        return {"available": False, "message": "Local BioEmu module not found"}

    def check_local_bioemu_available():
        return False, ["local_bioemu.py not found"], []


# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()


def create_app():
    """
    Flask application factory.

    Creates and configures the Flask application with all blueprints registered.
    """
    app = Flask(
        __name__,
        static_folder=os.path.join(BUILD_DIR, "static"),
        static_url_path="/static",
    )

    CORS(
        app,
        origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ],
    )

    # Register all route blueprints
    from routes import register_blueprints

    register_blueprints(app)

    return app


# Create the app instance
app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))

    print_separator()
    print("BIOEMU SERVER STARTING")
    print_separator()
    print(f"Server host: 0.0.0.0")
    print(f"Server port: {port}")
    print(f"BioEmu mode: {BIOEMU_MODE.upper()}")

    if BIOEMU_MODE == "local":
        print("\n🖥️  LOCAL MODE CONFIGURATION:")
        local_status = get_local_status()
        if local_status.get("available"):
            gpu_info = local_status.get("gpu", {})
            print(f"Local BioEmu ready")
            print(f"GPU: {gpu_info.get('name', 'Unknown')}")
            print(f"VRAM: {gpu_info.get('memory_gb', '?')} GB")
        else:
            print(f"Local BioEmu NOT available")
            for error in local_status.get("errors", []):
                print(f"• {error}")
    else:
        print("\nAZURE MODE CONFIGURATION:")
        print(f"Endpoint: {API_ENDPOINT or 'NOT CONFIGURED'}")
        print(f"API key: {'configured' if API_KEY else 'NOT CONFIGURED'}")

    print_separator()

    log_bioemu_info(f"Starting BioEmu server on port {port} in {BIOEMU_MODE} mode")

    print("Ready to receive BioEmu requests!")
    print("All API calls will be tracked with detailed logging")
    print("\nAvailable endpoints:")
    print("/api/predict - Structure prediction")
    print("/api/predict-uniprot - Predict from UniProt ID")
    print("/api/status - Check configuration status")
    print("/api/alphafold-structure/<id> - Download AlphaFold structures\n")

    # Start the Flask server
    app.run(host="0.0.0.0", port=port, debug=True)
