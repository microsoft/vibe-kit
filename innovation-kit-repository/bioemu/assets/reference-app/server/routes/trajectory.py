"""
Trajectory analysis endpoints.

Blueprint: trajectory_bp
Routes:
    POST /api/analyze-trajectory - Trajectory analysis using MDTraj
    POST /api/energy-landscape - Energy landscape analysis using PCA
"""

import base64
import logging
import time
from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
    log_bioemu_timing,
    print_separator,
)

logger = logging.getLogger(__name__)

trajectory_bp = Blueprint("trajectory", __name__)


@trajectory_bp.route("/api/analyze-trajectory", methods=["POST"])
def analyze_trajectory_endpoint():
    """Trajectory analysis using MDTraj - NO FALLBACKS"""
    try:
        data = request.json
        if not data or "pdb" not in data or "xtc" not in data:
            return jsonify(
                {"status": "failed", "message": "Missing PDB or XTC data"}
            ), 400

        logger.info("Starting trajectory analysis...")

        try:
            pdb_data = base64.b64decode(data["pdb"])
            xtc_data = base64.b64decode(data["xtc"])
        except Exception as e:
            logger.error(f"Failed to decode trajectory data: {str(e)}")
            return jsonify(
                {"status": "failed", "message": f"Invalid base64 data: {str(e)}"}
            ), 400

        # Trajectory analysis ONLY - NO FALLBACKS
        try:
            from trajectory_analysis import analyze_trajectory

            analysis_result = analyze_trajectory(pdb_data, xtc_data)

            logger.info("Trajectory analysis completed successfully")
            return jsonify(
                {
                    "status": "success",
                    "analysis": analysis_result,
                    "data_source": "real_trajectory_mdtraj",
                }
            )

        except ImportError as e:
            logger.error(f"MDTraj dependencies not available: {str(e)}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"MDTraj not properly installed: {str(e)}. Please install the required dependencies.",
                }
            ), 500
        except Exception as e:
            logger.error(f"Trajectory analysis failed: {str(e)}")
            return jsonify(
                {"status": "failed", "message": f"Trajectory analysis error: {str(e)}"}
            ), 500

    except Exception as e:
        logger.error(f"Trajectory analysis endpoint failed: {str(e)}")
        return jsonify(
            {"status": "failed", "message": f"Analysis error: {str(e)}"}
        ), 500


@trajectory_bp.route("/api/energy-landscape", methods=["POST"])
def energy_landscape_endpoint():
    """Energy landscape analysis using PCA on CA-CA contacts"""
    try:
        data = request.json
        if not data or "pdb" not in data or "xtc" not in data:
            return jsonify(
                {"status": "failed", "message": "Missing PDB or XTC data"}
            ), 400

        log_bioemu_info("=== ENERGY LANDSCAPE ANALYSIS START ===")
        start_time = time.time()

        # Decode the same BioEmu data used for visualization
        pdb_data = base64.b64decode(data["pdb"])
        xtc_data = base64.b64decode(data["xtc"])

        log_bioemu_data(
            "Energy landscape input",
            {"pdb_size": len(pdb_data), "xtc_size": len(xtc_data)},
        )

        # Import and compute energy landscape using MDTraj
        try:
            from energy_landscape_analysis import (
                compute_energy_landscape,
                compute_free_energy_surface,
            )

            landscape_results = compute_energy_landscape(pdb_data, xtc_data)

            # Optionally compute free energy surface
            include_surface = data.get("include_surface", True)
            if (
                include_surface
                and "pc1_coords" in landscape_results
                and "pc2_coords" in landscape_results
            ):
                surface_data = compute_free_energy_surface(
                    landscape_results["pc1_coords"], landscape_results["pc2_coords"]
                )
                if surface_data:
                    landscape_results["free_energy_surface"] = surface_data
        except ImportError as e:
            log_bioemu_error(f"Failed to import energy landscape module: {str(e)}")
            return jsonify(
                {
                    "status": "failed",
                    "message": f"Energy landscape module not available: {str(e)}",
                }
            ), 500

        end_time = time.time()
        log_bioemu_timing("Energy Landscape Analysis", start_time, end_time)
        log_bioemu_success("Energy landscape analysis completed successfully")

        return jsonify({"status": "success", "landscape_data": landscape_results})

    except Exception as e:
        log_bioemu_error(f"Energy landscape analysis failed: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Energy landscape analysis error: {str(e)}",
            }
        ), 500
    finally:
        print_separator()
        log_bioemu_info("=== ENERGY LANDSCAPE ANALYSIS END ===")
