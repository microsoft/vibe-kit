import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { PDBService } from '../services/PDBService';

// Simple PDB Input component using the exact same pattern as StableInputs
const PDBInput = memo(({ pdbId, chainId, onPDBChange, isDarkMode, onSequenceFetched }) => {
  // Internal state - SAME PATTERN AS STABLEINPUTS
  const [internalPdbId, setInternalPdbId] = useState(pdbId || '');
  const [internalChainId, setInternalChainId] = useState(chainId || '');
  const debounceRef = useRef(null);
  
  // Update internal state only when props change from outside
  useEffect(() => {
    if (pdbId !== internalPdbId) {
      setInternalPdbId(pdbId || '');
    }
  }, [pdbId, internalPdbId]);
  
  useEffect(() => {
    if (chainId !== internalChainId) {
      setInternalChainId(chainId || '');
    }
  }, [chainId, internalChainId]);
  
  // Debounced callback to parent
  const debouncedCallback = useCallback((newPdbId, newChainId) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onPDBChange(newPdbId, newChainId);
    }, 500);
  }, [onPDBChange]);
  
  // PDB ID change handler
  const handlePdbIdChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalPdbId(newValue);
    debouncedCallback(newValue, internalChainId);
  };
  
  // Chain ID change handler
  const handleChainIdChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalChainId(newValue);
    debouncedCallback(internalPdbId, newValue);
  };
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  return (
    <div className="space-y-4">
      {/* PDB ID Input */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          PDB ID
        </label>
        <input
          type="text"
          value={internalPdbId}
          onChange={handlePdbIdChange}
          placeholder="e.g., 1UBQ"
          maxLength={4}
          className={`w-full px-3 py-2 border rounded-lg transition-colors ${
            isDarkMode
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>
      
      {/* Chain ID Input */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Chain ID
        </label>
        <input
          type="text"
          value={internalChainId}
          onChange={handleChainIdChange}
          placeholder="e.g., A"
          maxLength={1}
          className={`w-full px-3 py-2 border rounded-lg transition-colors ${
            isDarkMode
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>
    </div>
  );
});

PDBInput.displayName = 'PDBInput';

export { PDBInput };
