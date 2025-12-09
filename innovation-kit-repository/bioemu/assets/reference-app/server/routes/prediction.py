"""
BioEmu prediction endpoints.

Blueprint: prediction_bp
Routes:
    POST /api/predict - Protein structure prediction
    POST /api/predict-uniprot - Enhanced prediction with UniProt ID or sequence
"""

import time
import requests
from flask import Blueprint, jsonify, request

from config import API_ENDPOINT, API_KEY, BIOEMU_MODE
from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
    log_bioemu_timing,
    print_separator,
)
from uniprot_service import (
    validate_uniprot_id,
    get_protein_sequence_from_uniprot,
    get_protein_info_from_uniprot,
    download_afdb_structure,
)

# Import local BioEmu inference (optional - only used when BIOEMU_MODE=local)
try:
    from local_bioemu import (
        run_local_prediction,
        check_local_bioemu_available,
    )
except ImportError:

    def run_local_prediction(*args, **kwargs):
        raise RuntimeError("Local BioEmu module not available")

    def check_local_bioemu_available():
        return False, ["local_bioemu.py not found"], []


prediction_bp = Blueprint("prediction", __name__)


@prediction_bp.route("/api/predict", methods=["POST"])
def predict_protein():
    """Protein structure prediction - routes to Azure or local based on BIOEMU_MODE"""
    print_separator()
    log_bioemu_info(f"=== BIOEMU PREDICTION REQUEST START (mode: {BIOEMU_MODE}) ===")
    start_time = time.time()

    try:
        data = request.json
        sequence = data.get("sequence")
        num_samples = data.get("numSamples", 10)

        if not sequence:
            log_bioemu_error("Missing protein sequence in request!")
            return jsonify(
                {"status": "failed", "message": "Missing protein sequence"}
            ), 400

        # Route based on BIOEMU_MODE
        if BIOEMU_MODE == "local":
            return _predict_protein_local(sequence, num_samples, start_time)
        else:
            return _predict_protein_azure(sequence, num_samples, start_time)

    except Exception as e:
        log_bioemu_error(f"Prediction request failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Prediction error: {str(e)}"}
        ), 500
    finally:
        print_separator()
        log_bioemu_info("=== BIOEMU PREDICTION REQUEST END ===")


def _predict_protein_local(sequence: str, num_samples: int, start_time: float):
    """Run prediction using local BioEmu model"""
    import requests  # noqa: F401

    log_bioemu_info("Using LOCAL BioEmu inference")

    # Check if local BioEmu is available
    available, errors, warnings = check_local_bioemu_available()
    if not available:
        error_msg = "Local BioEmu not available: " + "; ".join(errors)
        log_bioemu_error(error_msg)
        return jsonify(
            {
                "status": "failed",
                "message": error_msg,
                "setup_instructions": {
                    "requirements": [
                        "Linux OS",
                        "Python 3.10-3.12",
                        "GPU recommended (CPU works but slow)",
                        "pip install bioemu",
                    ]
                },
            }
        ), 500

    log_bioemu_data("Input sequence", sequence, max_length=80)
    print(f"Number of samples: {num_samples}")
    print(f"Sequence length: {len(sequence)}")

    try:
        result = run_local_prediction(sequence, num_samples)

        end_time = time.time()
        log_bioemu_timing("Local BioEmu Prediction", start_time, end_time)
        log_bioemu_success("Local prediction completed successfully!")

        return jsonify({"status": "success", "results": [result], "source": "local"})

    except Exception as e:
        log_bioemu_error(f"Local prediction failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Local prediction error: {str(e)}"}
        ), 500


def _predict_protein_azure(sequence: str, num_samples: int, start_time: float):
    """Run prediction using Azure BioEmu endpoint"""
    import requests

    log_bioemu_info("Using AZURE BioEmu endpoint")

    if not API_ENDPOINT or not API_KEY:
        log_bioemu_error("Missing Azure API credentials!")
        return jsonify(
            {
                "status": "failed",
                "message": "Missing Azure API credentials. Set AZURE_BIOEMU_ENDPOINT and AZURE_BIOEMU_KEY in .env",
            }
        ), 500

    log_bioemu_data("Input sequence", sequence, max_length=80)
    print(f"Number of samples: {num_samples}")
    print(f"Sequence length: {len(sequence)}")
    log_bioemu_info(f"Processing prediction for sequence of length {len(sequence)}")

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    payload = {"input_data": {"sequence": sequence, "num_samples": num_samples}}

    print("Calling Azure BioEmu API...")
    print(f"Endpoint: {API_ENDPOINT}")
    log_bioemu_data("Request payload structure", payload)
    log_bioemu_info("Sending request to Azure BioEmu API...")

    api_start_time = time.time()
    response = requests.post(API_ENDPOINT, headers=headers, json=payload)
    api_end_time = time.time()

    print(f"Response status: {response.status_code}")
    log_bioemu_timing("API Response Time", api_start_time, api_end_time)

    if not response.ok:
        log_bioemu_error(f"API request failed with status {response.status_code}")
        log_bioemu_data("Error response", response.text, max_length=200)
        return jsonify(
            {
                "status": "failed",
                "message": (
                    f"API request failed with status code {response.status_code}"
                ),
            }
        ), response.status_code

    try:
        result = response.json()
        print("Response received and parsed successfully")

        # Enhanced result logging
        if isinstance(result, dict):
            keys = list(result.keys())
            print(f"Response keys: {keys}")
            log_bioemu_data("Response structure", result, max_length=300)
        else:
            print(f"Response type: {type(result)}")

        log_bioemu_success("API request completed successfully!")

        if "status" in result and result["status"] != "success":
            log_bioemu_error(
                f"API returned error: {result.get('message', 'Unknown error')}"
            )
            return jsonify(
                {
                    "status": "failed",
                    "message": result.get("message", "Unknown API error"),
                }
            ), 500

        # Enhanced data flow tracking
        if "results" in result:
            print("Results structure found in response")
            results_data = result["results"]
            if isinstance(results_data, list) and len(results_data) > 0:
                print(f"Results array contains {len(results_data)} items")
                if isinstance(results_data[0], dict):
                    first_keys = list(results_data[0].keys())
                    print(f"First result keys: {first_keys}")

                    # Check for specific molecular data
                    if "pdb_data" in results_data[0]:
                        pdb_length = len(results_data[0]["pdb_data"])
                        print(f"PDB data found: {pdb_length} characters")
                    if "xtc_data" in results_data[0]:
                        xtc_length = len(results_data[0]["xtc_data"])
                        print(f"XTC data found: {xtc_length} characters")

            log_bioemu_success("Returning structured results to frontend")
            end_time = time.time()
            log_bioemu_timing("Total Prediction Request", start_time, end_time)
            return jsonify(
                {"status": "success", "results": result["results"], "source": "azure"}
            )
        else:
            print("Raw response being returned")
            log_bioemu_success("Returning raw response to frontend")
            end_time = time.time()
            log_bioemu_timing("Total Prediction Request", start_time, end_time)
            return jsonify({"status": "success", "results": result, "source": "azure"})

    except Exception as e:
        log_bioemu_error(f"Error parsing API response: {str(e)}")
        log_bioemu_data("Raw response", response.text, max_length=200)
        return jsonify(
            {"status": "failed", "message": f"Error parsing API response: {str(e)}"}
        ), 500


@prediction_bp.route("/api/predict-uniprot", methods=["POST"])
def predict_protein_from_uniprot():
    """Enhanced endpoint that accepts either UniProt ID or sequence for prediction"""
    import requests

    print_separator()
    log_bioemu_info("=== BIOEMU UNIPROT PREDICTION REQUEST START ===")
    start_time = time.time()

    if not API_ENDPOINT or not API_KEY:
        log_bioemu_error("Missing API credentials!")
        return jsonify({"status": "failed", "message": "Missing API credentials"}), 500

    try:
        data = request.json
        uniprot_id = data.get("uniprot_id")
        sequence = data.get("sequence")
        num_samples = data.get("numSamples", 10)
        include_alphafold = data.get("include_alphafold", True)

        # Validate input - need either UniProt ID or sequence
        if not uniprot_id and not sequence:
            log_bioemu_error("Missing both UniProt ID and sequence!")
            return jsonify(
                {
                    "status": "failed",
                    "message": "Either uniprot_id or sequence must be provided",
                }
            ), 400

        # If UniProt ID is provided, fetch the sequence and info
        protein_info = None
        alphafold_structure = None

        if uniprot_id:
            log_bioemu_info(f"Processing UniProt ID: {uniprot_id}")

            # Validate UniProt ID format
            if not validate_uniprot_id(uniprot_id):
                log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
                return jsonify(
                    {
                        "status": "failed",
                        "message": f"Invalid UniProt ID format: {uniprot_id}",
                    }
                ), 400

            # Get protein sequence from UniProt
            uniprot_sequence = get_protein_sequence_from_uniprot(uniprot_id)
            if not uniprot_sequence:
                error_msg = f"Could not retrieve sequence for UniProt ID: {uniprot_id}"
                log_bioemu_error(error_msg)
                return jsonify(
                    {
                        "status": "failed",
                        "message": f"UniProt ID not found or inaccessible: {uniprot_id}",
                    }
                ), 404

            # Use UniProt sequence (override provided sequence if both given)
            sequence = uniprot_sequence
            log_bioemu_success(f"Retrieved sequence from UniProt ID {uniprot_id}")

            # Get additional protein information
            protein_info = get_protein_info_from_uniprot(uniprot_id)
            log_bioemu_data("Protein info", protein_info)

            # Optionally fetch AlphaFold structure
            if include_alphafold:
                log_bioemu_info("Fetching AlphaFold structure...")
                alphafold_structure = download_afdb_structure(uniprot_id)
                if alphafold_structure:
                    log_bioemu_success("AlphaFold structure retrieved")
                    log_bioemu_data(
                        "AlphaFold PDB", alphafold_structure, max_length=100
                    )
                else:
                    log_bioemu_info("No AlphaFold structure available")

        # Validate sequence
        if not sequence:
            log_bioemu_error("No valid protein sequence available!")
            return jsonify(
                {
                    "status": "failed",
                    "message": "No valid protein sequence could be obtained",
                }
            ), 400

        # Enhanced logging for visibility
        log_bioemu_data("Final sequence for prediction", sequence, max_length=80)
        print(f"Number of samples: {num_samples}")
        print(f"Sequence length: {len(sequence)}")
        log_bioemu_info(f"Processing prediction for sequence of length {len(sequence)}")

        # Prepare API request
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        }

        payload = {"input_data": {"sequence": sequence, "num_samples": num_samples}}

        print("Calling Azure BioEmu API...")
        print(f"Endpoint: {API_ENDPOINT}")
        log_bioemu_data("Request payload structure", payload)
        log_bioemu_info("Sending request to Azure BioEmu API...")

        # Make API request
        api_start_time = time.time()
        response = requests.post(API_ENDPOINT, headers=headers, json=payload)
        api_end_time = time.time()

        print(f"Response status: {response.status_code}")
        log_bioemu_timing("API Response Time", api_start_time, api_end_time)

        if not response.ok:
            error_msg = f"API request failed with status {response.status_code}"
            log_bioemu_error(error_msg)
            log_bioemu_data("Error response", response.text, max_length=200)
            return jsonify(
                {
                    "status": "failed",
                    "message": f"API request failed with status code {response.status_code}",
                }
            ), response.status_code

        try:
            result = response.json()
            print("Response received and parsed successfully")

            # Enhanced result logging
            if isinstance(result, dict):
                keys = list(result.keys())
                print(f"Response keys: {keys}")
                log_bioemu_data("Response structure", result, max_length=300)
            else:
                print(f"Response type: {type(result)}")

            log_bioemu_success("API request completed successfully!")

            if "status" in result and result["status"] != "success":
                error_msg = (
                    f"API returned error: {result.get('message', 'Unknown error')}"
                )
                log_bioemu_error(error_msg)
                return jsonify(
                    {
                        "status": "failed",
                        "message": result.get("message", "Unknown API error"),
                    }
                ), 500

            # Prepare enhanced response with UniProt data
            enhanced_response = {
                "status": "success",
                "results": result.get("results", result),
                "source_info": {
                    "input_type": "uniprot_id" if uniprot_id else "sequence",
                    "sequence_length": len(sequence),
                },
            }

            # Add UniProt-specific information if available
            if uniprot_id:
                enhanced_response["uniprot_data"] = {
                    "uniprot_id": uniprot_id,
                    "protein_info": protein_info,
                    "has_alphafold": alphafold_structure is not None,
                }

                # Include AlphaFold structure if requested and available
                if alphafold_structure and include_alphafold:
                    enhanced_response["alphafold_structure"] = alphafold_structure

            log_bioemu_success(
                "Returning enhanced results with UniProt data to frontend"
            )
            end_time = time.time()
            log_bioemu_timing("Total UniProt Prediction Request", start_time, end_time)

            return jsonify(enhanced_response)

        except Exception as e:
            log_bioemu_error(f"Error parsing API response: {str(e)}")
            log_bioemu_data("Raw response", response.text, max_length=200)
            return jsonify(
                {"status": "failed", "message": f"Error parsing API response: {str(e)}"}
            ), 500

    except Exception as e:
        log_bioemu_error(f"UniProt prediction request failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Prediction error: {str(e)}"}
        ), 500
    finally:
        print_separator()
        log_bioemu_info("=== BIOEMU UNIPROT PREDICTION REQUEST END ===")
