import React, { memo, useState, useEffect, useRef } from 'react';
import { fetchPDBSequence } from '../services/PDBService';

// Single PDB input component - NO DEBOUNCE, ONLY UPDATE ON BLUR
const PDBInput = memo(({
  pdbId,
  chainId,
  onPDBChange,
  isDarkMode,
  onSequenceFetched
}) => {

  // Internal state to prevent re-renders from parent - COMPLETELY ISOLATED
  const [internalPdbId, setInternalPdbId] = useState(pdbId || '');
  const [internalChainId, setInternalChainId] = useState(chainId || '');
  const pdbInputRef = useRef(null);
  const chainInputRef = useRef(null);

  // Only update internal state if props change from outside (like loading examples)
  useEffect(() => {
    if (pdbId !== internalPdbId) {
      setInternalPdbId(pdbId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdbId]); // Only depend on pdbId prop, not internal value

  useEffect(() => {
    if (chainId !== internalChainId) {
      setInternalChainId(chainId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]); // Only depend on chainId prop, not internal value

  const handlePdbIdChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalPdbId(newValue);
    // NO parent updates during typing - only internal state changes
  };

  const handleChainIdChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalChainId(newValue);
    // NO parent updates during typing - only internal state changes
  };

  // Only update parent when user finishes editing (blur)
  const handlePdbIdBlur = async () => {
    onPDBChange(internalPdbId, internalChainId);

    // Auto-fetch sequence if we have a valid PDB ID
    if (internalPdbId && internalPdbId.length === 4) {
      try {
        const result = await fetchPDBSequence(internalPdbId, internalChainId || null);
        if (result.success && onSequenceFetched) {
          onSequenceFetched(result.data.sequence, result.data);
        } else {
          console.error('Failed to fetch PDB sequence:', result.error);
        }
      } catch (error) {
        console.error('Error fetching PDB sequence:', error);
      }
    }
  };

  const handleChainIdBlur = async () => {
    onPDBChange(internalPdbId, internalChainId);

    // Auto-fetch sequence if we have a valid PDB ID
    if (internalPdbId && internalPdbId.length === 4) {
      try {
        const result = await fetchPDBSequence(internalPdbId, internalChainId || null);
        if (result.success && onSequenceFetched) {
          onSequenceFetched(result.data.sequence, result.data);
        } else {
          console.error('Failed to fetch PDB sequence:', result.error);
        }
      } catch (error) {
        console.error('Error fetching PDB sequence:', error);
      }
    }
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        PDB ID
      </label>
      <div className="relative mb-4">
        <input
          ref={pdbInputRef}
          type="text"
          value={internalPdbId}
          onChange={handlePdbIdChange}
          onBlur={handlePdbIdBlur}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000'
          }}
          placeholder="e.g., 1UBQ"
          maxLength={4}
        />
      </div>

      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        Chain ID
      </label>
      <div className="relative">
        <input
          ref={chainInputRef}
          type="text"
          value={internalChainId}
          onChange={handleChainIdChange}
          onBlur={handleChainIdBlur}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000'
          }}
          placeholder="e.g., A"
          maxLength={1}
        />
      </div>

      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Enter a PDB ID to extract the sequence from the crystal structure
      </div>
    </div>
  );
});

PDBInput.displayName = 'PDBInput';

export { PDBInput };
