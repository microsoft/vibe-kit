"""
PDB database endpoints.

Blueprint: pdb_bp
Routes:
    GET /api/pdb-sequence/<pdb_id> - Get protein sequence from PDB ID
    GET /api/pdb-info/<pdb_id> - Get comprehensive PDB entry information
    GET /api/pdb-chains/<pdb_id> - Get available chains in a PDB structure
"""

from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
)
from pdb_service import (
    validate_pdb_id,
    sequence_from_pdb_id,
    get_pdb_info,
    get_available_chains,
)


pdb_bp = Blueprint("pdb", __name__)


@pdb_bp.route("/api/pdb-sequence/<pdb_id>", methods=["GET"])
def get_pdb_sequence_endpoint(pdb_id):
    """Get protein sequence from PDB ID"""
    log_bioemu_info(f"=== PDB SEQUENCE REQUEST: {pdb_id} ===")

    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)",
                }
            ), 400

        # Get optional chain parameter
        chain_id = request.args.get("chain", None)

        # Extract sequence from PDB
        sequence = sequence_from_pdb_id(pdb_id, chain_id)
        if not sequence:
            error_msg = f"Could not extract sequence from PDB: {pdb_id}"
            if chain_id:
                error_msg += f" (chain: {chain_id})"
            log_bioemu_error(error_msg)
            return jsonify(
                {
                    "status": "failed",
                    "message": error_msg,
                    "error_code": "PDB_SEQUENCE_UNAVAILABLE",
                    "pdb_id": pdb_id,
                    "chain_id": chain_id,
                }
            ), 404

        response_data = {
            "status": "success",
            "pdb_id": pdb_id.upper(),
            "chain_id": chain_id,
            "sequence": sequence,
            "sequence_length": len(sequence),
            "source": "PDB",
        }

        log_bioemu_success(
            f"Retrieved sequence from PDB: {pdb_id} (length: {len(sequence)})"
        )

        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching PDB sequence: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Error fetching PDB sequence: {str(e)}"}
        ), 500


@pdb_bp.route("/api/pdb-info/<pdb_id>", methods=["GET"])
def get_pdb_info_endpoint(pdb_id):
    """Get comprehensive information about a PDB entry"""
    log_bioemu_info(f"=== PDB INFO REQUEST: {pdb_id} ===")

    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)",
                }
            ), 400

        # Get PDB information
        pdb_info = get_pdb_info(pdb_id)
        if not pdb_info:
            error_msg = f"Could not retrieve information for PDB: {pdb_id}"
            log_bioemu_error(error_msg)
            return jsonify(
                {
                    "status": "failed",
                    "message": error_msg,
                    "error_code": "PDB_INFO_UNAVAILABLE",
                    "pdb_id": pdb_id,
                }
            ), 404

        response_data = {"status": "success", **pdb_info}

        log_bioemu_success(f"Retrieved PDB info for: {pdb_id}")
        log_bioemu_data("PDB info", pdb_info, max_length=100)

        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching PDB info: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Error fetching PDB info: {str(e)}"}
        ), 500


@pdb_bp.route("/api/pdb-chains/<pdb_id>", methods=["GET"])
def get_pdb_chains_endpoint(pdb_id):
    """Get available chains in a PDB structure"""
    log_bioemu_info(f"=== PDB CHAINS REQUEST: {pdb_id} ===")

    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)",
                }
            ), 400

        # Get available chains
        chains = get_available_chains(pdb_id)

        response_data = {
            "status": "success",
            "pdb_id": pdb_id.upper(),
            "chains": chains,
            "chain_count": len(chains),
        }

        log_bioemu_success(f"Retrieved chains for PDB: {pdb_id} - {len(chains)} chains")

        return jsonify(response_data)

    except Exception as e:
        log_bioemu_error(f"Error fetching PDB chains: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Error fetching PDB chains: {str(e)}"}
        ), 500
