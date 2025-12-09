"""
Structural superposition endpoints.

Blueprint: superposition_bp
Routes:
    POST /api/superpose-structures - Superpose BioEmu trajectory onto AlphaFold
    POST /api/enhanced-superpose-structures - Enhanced superposition with custom PDB
"""

import base64
import time
from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_data,
)
from superposition_utils import perform_sequence_alignment_superposition


superposition_bp = Blueprint("superposition", __name__)


@superposition_bp.route("/api/superpose-structures", methods=["POST"])
def superpose_structures():
    """Superpose BioEmu trajectory onto AlphaFold reference structure"""
    try:
        data = request.json
        if (
            not data
            or "bioemu_pdb" not in data
            or "bioemu_xtc" not in data
            or "alphafold_pdb" not in data
        ):
            return jsonify(
                {
                    "status": "failed",
                    "message": "Missing BioEmu trajectory data (pdb, xtc) or AlphaFold reference structure",
                }
            ), 400

        log_bioemu_info("=== STRUCTURAL SUPERPOSITION START ===")
        start_time = time.time()

        # Decode input data
        bioemu_pdb_data = base64.b64decode(data["bioemu_pdb"])
        bioemu_xtc_data = base64.b64decode(data["bioemu_xtc"])
        alphafold_pdb_data = base64.b64decode(data["alphafold_pdb"])

        # Check if sequence alignment is requested
        use_sequence_alignment = data.get("use_sequence_alignment", False)

        log_bioemu_data(
            "Superposition input",
            {
                "bioemu_pdb_size": len(bioemu_pdb_data),
                "bioemu_xtc_size": len(bioemu_xtc_data),
                "alphafold_pdb_size": len(alphafold_pdb_data),
                "use_sequence_alignment": use_sequence_alignment,
            },
        )

        # Import MDTraj for superposition
        try:
            import mdtraj as md
            import tempfile
            import os

            # Create temporary files
            with tempfile.TemporaryDirectory() as temp_dir:
                # Try sequence alignment first if requested
                if use_sequence_alignment:
                    log_bioemu_info("Attempting sequence-aligned superposition...")
                    success, result_data, error_msg = (
                        perform_sequence_alignment_superposition(
                            bioemu_pdb_data,
                            bioemu_xtc_data,
                            alphafold_pdb_data,
                            temp_dir,
                        )
                    )

                    if success:
                        elapsed = time.time() - start_time
                        result_data["processing_time"] = round(elapsed, 2)
                        return jsonify({"status": "success", **result_data})
                    else:
                        log_bioemu_error(f"Sequence alignment failed: {error_msg}")
                        log_bioemu_info("Falling back to simple superposition...")

                # Fallback to simple superposition (original working method)
                log_bioemu_info("Performing simple backbone+CB superposition...")

                # Write AlphaFold reference structure
                alphafold_path = os.path.join(temp_dir, "alphafold_ref.pdb")
                with open(alphafold_path, "wb") as f:
                    f.write(alphafold_pdb_data)

                # Write BioEmu trajectory files
                bioemu_pdb_path = os.path.join(temp_dir, "bioemu.pdb")
                bioemu_xtc_path = os.path.join(temp_dir, "bioemu.xtc")

                with open(bioemu_pdb_path, "wb") as f:
                    f.write(bioemu_pdb_data)
                with open(bioemu_xtc_path, "wb") as f:
                    f.write(bioemu_xtc_data)

                log_bioemu_info("Loading reference structure (AlphaFold)...")
                # Load AlphaFold reference structure
                ref = md.load(alphafold_path)

                # Select backbone + CB atoms for superposition
                backbone_ind = ref.topology.select("backbone or name CB")
                reference_traj = ref.atom_slice(backbone_ind)

                log_bioemu_info(
                    f"Reference structure: {ref.n_atoms} atoms, {len(backbone_ind)} atoms for superposition"
                )

                log_bioemu_info("Loading BioEmu trajectory...")
                # Load BioEmu trajectory
                sample_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)

                log_bioemu_info(
                    f"BioEmu trajectory: {sample_traj.n_frames} frames, {sample_traj.n_atoms} atoms"
                )

                # Select corresponding atoms in BioEmu trajectory
                try:
                    bioemu_ind = sample_traj.topology.select("backbone or name CB")
                    sample_traj_selected = sample_traj.atom_slice(bioemu_ind)

                    log_bioemu_info(
                        f"BioEmu atoms for superposition: {len(bioemu_ind)}"
                    )

                    # Check atom count compatibility
                    if reference_traj.n_atoms != sample_traj_selected.n_atoms:
                        return jsonify(
                            {
                                "status": "failed",
                                "message": f"Cannot superpose: atom count mismatch (AlphaFold: {reference_traj.n_atoms}, BioEmu: {sample_traj_selected.n_atoms})",
                            }
                        ), 400

                    log_bioemu_info("Performing structural superposition...")
                    # Perform superposition
                    sample_traj_selected.superpose(reference_traj)

                    # Create superposed full trajectory by applying same transformation
                    log_bioemu_info("Applying transformation to full trajectory...")
                    sample_traj.superpose(reference_traj, atom_indices=bioemu_ind)

                    log_bioemu_info("Saving superposed trajectory...")
                    # Save superposed trajectory
                    superposed_xtc_path = os.path.join(
                        temp_dir, "superposed_trajectory.xtc"
                    )
                    sample_traj.save(superposed_xtc_path)

                    # Read superposed trajectory back as binary data
                    with open(superposed_xtc_path, "rb") as f:
                        superposed_xtc_data = f.read()

                    # Encode as base64
                    superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode(
                        "utf-8"
                    )

                    # Calculate quality metrics
                    log_bioemu_info("Calculating RMSD quality metrics...")
                    rmsd_values = md.rmsd(sample_traj_selected, reference_traj)
                    avg_rmsd = float(rmsd_values.mean())
                    max_rmsd = float(rmsd_values.max())
                    min_rmsd = float(rmsd_values.min())

                    quality_metrics = {
                        "avg_rmsd_to_alphafold": avg_rmsd,
                        "max_rmsd_to_alphafold": max_rmsd,
                        "min_rmsd_to_alphafold": min_rmsd,
                        "rmsd_time_series": rmsd_values.tolist(),  # Frame-by-frame RMSD values for plotting
                        "n_frames_superposed": int(sample_traj.n_frames),
                        "n_atoms_superposed": int(reference_traj.n_atoms),
                        "superposition_atoms": "backbone + CB",
                    }

                    elapsed = time.time() - start_time
                    log_bioemu_success(
                        f"Superposition completed in {elapsed:.2f}s - RMSD: {avg_rmsd:.3f}Å"
                    )

                    return jsonify(
                        {
                            "status": "success",
                            "superposed_trajectory": superposed_xtc_b64,
                            "quality_metrics": quality_metrics,
                            "method": "MDTraj backbone+CB superposition",
                            "processing_time": round(elapsed, 2),
                        }
                    )

                except Exception as e:
                    log_bioemu_error(f"Superposition error: {str(e)}")
                    return jsonify(
                        {
                            "status": "failed",
                            "message": f"Superposition failed: {str(e)}",
                        }
                    ), 500

        except ImportError:
            log_bioemu_error("MDTraj not available for structural superposition")
            return jsonify(
                {
                    "status": "failed",
                    "message": "MDTraj library not available. Please install mdtraj for structural superposition.",
                }
            ), 500

    except Exception as e:
        log_bioemu_error(f"Superposition endpoint error: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Server error during superposition: {str(e)}",
            }
        ), 500


@superposition_bp.route("/api/enhanced-superpose-structures", methods=["POST"])
def enhanced_superpose_structures():
    """Enhanced superposition with custom PDB support for comprehensive RMSD analysis"""
    try:
        data = request.json
        if (
            not data
            or "bioemu_pdb" not in data
            or "bioemu_xtc" not in data
            or "alphafold_pdb" not in data
        ):
            return jsonify(
                {
                    "status": "failed",
                    "message": "Missing BioEmu trajectory data (pdb, xtc) or AlphaFold reference structure",
                }
            ), 400

        log_bioemu_info("=== ENHANCED STRUCTURAL SUPERPOSITION START ===")
        start_time = time.time()

        # Decode input data
        bioemu_pdb_data = base64.b64decode(data["bioemu_pdb"])
        bioemu_xtc_data = base64.b64decode(data["bioemu_xtc"])
        alphafold_pdb_data = base64.b64decode(data["alphafold_pdb"])

        # Check for custom PDB data
        custom_pdb_data = None
        if "custom_pdb" in data and data["custom_pdb"]:
            custom_pdb_data = base64.b64decode(data["custom_pdb"])
            log_bioemu_info(
                "Custom PDB structure detected - enabling multi-structure analysis"
            )

        # Check if sequence alignment is requested
        use_sequence_alignment = data.get("use_sequence_alignment", False)

        log_bioemu_data(
            "Enhanced superposition input",
            {
                "bioemu_pdb_size": len(bioemu_pdb_data),
                "bioemu_xtc_size": len(bioemu_xtc_data),
                "alphafold_pdb_size": len(alphafold_pdb_data),
                "custom_pdb_size": len(custom_pdb_data) if custom_pdb_data else 0,
                "use_sequence_alignment": use_sequence_alignment,
            },
        )

        # Import MDTraj for superposition
        try:
            import mdtraj as md
            import tempfile
            import os
            import numpy as np

            # Create temporary files
            with tempfile.TemporaryDirectory() as temp_dir:
                # Write all structures
                alphafold_path = os.path.join(temp_dir, "alphafold_ref.pdb")
                bioemu_pdb_path = os.path.join(temp_dir, "bioemu.pdb")
                bioemu_xtc_path = os.path.join(temp_dir, "bioemu.xtc")

                with open(alphafold_path, "wb") as f:
                    f.write(alphafold_pdb_data)
                with open(bioemu_pdb_path, "wb") as f:
                    f.write(bioemu_pdb_data)
                with open(bioemu_xtc_path, "wb") as f:
                    f.write(bioemu_xtc_data)

                custom_path = None
                if custom_pdb_data:
                    custom_path = os.path.join(temp_dir, "custom.pdb")
                    with open(custom_path, "wb") as f:
                        f.write(custom_pdb_data)

                log_bioemu_info("Loading reference structures...")
                # Load all structures
                alphafold_ref = md.load(alphafold_path)
                bioemu_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)
                custom_ref = None
                if custom_path:
                    custom_ref = md.load(custom_path)

                # Select backbone + CB atoms for superposition
                alphafold_backbone = alphafold_ref.topology.select(
                    "backbone or name CB"
                )
                bioemu_backbone = bioemu_traj.topology.select("backbone or name CB")

                # Perform main superposition (BioEmu to AlphaFold)
                alphafold_ref_selected = alphafold_ref.atom_slice(alphafold_backbone)
                bioemu_traj_selected = bioemu_traj.atom_slice(bioemu_backbone)

                # Check atom count compatibility for main superposition
                if alphafold_ref_selected.n_atoms != bioemu_traj_selected.n_atoms:
                    return jsonify(
                        {
                            "status": "failed",
                            "message": f"Cannot superpose: atom count mismatch (AlphaFold: {alphafold_ref_selected.n_atoms}, BioEmu: {bioemu_traj_selected.n_atoms})",
                        }
                    ), 400

                log_bioemu_info(
                    "Performing main structural superposition (BioEmu to AlphaFold)..."
                )
                # Perform superposition
                bioemu_traj_selected.superpose(alphafold_ref_selected)
                bioemu_traj.superpose(
                    alphafold_ref_selected, atom_indices=bioemu_backbone
                )

                # Calculate BioEmu vs AlphaFold RMSD
                bioemu_alphafold_rmsd = md.rmsd(
                    bioemu_traj_selected, alphafold_ref_selected
                )

                # Prepare results object
                quality_metrics = {
                    "avg_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.mean()),
                    "max_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.max()),
                    "min_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.min()),
                    "rmsd_time_series": bioemu_alphafold_rmsd.tolist(),
                    "n_frames_superposed": int(bioemu_traj.n_frames),
                    "n_atoms_superposed": int(alphafold_ref_selected.n_atoms),
                    "superposition_atoms": "backbone + CB",
                }

                custom_pdb_metrics = None
                if custom_ref:
                    log_bioemu_info("Calculating custom PDB comparisons...")

                    try:
                        # Custom PDB superposition and comparisons
                        custom_backbone = custom_ref.topology.select(
                            "backbone or name CB"
                        )
                        custom_ref_selected = custom_ref.atom_slice(custom_backbone)

                        # BioEmu vs Custom PDB RMSD calculation
                        # Need to align structures first for meaningful comparison
                        if bioemu_traj_selected.n_atoms == custom_ref_selected.n_atoms:
                            # Calculate RMSD between BioEmu trajectory and custom PDB
                            bioemu_custom_rmsd = []
                            for frame_idx in range(bioemu_traj_selected.n_frames):
                                frame = bioemu_traj_selected[frame_idx]
                                rmsd_val = md.rmsd(frame, custom_ref_selected)[0]
                                bioemu_custom_rmsd.append(float(rmsd_val))

                            # AlphaFold vs Custom PDB RMSD (static comparison)
                            alphafold_custom_rmsd = md.rmsd(
                                alphafold_ref_selected, custom_ref_selected
                            )[0]

                            custom_pdb_metrics = {
                                "rmsd_time_series": bioemu_custom_rmsd,
                                "avg_rmsd_bioemu_custom": float(
                                    np.mean(bioemu_custom_rmsd)
                                ),
                                "min_rmsd_bioemu_custom": float(
                                    np.min(bioemu_custom_rmsd)
                                ),
                                "max_rmsd_bioemu_custom": float(
                                    np.max(bioemu_custom_rmsd)
                                ),
                                "alphafold_custom_rmsd": [float(alphafold_custom_rmsd)]
                                * len(bioemu_custom_rmsd),  # Repeat for consistency
                                "alphafold_custom_static_rmsd": float(
                                    alphafold_custom_rmsd
                                ),
                                "custom_pdb_atoms": int(custom_ref_selected.n_atoms),
                            }

                            log_bioemu_success(
                                f"Custom PDB analysis complete - BioEmu↔Custom avg: {np.mean(bioemu_custom_rmsd):.3f}Å, AlphaFold↔Custom: {alphafold_custom_rmsd:.3f}Å"
                            )
                        else:
                            log_bioemu_error(
                                f"Custom PDB atom count mismatch: {custom_ref_selected.n_atoms} vs {bioemu_traj_selected.n_atoms}"
                            )
                            custom_pdb_metrics = {
                                "error": "Atom count mismatch with custom PDB",
                                "custom_pdb_atoms": int(custom_ref_selected.n_atoms),
                                "bioemu_atoms": int(bioemu_traj_selected.n_atoms),
                            }

                    except Exception as e:
                        log_bioemu_error(f"Custom PDB analysis error: {str(e)}")
                        custom_pdb_metrics = {
                            "error": f"Custom PDB analysis failed: {str(e)}"
                        }

                # Save superposed trajectory
                log_bioemu_info("Saving enhanced superposed trajectory...")
                superposed_xtc_path = os.path.join(
                    temp_dir, "enhanced_superposed_trajectory.xtc"
                )
                bioemu_traj.save(superposed_xtc_path)

                # Read superposed trajectory back as binary data
                with open(superposed_xtc_path, "rb") as f:
                    superposed_xtc_data = f.read()

                # Encode as base64
                superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode(
                    "utf-8"
                )

                elapsed = time.time() - start_time
                log_bioemu_success(
                    f"Enhanced superposition completed in {elapsed:.2f}s"
                )

                return jsonify(
                    {
                        "status": "success",
                        "superposed_trajectory": superposed_xtc_b64,
                        "quality_metrics": quality_metrics,
                        "custom_pdb_metrics": custom_pdb_metrics,
                        "method": "Enhanced MDTraj multi-structure superposition",
                        "processing_time": round(elapsed, 2),
                    }
                )

        except ImportError:
            log_bioemu_error(
                "MDTraj not available for enhanced structural superposition"
            )
            return jsonify(
                {
                    "status": "failed",
                    "message": "MDTraj library not available. Please install mdtraj for structural superposition.",
                }
            ), 500

    except Exception as e:
        log_bioemu_error(f"Enhanced superposition endpoint error: {str(e)}")
        return jsonify(
            {
                "status": "failed",
                "message": f"Server error during enhanced superposition: {str(e)}",
            }
        ), 500
