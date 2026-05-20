"""
Trajectory Analysis Module for BioEmu Research Platform
Imp        logger.info("Computing RMSF (flexibility) from trajectory "
                    "(per-residue, Cα only)...")
        ca_indices = traj.topology.select("name CA")
        if len(ca_indices) == 0:
            raise ValueError("No Cα atoms found in trajectory for "
                           "per-residue RMSF calculation.")
        # Per-residue flexibility
        rmsf = md.rmsf(traj.atom_slice(ca_indices),
                       traj[0].atom_slice(ca_indices))
        logger.info(f"RMSF computation complete: {len(rmsf)} values "
                    f"(should match number of residues)")
"""

import mdtraj as md
import numpy as np
import tempfile
import os
import logging

logger = logging.getLogger(__name__)


def analyze_trajectory(pdb_data, xtc_data):
    """
    Analyze Azure BioEmu trajectory data using MDTraj
    
    Args:
        pdb_data: Base64 decoded PDB topology data
        xtc_data: Base64 decoded XTC trajectory data
    
    Returns:
        Dictionary containing analysis results from actual trajectory data
    
    Raises:
        Exception: If MDTraj analysis fails for any reason
    """
    pdb_path = None
    xtc_path = None
    
    try:
        # Create temporary files for MDTraj processing
        logger.info("Creating temporary files for MDTraj analysis...")
        logger.info(f"PDB data size: {len(pdb_data)} bytes")
        logger.info(f"XTC data size: {len(xtc_data)} bytes")
        
        with tempfile.NamedTemporaryFile(suffix='.pdb',
                                         delete=False) as pdb_file:
            pdb_file.write(pdb_data)
            pdb_path = pdb_file.name
        
        with tempfile.NamedTemporaryFile(suffix='.xtc',
                                         delete=False) as xtc_file:
            xtc_file.write(xtc_data)
            xtc_path = xtc_file.name
        
        logger.info(f"Temporary files created: PDB={pdb_path}, XTC={xtc_path}")
        
        # Load trajectory from API data
        logger.info("Loading trajectory data with MDTraj...")
        traj = md.load(xtc_path, top=pdb_path)
        logger.info(f"Loaded trajectory: {traj.n_frames} frames, "
                    f"{traj.n_atoms} atoms")
        
        if traj.n_frames == 0:
            raise ValueError("Trajectory contains no frames")
        if traj.n_atoms == 0:
            raise ValueError("Trajectory contains no atoms")
        
        # Analysis computations from actual trajectory data
        logger.info("Computing radius of gyration from trajectory...")
        rg = md.compute_rg(traj)  # Radius of gyration from trajectory
        # Convert from nm (mdtraj default) to Angstrom for display (×10)
        rg = rg * 10.0
        logger.info(f"RG computation complete: {len(rg)} values, converted to Angstrom")
        
        logger.info("Computing RMSF (flexibility) from trajectory "
                    "(per-residue, Cα only)...")
        ca_indices = traj.topology.select('name CA')
        if len(ca_indices) == 0:
            raise ValueError("No Cα atoms found in trajectory for "
                             "per-residue RMSF calculation.")
        # Per-residue flexibility
        rmsf = md.rmsf(traj.atom_slice(ca_indices),
                       traj[0].atom_slice(ca_indices))
        # Convert from nm (mdtraj default) to Angstrom for display (×10)
        rmsf = rmsf * 10.0
        logger.info(f"RMSF computation complete: {len(rmsf)} values "
                    f"(should match number of residues), converted to Angstrom")
        logger.info("Computing contact maps from trajectory...")
        contacts, pairs = md.compute_contacts(traj, scheme='closest-heavy')
        logger.info(f"Contact computation complete: {len(contacts)} frames, "
                    f"{len(pairs)} pairs")
        
        # Compute Cα-Cα distance matrix for contact map visualization
        logger.info("Computing Cα-Cα distance matrix for contact map visualization...")
        ca_indices = traj.topology.select("name CA")
        if len(ca_indices) == 0:
            raise ValueError("No Cα atoms found for contact map calculation.")
        
        # Calculate pairwise distances between all Cα atoms for each frame
        ca_coords = traj.xyz[:, ca_indices, :]  # Shape: (n_frames, n_residues, 3)
        n_frames, n_residues, _ = ca_coords.shape
        
        # Initialize distance matrix array
        distance_matrices = np.zeros((n_frames, n_residues, n_residues))
        
        # Compute pairwise distances for each frame
        for frame_idx in range(n_frames):
            coords = ca_coords[frame_idx]  # Shape: (n_residues, 3)
            # Calculate all pairwise distances using broadcasting
            diff = coords[:, np.newaxis, :] - coords[np.newaxis, :, :]  # Shape: (n_residues, n_residues, 3)
            distances = np.sqrt(np.sum(diff**2, axis=2))  # Shape: (n_residues, n_residues)
            distance_matrices[frame_idx] = distances
        
        # Calculate ensemble-averaged distance matrix
        mean_distance_matrix = np.mean(distance_matrices, axis=0)
        
        # IMPORTANT: MDTraj coordinates are in nanometers (nm)
        # Typical Cα-Cα distances: 0.38 nm (adjacent), 0.8-2.0 nm (contacts)
        logger.info(f"Cα-Cα distance matrix calculation complete: {mean_distance_matrix.shape} "
                    f"(ensemble-averaged across {n_frames} frames)")
        logger.info(f"Distance range: {np.min(mean_distance_matrix):.3f} to {np.max(mean_distance_matrix):.3f} nm")
        
        logger.info("Computing secondary structure (DSSP) from trajectory...")
        # DSSP secondary structure analysis
        dssp = None
        secondary_structure_stats = None
        try:
            # 3-state: H (helix), E (sheet), C (coil)
            dssp = md.compute_dssp(traj, simplified=True)
            logger.info(f"DSSP computation complete: {dssp.shape}")
            
            # Calculate secondary structure statistics per residue
            n_frames, n_residues = dssp.shape
            # Fraction of time each residue spends in each state
            helix_fraction = np.mean(dssp == 'H', axis=0)
            sheet_fraction = np.mean(dssp == 'E', axis=0)
            coil_fraction = np.mean(dssp == 'C', axis=0)
            
            secondary_structure_stats = {
                'helix_fraction': helix_fraction.tolist(),
                'sheet_fraction': sheet_fraction.tolist(),
                'coil_fraction': coil_fraction.tolist(),
                'mean_helix_content': float(np.mean(helix_fraction)),
                'mean_sheet_content': float(np.mean(sheet_fraction)),
                'mean_coil_content': float(np.mean(coil_fraction)),
                'most_helical_residues': (np.argsort(helix_fraction)[-5:]
                                          .tolist()),
                'most_sheet_residues': (np.argsort(sheet_fraction)[-5:]
                                        .tolist())
            }
            mean_helix = secondary_structure_stats['mean_helix_content']
            mean_sheet = secondary_structure_stats['mean_sheet_content']
            mean_coil = secondary_structure_stats['mean_coil_content']
            logger.info(f"Secondary structure: {mean_helix:.2f} helix, "
                        f"{mean_sheet:.2f} sheet, {mean_coil:.2f} coil")
        except Exception as dssp_error:
            logger.warning(f"DSSP computation failed: {dssp_error}")
            # DSSP can fail for some structures, continue without it
        
        logger.info("Computing additional structural metrics...")
        
        # Local gyration analysis (per-residue gyration)
        logger.info("Computing per-residue gyration analysis...")
        local_gyration_stats = None
        try:
            # Compute gyration tensor for each residue individually
            n_residues = traj.n_residues
            local_rg = np.zeros((traj.n_frames, n_residues))
            
            for residue_idx in range(n_residues):
                # Get atoms for this residue (CA, C, N, O for main chain)
                atom_selection = (f'residue {residue_idx} and '
                                  f'(name CA or name C or name N or name O)')
                residue_atoms = traj.topology.select(atom_selection)
                if len(residue_atoms) > 0:
                    residue_traj = traj.atom_slice(residue_atoms)
                    # Need at least 2 atoms for meaningful gyration
                    if residue_traj.n_atoms >= 2:
                        local_rg[:, residue_idx] = md.compute_rg(residue_traj) * 10.0  # Convert nm to Angstrom
                    else:
                        local_rg[:, residue_idx] = 0.0
                else:
                    local_rg[:, residue_idx] = 0.0
            
            local_gyration_stats = {
                'per_residue_rg_mean': np.mean(local_rg, axis=0).tolist(),
                'per_residue_rg_std': np.std(local_rg, axis=0).tolist(),
                'per_residue_rg_ensemble': local_rg.tolist()
            }
            logger.info(f"Local gyration analysis complete: "
                        f"{n_residues} residues")
        except Exception as local_rg_error:
            logger.warning(f"Local gyration analysis failed: {local_rg_error}")
        
        # Positional variance analysis
        logger.info("Computing positional variance metrics...")
        positional_variance_stats = None
        try:
            # Compute per-residue positional variance (using CA atoms)
            # Shape: (n_frames, n_residues, 3)
            ca_positions = traj.xyz[:, ca_indices, :]
            
            # Positional variance per residue (variance in x, y, z coordinates)
            pos_variance_x = np.var(ca_positions[:, :, 0], axis=0)
            pos_variance_y = np.var(ca_positions[:, :, 1], axis=0)
            pos_variance_z = np.var(ca_positions[:, :, 2], axis=0)
            total_pos_variance = (pos_variance_x + pos_variance_y +
                                  pos_variance_z)
            
            positional_variance_stats = {
                'per_residue_pos_variance': total_pos_variance.tolist(),
                'per_residue_pos_variance_x': pos_variance_x.tolist(),
                'per_residue_pos_variance_y': pos_variance_y.tolist(),
                'per_residue_pos_variance_z': pos_variance_z.tolist(),
                'mean_positional_variance': float(np.mean(total_pos_variance)),
                'most_variable_residues': (np.argsort(total_pos_variance)[-5:]
                                           .tolist()),
                'least_variable_residues': (np.argsort(total_pos_variance)[:5]
                                            .tolist())
            }
            mean_var = np.mean(total_pos_variance)
            logger.info(f"Positional variance analysis complete: "
                        f"mean variance = {mean_var:.3f}")
        except Exception as pos_var_error:
            logger.warning(f"Positional variance analysis failed: "
                           f"{pos_var_error}")
        
        # Terminal region analysis
        logger.info("Computing terminal region analysis...")
        terminal_analysis_stats = None
        try:
            n_residues = len(ca_indices)
            if n_residues >= 10:  # Only analyze if we have enough residues
                # Define terminal regions (first/last 5 residues or 10% of
                # protein, whichever is smaller)
                terminal_size = min(5, max(2, n_residues // 10))
                n_term_indices = list(range(terminal_size))
                c_term_indices = list(range(n_residues - terminal_size,
                                            n_residues))
                middle_indices = list(range(terminal_size,
                                            n_residues - terminal_size))
                
                # Flexibility comparison
                n_term_flex = (np.mean(rmsf[n_term_indices])
                               if n_term_indices else 0.0)
                c_term_flex = (np.mean(rmsf[c_term_indices])
                               if c_term_indices else 0.0)
                middle_flex = (np.mean(rmsf[middle_indices])
                               if middle_indices else 0.0)
                
                # Compactness comparison (if local gyration available)
                n_term_compact = 0.0
                c_term_compact = 0.0
                middle_compact = 0.0
                
                if local_gyration_stats:
                    local_rg_mean = np.array(
                        local_gyration_stats['per_residue_rg_mean'])
                    n_term_compact = (np.mean(local_rg_mean[n_term_indices])
                                      if n_term_indices else 0.0)
                    c_term_compact = (np.mean(local_rg_mean[c_term_indices])
                                      if c_term_indices else 0.0)
                    middle_compact = (np.mean(local_rg_mean[middle_indices])
                                      if middle_indices else 0.0)
                
                # Flexibility ratios
                n_vs_middle_ratio = (n_term_flex / middle_flex
                                     if middle_flex > 0 else 0.0)
                c_vs_middle_ratio = (c_term_flex / middle_flex
                                     if middle_flex > 0 else 0.0)
                
                terminal_analysis_stats = {
                    'terminal_size': terminal_size,
                    'n_term_flexibility': float(n_term_flex),
                    'c_term_flexibility': float(c_term_flex),
                    'middle_flexibility': float(middle_flex),
                    'n_term_compactness': float(n_term_compact),
                    'c_term_compactness': float(c_term_compact),
                    'middle_compactness': float(middle_compact),
                    'n_term_indices': n_term_indices,
                    'c_term_indices': c_term_indices,
                    'flexibility_ratio_n_vs_middle': float(n_vs_middle_ratio),
                    'flexibility_ratio_c_vs_middle': float(c_vs_middle_ratio)
                }
                logger.info(f"Terminal analysis complete: N-term="
                            f"{n_term_flex:.3f}, C-term={c_term_flex:.3f}, "
                            f"Middle={middle_flex:.3f}")
            else:
                logger.info("Protein too short for meaningful "
                            "terminal analysis")
        except Exception as terminal_error:
            logger.warning(f"Terminal region analysis failed: "
                           f"{terminal_error}")
        
        # Enhanced secondary structure analysis with variance
        if secondary_structure_stats:
            try:
                logger.info("Computing secondary structure variance...")
                # Calculate variance in secondary structure content
                helix_var = (np.var(dssp == 'H', axis=0)
                             if dssp is not None else [])
                sheet_var = (np.var(dssp == 'E', axis=0)
                             if dssp is not None else [])
                coil_var = (np.var(dssp == 'C', axis=0)
                            if dssp is not None else [])
                
                # Add variance metrics to existing secondary structure stats
                secondary_structure_stats.update({
                    'helix_variance': (helix_var.tolist()
                                       if len(helix_var) > 0 else []),
                    'sheet_variance': (sheet_var.tolist()
                                       if len(sheet_var) > 0 else []),
                    'coil_variance': (coil_var.tolist()
                                      if len(coil_var) > 0 else []),
                    'mean_helix_variance': (float(np.mean(helix_var))
                                            if len(helix_var) > 0 else 0.0),
                    'mean_sheet_variance': (float(np.mean(sheet_var))
                                            if len(sheet_var) > 0 else 0.0),
                    'mean_coil_variance': (float(np.mean(coil_var))
                                           if len(coil_var) > 0 else 0.0),
                    'most_variable_helix_residues': (
                        np.argsort(helix_var)[-5:].tolist()
                        if len(helix_var) > 0 else []),
                    'most_variable_sheet_residues': (
                        np.argsort(sheet_var)[-5:].tolist()
                        if len(sheet_var) > 0 else [])
                })
                logger.info("Secondary structure variance analysis complete")
            except Exception as ss_var_error:
                logger.warning(f"Secondary structure variance analysis "
                               f"failed: {ss_var_error}")
        
        # Ensemble statistics from actual trajectory
        ensemble_stats = {
            'mean_rg': float(np.mean(rg)),
            'min_rg': float(np.min(rg)),
            'max_rg': float(np.max(rg)),
            'compactness_distribution': np.histogram(rg, bins=20)[0].tolist(),
            'compactness_bins': np.histogram(rg, bins=20)[1].tolist(),
            'n_frames': int(traj.n_frames),
            'n_atoms': int(traj.n_atoms),
            'trajectory_length_ns': (float(traj.time[-1])
                                     if len(traj.time) > 0 else 0.0)
        }

        # Flexibility analysis from trajectory
        flexibility_stats = {
            'mean_rmsf': float(np.mean(rmsf)),
            'std_rmsf': float(np.std(rmsf)),
            'most_flexible_residues': np.argsort(rmsf)[-5:].tolist(),
            'least_flexible_residues': np.argsort(rmsf)[:5].tolist()
        }

        # Contact analysis from trajectory
        contact_stats = {
            'mean_contacts': float(np.mean(np.sum(contacts, axis=1))),
            'contact_fluctuation': float(np.std(np.sum(contacts, axis=1))),
            'persistent_contacts': int(np.sum(np.mean(contacts, axis=0) > 0.8))
        }

        logger.info("Trajectory analysis completed successfully")

        return {
            'success': True,
            'real_rg_ensemble': rg.tolist(),
            'real_flexibility': rmsf.tolist(),
            'real_contact_maps': (contacts.tolist() if len(contacts) < 1000
                                  else contacts[:1000].tolist()),
            'contact_pairs': (pairs.tolist() if len(pairs) < 1000
                              else pairs[:1000].tolist()),
            'ca_distance_matrix': mean_distance_matrix.tolist(),  # Ensemble-averaged Cα-Cα distances
            'ca_distance_matrices_per_frame': (distance_matrices.tolist() if distance_matrices.shape[0] < 200
                                              else distance_matrices[:200].tolist()),  # Per-frame distance matrices for dynamic contact maps
            'ensemble_stats': ensemble_stats,
            'flexibility_stats': flexibility_stats,
            'contact_stats': contact_stats,
            'secondary_structure_stats': secondary_structure_stats,
            'local_gyration_stats': local_gyration_stats,
            'positional_variance_stats': positional_variance_stats,
            'terminal_analysis_stats': terminal_analysis_stats,
            'analysis_type': 'real_trajectory_mdtraj',
            'timestamp': str(np.datetime64('now'))
        }
    except Exception as e:
        logger.error(f"Trajectory analysis failed: {str(e)}")
        raise
        
    finally:
        # Clean up temporary files
        for temp_path in [pdb_path, xtc_path]:
            if temp_path:
                try:
                    os.unlink(temp_path)
                    logger.info(f"Cleaned up temporary file: {temp_path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temporary files: "
                                   f"{cleanup_error}")
