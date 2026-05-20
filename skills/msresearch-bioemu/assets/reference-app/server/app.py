from flask import Flask, request, jsonify, send_from_directory, send_file
import requests
import os
from flask_cors import CORS
from dotenv import load_dotenv
import logging
import base64
import json
import time
import tempfile
from datetime import datetime
from threading import Lock

# Import UniProt and AlphaFold services
from uniprot_service import (
    get_protein_sequence_from_uniprot,
    get_protein_info_from_uniprot,
    download_afdb_structure,
    get_uniprot_and_structure_data,
    validate_uniprot_id
)

# Add reference structure analysis import
from reference_structure_analysis import (
    analyze_reference_structure,
    fetch_pdb_structure,
    compare_md_with_reference
)

# Import PDB service
from pdb_service import (
    sequence_from_pdb_id,
    get_pdb_info,
    validate_pdb_id,
    get_available_chains
)

# Import copilot service
from copilot_service import get_copilot_response

from sequence_screening import screen_sequence

# Configure comprehensive logging for BioEmu API tracking
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def log_bioemu_info(message):
    logger.info(f"BIOEMU: {message}")

def log_bioemu_error(message):
    logger.error(f"BIOEMU: {message}")

def log_bioemu_success(message):
    logger.info(f"BIOEMU: {message}")

def log_bioemu_data(title, data, max_length=100):
    logger.debug(f"BIOEMU {title}: {str(data)[:max_length]}")

def log_bioemu_timing(operation, start_time, end_time):
    duration = end_time - start_time
    logger.info(f"BIOEMU {operation}: {duration:.2f}s")

def print_separator():
    pass  # No-op in production

# Load environment variables from .env file
load_dotenv()

# Optional sequence alignment function using BioPython
def perform_sequence_alignment_superposition(bioemu_pdb_data, bioemu_xtc_data, alphafold_pdb_data, temp_dir):
    """
    Perform sequence-aligned superposition using BioPython for sequence alignment and MDTraj for superposition.
    Falls back to simple superposition if sequence alignment fails.
    
    Returns: (success, result_data, error_message)
    """
    try:
        # Import BioPython for sequence alignment
        from Bio import pairwise2
        import mdtraj as md
        import os
        
        log_bioemu_info("Starting sequence-aligned superposition...")
        
        # Write files to temp directory
        alphafold_path = os.path.join(temp_dir, "alphafold_ref.pdb")
        bioemu_pdb_path = os.path.join(temp_dir, "bioemu.pdb")
        bioemu_xtc_path = os.path.join(temp_dir, "bioemu.xtc")
        
        with open(alphafold_path, 'wb') as f:
            f.write(alphafold_pdb_data)
        with open(bioemu_pdb_path, 'wb') as f:
            f.write(bioemu_pdb_data)
        with open(bioemu_xtc_path, 'wb') as f:
            f.write(bioemu_xtc_data)
        
        # Load structures
        alphafold_traj = md.load(alphafold_path)
        bioemu_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)
        
        # Extract sequences from both structures
        alphafold_sequence = ''.join([res.name for res in alphafold_traj.topology.residues])
        bioemu_sequence = ''.join([res.name for res in bioemu_traj.topology.residues])
        
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
            if af_char != '-' and bioemu_char != '-':
                af_residue_indices.append(af_res_idx)
                bioemu_residue_indices.append(bioemu_res_idx)
            
            # Advance position counters if not gap
            if af_char != '-':
                af_res_idx += 1
            if bioemu_char != '-':
                bioemu_res_idx += 1
        
        log_bioemu_info(f"Aligned residues: {len(af_residue_indices)} pairs")
        
        if len(af_residue_indices) < 3:
            return False, None, f"Too few aligned residues for superposition: {len(af_residue_indices)}"
        
        # Select backbone atoms from aligned residues only
        af_aligned_atoms = []
        bioemu_aligned_atoms = []
        
        for af_res_idx, bioemu_res_idx in zip(af_residue_indices, bioemu_residue_indices):
            # Get backbone atoms for this residue pair
            af_res_atoms = [atom.index for atom in alphafold_traj.topology.residue(af_res_idx).atoms if atom.name in ['N', 'CA', 'C', 'O']]
            bioemu_res_atoms = [atom.index for atom in bioemu_traj.topology.residue(bioemu_res_idx).atoms if atom.name in ['N', 'CA', 'C', 'O']]
            
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
        superposed_xtc_path = os.path.join(temp_dir, "superposed_trajectory_aligned.xtc")
        bioemu_traj.save(superposed_xtc_path)
        
        # Read back and encode
        with open(superposed_xtc_path, 'rb') as f:
            superposed_xtc_data = f.read()
        
        superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode('utf-8')
        
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
                "sequence_identity": len(af_residue_indices) / max(len(alphafold_sequence), len(bioemu_sequence))
            },
            "method": "Sequence-aligned superposition (BioPython + MDTraj)"
        }
        
        log_bioemu_success(f"Sequence-aligned superposition completed - RMSD: {avg_rmsd:.3f}Å, {len(af_residue_indices)} aligned residues")
        return True, result_data, None
        
    except ImportError as e:
        return False, None, "Sequence alignment tools not available"
    except Exception as e:
        return False, None, "Sequence alignment failed"

# Configure Flask to use React build directory for static files
build_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')
build_dir = os.path.abspath(build_dir)

app = Flask(__name__, 
            static_folder=os.path.join(build_dir, 'static'),
            static_url_path='/static')
CORS(app, origins=['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3020', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3020'])  # Enable CORS for React dev servers

# ── Security headers: allow iframe embedding from configured origin only ──
# Set LABS_FRONT_DOOR env var to enable iframe embedding from a specific origin.
#
# @app.after_request
# def set_security_headers(response):
#     front_door = os.environ.get('LABS_FRONT_DOOR')
#     if front_door:
#         response.headers['Content-Security-Policy'] = f"frame-ancestors 'self' {front_door}"
#     response.headers['X-Content-Type-Options'] = 'nosniff'
#     response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
#     return response

# Get API credentials from environment variables
API_ENDPOINT = os.getenv("AZURE_BIOEMU_ENDPOINT")
API_KEY = os.getenv("AZURE_BIOEMU_KEY")

# Add: Cache for last API status check
api_status_cache = {
    'status': None,
    'message': None,
    'last_checked': 0
}
api_status_lock = Lock()
API_STATUS_CACHE_SECONDS = 300  # 5 minutes

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    log_bioemu_info("Health check requested")
    return jsonify({"status": "healthy", "message": "BioEmu API proxy is running"}), 200


# --- API STATUS ENDPOINT (DISABLED FOR TESTING) ---
# To re-enable, restore the original implementation below
@app.route('/api/status', methods=['GET'])
def check_api_status():
    # API status check temporarily disabled to avoid overloading the backend during testing.
    return jsonify({
        "status": "connected",
        "message": "API status check is disabled for testing. Always returns 'connected'."
    }), 200


@app.route('/api/predict', methods=['POST'])
def predict_protein():
    """Proxy endpoint for Azure BioEmu API protein structure prediction"""
    print_separator()
    log_bioemu_info("=== BIOEMU API PREDICTION REQUEST START ===")
    start_time = time.time()
    
    if not API_ENDPOINT or not API_KEY:
        log_bioemu_error("Missing API credentials!")
        return jsonify({
            "status": "failed",
            "message": "Missing API credentials"
        }), 500

    try:
        data = request.json
        sequence = data.get('sequence', '').strip().upper()
        num_samples = data.get('numSamples', 10)

        # ── Input validation (T15, T16) ──
        if not sequence:
            return jsonify({
                "status": "failed",
                "message": "Missing protein sequence"
            }), 400

        if len(sequence) > 2000:
            return jsonify({
                "status": "failed",
                "message": "Sequence too long (max 2000 residues)"
            }), 400

        import re
        if not re.match(r'^[ACDEFGHIKLMNPQRSTVWY]+$', sequence):
            return jsonify({
                "status": "failed",
                "message": "Invalid sequence: only standard amino acid characters allowed"
            }), 400

        num_samples = max(1, min(int(num_samples), 50))

        # ── Safety screening: block Select Agent toxin sequences (T33, T34) ──
        block_reason = screen_sequence(sequence)
        if block_reason is not None:
            logger.warning(
                "SECURITY_BLOCK: endpoint=/api/predict reason=%s seq_len=%d",
                block_reason, len(sequence)
            )
            return jsonify({
                "status": "failed",
                "message": "This sequence cannot be processed."
            }), 403

        log_bioemu_info(
            f"Processing prediction for sequence of length {len(sequence)}"
        )
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        }

        payload = {
            'input_data': {
                'sequence': sequence,
                'num_samples': num_samples
            }
        }

        logger.info("Calling Azure BioEmu API")
        logger.debug(f"Endpoint: {API_ENDPOINT}")
        log_bioemu_data("Request payload structure", payload)
        log_bioemu_info("Sending request to Azure BioEmu API...")

        api_start_time = time.time()
        response = requests.post(API_ENDPOINT, headers=headers, json=payload, timeout=900)
        api_end_time = time.time()

        logger.info(f"Response status: {response.status_code}")
        log_bioemu_timing("API Response Time", api_start_time, api_end_time)

        if not response.ok:
            log_bioemu_error(
                f"API request failed with status {response.status_code}"
            )
            log_bioemu_data("Error response", response.text, max_length=200)
            if response.status_code == 429:
                return jsonify({
                    "status": "failed",
                    "message": "This is an experimental site and we're experiencing high demand. Try the polyubiquitin demo while you wait, or try again in a few minutes."
                }), 429
            return jsonify({
                "status": "failed",
                "message": "Prediction service is temporarily unavailable. You can still explore the polyubiquitin demo with cached data, or try again shortly."
            }), 503

        try:
            result = response.json()
            logger.info("Response received and parsed")
            
            # Enhanced result logging
            if isinstance(result, dict):
                keys = list(result.keys())
                logger.debug(f"Response keys: {keys}")
                log_bioemu_data("Response structure", result, max_length=300)
            else:
                logger.debug(f"Response type: {type(result)}")
            
            log_bioemu_success("API request completed successfully!")

            if "status" in result and result["status"] != "success":
                log_bioemu_error(
                    f"API returned error: {result.get('message', 'Unknown error')}"
                )
                return jsonify({
                    "status": "failed",
                    "message": result.get("message", "Unknown API error")
                }), 500

            # Enhanced data flow tracking
            if "results" in result:
                logger.debug("Results structure found in response")
                results_data = result["results"]
                if isinstance(results_data, list) and len(results_data) > 0:
                    logger.debug(f"Results array contains {len(results_data)} items")
                    if isinstance(results_data[0], dict):
                        first_keys = list(results_data[0].keys())
                        logger.debug(f"First result keys: {first_keys}")
                        
                        # Check for specific molecular data
                        if 'pdb_data' in results_data[0]:
                            pdb_length = len(results_data[0]['pdb_data'])
                            logger.debug(f"PDB data found: {pdb_length} characters")
                        if 'xtc_data' in results_data[0]:
                            xtc_length = len(results_data[0]['xtc_data'])
                            logger.debug(f"XTC data found: {xtc_length} characters")
                            
                log_bioemu_success("Returning structured results to frontend")
                end_time = time.time()
                log_bioemu_timing("Total Prediction Request", start_time, end_time)
                return jsonify({"status": "success", "results": result["results"]})
            else:
                logger.debug("Raw response being returned")
                log_bioemu_success("Returning raw response to frontend")
                end_time = time.time()
                log_bioemu_timing("Total Prediction Request", start_time, end_time)
                return jsonify({"status": "success", "results": result})

        except Exception as e:
            log_bioemu_error(f"Error parsing API response: {str(e)}")
            log_bioemu_data("Raw response", response.text, max_length=200)
            return jsonify({
                "status": "failed",
                "message": "Prediction service error"
            }), 500

    except Exception as e:
        log_bioemu_error(f"Prediction request failed: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "An error occurred processing your request"
        }), 500
    finally:
        print_separator()
        log_bioemu_info("=== BIOEMU API PREDICTION REQUEST END ===")


@app.route('/api/predict-uniprot', methods=['POST'])
def predict_protein_from_uniprot():
    """Enhanced endpoint that accepts either UniProt ID or sequence for prediction"""
    print_separator()
    log_bioemu_info("=== BIOEMU UNIPROT PREDICTION REQUEST START ===")
    start_time = time.time()
    
    if not API_ENDPOINT or not API_KEY:
        log_bioemu_error("Missing API credentials!")
        return jsonify({
            "status": "failed",
            "message": "Missing API credentials"
        }), 500

    try:
        data = request.json
        uniprot_id = data.get('uniprot_id')
        sequence = data.get('sequence')
        num_samples = data.get('numSamples', 10)
        include_alphafold = data.get('include_alphafold', True)

        # Validate input - need either UniProt ID or sequence
        if not uniprot_id and not sequence:
            log_bioemu_error("Missing both UniProt ID and sequence!")
            return jsonify({
                "status": "failed",
                "message": "Either uniprot_id or sequence must be provided"
            }), 400

        # If UniProt ID is provided, fetch the sequence and info
        protein_info = None
        alphafold_structure = None
        
        if uniprot_id:
            log_bioemu_info(f"Processing UniProt ID: {uniprot_id}")
            
            # Validate UniProt ID format
            if not validate_uniprot_id(uniprot_id):
                log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
                return jsonify({
                    "status": "failed",
                    "message": f"Invalid UniProt ID format: {uniprot_id}"
                }), 400
            
            # Get protein sequence from UniProt
            uniprot_sequence = get_protein_sequence_from_uniprot(uniprot_id)
            if not uniprot_sequence:
                error_msg = f"Could not retrieve sequence for UniProt ID: {uniprot_id}"
                log_bioemu_error(error_msg)
                return jsonify({
                    "status": "failed",
                    "message": f"UniProt ID not found or inaccessible: {uniprot_id}"
                }), 404
            
            # Use UniProt sequence (override provided sequence if both given)
            sequence = uniprot_sequence
            log_bioemu_success(f"Retrieved sequence from UniProt ID {uniprot_id}")
            
            # Get additional protein information
            protein_info = get_protein_info_from_uniprot(uniprot_id)
            log_bioemu_data("Protein info", protein_info)
            
            # Optionally fetch AlphaFold structure
            if include_alphafold:
                log_bioemu_info("Fetching AlphaFold structure...")
                alphafold_structure = download_afdb_structure(uniprot_id)
                if alphafold_structure:
                    log_bioemu_success("AlphaFold structure retrieved")
                    log_bioemu_data("AlphaFold PDB", alphafold_structure, max_length=100)
                else:
                    log_bioemu_info("No AlphaFold structure available")

        # ── Input validation (T15, T16) ──
        sequence = sequence.strip().upper() if sequence else ""
        if not sequence:
            return jsonify({
                "status": "failed",
                "message": "No valid protein sequence could be obtained"
            }), 400

        if len(sequence) > 2000:
            return jsonify({
                "status": "failed",
                "message": "Sequence too long (max 2000 residues)"
            }), 400

        import re
        if not re.match(r'^[ACDEFGHIKLMNPQRSTVWY]+$', sequence):
            return jsonify({
                "status": "failed",
                "message": "Invalid sequence: only standard amino acid characters allowed"
            }), 400

        num_samples = max(1, min(int(num_samples), 50))

        # ── Safety screening: block Select Agent toxin sequences (T33, T34) ──
        block_reason = screen_sequence(sequence)
        if block_reason is not None:
            logger.warning(
                "SECURITY_BLOCK: endpoint=/api/predict-uniprot reason=%s seq_len=%d",
                block_reason, len(sequence)
            )
            return jsonify({
                "status": "failed",
                "message": "This sequence cannot be processed."
            }), 403

        # Enhanced logging for visibility
        log_bioemu_data("Final sequence for prediction", sequence, max_length=80)
        logger.debug(f"Number of samples: {num_samples}")
        logger.debug(f"Sequence length: {len(sequence)}")
        log_bioemu_info(f"Processing prediction for sequence of length {len(sequence)}")
        
        # Prepare API request
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        }

        payload = {
            'input_data': {
                'sequence': sequence,
                'num_samples': num_samples
            }
        }

        logger.info("Calling Azure BioEmu API")
        logger.debug(f"Endpoint: {API_ENDPOINT}")
        log_bioemu_data("Request payload structure", payload)
        log_bioemu_info("Sending request to Azure BioEmu API...")

        # Make API request
        api_start_time = time.time()
        response = requests.post(API_ENDPOINT, headers=headers, json=payload, timeout=900)
        api_end_time = time.time()

        logger.info(f"Response status: {response.status_code}")
        log_bioemu_timing("API Response Time", api_start_time, api_end_time)

        if not response.ok:
            error_msg = f"API request failed with status {response.status_code}"
            log_bioemu_error(error_msg)
            log_bioemu_data("Error response", response.text, max_length=200)
            if response.status_code == 429:
                return jsonify({
                    "status": "failed",
                    "message": "This is an experimental site and we're experiencing high demand. Try the polyubiquitin demo while you wait, or try again in a few minutes."
                }), 429
            return jsonify({
                "status": "failed",
                "message": "Prediction service is temporarily unavailable. You can still explore the polyubiquitin demo with cached data, or try again shortly."
            }), 503

        try:
            result = response.json()
            logger.info("Response received and parsed")
            
            # Enhanced result logging
            if isinstance(result, dict):
                keys = list(result.keys())
                logger.debug(f"Response keys: {keys}")
                log_bioemu_data("Response structure", result, max_length=300)
            else:
                logger.debug(f"Response type: {type(result)}")
            
            log_bioemu_success("API request completed successfully!")

            if "status" in result and result["status"] != "success":
                error_msg = f"API returned error: {result.get('message', 'Unknown error')}"
                log_bioemu_error(error_msg)
                return jsonify({
                    "status": "failed",
                    "message": result.get("message", "Unknown API error")
                }), 500

            # Prepare enhanced response with UniProt data
            enhanced_response = {
                "status": "success",
                "results": result.get("results", result),
                "source_info": {
                    "input_type": "uniprot_id" if uniprot_id else "sequence",
                    "sequence_length": len(sequence)
                }
            }
            
            # Add UniProt-specific information if available
            if uniprot_id:
                enhanced_response["uniprot_data"] = {
                    "uniprot_id": uniprot_id,
                    "protein_info": protein_info,
                    "has_alphafold": alphafold_structure is not None
                }
                
                # Include AlphaFold structure if requested and available
                if alphafold_structure and include_alphafold:
                    enhanced_response["alphafold_structure"] = alphafold_structure

            log_bioemu_success("Returning enhanced results with UniProt data to frontend")
            end_time = time.time()
            log_bioemu_timing("Total UniProt Prediction Request", start_time, end_time)
            
            return jsonify(enhanced_response)

        except Exception as e:
            log_bioemu_error(f"Error parsing API response: {str(e)}")
            log_bioemu_data("Raw response", response.text, max_length=200)
            return jsonify({
                "status": "failed",
                "message": "Prediction service error"
            }), 500

    except Exception as e:
        log_bioemu_error(f"UniProt prediction request failed: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "An error occurred processing your request"
        }), 500
    finally:
        print_separator()
        log_bioemu_info("=== BIOEMU UNIPROT PREDICTION REQUEST END ===")


@app.route('/api/uniprot-info/<uniprot_id>', methods=['GET'])
def get_uniprot_info_endpoint(uniprot_id):
    """Get protein information from UniProt without running prediction"""
    log_bioemu_info(f"=== UNIPROT INFO REQUEST: {uniprot_id} ===")
    
    try:
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid UniProt ID format: {uniprot_id}"
            }), 400
        
        # Get protein information
        protein_info = get_protein_info_from_uniprot(uniprot_id)
        if not protein_info:
            log_bioemu_error(f"UniProt ID not found: {uniprot_id}")
            return jsonify({
                "status": "failed",
                "message": f"UniProt ID not found: {uniprot_id}"
            }), 404
        
        # Check if AlphaFold structure is available (quick check)
        log_bioemu_info("Checking AlphaFold availability...")
        alphafold_structure = download_afdb_structure(uniprot_id)
        alphafold_available = alphafold_structure is not None
        
        response_data = {
            "status": "success",
            "protein_info": protein_info,
            "alphafold_available": alphafold_available
        }
        
        log_bioemu_success(f"Retrieved info for UniProt ID: {uniprot_id}")
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching UniProt info: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching protein information. Please try again."
        }), 500


@app.route('/api/alphafold-structure/<uniprot_id>', methods=['GET'])
def get_alphafold_structure_endpoint(uniprot_id):
    """Get AlphaFold structure for a UniProt ID"""
    log_bioemu_info(f"=== ALPHAFOLD STRUCTURE REQUEST: {uniprot_id} ===")
    
    try:
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid UniProt ID format: {uniprot_id}"
            }), 400
        
        # Download AlphaFold structure
        structure_data = download_afdb_structure(uniprot_id)
        if not structure_data:
            error_msg = f"AlphaFold structure unavailable for: {uniprot_id}"
            log_bioemu_error(error_msg)
            
            # Check if this is likely an API outage vs missing protein
            # Try a quick test with a well-known protein to detect API issues
            api_status_msg = ""
            try:
                import requests
                test_response = requests.get("https://www.alphafold.ebi.ac.uk/api/prediction/P04637", timeout=10)
                if test_response.status_code >= 500:
                    api_status_msg = " ⚠️ AlphaFold EBI API appears to be experiencing server issues (returning 500 errors). This is a temporary infrastructure problem, not an issue with your protein or our code. Please try again later."
                    log_bioemu_error("AlphaFold EBI API is returning 500 Internal Server Error - API outage detected")
                elif test_response.status_code == 404:
                    api_status_msg = f" This protein may not be available in the AlphaFold database."
                else:
                    api_status_msg = f" There may be a connectivity issue or this protein is not in AlphaFold database."
            except:
                api_status_msg = " Unable to verify AlphaFold API status due to network issues."
            
            return jsonify({
                "status": "failed",
                "message": f"AlphaFold structure unavailable for UniProt ID: {uniprot_id}.{api_status_msg}",
                "error_code": "ALPHAFOLD_UNAVAILABLE", 
                "uniprot_id": uniprot_id,
                "api_status": "unknown",
                "suggested_alternatives": ["P04637", "P02768", "P01308"] if "server issues" not in api_status_msg else []
            }), 503 if "server issues" in api_status_msg else 404
        
        response_data = {
            "status": "success",
            "uniprot_id": uniprot_id,
            "structure_data": structure_data,
            "structure_format": "pdb",
            "source": "alphafold"
        }
        
        log_bioemu_success(f"Retrieved AlphaFold structure for: {uniprot_id}")
        log_bioemu_data("Structure data", structure_data, max_length=100)
        
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching AlphaFold structure: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching AlphaFold structure. Please try again."
        }), 500


@app.route('/api/alphafold-structure', methods=['POST'])
def get_alphafold_structure_post_endpoint():
    """Get AlphaFold structure for a UniProt ID via POST request"""
    log_bioemu_info("=== ALPHAFOLD STRUCTURE REQUEST (POST) ===")
    
    try:
        data = request.get_json()
        if not data or 'uniprot_id' not in data:
            return jsonify({
                "status": "failed",
                "message": "Missing uniprot_id in request body"
            }), 400
        
        uniprot_id = data['uniprot_id'].strip().upper()
        log_bioemu_info(f"Fetching AlphaFold structure for: {uniprot_id}")
        
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            log_bioemu_error(f"Invalid UniProt ID format: {uniprot_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid UniProt ID format: {uniprot_id}"
            }), 400
        
        # Download AlphaFold structure
        structure_data = download_afdb_structure(uniprot_id)
        if not structure_data:
            error_msg = f"AlphaFold structure unavailable for: {uniprot_id}"
            log_bioemu_error(error_msg)
            
            return jsonify({
                "status": "failed",
                "message": f"AlphaFold structure unavailable for UniProt ID: {uniprot_id}. This protein may not be available in the AlphaFold database.",
                "error_code": "ALPHAFOLD_UNAVAILABLE", 
                "uniprot_id": uniprot_id
            }), 404
        
        response_data = {
            "status": "success",
            "uniprot_id": uniprot_id,
            "pdb_content": structure_data,
            "structure_format": "pdb",
            "source": "alphafold"
        }
        
        log_bioemu_success(f"Retrieved AlphaFold structure for: {uniprot_id}")
        log_bioemu_data("Structure data", structure_data, max_length=100)
        
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching AlphaFold structure: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching AlphaFold structure. Please try again."
        }), 500


# ==================== PDB ENDPOINTS ====================

@app.route('/api/pdb-sequence/<pdb_id>', methods=['GET'])
def get_pdb_sequence_endpoint(pdb_id):
    """Get protein sequence from PDB ID"""
    log_bioemu_info(f"=== PDB SEQUENCE REQUEST: {pdb_id} ===")
    
    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)"
            }), 400
        
        # Get optional chain parameter
        chain_id = request.args.get('chain', None)
        
        # Extract sequence from PDB
        sequence = sequence_from_pdb_id(pdb_id, chain_id)
        if not sequence:
            error_msg = f"Could not extract sequence from PDB: {pdb_id}"
            if chain_id:
                error_msg += f" (chain: {chain_id})"
            log_bioemu_error(error_msg)
            return jsonify({
                "status": "failed",
                "message": error_msg,
                "error_code": "PDB_SEQUENCE_UNAVAILABLE",
                "pdb_id": pdb_id,
                "chain_id": chain_id
            }), 404
        
        response_data = {
            "status": "success",
            "pdb_id": pdb_id.upper(),
            "chain_id": chain_id,
            "sequence": sequence,
            "sequence_length": len(sequence),
            "source": "PDB"
        }
        
        log_bioemu_success(f"Retrieved sequence from PDB: {pdb_id} (length: {len(sequence)})")
        
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching PDB sequence: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching PDB data. Please try again."
        }), 500


@app.route('/api/pdb-info/<pdb_id>', methods=['GET'])
def get_pdb_info_endpoint(pdb_id):
    """Get comprehensive information about a PDB entry"""
    log_bioemu_info(f"=== PDB INFO REQUEST: {pdb_id} ===")
    
    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)"
            }), 400
        
        # Get PDB information
        pdb_info = get_pdb_info(pdb_id)
        if not pdb_info:
            error_msg = f"Could not retrieve information for PDB: {pdb_id}"
            log_bioemu_error(error_msg)
            return jsonify({
                "status": "failed",
                "message": error_msg,
                "error_code": "PDB_INFO_UNAVAILABLE",
                "pdb_id": pdb_id
            }), 404
        
        response_data = {
            "status": "success",
            **pdb_info
        }
        
        log_bioemu_success(f"Retrieved PDB info for: {pdb_id}")
        log_bioemu_data("PDB info", pdb_info, max_length=100)
        
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching PDB info: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching PDB data. Please try again."
        }), 500


@app.route('/api/pdb-chains/<pdb_id>', methods=['GET'])
def get_pdb_chains_endpoint(pdb_id):
    """Get available chains in a PDB structure"""
    log_bioemu_info(f"=== PDB CHAINS REQUEST: {pdb_id} ===")
    
    try:
        # Validate PDB ID format
        if not validate_pdb_id(pdb_id):
            log_bioemu_error(f"Invalid PDB ID format: {pdb_id}")
            return jsonify({
                "status": "failed",
                "message": f"Invalid PDB ID format: {pdb_id}. Expected format: 4 characters (e.g., 1UBQ)"
            }), 400
        
        # Get available chains
        chains = get_available_chains(pdb_id)
        
        response_data = {
            "status": "success",
            "pdb_id": pdb_id.upper(),
            "chains": chains,
            "chain_count": len(chains)
        }
        
        log_bioemu_success(f"Retrieved chains for PDB: {pdb_id} - {len(chains)} chains")
        
        return jsonify(response_data)
        
    except Exception as e:
        log_bioemu_error(f"Error fetching PDB chains: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching PDB data. Please try again."
        }), 500


# ==================== TRAJECTORY ANALYSIS ====================

@app.route('/api/analyze-trajectory', methods=['POST'])
def analyze_trajectory_endpoint():
    """Trajectory analysis using MDTraj - NO FALLBACKS"""
    try:
        data = request.json
        if not data or 'pdb' not in data or 'xtc' not in data:
            return jsonify({
                "status": "failed", 
                "message": "Missing PDB or XTC data"
            }), 400

        logger.info("Starting trajectory analysis...")

        try:
            pdb_data = base64.b64decode(data['pdb'])
            xtc_data = base64.b64decode(data['xtc'])
        except Exception as e:
            logger.error(f"Failed to decode trajectory data: {str(e)}")
            return jsonify({
                "status": "failed",
                "message": "Invalid data format."
            }), 400
        
        #  Trajectory analysis ONLY - NO FALLBACKS
        try:
            from trajectory_analysis_real import analyze_trajectory
            analysis_result = analyze_trajectory(pdb_data, xtc_data)

            logger.info("Trajectory analysis completed successfully")
            return jsonify({
                "status": "success",
                "analysis": analysis_result,
                "data_source": "real_trajectory_mdtraj"
            })
            
        except ImportError as e:
            logger.error(f"MDTraj dependencies not available: {str(e)}")
            return jsonify({
                "status": "failed",
                "message": "Analysis tools not available. Please try again later."
            }), 500
        except Exception as e:
            logger.error(f"Trajectory analysis failed: {str(e)}")
            return jsonify({
                "status": "failed",
                "message": "Trajectory analysis error. Please try again."
            }), 500
            
    except Exception as e:
        logger.error(f"Trajectory analysis endpoint failed: {str(e)}")
        return jsonify({
            "status": "failed", 
            "message": "Analysis error. Please try again."
        }), 500


@app.route('/api/energy-landscape', methods=['POST'])
def energy_landscape_endpoint():
    """Energy landscape analysis using PCA on CA-CA contacts"""
    try:
        data = request.json
        if not data or 'pdb' not in data or 'xtc' not in data:
            return jsonify({
                "status": "failed", 
                "message": "Missing PDB or XTC data"
            }), 400

        log_bioemu_info("=== ENERGY LANDSCAPE ANALYSIS START ===")
        start_time = time.time()

        # Decode the same BioEmu data used for visualization
        pdb_data = base64.b64decode(data['pdb'])
        xtc_data = base64.b64decode(data['xtc'])
        
        log_bioemu_data("Energy landscape input", {
            'pdb_size': len(pdb_data),
            'xtc_size': len(xtc_data)
        })

        # Import and compute energy landscape using MDTraj
        try:
            from energy_landscape_analysis import compute_energy_landscape, compute_free_energy_surface
            landscape_results = compute_energy_landscape(pdb_data, xtc_data)
            
            # Optionally compute free energy surface
            include_surface = data.get('include_surface', True)
            if include_surface and 'pc1_coords' in landscape_results and 'pc2_coords' in landscape_results:
                surface_data = compute_free_energy_surface(
                    landscape_results['pc1_coords'], 
                    landscape_results['pc2_coords']
                )
                if surface_data:
                    landscape_results['free_energy_surface'] = surface_data
        except ImportError as e:
            log_bioemu_error(f"Failed to import energy landscape module: {str(e)}")
            return jsonify({
                "status": "failed",
                "message": "Analysis tools not available. Please try again later."
            }), 500

        end_time = time.time()
        log_bioemu_timing("Energy Landscape Analysis", start_time, end_time)
        log_bioemu_success("Energy landscape analysis completed successfully")

        return jsonify({
            "status": "success",
            "landscape_data": landscape_results
        })

    except Exception as e:
        log_bioemu_error(f"Energy landscape analysis failed: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Analysis error. Please try again."
        }), 500
    finally:
        print_separator()
        log_bioemu_info("=== ENERGY LANDSCAPE ANALYSIS END ===")


@app.route('/api/superpose-structures', methods=['POST'])
def superpose_structures():
    """Superpose BioEmu trajectory onto AlphaFold reference structure"""
    try:
        data = request.json
        if not data or 'bioemu_pdb' not in data or 'bioemu_xtc' not in data or 'alphafold_pdb' not in data:
            return jsonify({
                "status": "failed", 
                "message": "Missing BioEmu trajectory data (pdb, xtc) or AlphaFold reference structure"
            }), 400

        log_bioemu_info("=== STRUCTURAL SUPERPOSITION START ===")
        start_time = time.time()

        # Decode input data
        bioemu_pdb_data = base64.b64decode(data['bioemu_pdb'])
        bioemu_xtc_data = base64.b64decode(data['bioemu_xtc'])
        alphafold_pdb_data = base64.b64decode(data['alphafold_pdb'])
        
        # Check if sequence alignment is requested
        use_sequence_alignment = data.get('use_sequence_alignment', False)
        
        log_bioemu_data("Superposition input", {
            'bioemu_pdb_size': len(bioemu_pdb_data),
            'bioemu_xtc_size': len(bioemu_xtc_data),
            'alphafold_pdb_size': len(alphafold_pdb_data),
            'use_sequence_alignment': use_sequence_alignment
        })

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
                    success, result_data, error_msg = perform_sequence_alignment_superposition(
                        bioemu_pdb_data, bioemu_xtc_data, alphafold_pdb_data, temp_dir
                    )
                    
                    if success:
                        elapsed = time.time() - start_time
                        result_data["processing_time"] = round(elapsed, 2)
                        return jsonify({
                            "status": "success",
                            **result_data
                        })
                    else:
                        log_bioemu_error(f"Sequence alignment failed: {error_msg}")
                        log_bioemu_info("Falling back to simple superposition...")
                
                # Fallback to simple superposition (original working method)
                log_bioemu_info("Performing simple backbone+CB superposition...")
                
                # Write AlphaFold reference structure
                alphafold_path = os.path.join(temp_dir, "alphafold_ref.pdb")
                with open(alphafold_path, 'wb') as f:
                    f.write(alphafold_pdb_data)
                
                # Write BioEmu trajectory files
                bioemu_pdb_path = os.path.join(temp_dir, "bioemu.pdb")
                bioemu_xtc_path = os.path.join(temp_dir, "bioemu.xtc")
                
                with open(bioemu_pdb_path, 'wb') as f:
                    f.write(bioemu_pdb_data)
                with open(bioemu_xtc_path, 'wb') as f:
                    f.write(bioemu_xtc_data)
                
                log_bioemu_info("Loading reference structure (AlphaFold)...")
                # Load AlphaFold reference structure
                ref = md.load(alphafold_path)
                
                # Select backbone + CB atoms for superposition
                backbone_ind = ref.topology.select("backbone or name CB")
                reference_traj = ref.atom_slice(backbone_ind)
                
                log_bioemu_info(f"Reference structure: {ref.n_atoms} atoms, {len(backbone_ind)} atoms for superposition")
                
                log_bioemu_info("Loading BioEmu trajectory...")
                # Load BioEmu trajectory
                sample_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)
                
                log_bioemu_info(f"BioEmu trajectory: {sample_traj.n_frames} frames, {sample_traj.n_atoms} atoms")
                
                # Select corresponding atoms in BioEmu trajectory
                try:
                    bioemu_ind = sample_traj.topology.select("backbone or name CB")
                    sample_traj_selected = sample_traj.atom_slice(bioemu_ind)
                    
                    log_bioemu_info(f"BioEmu atoms for superposition: {len(bioemu_ind)}")
                    
                    # Check atom count compatibility
                    if reference_traj.n_atoms != sample_traj_selected.n_atoms:
                        return jsonify({
                            "status": "failed",
                            "message": f"Cannot superpose: atom count mismatch (AlphaFold: {reference_traj.n_atoms}, BioEmu: {sample_traj_selected.n_atoms})"
                        }), 400
                    
                    log_bioemu_info("Performing structural superposition...")
                    # Perform superposition
                    sample_traj_selected.superpose(reference_traj)
                    
                    # Create superposed full trajectory by applying same transformation
                    log_bioemu_info("Applying transformation to full trajectory...")
                    sample_traj.superpose(reference_traj, atom_indices=bioemu_ind)
                    
                    log_bioemu_info("Saving superposed trajectory...")
                    # Save superposed trajectory
                    superposed_xtc_path = os.path.join(temp_dir, "superposed_trajectory.xtc")
                    sample_traj.save(superposed_xtc_path)
                    
                    # Read superposed trajectory back as binary data
                    with open(superposed_xtc_path, 'rb') as f:
                        superposed_xtc_data = f.read()
                    
                    # Encode as base64
                    superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode('utf-8')
                    
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
                        "superposition_atoms": "backbone + CB"
                    }
                    
                    elapsed = time.time() - start_time
                    log_bioemu_success(f"Superposition completed in {elapsed:.2f}s - RMSD: {avg_rmsd:.3f}Å")
                    
                    return jsonify({
                        "status": "success",
                        "superposed_trajectory": superposed_xtc_b64,
                        "quality_metrics": quality_metrics,
                        "method": "MDTraj backbone+CB superposition",
                        "processing_time": round(elapsed, 2)
                    })
                    
                except Exception as e:
                    log_bioemu_error(f"Superposition error: {str(e)}")
                    return jsonify({
                        "status": "failed",
                        "message": "Structure superposition failed. Please try again."
                    }), 500
                    
        except ImportError:
            log_bioemu_error("MDTraj not available for structural superposition")
            return jsonify({
                "status": "failed",
                "message": "MDTraj library not available. Please install mdtraj for structural superposition."
            }), 500
            
    except Exception as e:
        log_bioemu_error(f"Superposition endpoint error: {str(e)}")
        return jsonify({
            "status": "failed", 
            "message": "Server error. Please try again."
        }), 500


@app.route('/api/analyze-reference-structure', methods=['POST'])
def analyze_reference_structure_endpoint():
    """Analyze reference structure (AlphaFold/PDB) for secondary structure comparison"""
    try:
        data = request.json
        if not data:
            return jsonify({
                "status": "failed",
                "message": "No data provided"
            }), 400

        log_bioemu_info("=== REFERENCE STRUCTURE ANALYSIS START ===")
        start_time = time.time()

        # Get structure source
        structure_source = data.get('source', 'alphafold')  # 'alphafold', 'pdb', or 'upload'
        
        pdb_content = None
        source_info = {}
        
        if structure_source == 'alphafold':
            # Use provided AlphaFold structure
            alphafold_b64 = data.get('alphafold_structure')
            if not alphafold_b64:
                return jsonify({
                    "status": "failed",
                    "message": "AlphaFold structure data not provided"
                }), 400
            
            try:
                pdb_content = base64.b64decode(alphafold_b64).decode('utf-8')
                source_info = {
                    "type": "alphafold",
                    "uniprot_id": data.get('uniprot_id')
                }
            except Exception as e:
                return jsonify({
                    "status": "failed",
                    "message": "Invalid structure data."
                }), 400
                
        elif structure_source == 'pdb':
            # Fetch from PDB database
            pdb_id = data.get('pdb_id')
            if not pdb_id:
                return jsonify({
                    "status": "failed",
                    "message": "PDB ID not provided"
                }), 400
            
            log_bioemu_info(f"Fetching PDB structure: {pdb_id}")
            pdb_content = fetch_pdb_structure(pdb_id)
            if not pdb_content:
                return jsonify({
                    "status": "failed",
                    "message": f"Could not fetch PDB structure: {pdb_id}"
                }), 404
            
            source_info = {
                "type": "pdb",
                "pdb_id": pdb_id.upper()
            }
            
        elif structure_source == 'upload':
            # Use uploaded PDB content
            uploaded_pdb = data.get('pdb_content')
            if not uploaded_pdb:
                return jsonify({
                    "status": "failed",
                    "message": "PDB content not provided"
                }), 400
            
            try:
                # Handle both raw text and base64 encoded
                if uploaded_pdb.startswith('data:'):
                    # Extract base64 part if data URL
                    pdb_content = base64.b64decode(uploaded_pdb.split(',')[1]).decode('utf-8')
                elif len(uploaded_pdb) % 4 == 0:
                    # Try to decode as base64
                    try:
                        pdb_content = base64.b64decode(uploaded_pdb).decode('utf-8')
                    except:
                        pdb_content = uploaded_pdb
                else:
                    pdb_content = uploaded_pdb
                    
                source_info = {
                    "type": "upload",
                    "filename": data.get('filename', 'uploaded.pdb')
                }
            except Exception as e:
                return jsonify({
                    "status": "failed", 
                    "message": "Invalid PDB data."
                }), 400
        else:
            return jsonify({
                "status": "failed",
                "message": f"Unknown structure source: {structure_source}"
            }), 400

        # Analyze reference structure
        log_bioemu_info(f"Analyzing {structure_source} reference structure...")
        target_sequence = data.get('target_sequence')  # For sequence alignment
        
        analysis_result = analyze_reference_structure(pdb_content, target_sequence)
        if not analysis_result:
            return jsonify({
                "status": "failed",
                "message": "Reference structure analysis failed"
            }), 500

        # Add source information to result
        analysis_result['source_info'] = source_info
        
        end_time = time.time()
        log_bioemu_timing("Reference Structure Analysis", start_time, end_time)
        log_bioemu_success("Reference structure analysis completed successfully")

        return jsonify({
            "status": "success",
            "analysis": analysis_result
        })

    except Exception as e:
        log_bioemu_error(f"Reference structure analysis failed: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Analysis error. Please try again."
        }), 500
    finally:
        print_separator()
        log_bioemu_info("=== REFERENCE STRUCTURE ANALYSIS END ===")


@app.route('/api/compare-md-reference', methods=['POST'])
def compare_md_reference_endpoint():
    """Compare MD ensemble analysis with reference structure analysis"""
    try:
        data = request.json
        if not data or 'md_analysis' not in data or 'reference_analysis' not in data:
            return jsonify({
                "status": "failed",
                "message": "Missing MD analysis or reference analysis data"
            }), 400

        log_bioemu_info("=== MD vs REFERENCE COMPARISON START ===")
        start_time = time.time()

        md_analysis = data['md_analysis']
        reference_analysis = data['reference_analysis']
        
        # Validate analysis data
        if not md_analysis.get('secondary_structure_stats'):
            return jsonify({
                "status": "failed",
                "message": "MD analysis missing secondary structure statistics"
            }), 400
            
        if not reference_analysis.get('helix_fraction'):
            return jsonify({
                "status": "failed",
                "message": "Reference analysis missing secondary structure data"
            }), 400

        log_bioemu_info("Comparing MD ensemble with reference structure...")
        comparison_result = compare_md_with_reference(md_analysis, reference_analysis)
        
        if not comparison_result:
            return jsonify({
                "status": "failed",
                "message": "MD vs reference comparison failed"
            }), 500

        end_time = time.time()
        log_bioemu_timing("MD vs Reference Comparison", start_time, end_time)
        log_bioemu_success("MD vs reference comparison completed successfully")

        return jsonify({
            "status": "success",
            "comparison": comparison_result
        })

    except Exception as e:
        log_bioemu_error(f"MD vs reference comparison failed: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Comparison error. Please try again."
        }), 500
    finally:
        print_separator()
        log_bioemu_info("=== MD vs REFERENCE COMPARISON END ===")


# --- COPILOT AI ASSISTANT ROUTES ---

@app.route('/api/copilot/ask', methods=['POST'])
def copilot_ask():
    """AI copilot for scientific explanations — re-enabled with input validation"""
    try:
        data = request.json or {}
        message = data.get('message', '').strip()
        context = data.get('context', {})
        history = data.get('history', [])

        # ── Input validation ──
        if not message:
            return jsonify({"response": "Please enter a question.", "status": "error"}), 400
        if len(message) > 2000:
            return jsonify({"response": "Question too long (max 2000 characters).", "status": "error"}), 400

        result = get_copilot_response(message, context, history)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Copilot error: {str(e)}")
        return jsonify({
            "response": "Sorry, I couldn't process your question. Please try again.",
            "status": "error"
        }), 500

# --- FRONTEND CONFIGURATION ROUTES ---

@app.route('/api/config')
def get_frontend_config():
    """Provide runtime configuration for the frontend"""
    return jsonify({
        "backendUrl": "",  # Empty string means use relative URLs (same origin)
        "apiEndpoint": API_ENDPOINT or "not_configured",
        "apiKeyConfigured": bool(API_KEY),
        "environment": os.getenv('FLASK_ENV', 'development'),
        "version": "1.0.0"
    })

# --- FRONTEND SERVING ROUTES ---

# NOTE: Static files are now served automatically by Flask using 
# the static_folder configuration set in app creation above

# Serve root assets (favicon, manifest, etc.) - specific files only
@app.route('/favicon.ico')
@app.route('/favicon.svg')
@app.route('/manifest.json')
@app.route('/robots.txt')
def serve_root_assets():
    """Serve specific root assets from build directory"""
    # Get the filename from the request path
    filename = request.path[1:]  # Remove leading slash
    
    build_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        '..', 'build'
    )
    
    file_path = os.path.join(build_dir, filename)
    logger.debug(f"Root asset request: {filename}")
    logger.debug(f"Asset path: {file_path}")
    logger.debug(f"Asset exists: {os.path.exists(file_path)}")
    
    if os.path.exists(file_path):
        logger.debug(f"Serving root asset: {filename}")
        return send_from_directory(build_dir, filename)
    else:
        logger.warning(f"Root asset not found: {filename}")
        return "Asset not found", 404


# Serve React app (catch-all route for SPA routing) - MUST come last
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path=''):
    """Serve React app for all non-API routes"""
    logger.debug(f"React app request: path='{path}'")
    
    # If it's an API route, don't handle it here (let Flask return 404)
    if path.startswith('api/'):
        return jsonify({"error": "API endpoint not found"}), 404
    
    # If it's a static file request, don't handle it here
    if path.startswith('static/'):
        return jsonify({"error": "Static file not found"}), 404
    
    # Serve the React index.html for all other routes
    build_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        '..', 'build'
    )
    index_file = os.path.join(build_dir, 'index.html')
    logger.debug(f"Serving index.html from: {os.path.abspath(index_file)}")
    logger.debug(f"File exists: {os.path.exists(index_file)}")
    
    return send_file(index_file)


@app.route('/api/enhanced-superpose-structures', methods=['POST'])
def enhanced_superpose_structures():
    """Enhanced superposition with custom PDB support for comprehensive RMSD analysis"""
    try:
        data = request.json
        if not data or 'bioemu_pdb' not in data or 'bioemu_xtc' not in data or 'alphafold_pdb' not in data:
            return jsonify({
                "status": "failed", 
                "message": "Missing BioEmu trajectory data (pdb, xtc) or AlphaFold reference structure"
            }), 400

        log_bioemu_info("=== ENHANCED STRUCTURAL SUPERPOSITION START ===")
        start_time = time.time()

        # Decode input data
        bioemu_pdb_data = base64.b64decode(data['bioemu_pdb'])
        bioemu_xtc_data = base64.b64decode(data['bioemu_xtc'])
        alphafold_pdb_data = base64.b64decode(data['alphafold_pdb'])
        
        # Check for custom PDB data
        custom_pdb_data = None
        if 'custom_pdb' in data and data['custom_pdb']:
            custom_pdb_data = base64.b64decode(data['custom_pdb'])
            log_bioemu_info("Custom PDB structure detected - enabling multi-structure analysis")
        
        # Check if sequence alignment is requested
        use_sequence_alignment = data.get('use_sequence_alignment', False)
        
        log_bioemu_data("Enhanced superposition input", {
            'bioemu_pdb_size': len(bioemu_pdb_data),
            'bioemu_xtc_size': len(bioemu_xtc_data),
            'alphafold_pdb_size': len(alphafold_pdb_data),
            'custom_pdb_size': len(custom_pdb_data) if custom_pdb_data else 0,
            'use_sequence_alignment': use_sequence_alignment
        })

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
                
                with open(alphafold_path, 'wb') as f:
                    f.write(alphafold_pdb_data)
                with open(bioemu_pdb_path, 'wb') as f:
                    f.write(bioemu_pdb_data)
                with open(bioemu_xtc_path, 'wb') as f:
                    f.write(bioemu_xtc_data)
                
                custom_path = None
                if custom_pdb_data:
                    custom_path = os.path.join(temp_dir, "custom.pdb")
                    with open(custom_path, 'wb') as f:
                        f.write(custom_pdb_data)
                
                log_bioemu_info("Loading reference structures...")
                # Load all structures
                alphafold_ref = md.load(alphafold_path)
                bioemu_traj = md.load(bioemu_xtc_path, top=bioemu_pdb_path)
                custom_ref = None
                if custom_path:
                    custom_ref = md.load(custom_path)
                
                # Select backbone + CB atoms for superposition
                alphafold_backbone = alphafold_ref.topology.select("backbone or name CB")
                bioemu_backbone = bioemu_traj.topology.select("backbone or name CB")
                
                # Perform main superposition (BioEmu to AlphaFold)
                alphafold_ref_selected = alphafold_ref.atom_slice(alphafold_backbone)
                bioemu_traj_selected = bioemu_traj.atom_slice(bioemu_backbone)
                
                # Check atom count compatibility for main superposition
                if alphafold_ref_selected.n_atoms != bioemu_traj_selected.n_atoms:
                    return jsonify({
                        "status": "failed",
                        "message": f"Cannot superpose: atom count mismatch (AlphaFold: {alphafold_ref_selected.n_atoms}, BioEmu: {bioemu_traj_selected.n_atoms})"
                    }), 400
                
                log_bioemu_info("Performing main structural superposition (BioEmu to AlphaFold)...")
                # Perform superposition
                bioemu_traj_selected.superpose(alphafold_ref_selected)
                bioemu_traj.superpose(alphafold_ref_selected, atom_indices=bioemu_backbone)
                
                # Calculate BioEmu vs AlphaFold RMSD
                bioemu_alphafold_rmsd = md.rmsd(bioemu_traj_selected, alphafold_ref_selected)
                
                # Prepare results object
                quality_metrics = {
                    "avg_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.mean()),
                    "max_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.max()),
                    "min_rmsd_to_alphafold": float(bioemu_alphafold_rmsd.min()),
                    "rmsd_time_series": bioemu_alphafold_rmsd.tolist(),
                    "n_frames_superposed": int(bioemu_traj.n_frames),
                    "n_atoms_superposed": int(alphafold_ref_selected.n_atoms),
                    "superposition_atoms": "backbone + CB"
                }
                
                custom_pdb_metrics = None
                if custom_ref:
                    log_bioemu_info("Calculating custom PDB comparisons...")
                    
                    try:
                        # Custom PDB superposition and comparisons
                        custom_backbone = custom_ref.topology.select("backbone or name CB")
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
                            alphafold_custom_rmsd = md.rmsd(alphafold_ref_selected, custom_ref_selected)[0]
                            
                            custom_pdb_metrics = {
                                "rmsd_time_series": bioemu_custom_rmsd,
                                "avg_rmsd_bioemu_custom": float(np.mean(bioemu_custom_rmsd)),
                                "min_rmsd_bioemu_custom": float(np.min(bioemu_custom_rmsd)),
                                "max_rmsd_bioemu_custom": float(np.max(bioemu_custom_rmsd)),
                                "alphafold_custom_rmsd": [float(alphafold_custom_rmsd)] * len(bioemu_custom_rmsd),  # Repeat for consistency
                                "alphafold_custom_static_rmsd": float(alphafold_custom_rmsd),
                                "custom_pdb_atoms": int(custom_ref_selected.n_atoms)
                            }
                            
                            log_bioemu_success(f"Custom PDB analysis complete - BioEmu↔Custom avg: {np.mean(bioemu_custom_rmsd):.3f}Å, AlphaFold↔Custom: {alphafold_custom_rmsd:.3f}Å")
                        else:
                            log_bioemu_error(f"Custom PDB atom count mismatch: {custom_ref_selected.n_atoms} vs {bioemu_traj_selected.n_atoms}")
                            custom_pdb_metrics = {
                                "error": "Atom count mismatch with custom PDB",
                                "custom_pdb_atoms": int(custom_ref_selected.n_atoms),
                                "bioemu_atoms": int(bioemu_traj_selected.n_atoms)
                            }
                        
                    except Exception as e:
                        log_bioemu_error(f"Custom PDB analysis error: {str(e)}")
                        custom_pdb_metrics = {
                            "error": "Custom structure analysis failed. Please try again."
                        }
                
                # Save superposed trajectory
                log_bioemu_info("Saving enhanced superposed trajectory...")
                superposed_xtc_path = os.path.join(temp_dir, "enhanced_superposed_trajectory.xtc")
                bioemu_traj.save(superposed_xtc_path)
                
                # Read superposed trajectory back as binary data
                with open(superposed_xtc_path, 'rb') as f:
                    superposed_xtc_data = f.read()
                
                # Encode as base64
                superposed_xtc_b64 = base64.b64encode(superposed_xtc_data).decode('utf-8')
                
                elapsed = time.time() - start_time
                log_bioemu_success(f"Enhanced superposition completed in {elapsed:.2f}s")
                
                return jsonify({
                    "status": "success",
                    "superposed_trajectory": superposed_xtc_b64,
                    "quality_metrics": quality_metrics,
                    "custom_pdb_metrics": custom_pdb_metrics,
                    "method": "Enhanced MDTraj multi-structure superposition",
                    "processing_time": round(elapsed, 2)
                })
                
        except ImportError:
            log_bioemu_error("MDTraj not available for enhanced structural superposition")
            return jsonify({
                "status": "failed",
                "message": "MDTraj library not available. Please install mdtraj for structural superposition."
            }), 500
            
    except Exception as e:
        log_bioemu_error(f"Enhanced superposition endpoint error: {str(e)}")
        return jsonify({
            "status": "failed", 
            "message": "Server error. Please try again."
        }), 500


@app.route('/api/get-related-proteins/<uniprot_id>', methods=['GET'])
def get_related_proteins_endpoint(uniprot_id):
    """Get related proteins suggestions based on the current protein"""
    log_bioemu_info(f"=== RELATED PROTEINS REQUEST FOR: {uniprot_id} ===")
    
    try:
        # Validate UniProt ID
        if not validate_uniprot_id(uniprot_id):
            return jsonify({
                "status": "failed",
                "message": f"Invalid UniProt ID format: {uniprot_id}"
            }), 400
        
        # Get suggestions based on protein
        suggestions = get_protein_suggestions(uniprot_id)
        
        return jsonify({
            "status": "success",
            "uniprot_id": uniprot_id,
            "suggestions": suggestions
        })
        
    except Exception as e:
        log_bioemu_error(f"Error getting related proteins: {str(e)}")
        return jsonify({
            "status": "failed",
            "message": "Error fetching related proteins. Please try again."
        }), 500

def get_protein_suggestions(uniprot_id):
    """Get contextual protein suggestions based on the current protein"""
    
    # Handle special cases for designed proteins or common test cases
    special_cases = {
        'trp-cage': {
            'alphafold': [
                {'id': 'P01308', 'name': 'insulin', 'category': 'small protein'},
                {'id': 'P02768', 'name': 'albumin', 'category': 'comparison'},
                {'id': 'P69905', 'name': 'hemoglobin', 'category': 'comparison'},
                {'id': 'P04637', 'name': 'p53', 'category': 'comparison'},
            ],
            'pdb': [
                {'id': '1L2Y', 'name': 'Trp-cage miniprotein'},
                {'id': '2JOF', 'name': 'Trp-cage variant'},
                {'id': '1UBQ', 'name': 'ubiquitin (small protein)'},
                {'id': '1EJG', 'name': 'crambin (small protein)'},
            ]
        },
        'ubiquitin': {
            'alphafold': [
                {'id': 'P0CG48', 'name': 'ubiquitin', 'category': 'same protein'},
                {'id': 'P01308', 'name': 'insulin', 'category': 'small protein'},
                {'id': 'P69905', 'name': 'hemoglobin', 'category': 'comparison'},
            ],
            'pdb': [
                {'id': '1UBQ', 'name': 'ubiquitin'},
                {'id': '1F9J', 'name': 'ubiquitin variant'},
                {'id': '1EJG', 'name': 'crambin'},
            ]
        }
    }
    
    # Check if this might be a special case (check protein name patterns)
    uniprot_lower = uniprot_id.lower() if uniprot_id else ''
    for special_name, suggestions in special_cases.items():
        if special_name in uniprot_lower:
            return suggestions
    
    # Protein family/category mappings with verified AlphaFold availability
    protein_families = {
        # Hormones & signaling
        'P01308': {  # Insulin
            'alphafold': [
                {'id': 'P01308', 'name': 'insulin (human)', 'category': 'hormone'},
                {'id': 'P69905', 'name': 'hemoglobin subunit alpha', 'category': 'transport'},
                {'id': 'P02768', 'name': 'serum albumin', 'category': 'transport'},
            ],
            'pdb': [
                {'id': '1ZNI', 'name': 'insulin hexamer'},
                {'id': '4INS', 'name': 'insulin'},
                {'id': '1MSO', 'name': 'insulin analog'},
            ]
        },
        
        # Default suggestions for unknown proteins
        'default': {
            'alphafold': [
                {'id': 'P01308', 'name': 'insulin', 'category': 'hormone'},
                {'id': 'P69905', 'name': 'hemoglobin alpha', 'category': 'transport'},
                {'id': 'P02768', 'name': 'albumin', 'category': 'transport'},
                {'id': 'P04637', 'name': 'p53 tumor suppressor', 'category': 'regulatory'},
            ],
            'pdb': [
                {'id': '1UBQ', 'name': 'ubiquitin'},
                {'id': '1EJG', 'name': 'crambin'},
                {'id': '1INS', 'name': 'insulin'},
                {'id': '1MBO', 'name': 'myoglobin'},
            ]
        }
    }
    
    # Commonly studied proteins and their suggested comparisons
    well_known_proteins = {
        'P69905': {  # Hemoglobin alpha
            'alphafold': [
                {'id': 'P69905', 'name': 'hemoglobin alpha', 'category': 'same protein'},
                {'id': 'P68871', 'name': 'hemoglobin beta', 'category': 'related subunit'},
                {'id': 'P02185', 'name': 'myoglobin', 'category': 'similar function'},
            ],
            'pdb': [
                {'id': '1HHO', 'name': 'hemoglobin'},
                {'id': '2HHB', 'name': 'deoxyhemoglobin'},
                {'id': '1MBO', 'name': 'myoglobin'},
            ]
        },
        
        'P02768': {  # Albumin
            'alphafold': [
                {'id': 'P02768', 'name': 'serum albumin', 'category': 'same protein'},
                {'id': 'P01308', 'name': 'insulin', 'category': 'binding partner'},
                {'id': 'P69905', 'name': 'hemoglobin', 'category': 'blood protein'},
            ],
            'pdb': [
                {'id': '1AO6', 'name': 'albumin'},
                {'id': '1BM0', 'name': 'albumin complex'},
                {'id': '1UOR', 'name': 'albumin'},
            ]
        },
        
        'P04637': {  # p53
            'alphafold': [
                {'id': 'P04637', 'name': 'p53 tumor suppressor', 'category': 'same protein'},
                {'id': 'Q00987', 'name': 'MDM2', 'category': 'regulatory partner'},
                {'id': 'P01308', 'name': 'insulin', 'category': 'comparison'},
            ],
            'pdb': [
                {'id': '1TUP', 'name': 'p53 DNA binding domain'},
                {'id': '1YCR', 'name': 'p53-MDM2 complex'},
                {'id': '3KMD', 'name': 'p53 tetramer'},
            ]
        }
    }
    
    # Try to find specific suggestions for this protein
    if uniprot_id in well_known_proteins:
        return well_known_proteins[uniprot_id]
    elif uniprot_id in protein_families:
        return protein_families[uniprot_id]
    else:
        # Return default suggestions
        return protein_families['default']


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    
    print_separator()
    print("🚀 BIOEMU API PROXY SERVER STARTING")
    print_separator()
    print(f"🌐 Server host: 0.0.0.0")
    print(f"🔌 Server port: {port}")
    print(f"📍 Azure BioEmu endpoint: {API_ENDPOINT or 'NOT CONFIGURED'}")
    print(f"🔑 API key configured: {'YES' if API_KEY else 'NO'}")
    print(f"🐍 Debug mode: True")
    print_separator()
    
    log_bioemu_info(f"Starting BioEmu API proxy server on port {port}")
    
    print("🎯 Ready to receive BioEmu API requests!")
    print("📊 All API calls will be tracked with detailed logging")
    print("🔬 Real-time molecular data flow monitoring active")
    print("✨ Enhanced terminal visibility enabled")
    print("\n🧬 UniProt Integration Features:")
    print("   • /api/predict-uniprot - Predict from UniProt ID or sequence")
    print("   • /api/uniprot-info/<id> - Get protein information")
    print("   • /api/alphafold-structure/<id> - Download AlphaFold structures\n")

    # Actually start the Flask server
    app.run(host='0.0.0.0', port=port, debug=True)
