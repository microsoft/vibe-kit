import React, { useState, useEffect, useCallback } from 'react';
import MolstarViewerDualStructure from './MolstarViewerDualStructure.fixed';
import RMSDVisualization from './RMSDVisualization';

/**
 * Automatically detects the environment and returns the appropriate backend URL
 * - In local development (localhost:3000): returns 'http://localhost:5000'
 * - In Docker/production: returns '' (relative URLs for same-origin requests)
 * @returns {string} The backend URL to use for API calls
 */
const getBackendUrl = () => {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check if we're running on localhost (React dev server)
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '::1';
  
  // Get current port
  const currentPort = window.location.port;
  
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

const ProteinAnalysisPage = ({ 
  isDarkMode, 
  bioEmuFiles, 
  alphafoldPdbFile, 
  sequence, 
  analysisData, 
  proteinInfo, 
  uniprotId, 
  onBioEmuLaunch,
  onTabChange 
}) => {
  // State for superposed structures
  const [superposedFiles, setSuperposedFiles] = useState(null);
  const [superpositionStatus, setSuperpositionStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'

  // State for custom PDB comparison
  const [customPdbId, setCustomPdbId] = useState('');
  const [customPdbFile, setCustomPdbFile] = useState(null);
  const [isLoadingCustomPdb, setIsLoadingCustomPdb] = useState(false);
  const [useCustomPdb, setUseCustomPdb] = useState(false); // Toggle between AlphaFold and Custom PDB reference

  // State for manual AlphaFold addition
  const [alphafoldUniprotId, setAlphafoldUniprotId] = useState('');
  const [isLoadingAlphafold, setIsLoadingAlphafold] = useState(false);
  const [manualAlphafoldFile, setManualAlphafoldFile] = useState(null);

  // Check if we have BioEmu data available - use multiple indicators for robustness
  const hasBioEmuData = (bioEmuFiles?.pdbFile && bioEmuFiles?.xtcFile) || 
                        (analysisData?.structure_files) ||
                        (sequence && analysisData?.real_flexibility);
  
  // Check if we have AlphaFold data available (either from original input or manually added)
  const hasAlphaFoldData = alphafoldPdbFile || manualAlphafoldFile;
  const currentAlphafoldFile = manualAlphafoldFile || alphafoldPdbFile;

  // Superposition function
  const performSuperposition = useCallback(async () => {
    try {
      setSuperpositionStatus('loading');
      // Determine reference structure based on user choice
      const referenceFile = useCustomPdb ? customPdbFile : currentAlphafoldFile;
      const referenceLabel = useCustomPdb ? `PDB ${customPdbFile?.id}` : 'AlphaFold';
      
      if (!referenceFile || !referenceFile.url) {
        console.error('❌ Reference structure not available');
        setSuperpositionStatus('error');
        return;
      }
      // Get base64 data from file URLs - only fetch the chosen reference
      const [bioEmuPdbResponse, bioEmuXtcResponse, referenceResponse] = await Promise.all([
        fetch(bioEmuFiles.pdbFile.url),
        fetch(bioEmuFiles.xtcFile.url),
        fetch(referenceFile.url)
      ]);
      const [bioEmuPdbBuffer, bioEmuXtcBuffer, referenceBuffer] = await Promise.all([
        bioEmuPdbResponse.arrayBuffer(),
        bioEmuXtcResponse.arrayBuffer(),
        referenceResponse.arrayBuffer()
      ]);
      // Helper function to convert large ArrayBuffer to base64 without stack overflow
      const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 8192; // Process in 8KB chunks
        let binaryString = '';
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, chunk);
        }
        
        return btoa(binaryString);
      };
      // Convert to base64 using chunked approach
      const bioEmuPdbB64 = arrayBufferToBase64(bioEmuPdbBuffer);
      const bioEmuXtcB64 = arrayBufferToBase64(bioEmuXtcBuffer);
      const referenceB64 = arrayBufferToBase64(referenceBuffer);
      const requestBody = {
        bioemu_pdb: bioEmuPdbB64,
        bioemu_xtc: bioEmuXtcB64,
        alphafold_pdb: referenceB64, // Backend expects 'alphafold_pdb' but we use it for chosen reference
        use_sequence_alignment: true, // Re-enable to test the working sequence alignment
        reference_type: useCustomPdb ? 'custom_pdb' : 'alphafold', // Track what we're using
        reference_label: referenceLabel
      };
      
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/superpose-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (result.status === 'success') {
        // Create blob URLs for superposed data
        const superposedXtcBlob = new Blob([
          Uint8Array.from(atob(result.superposed_trajectory), c => c.charCodeAt(0))
        ]);
        const superposedXtcUrl = URL.createObjectURL(superposedXtcBlob);
        setSuperposedFiles({
          pdbFile: bioEmuFiles.pdbFile, // Use original topology
          xtcFile: { url: superposedXtcUrl }, // Use superposed trajectory
          qualityMetrics: result.quality_metrics,
          referenceType: useCustomPdb ? 'custom_pdb' : 'alphafold',
          referenceLabel: referenceLabel,
          method: result.method
        });
        
        setSuperpositionStatus('success');
      } else {
        console.error('❌ Superposition failed:', result.message);
        setSuperpositionStatus('error');
      }
    } catch (error) {
      console.error('❌ Superposition error:', error);
      setSuperpositionStatus('error');
    }
  }, [bioEmuFiles, alphafoldPdbFile, manualAlphafoldFile, customPdbFile, useCustomPdb, currentAlphafoldFile]);
  
  // Function to handle custom PDB loading
  const handleCustomPdbComparison = useCallback(async () => {
    if (!customPdbId.trim()) {
      alert('Please enter a PDB ID');
      return;
    }

    setIsLoadingCustomPdb(true);
    
    try {
      // Fetch PDB structure from RCSB
      const pdbUrl = `https://files.rcsb.org/download/${customPdbId.toUpperCase()}.pdb`;
      const response = await fetch(pdbUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB ${customPdbId}: ${response.status}`);
      }
      
      const pdbContent = await response.text();
      
      // Create a blob and URL for the PDB file
      const pdbBlob = new Blob([pdbContent], { type: 'text/plain' });
      const pdbUrl2 = URL.createObjectURL(pdbBlob);
      
      setCustomPdbFile({
        url: pdbUrl2,
        name: `${customPdbId.toUpperCase()}.pdb`,
        id: customPdbId.toUpperCase()
      });
    } catch (error) {
      console.error('❌ Error loading custom PDB:', error);
      alert(`Failed to load PDB ${customPdbId}: ${error.message}`);
    } finally {
      setIsLoadingCustomPdb(false);
    }
  }, [customPdbId]);

  // Function to handle manual AlphaFold structure loading
  const handleAlphafoldAddition = useCallback(async () => {
    if (!alphafoldUniprotId.trim()) {
      alert('Please enter a UniProt ID');
      return;
    }

    setIsLoadingAlphafold(true);
    
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/alphafold-structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uniprot_id: alphafoldUniprotId.trim().toUpperCase()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch AlphaFold structure: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status !== 'success' || !result.pdb_content) {
        throw new Error(result.message || 'No AlphaFold structure data received');
      }
      
      // Create a blob and URL for the AlphaFold PDB file
      const alphafoldBlob = new Blob([result.pdb_content], { type: 'text/plain' });
      const alphafoldUrl = URL.createObjectURL(alphafoldBlob);
      
      setManualAlphafoldFile({
        url: alphafoldUrl,
        name: `AF-${alphafoldUniprotId.toUpperCase()}.pdb`,
        id: alphafoldUniprotId.toUpperCase(),
        uniprotId: alphafoldUniprotId.toUpperCase()
      });
    } catch (error) {
      console.error('❌ Error loading AlphaFold structure:', error);
      alert(`Failed to load AlphaFold structure for ${alphafoldUniprotId}: ${error.message}`);
    } finally {
      setIsLoadingAlphafold(false);
    }
  }, [alphafoldUniprotId]);
  
  // Perform structural superposition when structures are available and conditions change
  useEffect(() => {
    const hasSelectedReference = useCustomPdb ? (customPdbFile && customPdbFile.url) : hasAlphaFoldData;
    
    if (hasBioEmuData && hasSelectedReference && superpositionStatus === 'idle') {
      performSuperposition();
    }
  }, [hasBioEmuData, hasAlphaFoldData, customPdbFile, useCustomPdb, superpositionStatus, performSuperposition]);

  // Reset superposition when reference choice changes (only track useCustomPdb change)
  useEffect(() => {
    setSuperpositionStatus('idle'); // Trigger re-calculation with new reference
  }, [useCustomPdb]);

  // Find interesting regions for highlighting
  // Show the multi-structure comparison when we have BioEmu data
  if (hasBioEmuData) {
    return (
      <div className={`w-full ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="flex flex-col">
          {/* Header */}
          <div className="px-3 sm:px-4 md:px-6 py-3 flex-shrink-0">
            <div className="flex flex-col space-y-2">
              <h2 className="text-heading" style={{ fontSize: 20 }}>
                Multi-Structure Comparison
              </h2>
              <p className="text-body" style={{ fontSize: 13 }}>
                Compare molecular dynamics with static predictions
              </p>
            </div>
          </div>

          {/* Dual Structure Viewer */}
          <div className="relative flex flex-col">
            {/* Mobile-Responsive Controls Bar */}
            <div className="card mx-3 sm:mx-6 mb-4 p-3 sm:p-4 flex-shrink-0">
              
              {/* Mobile: Stack vertically, Desktop: Horizontal layout */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
                
                {/* Add Structure Controls - Mobile First */}
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  {/* Add PDB Control - Mobile Responsive */}
                  {hasBioEmuData && hasAlphaFoldData && (
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>Add Structure:</span>
                      <div className="flex space-x-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="PDB ID (e.g., 1CRN)"
                          value={customPdbId}
                          onChange={(e) => setCustomPdbId(e.target.value.toUpperCase())}
                          className={`px-3 py-2 text-sm rounded border flex-1 sm:flex-none sm:w-36 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-blue-500' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                          } focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors`}
                        />
                        <button 
                          onClick={handleCustomPdbComparison}
                          disabled={isLoadingCustomPdb || !customPdbId.trim()}
                          className={`px-3 py-2 text-sm font-medium rounded transition-all duration-200 flex items-center justify-center space-x-1 flex-shrink-0 ${
                            isLoadingCustomPdb || !customPdbId.trim()
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                        {isLoadingCustomPdb ? (
                          <>
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Loading</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Add</span>
                          </>
                        )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Loaded Structures - Mobile Responsive Pills */}
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>Structures:</span>
                  <div className="flex flex-wrap items-center gap-2">
                  
                  {/* BioEmu Pill */}
                  {hasBioEmuData && (
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-orange-900/20 border border-orange-700/50' : 'bg-orange-50 border border-orange-200'}`}>
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                        BioEmu MD
                      </span>
                    </div>
                  )}

                  {/* AlphaFold Pill */}
                  {hasAlphaFoldData && (
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-purple-900/20 border border-purple-700/50' : 'bg-purple-50 border border-purple-200'}`}>
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                        AlphaFold
                      </span>
                      <button 
                        onClick={() => {
                          setManualAlphafoldFile(null);
                          setAlphafoldUniprotId('');
                        }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${isDarkMode ? 'hover:bg-purple-800/50 text-purple-400' : 'hover:bg-purple-200 text-purple-600'} transition-colors ml-1`}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Custom PDB Pill */}
                  {customPdbFile && (
                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-pink-900/20 border border-pink-700/50' : 'bg-pink-50 border border-pink-200'}`}>
                      <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-pink-300' : 'text-pink-700'}`}>
                        {customPdbId}
                      </span>
                      <button 
                        onClick={() => {
                          setCustomPdbFile(null);
                          setCustomPdbId('');
                        }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${isDarkMode ? 'hover:bg-pink-800/50 text-pink-400' : 'hover:bg-pink-200 text-pink-600'} transition-colors ml-1`}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  </div>
                </div>
                
                {/* RMSD Analysis Controls - Mobile Responsive */}
                {hasBioEmuData && hasAlphaFoldData && (
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} flex-shrink-0`}>RMSD Comparison for</span>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => setUseCustomPdb(false)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            !useCustomPdb
                              ? isDarkMode ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50' : 'bg-purple-100 text-purple-700 border border-purple-300'
                              : isDarkMode ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}
                        >
                          AlphaFold
                        </button>
                        
                        {customPdbFile && (
                          <button
                            onClick={() => setUseCustomPdb(true)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              useCustomPdb
                                ? isDarkMode ? 'bg-pink-900/30 text-pink-300 border border-pink-700/50' : 'bg-pink-100 text-pink-700 border border-pink-300'
                                : isDarkMode ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-300'
                            }`}
                          >
                            {customPdbId}
                          </button>
                        )}
                      </div>
                      
                      <button
                        onClick={performSuperposition}
                        disabled={superpositionStatus === 'loading'}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex-shrink-0 ${
                          superpositionStatus === 'loading'
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : useCustomPdb
                              ? 'bg-pink-600 hover:bg-pink-700 text-white shadow-sm'
                              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                        }`}
                      >
                        {superpositionStatus === 'loading' ? 'Analyzing...' : 'Analyze'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Indicator - Mobile Responsive */}
                <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end w-full lg:w-auto">
                  {superpositionStatus === 'success' && superposedFiles?.qualityMetrics && (
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${useCustomPdb
                      ? isDarkMode ? 'bg-pink-900/30 text-pink-400 border border-pink-700/50' : 'bg-pink-100 text-pink-600 border border-pink-300'
                      : isDarkMode ? 'bg-purple-900/30 text-purple-400 border border-purple-700/50' : 'bg-purple-100 text-purple-600 border border-purple-300'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>RMSD: {superposedFiles.qualityMetrics.avg_rmsd_to_alphafold.toFixed(3)} Å</span>
                    </div>
                  )}
                  {hasBioEmuData && hasAlphaFoldData && superpositionStatus !== 'success' && superpositionStatus !== 'loading' && (
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
                      isDarkMode ? 'bg-purple-900/30 text-purple-400 border border-purple-700/50' : 'bg-purple-100 text-purple-600 border border-purple-300'
                    }`}>
                      <span>Ready to Analyze</span>
                    </div>
                  )}
                  {superpositionStatus === 'error' && (
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-700/50' : 'bg-red-100 text-red-600 border border-red-300'}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Error</span>
                    </div>
                  )}
                </div>
                
              </div>
            </div>

            {/* Compact Add Controls */}
            {hasBioEmuData && !hasAlphaFoldData && (
              <div className={`mx-6 mb-3 p-2.5 rounded-lg border max-w-5xl ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center space-x-4">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Add:</span>
                  
                  {/* AlphaFold Input */}
                  <div className="flex items-center space-x-2">
                    <label className={`text-sm ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>AlphaFold</label>
                    <input
                      type="text"
                      placeholder="UniProt ID"
                      value={alphafoldUniprotId}
                      onChange={(e) => setAlphafoldUniprotId(e.target.value.toUpperCase())}
                      className={`w-28 px-2 py-1 text-sm rounded border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:ring-1 focus:ring-purple-500 focus:border-purple-500 focus:outline-none`}
                    />
                    <button 
                      onClick={handleAlphafoldAddition}
                      disabled={isLoadingAlphafold || !alphafoldUniprotId.trim()}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                        isLoadingAlphafold || !alphafoldUniprotId.trim()
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {isLoadingAlphafold ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                  
                  <div className={`w-px h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  
                  {/* PDB Input */}
                  <div className="flex items-center space-x-2">
                    <label className={`text-sm ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>PDB</label>
                    <input
                      type="text"
                      placeholder="PDB ID"
                      value={customPdbId}
                      onChange={(e) => setCustomPdbId(e.target.value.toUpperCase())}
                      className={`w-24 px-2 py-1 text-sm rounded border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none`}
                    />
                    <button 
                      onClick={handleCustomPdbComparison}
                      disabled={isLoadingCustomPdb || !customPdbId.trim()}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                        isLoadingCustomPdb || !customPdbId.trim()
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isLoadingCustomPdb ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Molstar Viewer */}
            <div className="relative" style={{ height: '70vh', minHeight: '500px', background: 'var(--bg-base)' }}>
            <MolstarViewerDualStructure
              bioEmuFiles={superposedFiles || bioEmuFiles}
              alphaFoldFile={currentAlphafoldFile}
              customPdbFile={customPdbFile}
              sequence={sequence}
              analysisData={analysisData}
              isDarkMode={isDarkMode}
            />
            </div>


          </div>

          {/* RMSD Analysis Section */}
          {superpositionStatus === 'success' && superposedFiles?.qualityMetrics && (
            <div className="mt-6 mb-4">
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--stroke-default)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                    <h2 className="text-heading" style={{ fontSize: 20, marginBottom: 4 }}>
                      RMSD Analysis
                    </h2>
                    <p className="text-body" style={{ fontSize: 13, marginTop: 4 }}>
                      Root Mean Square Deviation analysis comparing BioEmu ensemble to {superposedFiles?.referenceLabel || 'reference structure'}
                    </p>
                  </div>
                  
                  {/* Current Reference Indicator */}
                  <div className="app-header__btn" style={{ padding: '4px 10px', fontSize: 11 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: superposedFiles?.referenceType === 'custom_pdb' ? 'var(--accent-bio)' : 'var(--accent-bio)' }}></div>
                    <span>
                      vs {superposedFiles?.referenceLabel || 'Reference'}
                    </span>
                  </div>
                </div>
                
                {superposedFiles?.method && (
                  <div className="text-caption" style={{ marginTop: 12, color: 'var(--accent-chemistry)' }}>
                    Method: {superposedFiles.method}
                  </div>
                )}
              </div>
              <div className="p-4">
                <RMSDVisualization 
                  rmsdData={superposedFiles.qualityMetrics} 
                  referenceInfo={{
                    referenceType: superposedFiles.referenceType,
                    referenceLabel: superposedFiles.referenceLabel
                  }}
                  isDarkMode={isDarkMode} 
                />
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  // Fallback UI when we don't have BioEmu data
  if (!hasBioEmuData) {
    return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ marginBottom: 20, color: 'var(--fg-tertiary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h3 className="text-heading" style={{ fontSize: 17, marginBottom: 8 }}>No structures to compare</h3>
        <p className="text-body" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Generate a BioEmu conformational ensemble first. This tab compares the ensemble against AlphaFold predictions or custom PDB structures, showing structural alignment and RMSD analysis.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => onBioEmuLaunch && onBioEmuLaunch(sequence || '', 'Generate Ensemble')}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: 13 }}
          >
            Go to Generate
          </button>
        </div>
        <p className="text-caption" style={{ fontSize: 11, marginTop: 16 }}>
          Tip: Use a UniProt ID to auto-fetch AlphaFold for comparison
        </p>
      </div>
    </div>
    );
  }

  // Main interface when we have BioEmu data (AlphaFold optional)
  return (
    <div className={`h-full w-full ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div>
        <div className="px-3 sm:px-4 md:px-6 py-3">
          <h2 className="text-heading" style={{ fontSize: 20 }}>Multi-Structure Comparison</h2>
          <p className="text-body" style={{ fontSize: 13 }}>
            {hasAlphaFoldData
              ? 'Comparing BioEmu ensemble with AlphaFold prediction'
              : 'BioEmu ensemble ready — add AlphaFold or a PDB to compare'}
          </p>
          {!hasAlphaFoldData && (
            <p className="text-caption" style={{ fontSize: 11, marginTop: 4 }}>
              AlphaFold not available. Use a UniProt ID on the Generate tab, or add a custom PDB below.
            </p>
          )}
        </div>

        {/* BioEmu-only viewer */}
        {hasBioEmuData ? (
          <div className="space-y-4 px-3 sm:px-4 md:px-6">
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke-default)' }}>
                <h3 className="text-heading" style={{ fontSize: 15 }}>BioEmu Ensemble Viewer</h3>
                <p className="text-caption" style={{ fontSize: 12 }}>Explore the conformational ensemble</p>
              </div>
              <div className="relative" style={{ height: '70vh', minHeight: 400, background: 'var(--bg-base)' }}>
                {bioEmuFiles && (
                  <MolstarViewerDualStructure
                    bioEmuFiles={bioEmuFiles}
                    alphaFoldFile={null}
                    sequence={sequence}
                    analysisData={analysisData}
                    isDarkMode={isDarkMode}
                  />
                )}
              </div>
            </div>

            {/* Quick stats */}
            {analysisData && (
              <div className="grid grid-cols-3 gap-3">
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>
                    {analysisData.n_frames || analysisData.real_flexibility?.length || '—'}
                  </div>
                  <div className="text-caption">Conformations</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>
                    {sequence?.length || '—'}
                  </div>
                  <div className="text-caption">Residues</div>
                </div>
                <div className="card" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-bio)' }}>
                    {analysisData.real_flexibility?.length > 0
                      ? `${Math.min(...analysisData.real_flexibility).toFixed(2)}–${Math.max(...analysisData.real_flexibility).toFixed(2)}`
                      : '—'}
                  </div>
                  <div className="text-caption">Flexibility (Å)</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, padding: 32 }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <h3 className="text-heading" style={{ fontSize: 16, marginBottom: 8 }}>No data available</h3>
              <p className="text-body" style={{ fontSize: 13, marginBottom: 16 }}>Generate a protein ensemble first.</p>
              <button onClick={() => onBioEmuLaunch && onBioEmuLaunch('', '')} className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
                Go to Generate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProteinAnalysisPage;