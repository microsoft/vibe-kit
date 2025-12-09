import React, { useState, useEffect, useCallback } from 'react';
import MolstarViewerDualStructure from './MolstarViewerDualStructure';
import RMSDVisualization from './RMSDVisualization';
import { getBackendUrl } from '../utils/apiConfig';

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
        console.error('Reference structure not available');
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
        console.error('Superposition failed:', result.message);
        setSuperpositionStatus('error');
      }
    } catch (error) {
      console.error('Superposition error:', error);
      setSuperpositionStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioEmuFiles, alphafoldPdbFile, customPdbFile, useCustomPdb, currentAlphafoldFile]);

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
      console.error('Error loading custom PDB:', error);
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
      console.error('Error loading AlphaFold structure:', error);
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
      <div className={`h-full w-full ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        <div className="h-screen flex flex-col">
          {/* Mobile-Responsive Header */}
          <div className="px-3 sm:px-4 md:px-6 py-3 flex-shrink-0">
            <div className="flex flex-col space-y-2">
              <h2 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Multi-Structure Comparison
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Compare molecular dynamics with static predictions
              </p>
            </div>
          </div>

          {/* Dual Structure Viewer */}
          <div className="flex-1 relative flex flex-col">
            {/* Mobile-Responsive Controls Bar */}
            <div className={`mx-3 sm:mx-6 mb-4 p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} flex-shrink-0`}>

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
                          className={`px-3 py-2 text-sm rounded border flex-1 sm:flex-none sm:w-36 ${isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-blue-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                            } focus:ring-1 focus:ring-blue-500/30 focus:outline-none transition-colors`}
                        />
                        <button
                          onClick={handleCustomPdbComparison}
                          disabled={isLoadingCustomPdb || !customPdbId.trim()}
                          className={`px-3 py-2 text-sm font-medium rounded transition-all duration-200 flex items-center justify-center space-x-1 flex-shrink-0 ${isLoadingCustomPdb || !customPdbId.trim()
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
                          className={`px-2 py-1 text-xs rounded transition-colors ${!useCustomPdb
                            ? isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50' : 'bg-blue-100 text-blue-700 border border-blue-300'
                            : isDarkMode ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-300'
                            }`}
                        >
                          AlphaFold
                        </button>

                        {customPdbFile && (
                          <button
                            onClick={() => setUseCustomPdb(true)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${useCustomPdb
                              ? isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50' : 'bg-blue-100 text-blue-700 border border-blue-300'
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
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all flex-shrink-0 ${superpositionStatus === 'loading'
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
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
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700/50' : 'bg-green-100 text-green-600 border border-green-300'}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>RMSD: {superposedFiles.qualityMetrics.avg_rmsd_to_alphafold.toFixed(3)} Å</span>
                    </div>
                  )}
                  {hasBioEmuData && hasAlphaFoldData && superpositionStatus !== 'success' && superpositionStatus !== 'loading' && (
                    <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-700/50' : 'bg-blue-100 text-blue-600 border border-blue-300'
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
                      className={`w-28 px-2 py-1 text-sm rounded border ${isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        } focus:ring-1 focus:ring-purple-500 focus:border-purple-500 focus:outline-none`}
                    />
                    <button
                      onClick={handleAlphafoldAddition}
                      disabled={isLoadingAlphafold || !alphafoldUniprotId.trim()}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${isLoadingAlphafold || !alphafoldUniprotId.trim()
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
                      className={`w-24 px-2 py-1 text-sm rounded border ${isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none`}
                    />
                    <button
                      onClick={handleCustomPdbComparison}
                      disabled={isLoadingCustomPdb || !customPdbId.trim()}
                      className={`px-3 py-1 text-xs font-medium rounded transition-all ${isLoadingCustomPdb || !customPdbId.trim()
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
            <div className="flex-1 relative bg-white dark:bg-gray-900" style={{ minHeight: '600px', height: '70vh' }}>
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
              <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        RMSD Analysis
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Root Mean Square Deviation analysis comparing BioEmu ensemble to {superposedFiles?.referenceLabel || 'reference structure'}
                      </p>
                    </div>

                    {/* Current Reference Indicator */}
                    <div className={`flex items-center space-x-2 px-2 py-1 rounded border ${superposedFiles?.referenceType === 'custom_pdb'
                      ? isDarkMode ? 'bg-pink-900/20 border-pink-600' : 'bg-pink-50 border-pink-300'
                      : isDarkMode ? 'bg-purple-900/20 border-purple-600' : 'bg-purple-50 border-purple-300'
                      }`}>
                      <div className={`w-2 h-2 rounded-full ${superposedFiles?.referenceType === 'custom_pdb' ? 'bg-pink-500' : 'bg-purple-500'
                        }`}></div>
                      <span className={`text-xs font-medium ${superposedFiles?.referenceType === 'custom_pdb'
                        ? isDarkMode ? 'text-pink-300' : 'text-pink-700'
                        : isDarkMode ? 'text-purple-300' : 'text-purple-700'
                        }`}>
                        vs {superposedFiles?.referenceLabel || 'Reference'}
                      </span>
                    </div>
                  </div>

                  {superposedFiles?.method && (
                    <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
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
      <div className={`h-full w-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">
            BioEmu + AlphaFold Comparison
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Compare BioEmu-generated conformational ensembles with AlphaFold predictions to understand protein dynamics vs. static structure.
          </p>

          {/* Status Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* BioEmu Status */}
            <div className={`border rounded-lg p-4 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center mb-3">
                <div className="text-2xl mr-3">
                  {/* No icon */}
                </div>
                <div>
                  <h3 className="font-semibold">BioEmu Ensemble</h3>
                  <span className={`text-sm font-medium ${hasBioEmuData ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {hasBioEmuData ? (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Ready
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Not Generated
                      </div>
                    )}
                  </span>
                </div>
              </div>
              {!hasBioEmuData ? (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Generate a BioEmu conformational ensemble first to enable comparison.
                  </p>
                  <button
                    onClick={() => onBioEmuLaunch && onBioEmuLaunch(sequence || '', 'Generate Ensemble')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Generate Ensemble</span>
                  </button>
                </div>
              ) : (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    BioEmu ensemble is available. View the conformational dynamics in the Structure tab.
                  </p>
                  <button
                    onClick={() => onTabChange && onTabChange('visualization')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>View in Structure Tab</span>
                  </button>
                </div>
              )}
            </div>

            {/* AlphaFold Status */}
            <div className={`border rounded-lg p-4 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center mb-3">
                <div className="text-2xl mr-3">
                  {/* No icon */}
                </div>
                <div>
                  <h3 className="font-semibold">AlphaFold Structure</h3>
                  <span className={`text-sm font-medium ${hasAlphaFoldData ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {hasAlphaFoldData ? (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Ready
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Not Available
                      </div>
                    )}
                  </span>
                </div>
              </div>
              {!hasAlphaFoldData && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {hasBioEmuData
                      ? "AlphaFold currently unavailable due to API issues. BioEmu analysis available below."
                      : "AlphaFold structures are automatically fetched for UniProt ID inputs."
                    }
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <strong>Tip:</strong> Use the UniProt ID option on the Generate tab for automatic AlphaFold comparison.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* What This Tab Does */}
          <div className={`border rounded-lg p-6 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold mb-3">
              What You'll See Here
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2 text-blue-600 dark:text-blue-400">
                  BioEmu Dynamics
                </h4>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Multiple conformational states</li>
                  <li>• Flexible regions and movements</li>
                  <li>• Dynamic structural changes</li>
                  <li>• Ensemble flexibility patterns</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-green-600 dark:text-green-400">
                  AlphaFold Prediction
                </h4>
                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Single predicted structure</li>
                  <li>• High-confidence static model</li>
                  <li>• Sequence-based prediction</li>
                  <li>• Confidence score mapping</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Comparison Value:</strong> See how dynamic MD-based conformational ensembles
                relate to static structure predictions, revealing regions of flexibility vs. stability.
              </p>
            </div>
          </div>

          {/* How to Get Both */}
          {(!hasBioEmuData || !hasAlphaFoldData) && (
            <div className={`border rounded-lg p-6 mt-6 ${isDarkMode ? 'border-blue-700 bg-blue-900/20' : 'border-blue-200 bg-blue-50'}`}>
              <h3 className="font-semibold mb-3">
                How to Enable Full Comparison
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-3 mt-0.5">1</span>
                  <div>
                    <strong>Use UniProt ID Input:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      On the Generate Ensemble tab, choose "UniProt ID" and enter a protein ID (e.g., P53_HUMAN, Q9Y2J2)
                      to automatically fetch both BioEmu ensemble and AlphaFold structure.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-3 mt-0.5">2</span>
                  <div>
                    <strong>Generate Ensemble:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      Click "Generate Ensemble" to create the BioEmu conformational ensemble for your protein.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mr-3 mt-0.5">3</span>
                  <div>
                    <strong>Return Here:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      Once both are ready, this tab will show side-by-side comparison with structural alignment and analysis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main interface when we have BioEmu data (AlphaFold optional)
  return (
    <div className={`h-full w-full ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div>
        <h1 className="text-2xl font-bold mb-4">
          BioEmu + AlphaFold Comparison
        </h1>

        {hasAlphaFoldData ? (
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Comparing BioEmu-generated conformational ensemble with AlphaFold prediction for deeper structural insights.
          </p>
        ) : (
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              BioEmu ensemble is ready. AlphaFold comparison will be available when both structures are loaded.
            </p>
            <div className="text-sm text-orange-600 dark:text-orange-400 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              AlphaFold structure not available (API issue or manual sequence input)
            </div>
          </div>
        )}

        {/* BioEmu-only analysis when AlphaFold is unavailable */}
        {hasBioEmuData ? (
          <div className="space-y-6">
            {/* BioEmu Structure Viewer */}
            <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  BioEmu Ensemble Viewer
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Explore the conformational ensemble generated by BioEmu
                </p>
              </div>
              <div className="p-4">
                <div className="h-[600px] w-full">
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
            </div>

            {/* Ensemble Statistics - only show if we have meaningful data */}
            {analysisData && (analysisData.n_frames || analysisData.real_flexibility) && (
              <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Ensemble Analysis
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Statistical analysis of structural flexibility and conformational diversity
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {analysisData.n_frames || (analysisData.real_flexibility?.length) || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Conformations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {sequence?.length || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Residues</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {analysisData.real_flexibility && analysisData.real_flexibility.length > 0 ?
                          `${Math.min(...analysisData.real_flexibility).toFixed(2)}-${Math.max(...analysisData.real_flexibility).toFixed(2)}` :
                          'N/A'
                        }
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Flexibility Range (Å)</div>
                    </div>
                  </div>

                  {/* Additional info about what's available */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Available Analysis:</strong> BioEmu ensemble structural dynamics
                      {!hasAlphaFoldData && (
                        <span className="block mt-1 text-orange-600 dark:text-orange-400">
                          📋 <strong>Note:</strong> Additional comparative analysis will be available when AlphaFold data is loaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <div className="text-center">
              <div className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Data Available</h4>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generate a protein ensemble first to explore analysis data and download files.</p>
              <button
                onClick={() => onBioEmuLaunch && onBioEmuLaunch('', '')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Go to Generate Tab
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProteinAnalysisPage;