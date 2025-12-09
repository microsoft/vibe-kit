"""
Superposition utilities for aligning BioEmu trajectories with reference structures.
"""

import base64
import os

from logging_utils import log_bioemu_info, log_bioemu_success


def perform_sequence_alignment_superposition(
    bioemu_pdb_data, bioemu_xtc_data, alphafold_pdb_data, temp_dir
):
    """
    Perform sequence-aligned superposition using BioPython for sequence alignment and MDTraj for superposition.
    Falls back to simple superposition if sequence alignment fails.

    Returns: (success, result_data, error_message)
    """
    try:
        # Import BioPython for sequence alignment
        from Bio import pairwise2
        import mdtraj as md

        log_bioemu_info("Starting sequence-aligned superposition...")

        # Write files to temp directory
        alphafold_path = os.path.join(temp_dir, "alphafold_ref.pdb")
        bioemu_pdb_path = os.path.join(temp_dir, "bioemu.pdb")
        bioemu_xtc_path = os.path.join(temp_dir, "bioemu.xtc")

        with open(alphafold_path, "wb") as f:
            f.write(alphafold_pdb_data)
        with open(bioemu_pdb_path, "wb") as f:
            f.write(bioemu_pdb_data)
        with open(bioemu_xtc_path, "wb") as f:
            f.write(bioemu_xtc_data)

        # Load structures
        alphafold_traj = md.load(alphafold_path)
        bioemu_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)

        # Extract sequences from both structures
        alphafold_sequence = "".join(
            [res.name for res in alphafold_traj.topology.residues]
        )
        bioemu_sequence = "".join([res.name for res in bioemu_traj.topology.residues])

        log_bioemu_info(f"AlphaFold sequence length: {len(alphafold_sequence)}")
        log_bioemu_info(f"BioEmu sequence length: {len(bioemu_sequence)}")

        # Perform sequence alignment
        alignments = pairwise2.align.globalxx(alphafold_sequence, bioemu_sequence)
        if not alignments:
            return False, None, "No sequence alignment found"

        best_alignment = alignments[0]
        alignment_score = best_alignment[2]
        aligned_af_seq = best_alignment[0]
        aligned_bioemu_seq = best_alignment[1]

        log_bioemu_info(f"Sequence alignment score: {alignment_score}")
        log_bioemu_info(f"Alignment length: {len(aligned_af_seq)}")

        # Build mapping of aligned residues (skip gaps)
        af_residue_indices = []
        bioemu_residue_indices = []

        af_res_idx = 0
        bioemu_res_idx = 0

        for i in range(len(aligned_af_seq)):
            af_char = aligned_af_seq[i]
            bioemu_char = aligned_bioemu_seq[i]

            # If both positions have residues (not gaps), include in alignment
            if af_char != "-" and bioemu_char != "-":
                af_residue_indices.append(af_res_idx)
                bioemu_residue_indices.append(bioemu_res_idx)

            # Advance position counters if not gap
            if af_char != "-":
                af_res_idx += 1
            if bioemu_char != "-":
                bioemu_res_idx += 1

        log_bioemu_info(f"Aligned residues: {len(af_residue_indices)} pairs")

        if len(af_residue_indices) < 3:
            return (
                False,
                None,
                f"Too few aligned residues for superposition: {len(af_residue_indices)}",
            )

        # Select backbone atoms from aligned residues only
        af_aligned_atoms = []
        bioemu_aligned_atoms = []

        for af_res_idx, bioemu_res_idx in zip(
            af_residue_indices, bioemu_residue_indices
        ):
            # Get backbone atoms for this residue pair
            af_res_atoms = [
                atom.index
                for atom in alphafold_traj.topology.residue(af_res_idx).atoms
                if atom.name in ["N", "CA", "C", "O"]
            ]
            bioemu_res_atoms = [
                atom.index
                for atom in bioemu_traj.topology.residue(bioemu_res_idx).atoms
                if atom.name in ["N", "CA", "C", "O"]
            ]

            # Only include if both residues have the same backbone atoms
            if len(af_res_atoms) == len(bioemu_res_atoms):
                af_aligned_atoms.extend(af_res_atoms)
                bioemu_aligned_atoms.extend(bioemu_res_atoms)

        if len(af_aligned_atoms) == 0:
            return False, None, "No aligned atoms found for superposition"

        # Perform superposition using aligned atoms
        reference_traj = alphafold_traj.atom_slice(af_aligned_atoms)
        sample_traj_selected = bioemu_traj.atom_slice(bioemu_aligned_atoms)

        sample_traj_selected.superpose(reference_traj)
        bioemu_traj.superpose(reference_traj, atom_indices=bioemu_aligned_atoms)

        # Save superposed trajectory
        superposed_xtc_path = os.path.join(
            temp_dir, "superposed_trajectory_aligned.xtc"
        )
        bioemu_traj.save(superposed_xtc_path)

        # Read back and encode
        with open(superposed_xtc_path, "rb") as f:
            superposed_xtc_data = f.read()

        superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode("utf-8")

        # Calculate RMSD
        rmsd_values = md.rmsd(sample_traj_selected, reference_traj)
        avg_rmsd = float(rmsd_values.mean())
        max_rmsd = float(rmsd_values.max())
        min_rmsd = float(rmsd_values.min())

        result_data = {
            "superposed_trajectory": superposed_xtc_b64,
            "quality_metrics": {
                "avg_rmsd_to_alphafold": avg_rmsd,
                "max_rmsd_to_alphafold": max_rmsd,
                "min_rmsd_to_alphafold": min_rmsd,
                "rmsd_time_series": rmsd_values.tolist(),
                "n_frames_superposed": int(bioemu_traj.n_frames),
                "n_atoms_superposed": len(af_aligned_atoms),
                "superposition_atoms": f"sequence-aligned backbone ({len(af_residue_indices)} residue pairs)",
                "alignment_score": alignment_score,
                "matching_residues": len(af_residue_indices),
                "sequence_identity": len(af_residue_indices)
                / max(len(alphafold_sequence), len(bioemu_sequence)),
            },
            "method": "Sequence-aligned superposition (BioPython + MDTraj)",
        }

        log_bioemu_success(
            f"Sequence-aligned superposition completed - RMSD: {avg_rmsd:.3f}Å, {len(af_residue_indices)} aligned residues"
        )
        return True, result_data, None

    except ImportError as e:
        return False, None, f"BioPython not installed: {str(e)}"
    except Exception as e:
        return False, None, f"Sequence alignment error: {str(e)}"
