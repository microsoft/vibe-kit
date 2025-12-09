"""
Structure comparison endpoints.

Blueprint: comparison_bp
Routes:
    POST /api/analyze-reference-structure - Analyze reference structure (AlphaFold/PDB)
    POST /api/compare-md-reference - Compare MD ensemble with reference structure
"""

import base64
import time
from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_timing,
    print_separator,
)
from reference_structure_analysis import (
    fetch_pdb_structure,
    analyze_reference_structure,
    compare_md_with_reference,
)


comparison_bp = Blueprint("comparison", __name__)


@comparison_bp.route("/api/analyze-reference-structure", methods=["POST"])
def analyze_reference_structure_endpoint():
    """Analyze reference structure (AlphaFold/PDB) for secondary structure comparison"""
    try:
        data = request.json
        if not data:
            return jsonify({"status": "failed", "message": "No data provided"}), 400

        log_bioemu_info("=== REFERENCE STRUCTURE ANALYSIS START ===")
        start_time = time.time()

        # Get structure source
        structure_source = data.get(
            "source", "alphafold"
        )  # 'alphafold', 'pdb', or 'upload'

        pdb_content = None
        source_info = {}

        if structure_source == "alphafold":
            # Use provided AlphaFold structure
            alphafold_b64 = data.get("alphafold_structure")
            if not alphafold_b64:
                return jsonify(
                    {
                        "status": "failed",
                        "message": "AlphaFold structure data not provided",
                    }
                ), 400

            try:
                pdb_content = base64.b64decode(alphafold_b64).decode("utf-8")
                source_info = {
                    "type": "alphafold",
                    "uniprot_id": data.get("uniprot_id"),
                }
            except Exception as e:
                return jsonify(
                    {
                        "status": "failed",
                        "message": f"Invalid AlphaFold structure data: {str(e)}",
                    }
                ), 400

        elif structure_source == "pdb":
            # Fetch from PDB database
            pdb_id = data.get("pdb_id")
            if not pdb_id:
                return jsonify(
                    {"status": "failed", "message": "PDB ID not provided"}
                ), 400

            log_bioemu_info(f"Fetching PDB structure: {pdb_id}")
            pdb_content = fetch_pdb_structure(pdb_id)
            if not pdb_content:
                return jsonify(
                    {
                        "status": "failed",
                        "message": f"Could not fetch PDB structure: {pdb_id}",
                    }
                ), 404

            source_info = {"type": "pdb", "pdb_id": pdb_id.upper()}

        elif structure_source == "upload":
            # Use uploaded PDB content
            uploaded_pdb = data.get("pdb_content")
            if not uploaded_pdb:
                return jsonify(
                    {"status": "failed", "message": "PDB content not provided"}
                ), 400

            try:
                # Handle both raw text and base64 encoded
                if uploaded_pdb.startswith("data:"):
                    # Extract base64 part if data URL
                    pdb_content = base64.b64decode(uploaded_pdb.split(",")[1]).decode(
                        "utf-8"
                    )
                elif len(uploaded_pdb) % 4 == 0:
                    # Try to decode as base64
                    try:
                        pdb_content = base64.b64decode(uploaded_pdb).decode("utf-8")
                    except:
                        pdb_content = uploaded_pdb
                else:
                    pdb_content = uploaded_pdb

                source_info = {
                    "type": "upload",
                    "filename": data.get("filename", "uploaded.pdb"),
                }
            except Exception as e:
                return jsonify(
                    {"status": "failed", "message": f"Invalid PDB content: {str(e)}"}
                ), 400
        else:
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Unknown structure source: {structure_source}",
                }
            ), 400

        # Analyze reference structure
        log_bioemu_info(f"Analyzing {structure_source} reference structure...")
        target_sequence = data.get("target_sequence")  # For sequence alignment

        analysis_result = analyze_reference_structure(pdb_content, target_sequence)
        if not analysis_result:
            return jsonify(
                {"status": "failed", "message": "Reference structure analysis failed"}
            ), 500

        # Add source information to result
        analysis_result["source_info"] = source_info

        end_time = time.time()
        log_bioemu_timing("Reference Structure Analysis", start_time, end_time)
        log_bioemu_success("Reference structure analysis completed successfully")

        return jsonify({"status": "success", "analysis": analysis_result})

    except Exception as e:
        log_bioemu_error(f"Reference structure analysis failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Analysis error: {str(e)}"}
        ), 500
    finally:
        print_separator()
        log_bioemu_info("=== REFERENCE STRUCTURE ANALYSIS END ===")


@comparison_bp.route("/api/compare-md-reference", methods=["POST"])
def compare_md_reference_endpoint():
    """Compare MD ensemble analysis with reference structure analysis"""
    try:
        data = request.json
        if not data or "md_analysis" not in data or "reference_analysis" not in data:
            return jsonify(
                {
                    "status": "failed",
                    "message": "Missing MD analysis or reference analysis data",
                }
            ), 400

        log_bioemu_info("=== MD vs REFERENCE COMPARISON START ===")
        start_time = time.time()

        md_analysis = data["md_analysis"]
        reference_analysis = data["reference_analysis"]

        # Validate analysis data
        if not md_analysis.get("secondary_structure_stats"):
            return jsonify(
                {
                    "status": "failed",
                    "message": "MD analysis missing secondary structure statistics",
                }
            ), 400

        if not reference_analysis.get("helix_fraction"):
            return jsonify(
                {
                    "status": "failed",
                    "message": "Reference analysis missing secondary structure data",
                }
            ), 400

        log_bioemu_info("Comparing MD ensemble with reference structure...")
        comparison_result = compare_md_with_reference(md_analysis, reference_analysis)

        if not comparison_result:
            return jsonify(
                {"status": "failed", "message": "MD vs reference comparison failed"}
            ), 500

        end_time = time.time()
        log_bioemu_timing("MD vs Reference Comparison", start_time, end_time)
        log_bioemu_success("MD vs reference comparison completed successfully")

        return jsonify({"status": "success", "comparison": comparison_result})

    except Exception as e:
        log_bioemu_error(f"MD vs reference comparison failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Comparison error: {str(e)}"}
        ), 500
    finally:
        print_separator()
        log_bioemu_info("=== MD vs REFERENCE COMPARISON END ===")
