"""
AlphaFold structure endpoints.

Blueprint: alphafold_bp
Routes:
    GET /api/alphafold-structure/<uniprot_id> - Get AlphaFold structure by UniProt ID
    POST /api/alphafold-structure - Get AlphaFold structure via POST
    GET /api/get-related-proteins/<uniprot_id> - Get related protein suggestions
"""

from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
)
from uniprot_service import validate_uniprot_id, download_afdb_structure


alphafold_bp = Blueprint("alphafold", __name__)


@alphafold_bp.route("/api/alphafold-structure/<uniprot_id>", methods=["GET"])
def get_alphafold_structure_endpoint(uniprot_id):
    """Get AlphaFold structure for a UniProt ID"""
    log_bioemu_info(f"=== ALPHAFOLD STRUCTURE REQUEST: {uniprot_id} ===")

    try:
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid UniProt ID format: {uniprot_id}",
                }
            ), 400

        # Download AlphaFold structure
        structure_data = download_afdb_structure(uniprot_id)
        if not structure_data:
            error_msg = f"AlphaFold structure unavailable for: {uniprot_id}"
            log_bioemu_error(error_msg)

            # Check if this is likely an API outage vs missing protein
            api_status_msg = _check_alphafold_api_status()

            return jsonify(
                {
                    "status": "failed",
                    "message": f"AlphaFold structure unavailable for UniProt ID: {uniprot_id}.{api_status_msg}",
                    "error_code": "ALPHAFOLD_UNAVAILABLE",
                    "uniprot_id": uniprot_id,
                    "api_status": "unknown",
                    "suggested_alternatives": ["P04637", "P02768", "P01308"]
                    if "server issues" not in api_status_msg
                    else [],
                }
            ), 503 if "server issues" in api_status_msg else 404

        response_data = {
            "status": "success",
            "uniprot_id": uniprot_id,
            "structure_data": structure_data,
            "structure_format": "pdb",
            "source": "alphafold",
        }

        log_bioemu_success(f"Retrieved AlphaFold structure for: {uniprot_id}")
        log_bioemu_data("Structure data", structure_data, max_length=100)

        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching AlphaFold structure: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Error fetching AlphaFold structure: {str(e)}",
            }
        ), 500


@alphafold_bp.route("/api/alphafold-structure", methods=["POST"])
def get_alphafold_structure_post_endpoint():
    """Get AlphaFold structure for a UniProt ID via POST request"""
    log_bioemu_info("=== ALPHAFOLD STRUCTURE REQUEST (POST) ===")

    try:
        data = request.get_json()
        if not data or "uniprot_id" not in data:
            return jsonify(
                {"status": "failed", "message": "Missing uniprot_id in request body"}
            ), 400

        uniprot_id = data["uniprot_id"].strip().upper()
        log_bioemu_info(f"Fetching AlphaFold structure for: {uniprot_id}")

        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid UniProt ID format: {uniprot_id}",
                }
            ), 400

        # Download AlphaFold structure
        structure_data = download_afdb_structure(uniprot_id)
        if not structure_data:
            error_msg = f"AlphaFold structure unavailable for: {uniprot_id}"
            log_bioemu_error(error_msg)

            return jsonify(
                {
                    "status": "failed",
                    "message": f"AlphaFold structure unavailable for UniProt ID: {uniprot_id}. This protein may not be available in the AlphaFold database.",
                    "error_code": "ALPHAFOLD_UNAVAILABLE",
                    "uniprot_id": uniprot_id,
                }
            ), 404

        response_data = {
            "status": "success",
            "uniprot_id": uniprot_id,
            "pdb_content": structure_data,
            "structure_format": "pdb",
            "source": "alphafold",
        }

        log_bioemu_success(f"Retrieved AlphaFold structure for: {uniprot_id}")
        log_bioemu_data("Structure data", structure_data, max_length=100)

        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching AlphaFold structure: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Error fetching AlphaFold structure: {str(e)}",
            }
        ), 500


@alphafold_bp.route("/api/get-related-proteins/<uniprot_id>", methods=["GET"])
def get_related_proteins_endpoint(uniprot_id):
    """Get related proteins suggestions based on the current protein"""
    log_bioemu_info(f"=== RELATED PROTEINS REQUEST FOR: {uniprot_id} ===")

    try:
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid UniProt ID format: {uniprot_id}",
                }
            ), 400

        # Get suggestions based on protein
        suggestions = _get_protein_suggestions(uniprot_id)

        return jsonify(
            {"status": "success", "uniprot_id": uniprot_id, "suggestions": suggestions}
        )

    except Exception as e:
        log_bioemu_error(f"Error getting related proteins: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Error getting related proteins: {str(e)}"}
        ), 500


def _check_alphafold_api_status():
    """Check AlphaFold API status to provide helpful error messages"""
    try:
        import requests

        test_response = requests.get(
            "https://www.alphafold.ebi.ac.uk/api/prediction/P04637", timeout=10
        )
        if test_response.status_code >= 500:
            log_bioemu_error(
                "AlphaFold EBI API is returning 500 Internal Server Error - API outage detected"
            )
            return " ⚠️ AlphaFold EBI API appears to be experiencing server issues (returning 500 errors). This is a temporary infrastructure problem, not an issue with your protein or our code. Please try again later."
        elif test_response.status_code == 404:
            return " This protein may not be available in the AlphaFold database."
        else:
            return " There may be a connectivity issue or this protein is not in AlphaFold database."
    except:
        return " Unable to verify AlphaFold API status due to network issues."


def _get_protein_suggestions(uniprot_id):
    """Get contextual protein suggestions based on the current protein"""

    # Handle special cases for designed proteins or common test cases
    special_cases = {
        "trp-cage": {
            "alphafold": [
                {"id": "P01308", "name": "insulin", "category": "small protein"},
                {"id": "P02768", "name": "albumin", "category": "comparison"},
                {"id": "P69905", "name": "hemoglobin", "category": "comparison"},
                {"id": "P04637", "name": "p53", "category": "comparison"},
            ],
            "pdb": [
                {"id": "1L2Y", "name": "Trp-cage miniprotein"},
                {"id": "2JOF", "name": "Trp-cage variant"},
                {"id": "1UBQ", "name": "ubiquitin (small protein)"},
                {"id": "1EJG", "name": "crambin (small protein)"},
            ],
        },
        "ubiquitin": {
            "alphafold": [
                {"id": "P0CG48", "name": "ubiquitin", "category": "same protein"},
                {"id": "P01308", "name": "insulin", "category": "small protein"},
                {"id": "P69905", "name": "hemoglobin", "category": "comparison"},
            ],
            "pdb": [
                {"id": "1UBQ", "name": "ubiquitin"},
                {"id": "1F9J", "name": "ubiquitin variant"},
                {"id": "1EJG", "name": "crambin"},
            ],
        },
    }

    # Check if this might be a special case (check protein name patterns)
    uniprot_lower = uniprot_id.lower() if uniprot_id else ""
    for special_name, suggestions in special_cases.items():
        if special_name in uniprot_lower:
            return suggestions

    # Protein family/category mappings with verified AlphaFold availability
    protein_families = {
        # Hormones & signaling
        "P01308": {  # Insulin
            "alphafold": [
                {"id": "P01308", "name": "insulin (human)", "category": "hormone"},
                {
                    "id": "P69905",
                    "name": "hemoglobin subunit alpha",
                    "category": "transport",
                },
                {"id": "P02768", "name": "serum albumin", "category": "transport"},
            ],
            "pdb": [
                {"id": "1ZNI", "name": "insulin hexamer"},
                {"id": "4INS", "name": "insulin"},
                {"id": "1MSO", "name": "insulin analog"},
            ],
        },
        # Default suggestions for unknown proteins
        "default": {
            "alphafold": [
                {"id": "P01308", "name": "insulin", "category": "hormone"},
                {"id": "P69905", "name": "hemoglobin alpha", "category": "transport"},
                {"id": "P02768", "name": "albumin", "category": "transport"},
                {
                    "id": "P04637",
                    "name": "p53 tumor suppressor",
                    "category": "regulatory",
                },
            ],
            "pdb": [
                {"id": "1UBQ", "name": "ubiquitin"},
                {"id": "1EJG", "name": "crambin"},
                {"id": "1INS", "name": "insulin"},
                {"id": "1MBO", "name": "myoglobin"},
            ],
        },
    }

    # Commonly studied proteins and their suggested comparisons
    well_known_proteins = {
        "P69905": {  # Hemoglobin alpha
            "alphafold": [
                {
                    "id": "P69905",
                    "name": "hemoglobin alpha",
                    "category": "same protein",
                },
                {
                    "id": "P68871",
                    "name": "hemoglobin beta",
                    "category": "related subunit",
                },
                {"id": "P02185", "name": "myoglobin", "category": "similar function"},
            ],
            "pdb": [
                {"id": "1HHO", "name": "hemoglobin"},
                {"id": "2HHB", "name": "deoxyhemoglobin"},
                {"id": "1MBO", "name": "myoglobin"},
            ],
        },
        "P02768": {  # Albumin
            "alphafold": [
                {"id": "P02768", "name": "serum albumin", "category": "same protein"},
                {"id": "P01308", "name": "insulin", "category": "binding partner"},
                {"id": "P69905", "name": "hemoglobin", "category": "blood protein"},
            ],
            "pdb": [
                {"id": "1AO6", "name": "albumin"},
                {"id": "1BM0", "name": "albumin complex"},
                {"id": "1UOR", "name": "albumin"},
            ],
        },
        "P04637": {  # p53
            "alphafold": [
                {
                    "id": "P04637",
                    "name": "p53 tumor suppressor",
                    "category": "same protein",
                },
                {"id": "Q00987", "name": "MDM2", "category": "regulatory partner"},
                {"id": "P01308", "name": "insulin", "category": "comparison"},
            ],
            "pdb": [
                {"id": "1TUP", "name": "p53 DNA binding domain"},
                {"id": "1YCR", "name": "p53-MDM2 complex"},
                {"id": "3KMD", "name": "p53 tetramer"},
            ],
        },
    }

    # Try to find specific suggestions for this protein
    if uniprot_id in well_known_proteins:
        return well_known_proteins[uniprot_id]
    elif uniprot_id in protein_families:
        return protein_families[uniprot_id]
    else:
        # Return default suggestions
        return protein_families["default"]
