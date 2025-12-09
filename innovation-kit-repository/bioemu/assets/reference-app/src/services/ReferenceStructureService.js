/**
 * Reference Structure Service for BioEmu Research Platform
 * 
 * Handles fetching and processing reference structures (PDB, AlphaFold)
 * for comparison with MD ensemble data
 */

import { getBackendUrl } from '../utils/apiConfig';
import { logger } from '../utils/logger';

class ReferenceStructureService {
  constructor() {
    this.baseUrl = `${getBackendUrl()}/api`;
    logger.debug('ReferenceStructureService initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Fetch and analyze reference structure from PDB or AlphaFold
   * @param {string} type - 'pdb' or 'alphafold'
   * @param {string} identifier - PDB ID or UniProt ID
   * @param {string} sequence - Optional sequence for alignment
   * @returns {Promise<Object>} Reference structure analysis
   */
  async fetchReferenceStructure(type, identifier, sequence = null) {
    if (!identifier?.trim()) {
      throw new Error('Please provide a valid identifier');
    }

    const response = await fetch(`${this.baseUrl}/analyze-reference-structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_type: type,
        identifier: identifier.trim(),
        sequence: sequence
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch reference structure: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Compare MD ensemble with reference structure
   * @param {Object} mdAnalysis - MD ensemble analysis data
   * @param {Object} referenceAnalysis - Reference structure analysis data
   * @returns {Promise<Object>} Comparison metrics
   */
  async compareWithReference(mdAnalysis, referenceAnalysis) {
    const response = await fetch(`${this.baseUrl}/compare-md-reference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        md_analysis: mdAnalysis,
        reference_analysis: referenceAnalysis
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch comparison data: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  }

  /**
   * Validate PDB ID format
   * @param {string} pdbId - PDB identifier
   * @returns {boolean} True if valid format
   */
  isValidPdbId(pdbId) {
    if (!pdbId || typeof pdbId !== 'string') return false;
    // PDB IDs are 4 characters: 1 digit + 3 letters/digits
    const pdbRegex = /^[0-9][A-Za-z0-9]{3}$/;
    return pdbRegex.test(pdbId.trim());
  }

  /**
   * Validate UniProt ID format for AlphaFold
   * @param {string} uniprotId - UniProt identifier
   * @returns {boolean} True if valid format
   */
  isValidUniProtId(uniprotId) {
    if (!uniprotId || typeof uniprotId !== 'string') return false;
    // UniProt IDs: 6 or 10 characters, alphanumeric
    const uniprotRegex = /^[A-Za-z0-9]{6}(?:[A-Za-z0-9]{4})?$/;
    return uniprotRegex.test(uniprotId.trim());
  }

  /**
   * Get suggested reference structures based on sequence similarity
   * @param {string} sequence - Target sequence
   * @returns {Promise<Array>} List of suggested structures
   */
  async getSuggestedReferences(sequence) {
    // This would implement sequence similarity search
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Process uploaded PDB file
   * @param {File} file - PDB file
   * @param {string} sequence - Optional sequence for alignment
   * @returns {Promise<Object>} Reference structure analysis
   */
  async processUploadedPdb(file, sequence = null) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.name.toLowerCase().endsWith('.pdb')) {
      throw new Error('File must be a PDB file (.pdb extension)');
    }

    const formData = new FormData();
    formData.append('pdb_file', file);
    if (sequence) {
      formData.append('sequence', sequence);
    }

    const response = await fetch(`${this.baseUrl}/analyze-reference-structure`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to process uploaded PDB: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Format reference structure info for display
   * @param {Object} referenceData - Reference structure data
   * @returns {Object} Formatted display info
   */
  formatReferenceInfo(referenceData) {
    if (!referenceData) return null;

    return {
      residues: referenceData.n_residues,
      helixContent: (referenceData.mean_helix_content * 100).toFixed(1),
      sheetContent: (referenceData.mean_sheet_content * 100).toFixed(1),
      coilContent: (referenceData.mean_coil_content * 100).toFixed(1),
      sourceType: referenceData.source_type || 'unknown',
      radiusOfGyration: referenceData.radius_of_gyration?.toFixed(2)
    };
  }

  /**
   * Format comparison metrics for display
   * @param {Object} comparisonData - Comparison analysis data
   * @returns {Object} Formatted comparison metrics
   */
  formatComparisonMetrics(comparisonData) {
    if (!comparisonData) return null;

    const metrics = comparisonData.agreement_metrics || {};
    const structural = comparisonData.structural_metrics || {};

    return {
      overallAgreement: (metrics.overall_agreement * 100).toFixed(1),
      helixAgreement: (metrics.helix_agreement * 100).toFixed(1),
      sheetAgreement: (metrics.sheet_agreement * 100).toFixed(1),
      rmsd: structural.rmsd?.toFixed(3),
      correlationCoeff: structural.correlation_coefficient?.toFixed(3),
      significantDifferences: metrics.significant_differences || 0
    };
  }
}

// Create a singleton instance
const referenceStructureService = new ReferenceStructureService();

export default referenceStructureService;
export { ReferenceStructureService };
