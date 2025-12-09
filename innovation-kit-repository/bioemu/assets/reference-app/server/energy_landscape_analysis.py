"""
Energy Landscape Analysis Module for BioEmu Research Platform
Implements PCA-based conformational landscape analysis using CA-CA contacts
"""

import mdtraj as md
import numpy as np
import tempfile
import os
import logging
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


def compute_energy_landscape(pdb_data, xtc_data):
    """
    Compute conformational energy landscape using PCA on CA-CA contacts
    
    Args:
        pdb_data: Base64 decoded PDB topology data
        xtc_data: Base64 decoded XTC trajectory data
    
    Returns:
        Dictionary containing landscape coordinates and analysis results
    """
    pdb_path = None
    xtc_path = None
    
    try:
        logger.info("Starting energy landscape analysis...")
        logger.info(f"PDB data size: {len(pdb_data)} bytes")
        logger.info(f"XTC data size: {len(xtc_data)} bytes")
        
        # Create temporary files for MDTraj processing
        with tempfile.NamedTemporaryFile(suffix='.pdb', delete=False) as pdb_file:
            pdb_file.write(pdb_data)
            pdb_path = pdb_file.name
        
        with tempfile.NamedTemporaryFile(suffix='.xtc', delete=False) as xtc_file:
            xtc_file.write(xtc_data)
            xtc_path = xtc_file.name
        
        logger.info(f"Loading trajectory: PDB={pdb_path}, XTC={xtc_path}")
        
        # Load trajectory from BioEmu data
        trajectory = md.load(xtc_path, top=pdb_path)
        logger.info(f"Trajectory loaded: {trajectory.n_frames} frames, {trajectory.n_atoms} atoms")
        
        # Select CA atoms
        ca_indices = trajectory.top.select('name CA')
        logger.info(f"Selected {len(ca_indices)} CA atoms")
        
        if len(ca_indices) < 4:
            raise ValueError("Not enough CA atoms for contact analysis")
        
        # Compute contact features for each frame
        contact_features = []
        n_residues = len(ca_indices)
        
        logger.info("Computing CA-CA contact features...")
        
        for frame_idx in range(trajectory.n_frames):
            frame = trajectory[frame_idx]
            ca_coords = frame.atom_slice(ca_indices).xyz[0]  # Shape: (n_ca, 3)
            
            # Compute contact fingerprint: x_ij = exp(-d_ij) for j > i+3
            contacts = []
            for i in range(n_residues):
                for j in range(i+4, n_residues):  # j > i+3 to exclude local contacts
                    d_ij = np.linalg.norm(ca_coords[i] - ca_coords[j])
                    x_ij = np.exp(-d_ij)  # Contact strength
                    contacts.append(x_ij)
            
            contact_features.append(contacts)
            
            if (frame_idx + 1) % 50 == 0:
                logger.info(f"Processed {frame_idx + 1}/{trajectory.n_frames} frames")
        
        # Convert to numpy array
        contact_matrix = np.array(contact_features)
        logger.info(f"Contact matrix shape: {contact_matrix.shape}")
        
        # Standardize features (optional but often helpful)
        scaler = StandardScaler()
        contact_matrix_scaled = scaler.fit_transform(contact_matrix)
        
        # PCA analysis
        logger.info("Performing PCA analysis...")
        pca = PCA(n_components=min(10, contact_matrix.shape[1]))  # Up to 10 components
        landscape_coords = pca.fit_transform(contact_matrix_scaled)
        
        # Calculate explained variance
        explained_variance = pca.explained_variance_ratio_
        cumulative_variance = np.cumsum(explained_variance)
        
        logger.info(f"PC1 explains {explained_variance[0]:.1%} of variance")
        logger.info(f"PC2 explains {explained_variance[1]:.1%} of variance")
        logger.info(f"PC1+PC2 explain {cumulative_variance[1]:.1%} of total variance")
        
        # Prepare results
        results = {
            'pc1_coords': landscape_coords[:, 0].tolist(),
            'pc2_coords': landscape_coords[:, 1].tolist(),
            'explained_variance_pc1': float(explained_variance[0]),
            'explained_variance_pc2': float(explained_variance[1]),
            'cumulative_variance_pc1_pc2': float(cumulative_variance[1]),
            'n_frames': int(trajectory.n_frames),
            'n_contacts': len(contacts),
            'frame_indices': list(range(trajectory.n_frames))
        }
        
        # Add additional PCA components if requested
        if len(explained_variance) > 2:
            results['explained_variance_all'] = explained_variance[:5].tolist()
            results['pc3_coords'] = landscape_coords[:, 2].tolist() if landscape_coords.shape[1] > 2 else None
        
        logger.info("Energy landscape analysis completed successfully")
        return results
        
    except Exception as e:
        logger.error(f"Energy landscape analysis failed: {str(e)}")
        raise Exception(f"Energy landscape computation error: {str(e)}")
        
    finally:
        # Clean up temporary files
        try:
            if pdb_path and os.path.exists(pdb_path):
                os.unlink(pdb_path)
            if xtc_path and os.path.exists(xtc_path):
                os.unlink(xtc_path)
        except Exception as cleanup_error:
            logger.warning(f"Failed to clean up temporary files: {cleanup_error}")


def compute_free_energy_surface(pc1_coords, pc2_coords, bins=50, temperature=300):
    """
    Compute approximate free energy surface from PC coordinate density
    
    Args:
        pc1_coords: PC1 coordinates
        pc2_coords: PC2 coordinates
        bins: Number of bins for 2D histogram
        temperature: Temperature in Kelvin
    
    Returns:
        Dictionary with free energy surface data
    """
    try:
        # Compute 2D histogram
        hist, x_edges, y_edges = np.histogram2d(pc1_coords, pc2_coords, bins=bins)
        
        # Convert to free energy (G = -kT ln(P))
        # Add pseudocount to avoid log(0)
        hist_smooth = hist + 1e-10
        prob = hist_smooth / np.sum(hist_smooth)
        
        # Boltzmann constant in kcal/mol/K
        kb = 0.001987  # kcal/mol/K
        free_energy = -kb * temperature * np.log(prob)
        
        # Set minimum to zero
        free_energy = free_energy - np.min(free_energy)
        
        # Prepare grid coordinates
        x_centers = (x_edges[:-1] + x_edges[1:]) / 2
        y_centers = (y_edges[:-1] + y_edges[1:]) / 2
        
        return {
            'free_energy': free_energy.tolist(),
            'x_coords': x_centers.tolist(),
            'y_coords': y_centers.tolist(),
            'x_edges': x_edges.tolist(),
            'y_edges': y_edges.tolist()
        }
        
    except Exception as e:
        logger.error(f"Free energy surface computation failed: {str(e)}")
        return None
