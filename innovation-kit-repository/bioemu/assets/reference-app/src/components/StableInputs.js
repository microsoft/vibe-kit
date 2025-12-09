import React, { memo, useState, useEffect, useRef } from 'react';

// Memoized sequence input component
// Completely isolated sequence input component - NO DEBOUNCE, UPDATE ON BLUR
const SequenceInput = memo(({ sequence, onSequenceChange, isDarkMode, isValidSequence }) => {

  // Internal state to prevent re-renders from parent
  const [internalValue, setInternalValue] = useState(sequence || '');
  const inputRef = useRef(null);

  // Only update internal state if sequence prop changes from outside (like loading examples)
  useEffect(() => {
    if (sequence !== internalValue) {
      setInternalValue(sequence || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence]); // Only depend on sequence prop, not internal value

  const handleChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalValue(newValue);
    // NO parent updates during typing - only internal state changes
  };

  // Only update parent when user finishes editing (blur)
  const handleBlur = () => {
    onSequenceChange(internalValue);
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        Protein Sequence
      </label>
      <div className="relative">
        <textarea
          ref={inputRef}
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{
            width: '100%',
            height: '120px',
            padding: '10px',
            border: '2px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000'
          }}
          placeholder="Paste amino acid sequence here..."
        />
        {/* Subtle residue count */}
        {internalValue && (
          <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${isValidSequence(internalValue)
            ? isDarkMode ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
            : isDarkMode ? 'bg-red-900/30 text-red-300 border border-red-700' : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
            {internalValue.length}
          </div>
        )}
      </div>

      {/* Subtle validation feedback */}
      {internalValue && !isValidSequence(internalValue) && (
        <div className={`mt-2 text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
          {internalValue.length < 5 ? 'Minimum 5 residues required' :
            internalValue.length > 1000 ? 'Maximum 1000 residues allowed' :
              'Only standard amino acids allowed'}
        </div>
      )}
    </div>
  );
});

// Completely isolated UniProt input component - UNCONTROLLED with DEBOUNCED parent updates
const UniProtInput = memo(({ uniprotId, onUniprotIdChange, isDarkMode, isFetchingProtein, proteinInfo, onInputChange }) => {

  // Internal state to prevent re-renders from parent
  const [internalValue, setInternalValue] = useState(uniprotId || '');
  const inputRef = useRef(null);

  // Only update internal state if uniprotId prop changes from outside (like loading examples)
  useEffect(() => {
    if (uniprotId !== internalValue) {
      setInternalValue(uniprotId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniprotId]); // Only depend on uniprotId prop, not internal value

  const handleChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setInternalValue(newValue);
    // Signal that input changed (different from current uniprotId prop)
    if (onInputChange && newValue !== uniprotId) {
      onInputChange(newValue);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onUniprotIdChange(internalValue);
    }
  };

  // Only update parent when user finishes editing (blur)
  const handleBlur = () => {
    onUniprotIdChange(internalValue);
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        UniProt ID
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          style={{
            width: '100%',
            padding: '10px 50px 10px 10px', // Space for status icon on right
            border: '2px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            backgroundColor: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000'
          }}
          placeholder="e.g., P0CG47"
        />

        {/* Status Indicator */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isFetchingProtein && (
            <svg id="icon-loading-spinner" className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" role="img" aria-label="Loading">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {!isFetchingProtein && proteinInfo && (
            <svg id="icon-success-check" className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" role="img" aria-label="Success">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {!isFetchingProtein && !proteinInfo && internalValue.trim().length >= 4 && (
            <svg id="icon-info-warning" className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" role="img" aria-label="Info">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {internalValue.trim().length > 0 && internalValue.trim().length < 4 && (
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Enter at least 4 characters to auto-search
        </div>
      )}
    </div>
  );
});

export { SequenceInput, UniProtInput };
