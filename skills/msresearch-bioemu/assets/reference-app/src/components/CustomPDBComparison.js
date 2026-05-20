import React, { useState, useCallback } from 'react';
import { PDBInput } from './PDBInput';
import RMSDVisualization from './RMSDVisualization';
import MolstarViewerDualStructure from './MolstarViewerDualStructure.fixed';

/**
 * Custom PDB Comparison Component
 * Allows users to compare their BioEmu ensemble with any PDB structure
 */
const CustomPDBComparison = ({ bioEmuFiles, analysisData, isDarkMode, sequence }) => {
  // State for custom PDB comparison
  const [customPdbId, setCustomPdbId] = useState('');
  const [customChainId, setCustomChainId] = useState('');
  const [customPdbData, setCustomPdbData] = useState(null);
  const [isLoadingCustomPdb, setIsLoadingCustomPdb] = useState(false);
  const [superpositionData, setSuperpositionData] = useState(null);
  const [error, setError] = useState(null);

  // Handle PDB input changes
  const handlePDBChange = useCallback((newPdbId, newChainId) => {
    setCustomPdbId(newPdbId);
    setCustomChainId(newChainId);
    // Clear previous data when input changes
    setCustomPdbData(null);
    setSuperpositionData(null);
    setError(null);
  }, []);

  // Handle when PDB sequence is fetched - don't auto-trigger comparison
  const handlePDBSequenceFetched = useCallback(async (fetchedSequence, pdbInfo) => {
    setCustomPdbData({
      sequence: fetchedSequence,
      pdbId: pdbInfo.pdbId,
      chainId: pdbInfo.chainId,
      sequenceLength: pdbInfo.sequenceLength
    });
    
    // Clear any previous superposition data when new PDB is loaded
    setSuperpositionData(null);
    setError(null);
  }, []);

  // Perform structural superposition comparison
  const performComparison = async (pdbId, chainId) => {
    setIsLoadingCustomPdb(true);
    setError(null);
    
    try {
      // Fetch PDB structure from RCSB
      const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
      const pdbResponse = await fetch(pdbUrl);
      
      if (!pdbResponse.ok) {
        throw new Error(`Failed to fetch PDB ${pdbId}: ${pdbResponse.status}`);
      }
      
      const pdbContent = await pdbResponse.text();
      
      // Convert to base64
      const pdbBase64 = btoa(pdbContent);
      
      // Get BioEmu files
      if (!bioEmuFiles?.pdbFile || !bioEmuFiles?.xtcFile) {
        throw new Error('BioEmu files not available');
      }
      
      // Convert BioEmu files to base64 - handle different file types
      let bioEmuPdbBase64, bioEmuXtcBase64;
      
      // Handle bioEmuFiles.pdbFile - could be File object or URL object
      if (bioEmuFiles.pdbFile instanceof File) {
        const bioEmuPdbArrayBuffer = await bioEmuFiles.pdbFile.arrayBuffer();
        bioEmuPdbBase64 = btoa(String.fromCharCode(...new Uint8Array(bioEmuPdbArrayBuffer)));
      } else if (bioEmuFiles.pdbFile.url) {
        const pdbResponse = await fetch(bioEmuFiles.pdbFile.url);
        const bioEmuPdbArrayBuffer = await pdbResponse.arrayBuffer();
        bioEmuPdbBase64 = btoa(String.fromCharCode(...new Uint8Array(bioEmuPdbArrayBuffer)));
      } else {
        throw new Error('Invalid BioEmu PDB file format');
      }
      
      // Handle bioEmuFiles.xtcFile - could be File object or URL object
      if (bioEmuFiles.xtcFile instanceof File) {
        const bioEmuXtcArrayBuffer = await bioEmuFiles.xtcFile.arrayBuffer();
        bioEmuXtcBase64 = btoa(String.fromCharCode(...new Uint8Array(bioEmuXtcArrayBuffer)));
      } else if (bioEmuFiles.xtcFile.url) {
        const xtcResponse = await fetch(bioEmuFiles.xtcFile.url);
        const bioEmuXtcArrayBuffer = await xtcResponse.arrayBuffer();
        bioEmuXtcBase64 = btoa(String.fromCharCode(...new Uint8Array(bioEmuXtcArrayBuffer)));
      } else {
        throw new Error('Invalid BioEmu XTC file format');
      }

      const backendUrl = process.env.NODE_ENV === 'development' && 
                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                        ? 'http://localhost:5000' : '';

      const response = await fetch(`${backendUrl}/api/superpose-structures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bioemu_pdb: bioEmuPdbBase64,
          bioemu_xtc: bioEmuXtcBase64,
          alphafold_pdb: pdbBase64,
          use_sequence_alignment: true
        })
      });

      if (!response.ok) {
        throw new Error(`Superposition failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        // Create blob URLs for the superposed structures
        const referenceBlobUrl = createBlobUrl(result.reference_pdb_content, 'chemical/x-pdb');
        const mobileBlobUrl = createBlobUrl(result.mobile_pdb_content, 'chemical/x-pdb');
        
        setSuperpositionData({
          ...result,
          reference_blob_url: referenceBlobUrl,
          mobile_blob_url: mobileBlobUrl
        });
      } else {
        throw new Error(result.message || 'Superposition failed');
      }
    } catch (err) {
      console.error('❌ Error in custom PDB superposition:', err);
      setError(err.message);
    } finally {
      setIsLoadingCustomPdb(false);
    }
  };

  // Helper function to create blob URLs
  const createBlobUrl = (content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  // Check if we have BioEmu data
  const hasBioEmuData = bioEmuFiles && analysisData;

  return (
    <div className="w-full max-w-none overflow-x-hidden space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center mb-4 space-y-2 sm:space-y-0">
            <div className="flex items-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <div>
                <h3 className="text-base sm:text-lg font-semibold">Custom PDB Comparison</h3>
                <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                  Compare your BioEmu ensemble with any structure from the Protein Data Bank
                </p>
              </div>
            </div>
          </div>

          {/* PDB Input */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Enter PDB ID to Compare
            </label>
            <PDBInput
              pdbId={customPdbId}
              chainId={customChainId}
              onPDBChange={handlePDBChange}
              isDarkMode={isDarkMode}
              onSequenceFetched={handlePDBSequenceFetched}
            />
          </div>

          {/* Generate Comparison Button */}
          {customPdbData && hasBioEmuData && !isLoadingCustomPdb && (
            <div className="mb-4">
              <button
                onClick={() => performComparison(customPdbData.pdbId, customPdbData.chainId)}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Generate Structural Comparison</span>
              </button>
            </div>
          )}

          {/* Status Messages */}
          {!hasBioEmuData && (
            <div className={`p-3 rounded ${isDarkMode ? 'bg-orange-900/50 border-orange-700' : 'bg-orange-50 border-orange-200'} border`}>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-xs sm:text-sm">Generate a BioEmu ensemble first to enable PDB comparison</span>
              </div>
            </div>
          )}

          {error && (
            <div className={`p-3 rounded ${isDarkMode ? 'bg-red-900/50 border-red-700' : 'bg-red-50 border-red-200'} border`}>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs sm:text-sm text-red-600 dark:text-red-400 break-words">{error}</span>
              </div>
            </div>
          )}

          {isLoadingCustomPdb && (
            <div className={`p-3 rounded ${isDarkMode ? 'bg-blue-900/50 border-blue-700' : 'bg-blue-50 border-blue-200'} border`}>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs sm:text-sm">Fetching PDB structure and performing superposition...</span>
              </div>
            </div>
          )}

          {customPdbData && (
            <div className={`p-3 rounded ${isDarkMode ? 'bg-green-900/50 border-green-700' : 'bg-green-50 border-green-200'} border`}>
              <div className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs sm:text-sm">
                  Loaded PDB {customPdbData.pdbId}
                  {customPdbData.chainId ? ` Chain ${customPdbData.chainId}` : ''} 
                  • {customPdbData.sequenceLength} residues
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Superposition Results - Mobile Responsive */}
      {superpositionData && hasBioEmuData && (
        <div className="space-y-4 sm:space-y-6">
          {/* 3D Structural Superposition - Mobile Optimized */}
          <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold flex items-center flex-wrap">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="break-words">3D Structural Superposition</span>
              </h3>
              <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 break-words`}>
                BioEmu ensemble superposed with PDB {customPdbData.pdbId}
              </p>
            </div>
            {/* Mobile-First 3D Viewer Container */}
            <div className="p-2 sm:p-4 md:p-6">
              <div className="w-full overflow-hidden rounded-lg">
                {/* Mobile: Full width, minimum height */}
                <div className="w-full min-h-[300px] sm:min-h-[400px] md:min-h-[500px]">
                  <MolstarViewerDualStructure
                    referenceUrl={superpositionData.reference_blob_url}
                    mobileUrl={superpositionData.mobile_blob_url}
                    referenceName={superpositionData.reference_name}
                    mobileName={superpositionData.mobile_name}
                    isDarkMode={isDarkMode}
                    onError={(error) => setError(`3D viewer error: ${error}`)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RMSD Analysis - Mobile Responsive */}
          <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold flex items-center flex-wrap">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h2a2 2 0 01-2-2z" />
                </svg>
                <span>RMSD Analysis</span>
              </h3>
              <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 break-words`}>
                Root Mean Square Deviation between structures
              </p>
            </div>
            {/* Mobile-First Chart Container */}
            <div className="p-2 sm:p-4 md:p-6">
              <div className="w-full overflow-x-auto min-h-[250px] sm:min-h-[300px]">
                <div className="min-w-[300px]">
                  <RMSDVisualization
                    rmsdData={superpositionData.rmsd_analysis}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section - Mobile Optimized */}
      <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="p-3 sm:p-4 md:p-6">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-3 sm:mb-4 flex items-center flex-wrap">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="break-words">About Custom PDB Comparison</span>
          </h3>
          
          <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm break-words">
            <div>
              <h4 className="font-medium mb-2 text-green-600 dark:text-green-400 text-sm sm:text-base">
                🔬 What This Shows
              </h4>
              <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} space-y-1 ml-3 sm:ml-4`}>
                <li>• 3D structural superposition between your BioEmu ensemble and any PDB structure</li>
                <li>• RMSD analysis showing structural similarity and differences</li>
                <li>• Side-by-side 3D visualization of both structures aligned in space</li>
                <li>• Reveals conformational differences between dynamic MD and static structures</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-blue-600 dark:text-blue-400 text-sm sm:text-base">
                💡 Usage Tips
              </h4>
              <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} space-y-1 ml-3 sm:ml-4`}>
                <li>• Enter any 4-character PDB ID (e.g., 1UBQ, 2LYZ, 1AKE)</li>
                <li>• Specify chain ID if the structure has multiple chains</li>
                <li>• Compare with homologous proteins to see structural conservation</li>
                <li>• Try different conformational states of the same protein</li>
                <li>• Use the 3D viewer controls to rotate and examine the superposition</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-purple-600 dark:text-purple-400 text-sm sm:text-base">
                📊 Interpreting Results
              </h4>
              <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} space-y-1 ml-3 sm:ml-4`}>
                <li>• <span className="text-blue-600 dark:text-blue-400 font-medium">Blue structure</span>: PDB reference structure</li>
                <li>• <span className="text-green-600 dark:text-green-400 font-medium">Green structure</span>: BioEmu ensemble representative</li>
                <li>• Lower RMSD values indicate higher structural similarity</li>
                <li>• RMSD plots show per-residue deviations across the structure</li>
                <li>• Regions with high RMSD may indicate flexibility or conformational changes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomPDBComparison;
