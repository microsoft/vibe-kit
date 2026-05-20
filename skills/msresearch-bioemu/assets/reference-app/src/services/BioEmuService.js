/**
 * BioEmu API Service
 * Handles connections to Azure AI BioEmu API
 * This is the primary engine that powers all protein structure predictions in the application
 * BioEmu models are trained on millions of protein structures and can generate realistic conformational ensembles
 */

import { getCachedData, setCachedData } from './BioEmuCache';
import { UBIQUITIN_DEMO_DATA } from '../data/ubiquitin_demo_data';

// Global variable to track API availability
export let bioEmuApiAvailable = false;

/**
 * Automatically detects the environment and returns the appropriate backend URL
 * - In local development (localhost:3000): returns 'http://localhost:5000'
 * - In Docker/production: returns '' (relative URLs for same-origin requests)
 * @returns {string} The backend URL to use for API calls
 */
export const getBackendUrl = () => {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check if we're running on localhost (React dev server)
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '::1';
  
  // Get current port
  const currentPort = window.location.port;
  
  // Log environment details for debugging
  // Use localhost:5000 for local development (more flexible conditions)
  if (isDevelopment && isLocalhost) {
    return 'http://localhost:5000';
  } 
  // Fallback: if running on localhost with typical dev ports, assume local dev
  else if (isLocalhost && (currentPort === '3000' || currentPort === '3001' || currentPort === '8080')) {
    return 'http://localhost:5000';
  }
  else {
    return '';
  }
};

/**
 * Sends a request to the BioEmu API and returns the result
 * @param {string} sequence - The protein amino acid sequence
 * @param {number} numSamples - The number of samples to generate
 * @param {boolean} useFallback - Whether to use fallback mock data if API fails or is unavailable
 * @returns {Promise<Object>} - A promise that resolves to the API response
 */
export const generateProteinSamples = async (sequence, numSamples = 10, useFallback = false) => {  
  try {
    // Check cache first for sample proteins
    const cachedData = getCachedData(sequence, numSamples);
    if (cachedData) {
      bioEmuApiAvailable = true; // Mark as available since we have valid data
      return cachedData;
    } else {
    }

    // Reset API availability status at the beginning of each call
    bioEmuApiAvailable = false;
    
    // Auto-detect environment and set appropriate backend URL
    const backendUrl = getBackendUrl();
    // First check if the backend is available
    try {
      const statusResponse = await fetch(`${backendUrl}/api/status`);
      if (!statusResponse.ok) {
        if (useFallback) {
          return createFallbackResults(sequence, numSamples);
        }
        throw new Error('Backend server error');
      }
      
      const statusData = await statusResponse.json();
      if (statusData.status !== 'connected') {
        if (useFallback) {
          return createFallbackResults(sequence, numSamples);
        }
        throw new Error(`API not connected: ${statusData.message}`);
      }
      bioEmuApiAvailable = true;
    } catch (error) {
      console.error('💥 Error checking API status:', error);
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
      // Make the actual API request to our backend server
      const response = await fetch(`${backendUrl}/api/predict`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API request failed:", errorText);
        
        // Structured error handling for specific HTTP status codes
        const error = new Error();
        error.statusCode = response.status;
        
        if (response.status === 429) {
          error.message = 'This is an experimental research demo and we\u2019re experiencing high demand. Please try again in a few minutes.';
          error.errorType = 'rate_limit';
          error.retryable = true;
        } else if (response.status === 503 || response.status === 502) {
          error.message = 'This is an experimental research demo and we\u2019re experiencing high demand. Please try again in a few minutes.';
          error.errorType = 'service_unavailable';
          error.retryable = true;
        } else if (response.status === 504) {
          error.message = 'The request timed out. Large ensembles may take longer — try reducing the number of conformations or try the polyubiquitin example.';
          error.errorType = 'timeout';
          error.retryable = true;
        } else if (response.status === 403) {
          // Safety screening block — show the backend's message
          try {
            const errorData = JSON.parse(errorText);
            error.message = errorData.message || 'This request cannot be processed.';
          } catch {
            error.message = 'This request cannot be processed.';
          }
          error.errorType = 'blocked';
          error.retryable = false;
        } else if (response.status === 401) {
          error.message = 'Authentication failed. The API key may be invalid or expired.';
          error.errorType = 'auth_error';
          error.retryable = false;
        } else {
          error.message = `API request failed (${response.status}): ${response.statusText}`;
          error.errorType = 'api_error';
          error.retryable = response.status >= 500;
        }
        
        throw error;
      }

      const result = await response.json();
      // SEQUENCE VERIFICATION - Check if backend processed the right sequence
      if (result.results && result.results['topology.pdb']) {
        // We could decode the PDB and check sequence length if needed for verification
      }
      
      if (result.status !== 'success') {
        bioEmuApiAvailable = false;
        console.error("❌ Inference failed:", result.message);
        throw new Error(`Inference failed: ${result.message || 'Unknown error'}`);
      }
        // API call was successful, update the status
      bioEmuApiAvailable = true;
      
      // Cache the results for sample proteins
      setCachedData(sequence, result.results, numSamples);
      return result.results;
    } catch (error) {
      console.error('BioEmu API Error:', error);
      
      // If API call fails and fallback is allowed, use fallback data
      if (useFallback) {
        return createFallbackResults(sequence, numSamples);
      }
      
      throw error;
    }
  } catch (error) {
    console.error('BioEmu Service Error:', error);
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
  console.error("❌ FALLBACK DATA DISABLED - Platform requires real Azure BioEmu API data only");
  throw new Error("NO FALLBACKS ALLOWED: This platform only works with real Azure BioEmu API data. Please ensure API is connected and working.");
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
      // Skip non-base64 data or undefined values
      if (!rawData || typeof rawData !== 'string') {
        continue;
      }
      
      try {
        // Handle binary files specially (like XTC)
        const isBinaryFile = fileName.toLowerCase().endsWith('.xtc');
        
        // Convert base64 to binary data
        const binaryData = atob(rawData);
        const bytes = new Uint8Array(binaryData.length);
        
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        // Create a blob with appropriate type
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
      } catch (error) {
        console.error(`Error decoding file ${fileName}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing API results:', error);
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
  
  // Only include XTC file if it exists and its size is valid
  // This prevents issues with binary handling in the viewer
  if (decodedFiles['samples.xtc'] && decodedFiles['samples.xtc'].size > 100) {
    try {
      molViewerFiles.xtcFile = {
        name: 'samples.xtc',
        data: decodedFiles['samples.xtc'].data,
        url: decodedFiles['samples.xtc'].url,
        isBinary: true
      };
    } catch (error) {
    }
  } else {
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
    const backendUrl = getBackendUrl();
    
    // Check if we have the required files
    if (!decodedFiles['topology.pdb'] || !decodedFiles['samples.xtc']) {
      throw new Error('Missing PDB or XTC files for analysis');
    }
    // Convert file data to base64 for API transmission
    const pdbBlob = decodedFiles['topology.pdb'].data;
    const xtcBlob = decodedFiles['samples.xtc'].data;
    const pdbBase64 = await blobToBase64(pdbBlob);
    const xtcBase64 = await blobToBase64(xtcBlob);
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Analysis request timed out after 60 seconds')), 60000);
    });
    
    // Create the actual request promise
    const requestPromise = fetch(`${backendUrl}/api/analyze-trajectory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdb: pdbBase64,
        xtc: xtcBase64
      })
    });
    
    // Race between timeout and actual request
    const response = await Promise.race([requestPromise, timeoutPromise]);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Backend error response:", errorText);
      throw new Error(`Analysis request failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    if (result.status !== 'success') {
      console.error("❌ Analysis failed on backend:", result.message);
      throw new Error(`Analysis failed: ${result.message}`);
    }
    // SEQUENCE LENGTH VERIFICATION
    if (result.analysis?.ensemble_stats?.n_residues) {
    }
    
    return result.analysis;
    
  } catch (error) {
    console.error('❌ Trajectory analysis failed:', error);
    console.error('🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
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
      const base64 = reader.result.split(',')[1]; // Remove data:... prefix
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
    
    // Check if we have the required files
    if (!decodedFiles['topology.pdb'] || !decodedFiles['samples.xtc']) {
      throw new Error('Missing PDB or XTC files for energy landscape analysis');
    }
    // Convert file data to base64 for API transmission (same as analyzeTrajectory)
    const pdbBlob = decodedFiles['topology.pdb'].data;
    const xtcBlob = decodedFiles['samples.xtc'].data;
    const pdbBase64 = await blobToBase64(pdbBlob);
    const xtcBase64 = await blobToBase64(xtcBlob);
    const requestData = {
      pdb: pdbBase64,
      xtc: xtcBase64,
      include_surface: options.includeSurface !== false, // Default true
      ...options
    };

    const response = await fetch(`${backendUrl}/api/energy-landscape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Energy landscape analysis failed with status ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status !== 'success') {
      throw new Error(result.message || 'Energy landscape analysis failed');
    }
    return result.landscape_data;

  } catch (error) {
    console.error("❌ Energy landscape analysis failed:", error);
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
    // 🎭 DEMO MODE: Check if this is Polyubiquitin-B (P0CG47) and use demo data
    if (proteinData.uniprot_id === 'P0CG47' || proteinData.uniprot_id === 'p0cg47') {
      // Return the demo data in the same format as the API would return
      const demoResults = {
        ...UBIQUITIN_DEMO_DATA.data,
        // Override sample count if requested differently than the demo (50 samples)
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
    
    // Check cache first using the sequence and numSamples
    const cachedData = getCachedData(proteinData.sequence, numSamples);
    if (cachedData) {
      // Enhance cached data with UniProt information
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
    } else {
    }

    // Reset API availability status
    bioEmuApiAvailable = false;
    
    const backendUrl = getBackendUrl();
    // Check backend status first
    try {
      const statusResponse = await fetch(`${backendUrl}/api/status`);
      if (!statusResponse.ok) {
        if (useFallback) {
          return createFallbackResults(proteinData.sequence, numSamples);
        }
        throw new Error('Backend server error');
      }
      
      const statusData = await statusResponse.json();
      if (statusData.status !== 'connected') {
        if (useFallback) {
          return createFallbackResults(proteinData.sequence, numSamples);
        }
        throw new Error(`API not connected: ${statusData.message}`);
      }
      bioEmuApiAvailable = true;
    } catch (error) {
      console.error('💥 Error checking API status:', error);
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
      sequence: proteinData.sequence, // Include sequence as fallback
      numSamples: numSamples,
      include_alphafold: includeAlphaFold
    };
    const startTime = performance.now();
    
    const response = await fetch(`${backendUrl}/api/predict-uniprot`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData),
    });

    const endTime = performance.now();
    if (!response.ok) {
      console.error('❌ UniProt API request failed');
      console.error('📊 Response status:', response.status);
      console.error('📊 Response statusText:', response.statusText);
      
      // Structured error handling for specific HTTP status codes
      const apiError = new Error();
      apiError.statusCode = response.status;
      
      if (response.status === 429) {
        apiError.message = 'This is an experimental research demo and we\u2019re experiencing high demand. Please try again in a few minutes.';
        apiError.errorType = 'rate_limit';
        apiError.retryable = true;
      } else if (response.status === 503 || response.status === 502) {
        apiError.message = 'This is an experimental research demo and we\u2019re experiencing high demand. Please try again in a few minutes.';
        apiError.errorType = 'service_unavailable';
        apiError.retryable = true;
      } else if (response.status === 504) {
        apiError.message = 'The request timed out. Large ensembles may take longer — try reducing the number of conformations or try the polyubiquitin example.';
        apiError.errorType = 'timeout';
        apiError.retryable = true;
      } else if (response.status === 403) {
        // Safety screening block — read the backend's message
        try {
          const errorData = await response.json();
          apiError.message = errorData.message || 'This request cannot be processed.';
        } catch {
          apiError.message = 'This request cannot be processed.';
        }
        apiError.errorType = 'blocked';
        apiError.retryable = false;
      } else if (response.status === 401) {
        apiError.message = 'Authentication failed. The API key may be invalid or expired.';
        apiError.errorType = 'auth_error';
        apiError.retryable = false;
      } else {
        try {
          const errorData = await response.json();
          apiError.message = errorData.message || `API request failed (${response.status}): ${response.statusText}`;
        } catch (parseError) {
          apiError.message = `API request failed (${response.status}): ${response.statusText}`;
        }
        apiError.errorType = 'api_error';
        apiError.retryable = response.status >= 500;
      }
      
      if (useFallback) {
        return createFallbackResults(proteinData.sequence, numSamples);
      }
      throw apiError;
    }

    const result = await response.json();
    if (result.status === 'success') {
      if (result.uniprot_data) {
      }
      
      if (result.alphafold_structure) {
      }

      // Cache the result using the sequence and numSamples as key
      setCachedData(proteinData.sequence, result, numSamples);
      
      bioEmuApiAvailable = true;
      return result;
    } else {
      console.error('❌ UniProt API returned error:', result.message);
      if (useFallback) {
        return createFallbackResults(proteinData.sequence, numSamples);
      }
      throw new Error(result.message || 'Unknown API error');
    }

  } catch (error) {
    console.error('💥 UniProt generateProteinSamples error:', error);
    bioEmuApiAvailable = false;
    
    if (useFallback) {
      return createFallbackResults(proteinData.sequence, numSamples);
    }
    
    throw error;
  }
};
