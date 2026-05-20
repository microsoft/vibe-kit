"""
UniProt and AlphaFold Database service for BioEmu Research Platform
Provides functionality to:
1. Fetch protein sequences from UniProt using accession IDs
2. Download AlphaFold predicted structures from AFDB
3. Validate UniProt IDs
"""

import requests
import logging
from typing import Optional, Dict, Any
import re
import time

logger = logging.getLogger(__name__)


def validate_uniprot_id(uniprot_id: str) -> bool:
    """
    Validate UniProt accession format
    UniProt accessions are typically 4-10 characters: [A-Z0-9]{4,10}
    Examples: P0145, P05067, Q9Y6R7, A0A0B4J2F0
    """
    if not uniprot_id:
        return False
    
    # Remove any whitespace
    uniprot_id = uniprot_id.strip().upper()
    
    # Basic format validation - updated to allow 4+ characters
    pattern = r'^[A-Z0-9]{4,10}$'
    return bool(re.match(pattern, uniprot_id))


def get_protein_sequence_from_uniprot(uniprot_id: str) -> Optional[str]:
    """
    Fetch protein sequence from UniProt using the REST API
    
    Args:
        uniprot_id: UniProt accession ID (e.g., 'P05067')
    
    Returns:
        Protein sequence as string, or None if not found/error
    """
    if not validate_uniprot_id(uniprot_id):
        logger.error(f"Invalid UniProt ID format: {uniprot_id}")
        return None
    
    try:
        url = f"https://rest.uniprot.org/uniprotkb/{uniprot_id}?fields=sequence"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'BioEmu-Research-Platform/1.0'
        }
        
        logger.info(f"Fetching sequence for UniProt ID: {uniprot_id}")
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 404:
            logger.warning(f"UniProt ID not found: {uniprot_id}")
            return None
        
        if not response.ok:
            logger.error(f"UniProt API error {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        sequence = data.get('sequence', {}).get('value')
        
        if sequence:
            logger.info(f"Successfully retrieved sequence of length {len(sequence)} for {uniprot_id}")
            return sequence
        else:
            logger.warning(f"No sequence found in UniProt response for {uniprot_id}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error fetching UniProt sequence: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error parsing UniProt response: {str(e)}")
        return None

def get_protein_info_from_uniprot(uniprot_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch comprehensive protein information from UniProt
    
    Args:
        uniprot_id: UniProt accession ID
    
    Returns:
        Dictionary with protein info including name, organism, sequence, etc.
    """
    if not validate_uniprot_id(uniprot_id):
        logger.error(f"Invalid UniProt ID format: {uniprot_id}")
        return None
    
    try:
        # Request multiple fields for comprehensive info
        fields = [
            'accession', 'id', 'protein_name', 'gene_names', 
            'organism_name', 'organism_id', 'length', 'sequence',
            'cc_function', 'ft_domain', 'xref_pdb'
        ]
        fields_param = ','.join(fields)
        
        url = f"https://rest.uniprot.org/uniprotkb/{uniprot_id}?fields={fields_param}"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'BioEmu-Research-Platform/1.0'
        }
        
        logger.info(f"Fetching protein info for UniProt ID: {uniprot_id}")
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 404:
            logger.warning(f"UniProt ID not found: {uniprot_id}")
            return None
        
        if not response.ok:
            logger.error(f"UniProt API error {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        
        # Extract and format the information
        protein_info = {
            'uniprot_id': uniprot_id,
            'accession': data.get('primaryAccession', uniprot_id),
            'entry_name': data.get('uniProtkbId', ''),
            'protein_name': '',
            'gene_names': [],
            'organism': '',
            'organism_id': data.get('organism', {}).get('taxonId'),
            'sequence': data.get('sequence', {}).get('value', ''),
            'length': data.get('sequence', {}).get('length', 0),
            'function': '',
            'domains': [],
            'pdb_structures': []
        }
        
        # Extract protein name
        if 'proteinDescription' in data:
            rec_name = data['proteinDescription'].get('recommendedName')
            if rec_name:
                protein_info['protein_name'] = rec_name.get('fullName', {}).get('value', '')
        
        # Extract gene names
        if 'genes' in data:
            for gene in data['genes']:
                if 'geneName' in gene:
                    protein_info['gene_names'].append(gene['geneName'].get('value', ''))
        
        # Extract organism name
        if 'organism' in data:
            protein_info['organism'] = data['organism'].get('scientificName', '')
        
        # Extract function (first comment if available)
        if 'comments' in data:
            for comment in data['comments']:
                if comment.get('commentType') == 'FUNCTION':
                    for text in comment.get('texts', []):
                        protein_info['function'] = text.get('value', '')
                        break
                    break
        
        # Extract PDB cross-references
        if 'uniProtKBCrossReferences' in data:
            for xref in data['uniProtKBCrossReferences']:
                if xref.get('database') == 'PDB':
                    protein_info['pdb_structures'].append(xref.get('id', ''))
        
        logger.info(f"Successfully retrieved protein info for {uniprot_id}")
        return protein_info
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error fetching UniProt info: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error parsing UniProt info response: {str(e)}")
        return None

def download_afdb_structure(uniprot_id: str) -> Optional[str]:
    """
    Download AlphaFold predicted structure from AFDB and return as PDB string
    
    Args:
        uniprot_id: UniProt accession ID
    
    Returns:
        PDB structure data as string, or None if not available
    """
    if not validate_uniprot_id(uniprot_id):
        logger.error(f"Invalid UniProt ID format: {uniprot_id}")
        return None
    
    try:
        # Get the prediction metadata
        logger.info(f"Checking AlphaFold availability for UniProt ID: {uniprot_id}")
        api_url = f"https://www.alphafold.ebi.ac.uk/api/prediction/{uniprot_id}"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'BioEmu-Research-Platform/1.0'
        }
        
        response = requests.get(api_url, headers=headers, timeout=120)
        
        if response.status_code == 404:
            logger.warning(f"No AlphaFold prediction available for {uniprot_id}")
            return None
        
        if not response.ok:
            logger.error(f"AlphaFold API error {response.status_code}: {response.text}")
            return None
        
        predictions = response.json()
        if not predictions or len(predictions) == 0:
            logger.warning(f"No predictions returned for {uniprot_id}")
            return None
        
        # Get the PDB URL
        prediction = predictions[0]
        pdb_url = prediction.get('pdbUrl')
        
        if not pdb_url:
            logger.warning(f"No PDB URL available for {uniprot_id}")
            return None
        
        # Download the PDB structure
        logger.info(f"Downloading AlphaFold structure from: {pdb_url}")
        pdb_response = requests.get(pdb_url, timeout=180)
        
        if not pdb_response.ok:
            logger.error(f"Failed to download PDB structure: {pdb_response.status_code}")
            return None
        
        pdb_data = pdb_response.text
        logger.info(f"Successfully downloaded AlphaFold structure for {uniprot_id} ({len(pdb_data)} characters)")
        
        return pdb_data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error downloading AlphaFold structure: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error processing AlphaFold structure: {str(e)}")
        return None

def get_uniprot_and_structure_data(uniprot_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch both UniProt protein information and AlphaFold structure
    
    Args:
        uniprot_id: UniProt accession ID
    
    Returns:
        Dictionary containing protein info and structure data
    """
    if not validate_uniprot_id(uniprot_id):
        return None
    
    # Get protein information
    protein_info = get_protein_info_from_uniprot(uniprot_id)
    if not protein_info:
        return None
    
    # Get AlphaFold structure (optional - may not be available)
    structure_data = download_afdb_structure(uniprot_id)
    
    result = {
        'protein_info': protein_info,
        'alphafold_structure': structure_data,
        'has_structure': structure_data is not None
    }
    
    return result
