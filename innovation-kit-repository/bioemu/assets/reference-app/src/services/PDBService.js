/**
 * PDB Service for BioEmu Explorer
 * Provides functionality to fetch sequences and information from PDB entries
 */

import { getBackendUrl } from '../utils/apiConfig';
import { logger } from '../utils/logger';

const API_BASE_URL = getBackendUrl();

logger.debug('PDBService Configuration:', {
  hostname: window.location.hostname,
  API_BASE_URL
});

/**
 * Fetch protein sequence from PDB ID and optional chain
 * @param {string} pdbId - PDB ID (e.g., '1UBQ')
 * @param {string} chainId - Optional chain identifier (e.g., 'A')
 * @returns {Promise<Object>} - Promise resolving to sequence data
 */
export const fetchPDBSequence = async (pdbId, chainId = null) => {
  try {
    logger.debug(`Fetching PDB sequence: ${pdbId}${chainId ? ` (chain: ${chainId})` : ''}`);

    const url = new URL(`${API_BASE_URL}/api/pdb-sequence/${pdbId}`);
    if (chainId) {
      url.searchParams.append('chain', chainId);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    if (data.status === 'success') {
      logger.debug(`Successfully fetched PDB sequence: ${pdbId} (${data.sequence_length} residues)`);
      return {
        success: true,
        data: {
          pdbId: data.pdb_id,
          chainId: data.chain_id,
          sequence: data.sequence,
          sequenceLength: data.sequence_length,
          source: data.source
        }
      };
    } else {
      throw new Error(data.message || 'Failed to fetch PDB sequence');
    }

  } catch (error) {
    logger.error(`Error fetching PDB sequence for ${pdbId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to fetch PDB sequence'
    };
  }
};

/**
 * Fetch comprehensive information about a PDB entry
 * @param {string} pdbId - PDB ID (e.g., '1UBQ')
 * @returns {Promise<Object>} - Promise resolving to PDB information
 */
export const fetchPDBInfo = async (pdbId) => {
  try {
    logger.debug(`Fetching PDB info: ${pdbId}`);

    const response = await fetch(`${API_BASE_URL}/api/pdb-info/${pdbId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    if (data.status === 'success') {
      logger.debug(`Successfully fetched PDB info: ${pdbId}`);
      return {
        success: true,
        data: {
          pdbId: data.pdb_id,
          sequence: data.sequence,
          nResidues: data.n_residues,
          nAtoms: data.n_atoms,
          secondaryStructure: data.secondary_structure,
          metadata: data.metadata,
          source: data.source
        }
      };
    } else {
      throw new Error(data.message || 'Failed to fetch PDB info');
    }

  } catch (error) {
    logger.error(`Error fetching PDB info for ${pdbId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to fetch PDB info'
    };
  }
};

/**
 * Fetch available chains in a PDB structure
 * @param {string} pdbId - PDB ID (e.g., '1UBQ')
 * @returns {Promise<Object>} - Promise resolving to chain information
 */
export const fetchPDBChains = async (pdbId) => {
  try {
    logger.debug(`Fetching PDB chains: ${pdbId}`);

    const response = await fetch(`${API_BASE_URL}/api/pdb-chains/${pdbId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    if (data.status === 'success') {
      logger.debug(`Successfully fetched PDB chains: ${pdbId} (${data.chain_count} chains)`);
      return {
        success: true,
        data: {
          pdbId: data.pdb_id,
          chains: data.chains,
          chainCount: data.chain_count
        }
      };
    } else {
      throw new Error(data.message || 'Failed to fetch PDB chains');
    }

  } catch (error) {
    logger.error(`Error fetching PDB chains for ${pdbId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to fetch PDB chains'
    };
  }
};

/**
 * Validate PDB ID format
 * @param {string} pdbId - PDB ID to validate
 * @returns {boolean} - True if valid format
 */
export const validatePDBId = (pdbId) => {
  if (!pdbId || typeof pdbId !== 'string' || pdbId.length !== 4) {
    return false;
  }

  // PDB IDs are 4 characters: 1 digit + 3 alphanumeric
  const pdbPattern = /^[0-9][a-zA-Z0-9]{3}$/;
  return pdbPattern.test(pdbId);
};

/**
 * Validate chain ID format
 * @param {string} chainId - Chain ID to validate
 * @returns {boolean} - True if valid format
 */
export const validateChainId = (chainId) => {
  if (!chainId || typeof chainId !== 'string') {
    return false;
  }

  // Chain IDs are typically single characters or short strings
  return chainId.length >= 1 && chainId.length <= 3;
};

/**
 * Format PDB ID to uppercase
 * @param {string} pdbId - PDB ID to format
 * @returns {string} - Formatted PDB ID
 */
export const formatPDBId = (pdbId) => {
  return pdbId ? pdbId.toUpperCase().trim() : '';
};

/**
 * Format chain ID to uppercase
 * @param {string} chainId - Chain ID to format
 * @returns {string} - Formatted chain ID
 */
export const formatChainId = (chainId) => {
  return chainId ? chainId.toUpperCase().trim() : '';
};
