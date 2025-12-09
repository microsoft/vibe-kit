/**
 * BioEmu API Service
 * Handles connections to Azure AI BioEmu API
 * This is the primary engine that powers all protein structure predictions in the application
 * BioEmu models are trained on millions of protein structures and can generate realistic conformational ensembles
 */

import { getCachedData, setCachedData } from './BioEmuCache';
import { UBIQUITIN_DEMO_DATA } from '../data/ubiquitin_demo_data';
import { logger } from '../utils/logger';
import { getBackendUrl } from '../utils/apiConfig';

// Re-export for backward compatibility
export { getBackendUrl };

// Global variable to track API availability
export let bioEmuApiAvailable = false;

/**
 * Sends a request to the BioEmu API and returns the result
 * @param {string} sequence - The protein amino acid sequence
 * @param {number} numSamples - The number of samples to generate
 * @param {boolean} useFallback - Whether to use fallback mock data if API fails or is unavailable
 * @returns {Promise<Object>} - A promise that resolves to the API response
 */
export const generateProteinSamples = async (sequence, numSamples = 10, useFallback = false) => {
    try {
        logger.debug('generateProteinSamples called', {
            sequenceLength: sequence.length,
            numSamples,
            useFallback
        });

        // Check cache first
        const cachedData = getCachedData(sequence, numSamples);
        if (cachedData) {
            logger.debug('Cache hit for sequence');
            bioEmuApiAvailable = true;
            return cachedData;
        }

        bioEmuApiAvailable = false;
        const backendUrl = getBackendUrl();

        logger.debug('Making API request', { backendUrl: backendUrl || 'relative' });

        // Check backend status
        try {
            const statusResponse = await fetch(`${backendUrl}/api/status`);
            if (!statusResponse.ok) {
                logger.warn('Backend server error:', statusResponse.status);
                if (useFallback) {
                    return createFallbackResults(sequence, numSamples);
                }
                throw new Error('Backend server error');
            }

            const statusData = await statusResponse.json();
            if (statusData.status !== 'connected') {
                logger.warn('API not connected:', statusData.message);
                if (useFallback) {
                    return createFallbackResults(sequence, numSamples);
                }
                throw new Error(`API not connected: ${statusData.message}`);
            }
            bioEmuApiAvailable = true;
        } catch (error) {
            logger.error('Error checking API status:', error);
            if (useFallback) {
                return createFallbackResults(sequence, numSamples);
            }
            throw error;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const data = {
            sequence: sequence,
            numSamples: numSamples,
        };

        try {
            const response = await fetch(`${backendUrl}/api/predict`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data),
            });

            logger.debug('API response received', { status: response.status, ok: response.ok });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('API request failed:', errorText);
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status !== 'success') {
                bioEmuApiAvailable = false;
                logger.error('Inference failed:', result.message);
                throw new Error(`Inference failed: ${result.message || 'Unknown error'}`);
            }

            logger.info('BioEmu API call successful');
            bioEmuApiAvailable = true;

            // Cache the results
            setCachedData(sequence, result.results, numSamples);

            return result.results;
        } catch (error) {
            logger.error('BioEmu API Error:', error);
            if (useFallback) {
                logger.warn('Using fallback results due to API error');
                return createFallbackResults(sequence, numSamples);
            }
            throw error;
        }
    } catch (error) {
        logger.error('BioEmu Service Error:', error);
        if (useFallback) {
            return createFallbackResults(sequence, numSamples);
        }
        throw error;
    }
};

/**
 * Creates fallback results when the API is unavailable
 * @param {string} sequence - The protein sequence to create fallback data for
 * @param {number} numSamples - The number of samples requested
 * @returns {Object} - A fallback response object with base64 encoded data
 */
const createFallbackResults = (sequence, numSamples = 10) => {
    logger.error('Fallback data disabled - platform requires real Azure BioEmu API');
    throw new Error('NO FALLBACKS ALLOWED: This platform only works with real Azure BioEmu API data. Please ensure API is connected and working.');
};

/**
 * Decodes base64 encoded result files from BioEmu API
 * @param {Object} results - The API response results object
 * @returns {Object} - An object containing decoded file data
 */
export const decodeApiResults = (results) => {
    const decodedFiles = {};

    try {
        for (const [fileName, rawData] of Object.entries(results)) {
            if (!rawData || typeof rawData !== 'string') {
                logger.warn(`Skipping invalid data for file ${fileName}`);
                continue;
            }

            try {
                const isBinaryFile = fileName.toLowerCase().endsWith('.xtc');
                const binaryData = atob(rawData);
                const bytes = new Uint8Array(binaryData.length);

                for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                }

                let blob;
                if (isBinaryFile) {
                    blob = new Blob([bytes], { type: 'application/octet-stream' });
                } else {
                    blob = new Blob([bytes], { type: getMimeType(fileName) });
                }

                decodedFiles[fileName] = {
                    data: blob,
                    url: URL.createObjectURL(blob),
                    size: blob.size,
                    type: getMimeType(fileName),
                    isBinary: isBinaryFile
                };

                logger.debug(`Decoded file ${fileName}`, { size: blob.size, type: getMimeType(fileName) });
            } catch (error) {
                logger.error(`Error decoding file ${fileName}:`, error);
            }
        }
    } catch (error) {
        logger.error('Error processing API results:', error);
    }

    return decodedFiles;
};

/**
 * Gets the MIME type for a file based on its extension
 * @param {string} fileName - The name of the file
 * @returns {string} - The MIME type
 */
const getMimeType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
        'pdb': 'chemical/x-pdb',
        'xtc': 'application/octet-stream',
        'fasta': 'text/plain',
        'txt': 'text/plain',
        'json': 'application/json',
    };
    return mimeTypes[extension] || 'application/octet-stream';
};

/**
 * Downloads the protein files from the BioEmu API response
 * @param {Object} decodedFiles - The object containing decoded file data
 */
export const downloadProteinFiles = (decodedFiles) => {
    for (const [fileName, fileData] of Object.entries(decodedFiles)) {
        const downloadLink = document.createElement('a');
        downloadLink.href = fileData.url;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
};

/**
 * Creates a file object compatible with Mol* Viewer from the BioEmu API response
 * @param {Object} decodedFiles - The object containing decoded file data
 * @returns {Object} - An object containing Mol* compatible file objects
 */
export const prepareFilesForMolViewer = (decodedFiles) => {
    const molViewerFiles = {};

    if (decodedFiles['topology.pdb']) {
        molViewerFiles.pdbFile = {
            name: 'topology.pdb',
            data: decodedFiles['topology.pdb'].data,
            url: decodedFiles['topology.pdb'].url,
        };
    }

    if (decodedFiles['samples.xtc'] && decodedFiles['samples.xtc'].size > 100) {
        try {
            molViewerFiles.xtcFile = {
                name: 'samples.xtc',
                data: decodedFiles['samples.xtc'].data,
                url: decodedFiles['samples.xtc'].url,
                isBinary: true
            };
            logger.debug('XTC file prepared for visualization', { size: decodedFiles['samples.xtc'].size });
        } catch (error) {
            logger.warn('Error preparing XTC file for visualization:', error);
        }
    } else {
        logger.warn('Skipping XTC file - not found or too small');
    }

    return molViewerFiles;
};

/**
 * Analyzes trajectory data using the backend MDTraj service
 * @param {Object} decodedFiles - The decoded PDB and XTC files
 * @returns {Promise<Object>} - Analysis results from MDTraj
 */
export const analyzeTrajectory = async (decodedFiles) => {
    try {
        logger.debug('Starting trajectory analysis', { files: Object.keys(decodedFiles) });

        const backendUrl = getBackendUrl();

        if (!decodedFiles['topology.pdb'] || !decodedFiles['samples.xtc']) {
            throw new Error('Missing PDB or XTC files for analysis');
        }

        const pdbBlob = decodedFiles['topology.pdb'].data;
        const xtcBlob = decodedFiles['samples.xtc'].data;

        const pdbBase64 = await blobToBase64(pdbBlob);
        const xtcBase64 = await blobToBase64(xtcBlob);

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Analysis request timed out after 60 seconds')), 60000);
        });

        const requestPromise = fetch(`${backendUrl}/api/analyze-trajectory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdb: pdbBase64, xtc: xtcBase64 })
        });

        const response = await Promise.race([requestPromise, timeoutPromise]);

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Backend analysis error:', errorText);
            throw new Error(`Analysis request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            logger.error('Analysis failed:', result.message);
            throw new Error(`Analysis failed: ${result.message}`);
        }

        logger.info('Trajectory analysis completed', {
            frames: result.analysis?.ensemble_stats?.n_frames,
            atoms: result.analysis?.ensemble_stats?.n_atoms
        });

        return result.analysis;

    } catch (error) {
        logger.error('Trajectory analysis failed:', error);
        throw error;
    }
};

/**
 * Helper function to convert blob to base64
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - Base64 encoded string
 */
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Analyze energy landscape from BioEmu trajectory using PCA on CA-CA contacts
 * @param {Object} decodedFiles - Decoded files object (similar to analyzeTrajectory)
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} - Energy landscape analysis results
 */
export const analyzeEnergyLandscape = async (decodedFiles, options = {}) => {
    try {
        const backendUrl = getBackendUrl();

        if (!decodedFiles['topology.pdb'] || !decodedFiles['samples.xtc']) {
            throw new Error('Missing PDB or XTC files for energy landscape analysis');
        }

        logger.debug('Starting energy landscape analysis');

        const pdbBlob = decodedFiles['topology.pdb'].data;
        const xtcBlob = decodedFiles['samples.xtc'].data;

        const pdbBase64 = await blobToBase64(pdbBlob);
        const xtcBase64 = await blobToBase64(xtcBlob);

        const requestData = {
            pdb: pdbBase64,
            xtc: xtcBase64,
            include_surface: options.includeSurface !== false,
            ...options
        };

        const response = await fetch(`${backendUrl}/api/energy-landscape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Energy landscape analysis failed with status ${response.status}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || 'Energy landscape analysis failed');
        }

        logger.info('Energy landscape analysis completed', {
            n_frames: result.landscape_data.n_frames,
            total_variance: result.landscape_data.cumulative_variance_pc1_pc2
        });

        return result.landscape_data;

    } catch (error) {
        logger.error('Energy landscape analysis failed:', error);
        throw error;
    }
};

/**
 * Sends a request to the BioEmu API using UniProt ID and returns the result
 * @param {Object} proteinData - Object containing uniprot_id, sequence, and other protein info
 * @param {number} numSamples - The number of samples to generate
 * @param {boolean} includeAlphaFold - Whether to include AlphaFold structure
 * @param {boolean} useFallback - Whether to use fallback mock data if API fails
 * @returns {Promise<Object>} - A promise that resolves to the API response
 */
export const generateProteinSamplesFromUniProt = async (proteinData, numSamples = 10, includeAlphaFold = true, useFallback = false) => {
    try {
        logger.debug('generateProteinSamplesFromUniProt called', {
            uniprotId: proteinData.uniprot_id,
            sequenceLength: proteinData.sequence.length,
            numSamples
        });

        // Demo mode for Polyubiquitin-B (P0CG47)
        if (proteinData.uniprot_id === 'P0CG47' || proteinData.uniprot_id === 'p0cg47') {
            logger.info('Using demo data for Polyubiquitin-B (P0CG47)');

            const demoResults = {
                ...UBIQUITIN_DEMO_DATA.data,
                numSamples: numSamples,
                source_info: {
                    input_type: 'uniprot_id',
                    sequence_length: UBIQUITIN_DEMO_DATA.data.uniprot_data.protein_info.sequence.length,
                    demo_mode: true
                }
            };

            bioEmuApiAvailable = true;
            return demoResults;
        }

        // Check cache
        const cachedData = getCachedData(proteinData.sequence, numSamples);
        if (cachedData) {
            logger.debug('Cache hit for UniProt sequence');
            const enhancedData = {
                ...cachedData,
                uniprot_data: {
                    uniprot_id: proteinData.uniprot_id,
                    protein_info: proteinData.protein_info,
                    has_alphafold: proteinData.alphafold_available
                },
                source_info: {
                    input_type: 'uniprot_id',
                    sequence_length: proteinData.sequence.length
                }
            };
            bioEmuApiAvailable = true;
            return enhancedData;
        }

        bioEmuApiAvailable = false;
        const backendUrl = getBackendUrl();

        // Check backend status
        try {
            const statusResponse = await fetch(`${backendUrl}/api/status`);
            if (!statusResponse.ok) {
                logger.warn('Backend server error:', statusResponse.status);
                if (useFallback) {
                    return createFallbackResults(proteinData.sequence, numSamples);
                }
                throw new Error('Backend server error');
            }

            const statusData = await statusResponse.json();
            if (statusData.status !== 'connected') {
                logger.warn('API not connected:', statusData.message);
                if (useFallback) {
                    return createFallbackResults(proteinData.sequence, numSamples);
                }
                throw new Error(`API not connected: ${statusData.message}`);
            }
            bioEmuApiAvailable = true;
        } catch (error) {
            logger.error('Error checking API status:', error);
            if (useFallback) {
                return createFallbackResults(proteinData.sequence, numSamples);
            }
            throw error;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const requestData = {
            uniprot_id: proteinData.uniprot_id,
            sequence: proteinData.sequence,
            numSamples: numSamples,
            include_alphafold: includeAlphaFold
        };

        const startTime = performance.now();

        const response = await fetch(`${backendUrl}/api/predict-uniprot`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData),
        });

        const duration = (performance.now() - startTime).toFixed(2);
        logger.debug(`UniProt API request took ${duration}ms`);

        if (!response.ok) {
            logger.error('UniProt API request failed', { status: response.status });

            try {
                const errorData = await response.json();
                if (useFallback) {
                    return createFallbackResults(proteinData.sequence, numSamples);
                }
                throw new Error(errorData.message || `API request failed: ${response.status}`);
            } catch (parseError) {
                if (useFallback) {
                    return createFallbackResults(proteinData.sequence, numSamples);
                }
                throw new Error(`API request failed: ${response.status}`);
            }
        }

        const result = await response.json();

        if (result.status === 'success') {
            logger.info('UniProt prediction successful');
            setCachedData(proteinData.sequence, result, numSamples);
            bioEmuApiAvailable = true;
            return result;
        } else {
            logger.error('UniProt API returned error:', result.message);
            if (useFallback) {
                return createFallbackResults(proteinData.sequence, numSamples);
            }
            throw new Error(result.message || 'Unknown API error');
        }

    } catch (error) {
        logger.error('UniProt generateProteinSamples error:', error);
        bioEmuApiAvailable = false;

        if (useFallback) {
            return createFallbackResults(proteinData.sequence, numSamples);
        }
        throw error;
    }
};
