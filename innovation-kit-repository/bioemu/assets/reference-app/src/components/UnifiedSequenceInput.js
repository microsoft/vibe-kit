import React, { memo, useState, useEffect, useCallback } from 'react';
import { SequenceInput, UniProtInput } from './StableInputs';
import { PDBInput } from './PDBInput';

// Unified sequence input component with tabbed interface
const UnifiedSequenceInput = memo(({
  sequence,
  onSequenceChange,
  uniprotId,
  onUniprotChange,
  pdbId,
  chainId,
  onPDBChange,
  onPDBSequenceFetched,
  inputMode,
  onInputModeChange,
  isDarkMode,
  isValidSequence,
  proteinInfo,
  isFetchingProtein,
  onProteinInfoChange,
  // Example protein handling
  exampleProteins = {},
  exampleUniprotIds = {},
  onLoadExample,
  onLoadUniProtExample,
  isGenerating = false,
  isDemoMode = false
}) => {
  // Local state for PDB info
  const [pdbInfo, setPdbInfo] = useState(null);

  const handlePDBSequenceFetched = useCallback((fetchedSequence, info) => {

    // Update the sequence
    onSequenceChange(fetchedSequence);

    // Store PDB info for display
    setPdbInfo(info);

    // Create protein info object similar to UniProt
    const pdbProteinInfo = {
      sequence: fetchedSequence,
      length: info.sequenceLength,
      name: `PDB ${info.pdbId}${info.chainId ? ` Chain ${info.chainId}` : ''}`,
      source: info.source,
      id: info.pdbId,
      chainId: info.chainId
    };

    onProteinInfoChange(pdbProteinInfo);

    // Also call parent callback if provided
    if (onPDBSequenceFetched) {
      onPDBSequenceFetched(fetchedSequence, info);
    }
  }, [onSequenceChange, onProteinInfoChange, onPDBSequenceFetched]);

  // Clear PDB info when switching away from PDB mode
  useEffect(() => {
    if (inputMode !== 'pdb') {
      setPdbInfo(null);
    }
  }, [inputMode, pdbInfo]);

  // Handle UniProt input changes - clear protein info when user starts typing a different ID
  const handleUniProtInputChange = useCallback((newValue) => {
    // Clear protein info immediately when user starts typing something different
    if (proteinInfo && newValue !== uniprotId) {
      onProteinInfoChange(null);
    }
  }, [proteinInfo, uniprotId, onProteinInfoChange]);

  const inputModes = [
    {
      key: 'sequence',
      label: 'Manual Sequence',
      icon: <svg id="icon-edit-pencil" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} role="img" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    },
    {
      key: 'uniprot',
      label: 'UniProt ID',
      icon: <svg id="icon-verified-badge" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} role="img" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    },
    {
      key: 'pdb',
      label: 'PDB ID',
      icon: <svg id="icon-flask" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} role="img" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    }
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {inputModes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onInputModeChange(mode.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${inputMode === mode.key
              ? 'bg-blue-500 text-white'
              : isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            {mode.icon}
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Input Content */}
      <div className="min-h-[200px]">
        {inputMode === 'sequence' && (
          <div>
            <SequenceInput
              sequence={sequence}
              onSequenceChange={onSequenceChange}
              isDarkMode={isDarkMode}
              isValidSequence={isValidSequence}
            />

            {/* Subtle Protein Info for Selected Examples */}
            {(() => {
              const selectedExample = Object.entries(exampleProteins).find(([key, protein]) =>
                sequence === protein.sequence
              );
              return selectedExample ? (
                <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  ✓ {selectedExample[1].name} • {selectedExample[1].sequence.length} residues • {selectedExample[1].description}
                </div>
              ) : null;
            })()}

            {/* Sequence Examples */}
            {Object.keys(exampleProteins).length > 0 && (
              <div className="mt-4">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Example Proteins
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(exampleProteins).map(([key, protein]) => {
                    const isSelected = sequence === protein.sequence;
                    return (
                      <button
                        key={key}
                        onClick={() => onLoadExample?.(key)}
                        disabled={isGenerating}
                        className={`px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap ${isSelected
                          ? isDarkMode
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-blue-100 border-blue-300 text-blue-800'
                          : isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                      >
                        {protein.name} ({protein.sequence.length})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Paste amino acid sequence using single-letter codes (e.g., NLYIQWLKDGG...)
            </div>
          </div>
        )}

        {inputMode === 'uniprot' && (
          <div>
            <UniProtInput
              uniprotId={uniprotId}
              onUniprotIdChange={onUniprotChange}
              onInputChange={handleUniProtInputChange}
              isDarkMode={isDarkMode}
              proteinInfo={proteinInfo}
              isFetchingProtein={isFetchingProtein}
            />

            {/* Subtle Protein Info Display */}
            {proteinInfo && (
              <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                ✓ {proteinInfo?.protein_name} • {proteinInfo?.length} residues • {proteinInfo?.organism}
                {isDemoMode && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    Demo
                  </span>
                )}
              </div>
            )}

            {/* UniProt Examples */}
            {Object.keys(exampleUniprotIds).length > 0 && (
              <div className="mt-4">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Example Proteins
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(exampleUniprotIds).map(([key, protein]) => {
                    const isSelected = uniprotId === protein.uniprotId;
                    return (
                      <button
                        key={key}
                        onClick={() => onLoadUniProtExample?.(key)}
                        disabled={isGenerating || isFetchingProtein}
                        className={`px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap ${isSelected
                          ? isDarkMode
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-blue-100 border-blue-300 text-blue-800'
                          : isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                      >
                        {protein.name} ({protein.uniprotId})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Enter a UniProt ID (e.g., P01542) - fetches automatically as you type
            </div>
          </div>
        )}

        {inputMode === 'pdb' && (
          <div>
            <PDBInput
              pdbId={pdbId}
              chainId={chainId}
              onPDBChange={onPDBChange}
              isDarkMode={isDarkMode}
              onSequenceFetched={handlePDBSequenceFetched}
            />

            {/* Subtle PDB Info Display */}
            {pdbInfo && (
              <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                ✓ PDB {pdbInfo.pdbId}{pdbInfo.chainId ? ` Chain ${pdbInfo.chainId}` : ''} • {pdbInfo.sequenceLength} residues • Crystal structure
                {isDemoMode && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    Demo
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

UnifiedSequenceInput.displayName = 'UnifiedSequenceInput';

export { UnifiedSequenceInput };
