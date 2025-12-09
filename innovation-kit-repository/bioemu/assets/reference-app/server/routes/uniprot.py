"""
UniProt database endpoints.

Blueprint: uniprot_bp
Routes:
    GET /api/uniprot-info/<uniprot_id> - Get protein information from UniProt
"""

from flask import Blueprint, jsonify

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
)
from uniprot_service import (
    validate_uniprot_id,
    get_protein_info_from_uniprot,
    download_afdb_structure,
)


uniprot_bp = Blueprint("uniprot", __name__)


@uniprot_bp.route("/api/uniprot-info/<uniprot_id>", methods=["GET"])
def get_uniprot_info_endpoint(uniprot_id):
    """Get protein information from UniProt without running prediction"""
    log_bioemu_info(f"=== UNIPROT INFO REQUEST: {uniprot_id} ===")

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

        # Get protein information
        protein_info = get_protein_info_from_uniprot(uniprot_id)
        if not protein_info:
            log_bioemu_error(f"UniProt ID not found: {uniprot_id}")
            return jsonify(
                {"status": "failed", "message": f"UniProt ID not found: {uniprot_id}"}
            ), 404

        # Check if AlphaFold structure is available (quick check)
        log_bioemu_info("Checking AlphaFold availability...")
        alphafold_structure = download_afdb_structure(uniprot_id)
        alphafold_available = alphafold_structure is not None

        response_data = {
            "status": "success",
            "protein_info": protein_info,
            "alphafold_available": alphafold_available,
        }

        log_bioemu_success(f"Retrieved info for UniProt ID: {uniprot_id}")
        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching UniProt info: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Error fetching protein information: {str(e)}",
            }
        ), 500
