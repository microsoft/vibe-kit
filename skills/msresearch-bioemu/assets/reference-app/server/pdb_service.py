"""
PDB Service Module for BioEmu Research Platform
Provides functionality to fetch sequences and information from PDB entries
"""

import logging
import requests
import re
from tempfile import NamedTemporaryFile
from typing import Optional, Dict, Any, List, Callable
from Bio import SeqIO
from reference_structure_analysis import (
    fetch_pdb_structure,
    analyze_reference_structure
)

logger = logging.getLogger(__name__)


def ignore_auth_chain_name(chain_name: str) -> str:
    """Remove suffix like '[auth A]' from the chain name."""
    m = re.match(r"(\w+)(?:\[.*\])?", chain_name)
    assert m is not None
    return m.group(1)


def sequence_from_fasta(
    fasta_file: str, desc_filter: Optional[Callable[[str], bool]] = None
) -> str:
    """Extracts a single sequence from a FASTA file optionally using a description filter.

    Args:
        fasta_file: Path to the FASTA file.
        desc_filter: A function that takes a sequence description
            and returns True if the sequence should be included. If None, the first sequence is returned.

    Returns:
        The sequence as a string.
    """
    with open(fasta_file) as f:
        seq_generator = SeqIO.parse(f, "fasta")
        descriptions = []
        matches = []
        for seq in seq_generator:
            if desc_filter is None:
                # If no filter is provided, return the first sequence found
                return str(seq.seq)
            if desc_filter(seq.description):
                matches.append(seq.seq)
                descriptions.append(seq.description)
    if not matches:
        raise ValueError(
            f"Found no sequence in FASTA file {fasta_file} that matches the description filter."
            f" Please try with `desc_filter=None`."
        )
    if len(matches) > 1:
        raise ValueError(
            f"Found multiple sequences in FASTA file {fasta_file} that match the description filter."
            f" Matching descriptions: {descriptions}"
        )
    return str(matches[0])


def sequence_from_pdb_id(pdb_id: str, chain_name: Optional[str] = None) -> Optional[str]:
    """
    Extract protein sequence from PDB ID and optional chain using RCSB FASTA API
    
    Args:
        pdb_id: PDB ID (e.g., '1UBQ', '2ABC')
        chain_name: Optional chain identifier (e.g., 'A', 'B').
                   If None, uses first chain
    
    Returns:
        Protein sequence as single-letter amino acid string,
        or None if not found
    """
    try:
        def desc_filter(description: str) -> bool:
            """Filter function to match the chain ID."""
            chainsdesc = description.split("|")[1]
            assert chainsdesc.startswith("Chains ")
            chain_names = [ignore_auth_chain_name(name) for name in chainsdesc[7:].split(", ")]
            return chain_name in chain_names

        url = f"https://www.rcsb.org/fasta/entry/{pdb_id}"
        response = requests.get(url)
        if response.status_code != 200:
            logger.error(f"Failed to fetch FASTA for PDB ID {pdb_id}: HTTP {response.status_code}")
            return None

        with NamedTemporaryFile("w", suffix=".fasta", delete=False) as temp_file:
            temp_file.write(response.text)
            temp_file.flush()
            
            sequence = sequence_from_fasta(
                temp_file.name, 
                desc_filter=desc_filter if chain_name is not None else None
            )
            
            chain_info = f" chain {chain_name}" if chain_name else ""
            logger.info(f"Successfully extracted sequence from PDB {pdb_id}{chain_info}: {len(sequence)} residues")
            return sequence
            
    except Exception as e:
        logger.error(f"Error extracting sequence from PDB {pdb_id}: {e}")
        return None


def get_pdb_info(pdb_id: str) -> Optional[Dict[str, Any]]:
    """
    Get comprehensive information about a PDB entry
    
    Args:
        pdb_id: PDB ID (e.g., '1UBQ')
    
    Returns:
        Dictionary containing PDB information, or None if not found
    """
    try:
        # Fetch basic PDB structure
        pdb_content = fetch_pdb_structure(pdb_id)
        if not pdb_content:
            return None
        
        # Analyze structure to get basic info
        analysis_result = analyze_reference_structure(pdb_content)
        if not analysis_result:
            return None
        
        # Extract metadata from PDB header
        metadata = _extract_pdb_metadata(pdb_content)
        
        # Combine analysis and metadata
        pdb_info = {
            'pdb_id': pdb_id.upper(),
            'sequence': analysis_result['sequence'],
            'n_residues': analysis_result['n_residues'],
            'n_atoms': analysis_result.get('n_atoms', 0),
            'secondary_structure': {
                'helix_content': analysis_result.get('mean_helix_content', 0),
                'sheet_content': analysis_result.get('mean_sheet_content', 0),
                'coil_content': analysis_result.get('mean_coil_content', 0)
            },
            'metadata': metadata,
            'source': 'PDB'
        }
        
        logger.info(f"Successfully retrieved PDB info for {pdb_id}")
        return pdb_info
        
    except Exception as e:
        logger.error(f"Error getting PDB info for {pdb_id}: {e}")
        return None


def _extract_pdb_metadata(pdb_content: str) -> Dict[str, Any]:
    """
    Extract metadata from PDB file header
    
    Args:
        pdb_content: PDB file content as string
    
    Returns:
        Dictionary containing metadata
    """
    metadata = {
        'title': 'Unknown',
        'resolution': None,
        'method': 'Unknown',
        'organism': 'Unknown',
        'chains': []
    }
    
    try:
        lines = pdb_content.split('\n')
        
        for line in lines:
            # Extract title
            if line.startswith('TITLE'):
                if metadata['title'] == 'Unknown':
                    metadata['title'] = line[10:].strip()
                else:
                    metadata['title'] += ' ' + line[10:].strip()
            
            # Extract resolution
            elif line.startswith('REMARK   2 RESOLUTION'):
                try:
                    res_text = line.split()[-2]  # Usually "X.XX ANGSTROMS"
                    metadata['resolution'] = float(res_text)
                except (ValueError, IndexError):
                    pass
            
            # Extract method
            elif line.startswith('EXPDTA'):
                metadata['method'] = line[10:].strip()
            
            # Extract organism
            elif line.startswith('SOURCE') and 'ORGANISM_SCIENTIFIC' in line:
                organism_start = line.find('ORGANISM_SCIENTIFIC:') + 20
                organism_end = line.find(';', organism_start)
                if organism_end == -1:
                    organism_end = len(line)
                metadata['organism'] = line[organism_start:organism_end].strip()
            
            # Extract chain information
            elif line.startswith('ATOM') and line[21:22].strip():
                chain_id = line[21:22]
                if chain_id not in metadata['chains']:
                    metadata['chains'].append(chain_id)
    
    except Exception as e:
        logger.warning(f"Error extracting PDB metadata: {e}")
    
    return metadata


def validate_pdb_id(pdb_id: str) -> bool:
    """
    Validate PDB ID format
    
    Args:
        pdb_id: PDB ID to validate
    
    Returns:
        True if valid format, False otherwise
    """
    if not pdb_id or len(pdb_id) != 4:
        return False
    
    # PDB IDs are 4 characters: 1 digit + 3 alphanumeric
    if not (pdb_id[0].isdigit() and pdb_id[1:].isalnum()):
        return False
    
    return True


def get_available_chains(pdb_id: str) -> List[str]:
    """
    Get list of available chains in a PDB structure
    
    Args:
        pdb_id: PDB ID
    
    Returns:
        List of chain identifiers
    """
    try:
        pdb_content = fetch_pdb_structure(pdb_id)
        if not pdb_content:
            return []
        
        metadata = _extract_pdb_metadata(pdb_content)
        return metadata.get('chains', [])
        
    except Exception as e:
        logger.error(f"Error getting chains for PDB {pdb_id}: {e}")
        return []
