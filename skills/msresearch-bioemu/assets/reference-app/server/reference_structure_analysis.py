"""
Reference Structure Analysis Module for BioEmu Research Platform
Provides functionality to analyze reference structures (AlphaFold/X-ray) for comparison with MD ensembles
"""

import mdtraj as md
import numpy as np
import tempfile
import os
import logging
import requests
from typing import Optional, Dict, Any, List, Tuple

logger = logging.getLogger(__name__)


def fetch_pdb_structure(pdb_id: str) -> Optional[str]:
    """
    Fetch PDB structure from RCSB PDB database
    
    Args:
        pdb_id: PDB ID (e.g., '1ABC')
    
    Returns:
        PDB content as string, or None if not found
    """
    try:
        url = f"https://files.rcsb.org/view/{pdb_id.upper()}.pdb"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            logger.info(f"Successfully fetched PDB structure: {pdb_id}")
            return response.text
        else:
            logger.warning(f"PDB {pdb_id} not found: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching PDB {pdb_id}: {e}")
        return None


def analyze_reference_structure(pdb_content: str, sequence: str = None) -> Optional[Dict[str, Any]]:
    """
    Analyze reference structure (PDB/AlphaFold) to extract secondary structure
    
    Args:
        pdb_content: PDB file content as string
        sequence: Optional sequence for alignment checking
    
    Returns:
        Dictionary containing reference structure analysis
    """
    pdb_path = None
    
    try:
        # Create temporary PDB file
        with tempfile.NamedTemporaryFile(suffix='.pdb', delete=False, mode='w') as pdb_file:
            pdb_file.write(pdb_content)
            pdb_path = pdb_file.name
        
        # Load structure with MDTraj
        logger.info("Loading reference structure with MDTraj...")
        traj = md.load(pdb_path)
        logger.info(f"Loaded reference structure: {traj.n_atoms} atoms, {traj.n_residues} residues")
        
        # Extract sequence from structure (protein chains only)
        topology = traj.topology
        
        # Filter for protein residues only and select first protein chain
        protein_residues = []
        for chain in topology.chains:
            chain_residues = [residue for residue in chain.residues if residue.is_protein]
            if chain_residues:  # If this chain has protein residues
                protein_residues = chain_residues
                logger.info(f"Using protein chain {chain.index} with {len(chain_residues)} residues")
                break
        
        if not protein_residues:
            logger.error("No protein residues found in structure")
            return None
        
        ref_residues = [residue.name for residue in protein_residues]
        
        # Convert 3-letter to 1-letter amino acid codes
        aa_map = {
            'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C',
            'GLN': 'Q', 'GLU': 'E', 'GLY': 'G', 'HIS': 'H', 'ILE': 'I',
            'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F', 'PRO': 'P',
            'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'
        }
        
        # Filter out non-standard amino acids
        standard_residues = [aa for aa in ref_residues if aa in aa_map]
        non_standard_count = len(ref_residues) - len(standard_residues)
        
        if non_standard_count > 0:
            logger.warning(f"Filtered out {non_standard_count} non-standard residues")
        
        if len(standard_residues) < 5:
            logger.error("Too few standard amino acids found")
            return None
            
        ref_sequence_1letter = ''.join([aa_map[aa] for aa in standard_residues])
        
        # Compute DSSP for reference structure
        logger.info("Computing DSSP for reference structure...")
        dssp = md.compute_dssp(traj, simplified=True)
        
        # Since this is a single structure, dssp shape is (1, n_residues)
        dssp_assignments = dssp[0]  # Get the single frame
        
        # Convert to fractions (0 or 1 for single structure)
        helix_fraction = (dssp_assignments == 'H').astype(float)
        sheet_fraction = (dssp_assignments == 'E').astype(float)
        coil_fraction = (dssp_assignments == 'C').astype(float)
        
        # Compute basic structural metrics
        rg = md.compute_rg(traj)[0]  # Single value for single structure
        
        # Count secondary structure elements
        helix_count = np.sum(helix_fraction)
        sheet_count = np.sum(sheet_fraction)
        coil_count = np.sum(coil_fraction)
        total_residues = len(dssp_assignments)
        
        analysis_result = {
            'source_type': 'reference',  # Distinguish from MD ensemble
            'n_residues': total_residues,
            'sequence': ref_sequence_1letter,
            'structure_type': 'static',  # Single conformation
            
            # Secondary structure fractions (0 or 1 for each residue)
            'helix_fraction': helix_fraction.tolist(),
            'sheet_fraction': sheet_fraction.tolist(), 
            'coil_fraction': coil_fraction.tolist(),
            
            # DSSP assignments as string
            'dssp_assignments': dssp_assignments.tolist(),
            
            # Summary statistics
            'mean_helix_content': float(helix_count / total_residues),
            'mean_sheet_content': float(sheet_count / total_residues),
            'mean_coil_content': float(coil_count / total_residues),
            
            # No variance for single structure
            'helix_variance': [0.0] * total_residues,
            'sheet_variance': [0.0] * total_residues,
            'coil_variance': [0.0] * total_residues,
            
            # Structural metrics
            'radius_of_gyration': float(rg),
            
            # Structured regions identification
            'structured_regions': _identify_structured_regions(helix_fraction, sheet_fraction),
            
            # Sequence alignment info (if provided)
            'sequence_alignment': None  # Will be added later if sequence provided
        }
        
        # Perform sequence alignment if target sequence provided
        if sequence:
            alignment_info = _align_sequences(sequence, ref_sequence_1letter)
            analysis_result['sequence_alignment'] = alignment_info
        
        logger.info("Reference structure analysis complete")
        return analysis_result
        
    except Exception as e:
        logger.error(f"Reference structure analysis failed: {e}")
        return None
        
    finally:
        # Clean up temporary file
        if pdb_path and os.path.exists(pdb_path):
            try:
                os.unlink(pdb_path)
            except:
                pass


def _identify_structured_regions(helix_fraction: np.ndarray, sheet_fraction: np.ndarray) -> List[Dict[str, Any]]:
    """
    Identify continuous structured regions in reference structure
    """
    regions = []
    current_region = None
    
    for idx, (helix, sheet) in enumerate(zip(helix_fraction, sheet_fraction)):
        dominant_type = None
        if helix > 0.5:
            dominant_type = 'helix'
        elif sheet > 0.5:
            dominant_type = 'sheet'
            
        if dominant_type:
            if current_region and current_region['type'] == dominant_type and idx == current_region['end'] + 1:
                # Extend current region
                current_region['end'] = idx
            else:
                # Start new region
                if current_region:
                    regions.append(current_region)
                current_region = {
                    'type': dominant_type,
                    'start': idx,
                    'end': idx,
                    'id': f"{dominant_type}-{idx}"
                }
        else:
            # Break current region
            if current_region:
                regions.append(current_region)
                current_region = None
    
    if current_region:
        regions.append(current_region)
    
    # Filter short regions
    return [r for r in regions if r['end'] - r['start'] >= 2]


def _align_sequences(sequence1: str, sequence2: str) -> Dict[str, Any]:
    """
    Simple sequence alignment using basic string matching
    For production, should use proper alignment algorithm (Needleman-Wunsch, etc.)
    """
    # Simple implementation - for production use BioPython or similar
    if sequence1 == sequence2:
        return {
            'alignment_type': 'identical',
            'identity': 1.0,
            'gaps': 0,
            'aligned_length': len(sequence1),
            'alignment_mapping': list(range(len(sequence1)))  # 1:1 mapping
        }
    else:
        # Basic similarity calculation
        min_len = min(len(sequence1), len(sequence2))
        matches = sum(1 for i in range(min_len) if sequence1[i] == sequence2[i])
        identity = matches / max(len(sequence1), len(sequence2))
        
        return {
            'alignment_type': 'basic',
            'identity': identity,
            'gaps': abs(len(sequence1) - len(sequence2)),
            'aligned_length': min_len,
            'alignment_mapping': list(range(min_len))  # Simple mapping
        }


def compare_md_with_reference(md_analysis: Dict[str, Any], ref_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare MD ensemble analysis with reference structure analysis
    
    Args:
        md_analysis: MD trajectory analysis results
        ref_analysis: Reference structure analysis results
    
    Returns:
        Comparison analysis
    """
    try:
        # Extract secondary structure data
        md_helix = np.array(md_analysis['secondary_structure_stats']['helix_fraction'])
        md_sheet = np.array(md_analysis['secondary_structure_stats']['sheet_fraction'])
        ref_helix = np.array(ref_analysis['helix_fraction'])
        ref_sheet = np.array(ref_analysis['sheet_fraction'])
        
        # Ensure sequences are aligned (basic check)
        min_len = min(len(md_helix), len(ref_helix))
        md_helix = md_helix[:min_len]
        md_sheet = md_sheet[:min_len]
        ref_helix = ref_helix[:min_len]
        ref_sheet = ref_sheet[:min_len]
        
        # Calculate differences
        helix_diff = md_helix - ref_helix
        sheet_diff = md_sheet - ref_sheet
        
        # Calculate metrics
        helix_rmsd = np.sqrt(np.mean(helix_diff**2))
        sheet_rmsd = np.sqrt(np.mean(sheet_diff**2))
        
        # Identify regions of agreement/disagreement
        helix_agreement = np.abs(helix_diff) < 0.2  # Within 20%
        sheet_agreement = np.abs(sheet_diff) < 0.2
        
        comparison = {
            'sequence_length_comparison': {
                'md_length': len(md_analysis['secondary_structure_stats']['helix_fraction']),
                'ref_length': len(ref_analysis['helix_fraction']),
                'aligned_length': min_len
            },
            'secondary_structure_comparison': {
                'helix_rmsd': float(helix_rmsd),
                'sheet_rmsd': float(sheet_rmsd),
                'helix_differences': helix_diff.tolist(),
                'sheet_differences': sheet_diff.tolist(),
                'helix_agreement': helix_agreement.tolist(),
                'sheet_agreement': sheet_agreement.tolist(),
                'overall_agreement': float(np.mean(helix_agreement & sheet_agreement))
            },
            'summary_statistics': {
                'md_helix_content': float(np.mean(md_helix)),
                'ref_helix_content': float(np.mean(ref_helix)),
                'md_sheet_content': float(np.mean(md_sheet)),
                'ref_sheet_content': float(np.mean(ref_sheet)),
                'helix_content_diff': float(np.mean(md_helix) - np.mean(ref_helix)),
                'sheet_content_diff': float(np.mean(md_sheet) - np.mean(ref_sheet))
            }
        }
        
        logger.info("MD vs Reference comparison complete")
        return comparison
        
    except Exception as e:
        logger.error(f"MD vs Reference comparison failed: {e}")
        return None
