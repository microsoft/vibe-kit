import React, { useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MolstarViewerFixedEnhanced from './components/MolstarViewerFixed.enhanced';
import ProteinAnalysisPage from './components/ProteinAnalysisPage.working';
import ConformationalExplorer from './components/ConformationalExplorer';
import SecondaryStructureVisualization from './components/SecondaryStructureVisualization';
import ContactMapVisualization from './components/ContactMapVisualization';
import { CopilotProvider } from './components/copilot/CopilotContext';
import CopilotWidget from './components/copilot/CopilotWidget';
import { UnifiedSequenceInput } from './components/UnifiedSequenceInput';
import { generateProteinSamples, generateProteinSamplesFromUniProt, decodeApiResults, prepareFilesForMolViewer, analyzeTrajectory, getBackendUrl } from './services/BioEmuService';
import { UBIQUITIN_DEMO_DATA } from './data/ubiquitin_demo_data';
import { ContextIntegration } from './services/ContextIntegration';
import FeatureTour from './components/FeatureTour';

// Reusable inline error card (replaces alert() calls)
const InlineError = React.memo(({ title, message, errorType, retryable, onRetry, onDismiss, isDarkMode }) => (
  <div className="error-card" style={{ marginBottom: 16 }}>
    <div className="error-card__icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {errorType === 'rate_limit' ? (
          <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>
        ) : (
          <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
        )}
      </svg>
    </div>
    <div className="error-card__body">
      <div className="error-card__title">{title}</div>
      <div className="error-card__message">{message}</div>
      {(retryable || onDismiss) && (
        <div className="error-card__action" style={{ display: 'flex', gap: 8 }}>
          {retryable && onRetry && (
            <button className="error-card__retry" onClick={onRetry}>Try Again</button>
          )}
          {onDismiss && (
            <button className="error-card__retry" onClick={onDismiss} style={{ color: 'var(--fg-secondary)', borderColor: 'var(--stroke-default)' }}>Dismiss</button>
          )}
        </div>
      )}
    </div>
  </div>
));

// Stable Number Input Component (same pattern as StableInputs)
const NumberInput = React.memo(({ value, onChange, min, max, isDarkMode, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() || '');

  const handleDecrement = () => onChange(Math.max(min, (value || 0) - 1));
  const handleIncrement = () => onChange(Math.min(max, (value || 0) + 1));
  
  const startEditing = () => {
    setDraft(value?.toString() || '');
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseInt(draft) || min;
    onChange(Math.max(min, Math.min(max, num)));
    setEditing(false);
  };

  return (
    <div className="number-input-group">
      <button className="number-input-group__btn" onClick={handleDecrement} disabled={disabled || value <= min} aria-label="Decrease">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 5h6" /></svg>
      </button>
      {editing ? (
        <input
          className="number-input-group__input"
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          style={{ width: 36 }}
          disabled={disabled}
        />
      ) : (
        <span className="number-input-group__value" onClick={!disabled ? startEditing : undefined} title="Click to edit">
          {value}
        </span>
      )}
      <button className="number-input-group__btn" onClick={handleIncrement} disabled={disabled || value >= max} aria-label="Increase">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 2v6M2 5h6" /></svg>
      </button>
    </div>
  );
});

// Slider with local state during drag to avoid expensive re-renders
const SmoothSlider = React.memo(({ value, onChange, min, max, disabled }) => {
  const [dragging, setDragging] = useState(false);
  const [localVal, setLocalVal] = useState(value);

  // Sync from parent when not dragging
  useEffect(() => {
    if (!dragging) setLocalVal(value);
  }, [value, dragging]);

  return (
    <input
      type="range" min={min} max={max} step="1"
      value={localVal}
      onChange={(e) => {
        const v = parseInt(e.target.value);
        setLocalVal(v);
        if (!dragging) onChange(v); // fallback for keyboard/a11y
      }}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => { setDragging(false); onChange(localVal); }}
      onPointerCancel={() => { setDragging(false); onChange(localVal); }}
      className="range-slider"
      style={{ width: 140, flexShrink: 0 }}
      disabled={disabled}
    />
  );
});

// Example proteins for quick testing with their known UniProt IDs
const EXAMPLE_PROTEINS = {
  'villin_hp35': {
    sequence: 'LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF',
    name: 'Villin Headpiece (HP35)',
    description: 'Ultra-fast folding three-helix bundle',
    uniprotId: null // Disable auto-fetch to avoid problematic sequence alignment
  },
  'trp_cage': {
    sequence: 'NLYIQWLKDGGPSSGRPPPS',
    name: 'Trp-cage TC5b',
    description: 'Smallest autonomously folding protein',
    uniprotId: null // Designed protein, no natural UniProt ID
  },

};

// Small proteins with known UniProt IDs for testing UniProt/AlphaFold functionality
const EXAMPLE_UNIPROT_IDS = {
  'ubiquitin_human': {
    uniprotId: 'P0CG47',
    name: 'Polyubiquitin-B',
    description: 'Human polyubiquitin precursor (229 residues) - contains multiple ubiquitin domains'
  },
  'crambin': {
    uniprotId: 'P01542',
    name: 'Crambin',
    description: 'Very small plant protein (46 residues) - classic test case'
  }
};

const App = () => {
  const [sequence, setSequence] = useState('');
  const [numSamples, setNumSamples] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const [errorState, setErrorState] = useState(null); // { title, message, errorType, retryable }
  const isEmbedded = window.self !== window.top;

  // Show "← AI for Science Labs" only if user arrived from that site or env var is set
  const [showLabsBack] = useState(() => {
    const labsOrigin = process.env.REACT_APP_LABS_URL;
    if (!labsOrigin) return false;
    try {
      return document.referrer && new URL(document.referrer).origin === new URL(labsOrigin).origin;
    } catch {
      return false;
    }
  });

  // Enhanced user expertise detection
  const getUserExpertiseLevel = (isDemoMode, analysisData, sequence, proteinInfo) => {
    // Check localStorage for user preference
    const savedLevel = localStorage.getItem('bioemu-user-expertise');
    if (savedLevel && ['beginner', 'intermediate', 'expert'].includes(savedLevel)) {
      return savedLevel;
    }

    // Behavioral inference
    if (isDemoMode) return 'beginner';
    
    // Expert indicators
    const expertIndicators = [
      sequence && sequence.length > 200, // Large proteins
      proteinInfo?.source === 'PDB', // Using PDB directly
      analysisData?.real_flexibility?.length > 100, // Large ensembles
      analysisData?.energyLandscape?.length > 50 // Complex analysis
    ].filter(Boolean).length;

    if (expertIndicators >= 2) return 'expert';
    if (analysisData?.real_flexibility?.length) return 'intermediate';
    return 'beginner';
  };
  const [activeTab, setActiveTab] = useState('input');
  const [pdbFile, setPdbFile] = useState(null);
  const [xtcFile, setXtcFile] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // UniProt-related state
  const [inputMode, setInputMode] = useState('sequence'); // 'sequence', 'uniprot', or 'pdb'
  const [uniprotId, setUniprotId] = useState('');
  const [proteinInfo, setProteinInfo] = useState(null);
  const [isFetchingProtein, setIsFetchingProtein] = useState(false);
  
  // PDB-related state
  const [pdbId, setPdbId] = useState('');
  const [chainId, setChainId] = useState('');
  
  // AlphaFold-related state
  // const [alphafoldStructure, setAlphafoldStructure] = useState(null);
  const [alphafoldPdbFile, setAlphafoldPdbFile] = useState(null);
  
  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Tour state
  const [showTour, setShowTour] = useState(() => {
    return !localStorage.getItem('bioemu-tour-completed');
  });
  const tourSteps = [
    {
      target: null,
      title: 'Welcome to BioEmu',
      content: 'BioEmu is a generative model from Microsoft Research that samples equilibrium protein conformations. Instead of running expensive molecular dynamics simulations, it directly generates an ensemble of 3D structures from an amino acid sequence — capturing the natural flexibility and dynamics of proteins in seconds.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="input-card"]',
      title: 'Input Protein',
      content: 'Start by entering an amino acid sequence, a UniProt accession ID, or a PDB identifier. The app auto-fetches metadata and AlphaFold reference structures for known proteins.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="example-proteins"]',
      title: 'Example Proteins',
      content: 'Pick a pre-loaded example to explore immediately. Polyubiquitin-B works fully offline with cached BioEmu data — great for a first run.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="generate-bar"]',
      title: 'Generate Ensemble',
      content: 'Set the number of conformations (10–50) and click Generate. BioEmu samples equilibrium protein structures — each run takes about 1–2 minutes.',
      placement: 'top'
    },
    {
      target: '[data-tour="tab-bar"]',
      title: 'Explore Results',
      content: 'After generation, visit Structure to view the 3D ensemble in Mol*, Compare for AlphaFold overlay, Analyze for PCA energy landscapes, and Export to download data.',
      placement: 'bottom'
    },
  ];
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Load theme preference from localStorage, default to dark
    const saved = localStorage.getItem('bioemu-app-theme');
    return saved ? saved === 'dark' : true;
  });

  // Check API status on mount
  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) {
        setApiStatus('connected');
      } else {
        setApiStatus('failed');
      }
    } catch (error) {
      setApiStatus('failed');
    }
  };

  const toggleAppTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('bioemu-app-theme', newTheme ? 'dark' : 'light');
  };

  const isValidSequence = useCallback((seq) => {
    const validAA = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
    return validAA.test(seq) && seq.length >= 5 && seq.length <= 1000;
  }, []);

  const handleSequenceChange = useCallback((newSequence) => {
    setSequence(newSequence);
  }, []);

  const handleUniprotIdChange = useCallback((newUniprotId) => {
    setUniprotId(newUniprotId);
  }, []);

  const handlePDBChange = useCallback((newPdbId, newChainId) => {
    setPdbId(newPdbId);
    setChainId(newChainId);
  }, []);

  const handlePDBSequenceFetched = useCallback((sequence, pdbData) => {
    setSequence(sequence);
  }, []);

  const loadExample = async (proteinKey) => {
    const protein = EXAMPLE_PROTEINS[proteinKey];
    setSequence(protein.sequence);
    setInputMode('sequence'); // Switch to sequence mode when loading example
    
    // If this protein has a known UniProt ID, also fetch its AlphaFold structure
    if (protein.uniprotId) {
      // Clean up previous AlphaFold structure
      if (alphafoldPdbFile?.url) {
        URL.revokeObjectURL(alphafoldPdbFile.url);
      }
      setAlphafoldPdbFile(null);
      setProteinInfo(null);
      
      try {
        const backendUrl = getBackendUrl();
        
        // Fetch protein info
        const infoResponse = await fetch(`${backendUrl}/api/uniprot-info/${protein.uniprotId}`);
        if (infoResponse.ok) {
          const infoData = await infoResponse.json();
          if (infoData.status === 'success') {
            setProteinInfo(infoData.protein_info);
          }
        }
        
        // Fetch AlphaFold structure
        const alphafoldResponse = await fetch(`${backendUrl}/api/alphafold-structure/${protein.uniprotId}`);
        if (alphafoldResponse.ok) {
          const alphafoldData = await alphafoldResponse.json();
          if (alphafoldData.status === 'success') {
            const pdbString = alphafoldData.structure_data;
            const pdbBlob = new Blob([pdbString], { type: 'text/plain' });
            const pdbFileObject = {
              data: pdbBlob,
              url: URL.createObjectURL(pdbBlob),
              size: pdbBlob.size,
              type: 'text/plain',
              isBinary: false
            };
            setAlphafoldPdbFile(pdbFileObject);
          } else {
            // Show alert for API outages during demo protein loading
            if (alphafoldData.message && alphafoldData.message.includes('server issues')) {
              console.error(`🚨 AlphaFold API outage detected while loading ${protein.name}`);
            }
          }
        } else if (alphafoldResponse.status === 503) {
          console.error(`🚨 AlphaFold API outage detected while loading ${protein.name}`);
        }
      } catch (error) {
      }
    } else {
      // Clear any existing AlphaFold structure
      if (alphafoldPdbFile?.url) {
        URL.revokeObjectURL(alphafoldPdbFile.url);
      }
      setAlphafoldPdbFile(null);
      setProteinInfo(null);
    }
  };

  const loadUniProtExample = (proteinKey) => {
    const protein = EXAMPLE_UNIPROT_IDS[proteinKey];
    setInputMode('uniprot');
    setUniprotId(protein.uniprotId);
    
    // For the demo protein, hydrate data immediately — don't clear and wait for auto-fetch.
    // Clearing proteinInfo then relying on the debounced useEffect creates a race condition:
    // if uniprotId is already P0CG47, the effect deps don't change, it never re-fires,
    // proteinInfo stays null, and the Generate button is permanently disabled.
    if (proteinKey === 'ubiquitin_human') {
      setNumSamples(50);
      setIsDemoMode(true);
      
      // Set protein info directly from demo data
      const demoProteinInfo = UBIQUITIN_DEMO_DATA.data.uniprot_data.protein_info;
      setProteinInfo(demoProteinInfo);
      
      // Load AlphaFold structure from demo data
      try {
        const pdbString = UBIQUITIN_DEMO_DATA.data.alphafold_structure;
        if (pdbString) {
          // Clean up previous URL
          if (alphafoldPdbFile?.url) URL.revokeObjectURL(alphafoldPdbFile.url);
          const pdbBlob = new Blob([pdbString], { type: 'text/plain' });
          setAlphafoldPdbFile({
            data: pdbBlob,
            url: URL.createObjectURL(pdbBlob),
            size: pdbBlob.size,
            type: 'text/plain',
            isBinary: false
          });
        }
      } catch (e) {
      }
    } else {
      // For non-demo proteins, clear and let auto-fetch handle it
      setProteinInfo(null);
      setIsDemoMode(false);
    }
  };

  const fetchProteinInfo = useCallback(async () => {
    if (!uniprotId.trim()) return;
    
    setIsFetchingProtein(true);
    setProteinInfo(null);
    // setAlphafoldStructure(null);
    // Clean up previous AlphaFold object URL to prevent memory leaks
    if (alphafoldPdbFile?.url) {
      URL.revokeObjectURL(alphafoldPdbFile.url);
    }
    setAlphafoldPdbFile(null);
    
    try {
      // 🎭 DEMO MODE: Check if this is Polyubiquitin-B (P0CG47) and use demo data
      if (uniprotId.trim().toUpperCase() === 'P0CG47') {
        setIsDemoMode(true);
        
        // Extract protein info from demo data
        const demoProteinInfo = UBIQUITIN_DEMO_DATA.data.uniprot_data.protein_info;
        setProteinInfo(demoProteinInfo);
        // Don't auto-set sequence to prevent infinite loop
        // setSequence(demoProteinInfo.sequence);
        
        // Load AlphaFold structure from demo data
        try {
          const pdbString = UBIQUITIN_DEMO_DATA.data.alphafold_structure;
          
          // Convert structure to PDB file for Molstar (match BioEmu format)
          const pdbBlob = new Blob([pdbString], { type: 'text/plain' });
          const pdbFileObject = {
            data: pdbBlob,
            url: URL.createObjectURL(pdbBlob),
            size: pdbBlob.size,
            type: 'text/plain',
            isBinary: false
          };
          setAlphafoldPdbFile(pdbFileObject);
        } catch (demoError) {
        }
        
        setIsFetchingProtein(false);
        return;
      }
      
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/uniprot-info/${uniprotId.trim()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setIsDemoMode(false); // Reset demo mode for real API data
          setProteinInfo(data.protein_info);
          // Don't auto-set sequence to prevent infinite loop
          // setSequence(data.protein_info.sequence);
          
          // Fetch AlphaFold structure
          try {
            const alphafoldResponse = await fetch(`${backendUrl}/api/alphafold-structure/${uniprotId.trim()}`);
            if (alphafoldResponse.ok) {
              const alphafoldData = await alphafoldResponse.json();
              if (alphafoldData.status === 'success') {
                // Structure data is directly the PDB string content
                const pdbString = alphafoldData.structure_data;
                // setAlphafoldStructure({
                //   pdb_content: pdbString,
                //   source: 'alphafold',
                //   uniprot_id: uniprotId.trim()
                // });
                // Convert structure to PDB file for Molstar (match BioEmu format)
                const pdbBlob = new Blob([pdbString], { type: 'text/plain' });
                const pdbFileObject = {
                  data: pdbBlob,
                  url: URL.createObjectURL(pdbBlob),
                  size: pdbBlob.size,
                  type: 'text/plain',
                  isBinary: false
                };
                setAlphafoldPdbFile(pdbFileObject);
              } else {
                // Show user-friendly error message for API outages
                if (alphafoldData.message && alphafoldData.message.includes('server issues')) {
                  setErrorState({
                    title: 'AlphaFold API Outage',
                    message: 'The AlphaFold EBI API is currently experiencing server issues (500 errors). This is a temporary infrastructure problem. Please try again in a few minutes.',
                    errorType: 'service_unavailable',
                    retryable: true
                  });
                } else {
                }
              }
            } else if (alphafoldResponse.status === 503) {
              // Service Unavailable - API outage
              const errorData = await alphafoldResponse.json();
              setErrorState({
                title: 'AlphaFold API Outage',
                message: errorData.message || 'AlphaFold EBI API is currently experiencing issues. Please try again later.',
                errorType: 'service_unavailable',
                retryable: true
              });
            } else {
            }
          } catch (alphafoldError) {
            // Check if it's a network error
            if (alphafoldError.message && alphafoldError.message.includes('fetch')) {
              setErrorState({
                title: 'Network Error',
                message: 'Unable to connect to AlphaFold service. Please check your internet connection and try again.',
                errorType: 'network',
                retryable: true
              });
            }
          }
        } else {
          console.error('Failed to fetch protein info:', data.message);
          setErrorState({
            title: 'Protein Info Unavailable',
            message: `Failed to fetch protein info: ${data.message}`,
            errorType: 'api_error',
            retryable: true
          });
        }
      } else {
        console.error('Failed to fetch protein info:', response.status);
        setErrorState({
          title: 'Server Error',
          message: `Failed to fetch protein info. Server returned ${response.status}.`,
          errorType: response.status === 429 ? 'rate_limit' : 'api_error',
          retryable: true
        });
      }
    } catch (error) {
      console.error('Error fetching protein info:', error);
      setErrorState({
        title: 'Connection Error',
        message: 'Error fetching protein info. Please check your connection and try again.',
        errorType: 'network',
        retryable: true
      });
    } finally {
      setIsFetchingProtein(false);
    }
  }, [uniprotId, alphafoldPdbFile?.url]);

  // Auto-fetch protein info when UniProt ID changes (with debounce)
  useEffect(() => {
    let timeoutId;
    
    if (inputMode === 'uniprot' && uniprotId.trim().length >= 4) {
      timeoutId = setTimeout(() => {
        // Only fetch if we don't already have protein info for this ID
        if (!proteinInfo && !isFetchingProtein) {
          fetchProteinInfo();
        }
      }, 800); // 800ms debounce
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, uniprotId]); // Intentionally simplified to prevent infinite loop
  
  // Separate effect to clear data when ID becomes too short
  useEffect(() => {
    if (inputMode === 'uniprot' && uniprotId.trim().length < 4 && proteinInfo) {
      setProteinInfo(null);
      setIsDemoMode(false);
      if (alphafoldPdbFile?.url) {
        URL.revokeObjectURL(alphafoldPdbFile.url);
      }
      setAlphafoldPdbFile(null);
    }
  }, [inputMode, uniprotId, proteinInfo, alphafoldPdbFile?.url]);

  // Track analysis data availability for Copilot context
  // TEMPORARILY DISABLED FOR FOCUS TESTING
  /*
  useEffect(() => {
    if (analysisData) {
      if (analysisData.real_flexibility) {
        ContextIntegration.onAnalysisViewed('flexibility', {
          hasData: true,
          residueCount: analysisData.real_flexibility.length
        });
      }
      if (analysisData.secondary_structure_stats) {
        ContextIntegration.onAnalysisViewed('secondary_structure', {
          hasData: true,
          residueCount: analysisData.secondary_structure_stats.helix_fraction?.length || 0
        });
      }
    }
  }, [analysisData]);
  */

  const generateEnsemble = async (inputSequence, samples) => {
    setIsGenerating(true);
    setResults(null);
    setPdbFile(null);
    setXtcFile(null);
    setAnalysisData(null);
    setErrorState(null); // Clear previous errors
    
    // ADD DETAILED LOGGING
    try {
      let apiResults;
      
      if (inputMode === 'uniprot' && proteinInfo) {
        // Use UniProt-based prediction
        const proteinData = {
          uniprot_id: uniprotId,
          sequence: proteinInfo.sequence,
          protein_info: proteinInfo,
          alphafold_available: true // We can check this from the previous API call
        };
        
        apiResults = await generateProteinSamplesFromUniProt(proteinData, samples, true);
      } else {
        // Use regular sequence-based prediction
        apiResults = await generateProteinSamples(inputSequence, samples);
      }
      
      // Decode and prepare results (same for both methods)
      const decodedResults = decodeApiResults(apiResults.results || apiResults);
      const { pdbFile: preparedPdb, xtcFile: preparedXtc } = await prepareFilesForMolViewer(decodedResults);
      
      setResults(decodedResults);
      setPdbFile(preparedPdb);
      setXtcFile(preparedXtc);
      setActiveTab('visualization');
      
      // Start trajectory analysis in the background
      if (decodedResults['topology.pdb'] && decodedResults['samples.xtc']) {
        setIsAnalyzing(true);
        try {
          const analysis = await analyzeTrajectory(decodedResults);
          setAnalysisData(analysis);
        } catch (analysisError) {
          // Don't fail the whole process if analysis fails
        } finally {
          setIsAnalyzing(false);
        }
      }
      
    } catch (error) {
      console.error('❌ Ensemble generation failed:', error);
      // Build structured error state for inline display
      // Use messages from BioEmuService.js — don't override them here
      const errorInfo = {
        title: error.errorType === 'rate_limit' ? 'High Demand'
             : error.errorType === 'service_unavailable' ? 'High Demand'
             : error.errorType === 'timeout' ? 'Request Timed Out'
             : error.errorType === 'blocked' ? 'Request Blocked'
             : error.errorType === 'auth_error' ? 'Authentication Error'
             : 'Generation Failed',
        message: error.message || 'This is an experimental research demo and we\u2019re experiencing high demand. Please try again in a few minutes.',
        errorType: error.errorType || 'unknown',
        retryable: error.errorType !== 'blocked' && error.retryable !== false,
        statusCode: error.statusCode || null
      };
      
      setErrorState(errorInfo);
      setResults({ error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (isValidInput()) {
      // Use protein sequence for UniProt mode, current sequence for sequence/pdb mode
      const sequenceToUse = inputMode === 'uniprot' ? proteinInfo.sequence : sequence;
      generateEnsemble(sequenceToUse, numSamples);
    } else {
    }
  };

  const isValidInput = () => {
    if (inputMode === 'sequence') {
      return isValidSequence(sequence);
    } else if (inputMode === 'uniprot') {
      return proteinInfo && proteinInfo.sequence && isValidSequence(proteinInfo.sequence);
    } else if (inputMode === 'pdb') {
      return isValidSequence(sequence); // PDB sequence is loaded into the sequence state
    }
    return false;
  };

  const downloadFile = (data, filename, type = 'text/plain') => {
    let blob;
    
    // Check if data is already a Blob object (from decoded file results)
    if (data instanceof Blob) {
      blob = data;
    } else {
      // Create blob from string data (for other download cases)
      blob = new Blob([data], { type });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Create filtered analysis data for download (only include data that's shown in plots)
  const getFilteredAnalysisData = () => {
    if (!analysisData) return null;
    
    const filteredData = {};
    
    // Only include properties that are actually displayed in the UI
    const displayedProperties = [
      'real_flexibility',           // Shown in flexibility plot
      'secondary_structure_stats',  // Shown in secondary structure plot  
      'real_rg_ensemble',          // Shown in radius of gyration plot
      'rmsd_to_alphafold',         // Shown in RMSD comparison analysis
      'contact_map',               // Shown in contact map visualization
      'structure_files'            // File references
    ];
    
    displayedProperties.forEach(prop => {
      if (analysisData[prop] !== undefined) {
        filteredData[prop] = analysisData[prop];
      }
    });
    
    // Add metadata about what was filtered
    filteredData._metadata = {
      note: "This file contains only analysis data that is displayed in the BioEmu Explorer plots",
      filtered_at: new Date().toISOString(),
      original_sequence: sequence,
      included_properties: Object.keys(filteredData).filter(k => k !== '_metadata')
    };
    
    return filteredData;
  };

  // Input Tab Content
  const InputTab = () => (
    <div className="space-y-4" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Inline Error Display */}
      {errorState && (
        <InlineError
          title={errorState.title}
          message={errorState.message}
          errorType={errorState.errorType}
          retryable={errorState.retryable}
          onRetry={errorState.retryable ? () => { setErrorState(null); handleSubmit(); } : undefined}
          onDismiss={() => setErrorState(null)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Protein Input */}
      <div className="card" data-tour="input-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h3 className="text-heading" style={{ fontSize: 15 }}>Input Protein</h3>
          {/* Info tooltip */}
          <div className="relative group">
            <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', background: 'var(--brand-primary)', flexShrink: 0 }}>
              <span style={{ color: 'var(--fg-inverse)', fontSize: 10, fontWeight: 700 }}>?</span>
            </div>
            <div className="absolute left-6 top-0 w-72 p-3 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10"
                 style={{ background: 'var(--bg-layer-2)', border: '1px solid var(--stroke-default)' }}>
              <div className="text-body" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>Sequence:</strong> Paste an amino acid sequence directly.</div>
                <div><strong>UniProt ID:</strong> Auto-fetches sequence + AlphaFold reference.</div>
                <div><strong>PDB ID:</strong> Extract sequence from a crystal structure.</div>
              </div>
            </div>
          </div>
        </div>
            
        <UnifiedSequenceInput
          sequence={sequence}
          onSequenceChange={handleSequenceChange}
          uniprotId={uniprotId}
          onUniprotChange={handleUniprotIdChange}
          pdbId={pdbId}
          chainId={chainId}
          onPDBChange={handlePDBChange}
          onPDBSequenceFetched={handlePDBSequenceFetched}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          isDarkMode={isDarkMode}
          isValidSequence={isValidSequence}
          proteinInfo={proteinInfo}
          isFetchingProtein={isFetchingProtein}
          onProteinInfoChange={setProteinInfo}
          exampleProteins={EXAMPLE_PROTEINS}
          exampleUniprotIds={EXAMPLE_UNIPROT_IDS}
          onLoadExample={loadExample}
          onLoadUniProtExample={loadUniProtExample}
          isGenerating={isGenerating}
          isDemoMode={isDemoMode}
        />
      </div>

      {/* Generate Controls */}
      <div className="card" data-tour="generate-bar" style={{ padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Ensemble Size */}
          <label className="text-body" style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
            Conformations
          </label>
          <NumberInput
            value={numSamples}
            onChange={setNumSamples}
            min={10}
            max={50}
            isDarkMode={isDarkMode}
            disabled={isGenerating}
          />
          <SmoothSlider
            value={numSamples}
            onChange={setNumSamples}
            min={10}
            max={50}
            disabled={isGenerating}
          />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Status chip — contextual, not alarming */}
          {apiStatus === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-layer-3)', fontSize: 11, fontWeight: 500,
                color: 'var(--fg-secondary)'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-materials)' }} />
                Offline
              </span>
              <button
                onClick={() => loadUniProtExample('ubiquitin_human')}
                disabled={isGenerating || isFetchingProtein}
                className="btn-outline"
                style={{ padding: '3px 10px', fontSize: 11, borderColor: 'var(--accent-bio)', color: 'var(--accent-bio)' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3h6v7l5 8H4l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/>
                  </svg>
                  Sample data
                </span>
              </button>
            </div>
          )}
          {apiStatus === 'checking' && (
            <span className="text-caption" style={{ whiteSpace: 'nowrap' }}>Connecting…</span>
          )}
          {apiStatus === 'connected' && isValidInput() && (
            <span className="text-caption" style={{ whiteSpace: 'nowrap' }}>~1-2 min</span>
          )}

          {/* Generate Button */}
          <button
            onClick={handleSubmit}
            disabled={isGenerating || !isValidInput()}
            className="btn-primary"
            style={{ padding: '9px 24px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                </svg>
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '14px 16px 12px', marginTop: 8, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <a href="https://www.microsoft.com/en-us/research/lab/microsoft-research-ai-for-science" target="_blank" rel="noopener noreferrer" className="link-btn" style={{ padding: '4px 12px', fontSize: 11 }}>
            AI for Science
          </a>
          <a href="https://www.science.org/doi/10.1126/science.adv9817" target="_blank" rel="noopener noreferrer" className="link-btn" style={{ padding: '4px 12px', fontSize: 11 }}>
            Paper
          </a>
          <a href="https://github.com/microsoft/bioemu" target="_blank" rel="noopener noreferrer" className="link-btn" style={{ padding: '4px 12px', fontSize: 11 }}>
            GitHub
          </a>
          <a href="https://github.com/microsoft/vibe-kit/issues" target="_blank" rel="noopener noreferrer" className="link-btn" style={{ padding: '4px 12px', fontSize: 11 }}>
            Feedback
          </a>
        </div>
        <div className="text-caption" style={{ lineHeight: 1.5 }}>
          BioEmu · Microsoft Research
        </div>
        <div className="text-caption" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
          Not for clinical, diagnostic, or therapeutic use.
        </div>
      </div>
    </div>
  );

  // Visualization Tab Content - Clean layout with working components
  const VisualizationTab = () => {
    if (!results || results.error) {
      return (
        <div className="card" style={{ padding: 24 }}>
          <div className="text-center">
            {results?.error && errorState ? (
              /* Structured error display */
              <div style={{ maxWidth: 480, margin: '0 auto' }}>
                <InlineError
                  title={errorState.title}
                  message={errorState.message}
                  errorType={errorState.errorType}
                  retryable={errorState.retryable}
                  onRetry={errorState.retryable ? () => { setErrorState(null); setResults(null); setActiveTab('input'); } : undefined}
                  onDismiss={() => { setErrorState(null); setResults(null); setActiveTab('input'); }}
                  isDarkMode={isDarkMode}
                />
              </div>
            ) : (
              /* Default empty state */
              <>
                <h4 className="text-heading" style={{ fontSize: 16, marginBottom: 8 }}>
                  No Structure Available
                </h4>
                <p className="text-body" style={{ fontSize: 13, marginBottom: 16 }}>
                  Generate a protein ensemble first to view 3D molecular structures.
                </p>
                <button
                  onClick={() => setActiveTab('input')}
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: 13, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Generate Ensemble
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-heading" style={{ fontSize: 20 }}>
            Structure Explorer
          </h2>
          <div className="text-caption">
            Sequence: {sequence.slice(0, 20)}... • {analysisData ? 'Analysis Complete' : 'Analysis Pending'}
          </div>
        </div>
        <div className="text-caption" style={{ fontSize: 11, textAlign: 'center', padding: '4px 0' }}>
          Predictions are approximate. Validate experimentally before use.
        </div>

        {/* 3D Molecular Viewer */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="text-heading" style={{ fontSize: 16, marginBottom: 16 }}>
            Interactive 3D Molecular Viewer
          </h3>
          <div className="h-[600px] w-full">
            {pdbFile && xtcFile ? (
              <MolstarViewerFixedEnhanced
                pdbFile={pdbFile}
                xtcFile={xtcFile}
                isDarkMode={isDarkMode}
              />
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--fg-tertiary)' }}>
                <div className="text-center">
                  <div className="text-heading" style={{ fontSize: 16, marginBottom: 8 }}>Loading 3D Viewer...</div>
                  <div className="text-body" style={{ fontSize: 13 }}>Preparing molecular data</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading Indicator for Generation/Analysis */}
        {(isGenerating || isAnalyzing) && (
          <div className="card card--raised" style={{ padding: 48, textAlign: 'center' }}>
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div style={{ width: 64, height: 64, border: '4px solid var(--stroke-default)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%' }} className="animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div style={{ width: 32, height: 32, background: 'var(--brand-primary)', borderRadius: '50%' }} className="animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-heading" style={{ fontSize: 18 }}>
                  {isGenerating ? 'Generating Protein Ensemble' : 'Analyzing Conformations'}
                </h3>
                <p className="text-body" style={{ fontSize: 13 }}>
                  {isGenerating 
                    ? 'Creating molecular dynamics trajectories...' 
                    : 'Computing contact maps and structural metrics...'}
                </p>
                <div className="text-caption">
                  {isGenerating ? 'This may take 30-60 seconds' : 'Analyzing ensemble properties'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ensemble Analysis Section */}
        {analysisData && !isGenerating && !isAnalyzing && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-heading" style={{ fontSize: 18 }}>
                Ensemble Analysis
              </h3>
              <div className="text-caption">
                BioEmu conformational analysis powered by MDTraj
              </div>
            </div>

            {/* Optimized 40/60 Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              
              {/* LEFT COLUMN (40%): Ensemble Statistics + Contact Map */}
              <div className="xl:col-span-2 flex flex-col space-y-6">
                
                {/* Ensemble Statistics */}
                <div className="card card--raised" style={{ padding: 24 }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-heading" style={{ fontSize: 18 }}>
                        Ensemble Statistics
                      </h3>
                      <p className="text-body" style={{ fontSize: 13, marginTop: 4 }}>
                        Conformational ensemble overview
                      </p>
                    </div>
                  </div>
                  <EnsembleStatsCard analysis={analysisData} />
                </div>

                {/* Contact Map Analysis */}
                <div className="card card--raised flex-1">
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-heading" style={{ fontSize: 16 }}>
                          Contact Map Analysis
                        </h3>
                        <p className="text-caption" style={{ marginTop: 4 }}>
                          Cα-Cα Distance Map
                        </p>
                      </div>
                    </div>
                    
                    {/* Contact Map Visualization - Larger Map Size */}
                    <div className="flex-1 flex items-center justify-center">
                      {isAnalyzing ? (
                        <div className={`w-96 h-96 flex items-center justify-center rounded-lg border-2 border-dashed ${
                          isDarkMode 
                            ? 'border-gray-600 bg-gray-900/50' 
                            : 'border-gray-300 bg-gray-50'
                        }`}>
                          <div className="text-center">
                            <div className="relative mb-3">
                              <div className="w-12 h-12 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-6 h-6 bg-purple-500 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                              Analyzing Contacts
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              Computing distance matrix...
                            </p>
                          </div>
                        </div>
                      ) : analysisData?.ca_distance_matrix ? (
                        <ContactMapVisualization 
                          distanceMatrix={analysisData.ca_distance_matrix}
                          isDarkMode={isDarkMode}
                          width={480}
                          height={480}
                        />
                      ) : (
                        <div className={`w-96 h-96 flex items-center justify-center rounded-lg border-2 border-dashed ${
                          isDarkMode 
                            ? 'border-gray-600 bg-gray-900/50' 
                            : 'border-gray-300 bg-gray-50'
                        }`}>
                          <div className="text-center">
                            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                              Contact map will appear here
                            </div>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              After trajectory analysis
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (60%): Charts */}
              <div className="xl:col-span-3 space-y-6">
                
                {/* Radius of Gyration Distribution */}
                <div className="card card--raised">
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div>
                      <h3 className="text-heading" style={{ fontSize: 18 }}>
                        Radius of Gyration Distribution
                      </h3>
                      <p className="text-body" style={{ fontSize: 13, marginTop: 4 }}>
                        Conformational compactness profile
                      </p>
                    </div>
                  </div>
                  <RgHistogramChart analysis={analysisData} />
                </div>
                
                {/* Molecular Flexibility Profile */}
                <div className="card card--raised flex-1">
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div>
                      <h3 className="text-heading" style={{ fontSize: 18 }}>
                        Molecular Flexibility Profile
                      </h3>
                      <p className="text-body" style={{ fontSize: 13, marginTop: 4 }}>
                        Per-residue atomic mobility (RMSF)
                      </p>
                    </div>
                  </div>
                  <FlexibilityChart analysis={analysisData} />
                </div>
              </div>
            </div>

            {/* FULL WIDTH: Secondary Structure Analysis */}
            <div className="mt-6">
              <SecondaryStructureVisualization 
                analysis={analysisData} 
                isDarkMode={isDarkMode}
                onRegionSelect={(region) => {
                }}
                showConfidenceIntervals={true}
              />
            </div>
          </div>
        )}

        {/* No Analysis Data State */}
        {!analysisData && !isGenerating && (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div className="text-caption" style={{ fontSize: 13, marginBottom: 8 }}>No analysis data yet</div>
              <p className="text-body" style={{ fontSize: 13, marginBottom: 16, maxWidth: 420, margin: '0 auto 16px' }}>Generate a conformational ensemble to access flexibility profiles, secondary structure, and contact maps.</p>
              <button
                onClick={() => setActiveTab('input')}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: 13 }}
              >
                Generate Ensemble
              </button>
          </div>
        )}
      </div>
    );
  };

  // Scientific Analysis Components
  const FlexibilityChart = ({ analysis }) => {
    if (!analysis?.real_flexibility) return null;
    
    const flexibilityData = analysis.real_flexibility.map((rmsf, index) => ({
      residue: index + 1,
      flexibility: rmsf,
      aminoAcid: sequence[index] || 'X'
    }));

    return (
      <div className="p-8">
        <div className="h-72 rounded-xl overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flexibilityData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <defs>
                <linearGradient id="flexibilityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#DC2626" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDarkMode ? '#374151' : '#e5e7eb'} 
                strokeOpacity={0.5}
              />
              <XAxis 
                dataKey="residue" 
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                tickLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                label={{ 
                  value: 'Residue Number', 
                  position: 'insideBottom', 
                  offset: -15, 
                  style: { 
                    textAnchor: 'middle', 
                    fill: isDarkMode ? '#9CA3AF' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 'medium'
                  } 
                }}
              />
              <YAxis 
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                tickLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                label={{ 
                  value: 'RMSF (Å)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { 
                    textAnchor: 'middle', 
                    fill: isDarkMode ? '#9CA3AF' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 'medium'
                  } 
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
                  border: `2px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '12px',
                  color: isDarkMode ? '#F3F4F6' : '#374151',
                  fontSize: '14px',
                  fontWeight: 'medium',
                  boxShadow: isDarkMode 
                    ? '0 10px 25px rgba(0, 0, 0, 0.5)' 
                    : '0 10px 25px rgba(0, 0, 0, 0.15)'
                }}
                formatter={(value, name) => [
                  <span className="font-semibold">{value.toFixed(3)} Å</span>, 
                  <span className="text-orange-600">Flexibility</span>
                ]}
                labelFormatter={(label) => (
                  <span className="font-bold">
                    Residue {label} ({flexibilityData[label-1]?.aminoAcid})
                  </span>
                )}
              />
              <Bar 
                dataKey="flexibility" 
                fill="url(#flexibilityGradient)" 
                radius={[2, 2, 0, 0]}
                stroke={isDarkMode ? '#F97316' : '#EA580C'}
                strokeWidth={0.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Method info */}
        <div className="card" style={{ margin: '16px 0 0 0', padding: 16 }}>
          <p className="text-body" style={{ fontSize: 13 }}>
            <span className="font-semibold">Method:</span> RMSF (Root Mean Square Fluctuation) quantifies per-residue atomic mobility using Cα coordinates across 
            the trajectory ensemble. Higher values indicate increased conformational flexibility and dynamic behavior.
          </p>
        </div>
      </div>
    );
  };

  const RgHistogramChart = ({ analysis }) => {
    if (!analysis?.ensemble_stats?.compactness_distribution || !analysis?.ensemble_stats?.compactness_bins) {
      return null;
    }
    
    const distribution = analysis.ensemble_stats.compactness_distribution;
    const bins = analysis.ensemble_stats.compactness_bins;
    
    // Create histogram data by pairing bins with counts
    const histogramData = distribution.map((count, index) => {
      const binStart = bins[index];
      const binEnd = bins[index + 1];
      const binCenter = (binStart + binEnd) / 2;
      
      return {
        bin: binCenter.toFixed(3),
        count: count,
        range: `${binStart.toFixed(2)}-${binEnd.toFixed(2)} Å`
      };
    });

    return (
      <div className="p-8">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 30, bottom: 60 }}>
              <defs>
                <linearGradient id="rgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDarkMode ? '#374151' : '#e5e7eb'} 
                strokeOpacity={0.5}
              />
              <XAxis 
                dataKey="bin" 
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                tickLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                label={{ 
                  value: 'R_g (Å)', 
                  position: 'insideBottom', 
                  offset: -15, 
                  style: { 
                    textAnchor: 'middle', 
                    fill: isDarkMode ? '#9CA3AF' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 'medium'
                  } 
                }}
              />
              <YAxis 
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                tickLine={{ stroke: isDarkMode ? '#4B5563' : '#d1d5db' }}
                label={{ 
                  value: 'Frequency', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { 
                    textAnchor: 'middle', 
                    fill: isDarkMode ? '#9CA3AF' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 'medium'
                  } 
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
                  border: `2px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '12px',
                  color: isDarkMode ? '#F3F4F6' : '#374151',
                  fontSize: '14px',
                  fontWeight: 'medium',
                  boxShadow: isDarkMode 
                    ? '0 10px 25px rgba(0, 0, 0, 0.5)' 
                    : '0 10px 25px rgba(0, 0, 0, 0.15)'
                }}
                formatter={(value, name) => [
                  <span className="font-semibold">{value} conformations</span>, 
                  <span className="text-blue-600">Frequency</span>
                ]}
                labelFormatter={(label) => (
                  <span className="font-bold">
                    R_g range: {histogramData.find(d => d.bin === label)?.range || label} Å
                  </span>
                )}
              />
              <Bar 
                dataKey="count" 
                fill="url(#rgGradient)" 
                name="Frequency"
                radius={[2, 2, 0, 0]}
                stroke={isDarkMode ? '#3B82F6' : '#1D4ED8'}
                strokeWidth={0.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Method info */}
        <div className="card" style={{ margin: '24px 0 0 0', padding: 16 }}>
          <p className="text-body" style={{ fontSize: 13 }}>
            <span className="font-semibold">Method:</span> Histogram of radius of gyration (R<sub>g</sub>) values across the ensemble shows the distribution of protein compactness.
            <br />
            <span className="font-semibold">Interpretation:</span> Peak positions indicate preferred compactness states. Narrow distributions suggest consistent folding, 
            while broad distributions indicate conformational heterogeneity. Mean R<sub>g</sub>: {analysis.ensemble_stats?.mean_rg?.toFixed(3) || 'N/A'} Å
          </p>
        </div>
      </div>
    );
  };

  const EnsembleStatsCard = ({ analysis }) => {
    if (!analysis?.ensemble_stats) return null;
    
    const stats = analysis.ensemble_stats;
    
    return (
      <div className="card" style={{ padding: 32 }}>
        <h3 className="text-heading" style={{ fontSize: 18, marginBottom: 32 }}>
          Ensemble Statistics
        </h3>
        
        {/* Primary Metrics */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="text-center">
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-chemistry)', marginBottom: 12 }}>
              {stats.n_frames}
            </div>
            <div className="text-heading" style={{ fontSize: 13, marginBottom: 4 }}>
              BioEmu Samples
            </div>
            <div className="text-caption">
              Conformations in ensemble
            </div>
          </div>
          
          <div className="text-center">
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
              {stats.mean_rg?.toFixed(2) || 'N/A'}
            </div>
            <div className="text-heading" style={{ fontSize: 13, marginBottom: 4 }}>
              Mean R<sub>g</sub> (Å)
            </div>
            <div className="text-caption">
              Overall compactness
            </div>
          </div>
          
          <div className="text-center">
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-materials)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
              {analysis.flexibility_stats?.mean_rmsf?.toFixed(2) || 'N/A'}
            </div>
            <div className="text-heading" style={{ fontSize: 13, marginBottom: 4 }}>
              Mean RMSF (Å)
            </div>
            <div className="text-caption">
              Average flexibility
            </div>
          </div>
        </div>

        {/* Methodology info */}
        <div style={{ borderTop: '1px solid var(--stroke-default)', paddingTop: 24 }}>
          <div className="text-caption" style={{ lineHeight: 1.6 }}>
            <span className="font-semibold">BioEmu Samples:</span> Number of conformations in the generated ensemble - more samples provide better statistical coverage.
            <br />
            <span className="font-semibold">Mean R<sub>g</sub>:</span> Average radius of gyration indicating overall structural compactness - higher values suggest extended conformations.
            <br />
            <span className="font-semibold">Mean RMSF:</span> Average per-residue flexibility across the ensemble - quantifies atomic mobility patterns.
          </div>
        </div>
      </div>
    );
  };

  // Data Explorer Tab Content
  const DataExplorerTab = () => {
    if (!results) {
      return (
        <div className="card" style={{ padding: 24 }}>
          <div className="text-center">
            <h4 className="text-heading" style={{ fontSize: 15, marginBottom: 8 }}>No Data to Export</h4>
            <p className="text-body" style={{ fontSize: 13, marginBottom: 16 }}>Generate an ensemble first to access structure files and analysis data.</p>
            <button
              onClick={() => setActiveTab('input')}
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: 13 }}
            >
              Generate Ensemble
            </button>
          </div>
        </div>
      );
    }

    if (results.error) {
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="error-card" style={{ maxWidth: 400, margin: '0 auto' }}>
            <div className="error-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="error-card__body">
              <div className="error-card__title">No Data Available</div>
              <div className="error-card__message">{results.error}</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-heading" style={{ fontSize: 18 }}>
            Data Explorer
          </h2>
          <div className="text-caption">
            Download and explore generated data
          </div>
        </div>

        {/* Data Overview Card */}
        <div className="card" style={{ padding: 16 }}>
          <h4 style={{ fontWeight: 500, color: 'var(--brand-primary)', marginBottom: 12, fontSize: 14 }}>Available Data Types:</h4>
          <div className="text-body" style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>PDB Structure:</strong> Topology data file</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>XTC Trajectory:</strong> Animation data file</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>Complete Analysis:</strong> Full trajectory data with all metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>Flexibility Data:</strong> Per-residue RMSF measurements</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>Structure Data:</strong> Per-residue secondary structure analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span><strong>Project Summary:</strong> Metadata and file inventory</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 className="text-heading" style={{ fontSize: 16, marginBottom: 16 }}>
            Available Downloads
          </h3>
          
          <div className="space-y-3">
            {/* Primary Data Files */}
            {results['topology.pdb'] && (
              <button
                onClick={() => downloadFile(results['topology.pdb'].data, `${sequence.slice(0, 8)}_topology.pdb`)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                  isDarkMode
                    ? 'bg-blue-900/20 border border-blue-800 hover:bg-blue-900/30'
                    : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="text-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>PDB Structure</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Topology data file</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-800 text-blue-300' : 'bg-blue-200 text-blue-700'}`}>
                  .pdb
                </div>
              </button>
            )}

            {results['samples.xtc'] && (
              <button
                onClick={() => downloadFile(results['samples.xtc'].data, `${sequence.slice(0, 8)}_samples.xtc`, 'application/octet-stream')}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                  isDarkMode
                    ? 'bg-green-900/20 border border-green-800 hover:bg-green-900/30'
                    : 'bg-green-50 border border-green-200 hover:bg-green-100'
                }`}
              >
                <div className="text-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>XTC Trajectory</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Animation data file</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-green-800 text-green-300' : 'bg-green-200 text-green-700'}`}>
                  .xtc
                </div>
              </button>
            )}

            {/* Analysis Data */}
            {analysisData && (
              <>
                <button
                  onClick={() => {
                    const filteredData = getFilteredAnalysisData();
                    downloadFile(JSON.stringify(filteredData, null, 2), `${sequence.slice(0, 8)}_trajectory_analysis.json`);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                    isDarkMode
                      ? 'bg-purple-900/20 border border-purple-800 hover:bg-purple-900/30'
                      : 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <div className="text-2xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>Complete Analysis</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Full trajectory data with all metrics</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-purple-800 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>
                    .json
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    if (analysisData?.real_flexibility) {
                      const csvContent = analysisData.real_flexibility
                        .map((rmsf, index) => `${index + 1},${sequence[index] || 'X'},${rmsf.toFixed(6)}`)
                        .join('\n');
                      const header = 'Residue,AminoAcid,RMSF_Angstrom\n';
                      downloadFile(header + csvContent, `${sequence.slice(0, 8)}_flexibility.csv`);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                    isDarkMode
                      ? 'bg-orange-900/20 border border-orange-800 hover:bg-orange-900/30'
                      : 'bg-orange-50 border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <div className="text-2xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>Flexibility Data</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Per-residue RMSF measurements</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-orange-800 text-orange-300' : 'bg-orange-200 text-orange-700'}`}>
                    .csv
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    if (analysisData?.secondary_structure_stats) {
                      const stats = analysisData.secondary_structure_stats;
                      const csvContent = stats.helix_fraction
                        .map((helix, index) => 
                          `${index + 1},${sequence[index] || 'X'},${(helix * 100).toFixed(2)},${(stats.sheet_fraction[index] * 100).toFixed(2)},${(stats.coil_fraction[index] * 100).toFixed(2)}`
                        )
                        .join('\n');
                      const header = 'Residue,AminoAcid,Helix_Percent,Sheet_Percent,Coil_Percent\n';
                      downloadFile(header + csvContent, `${sequence.slice(0, 8)}_secondary_structure.csv`);
                    }
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                    isDarkMode
                      ? 'bg-red-900/20 border border-red-800 hover:bg-red-900/30'
                      : 'bg-red-50 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <div className="text-2xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>Structure Data</div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Per-residue secondary structure analysis</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-red-800 text-red-300' : 'bg-red-200 text-red-700'}`}>
                    .csv
                  </div>
                </button>

                {/* RMSD Comparison Data Export */}
                {analysisData?.rmsd_to_alphafold && (
                  <button
                    onClick={() => {
                      const isCustomPdb = inputMode === 'pdb';
                      const rmsdData = {
                        comparison_type: isCustomPdb ? 'Custom_PDB' : 'AlphaFold',
                        reference_structure: isCustomPdb ? pdbId : 'AlphaFold_Prediction',
                        statistics: {
                          avg_rmsd: analysisData.rmsd_to_alphafold.avg_rmsd_to_alphafold,
                          min_rmsd: analysisData.rmsd_to_alphafold.min_rmsd_to_alphafold,
                          max_rmsd: analysisData.rmsd_to_alphafold.max_rmsd_to_alphafold,
                          n_frames: analysisData.rmsd_to_alphafold.n_frames_superposed
                        },
                        rmsd_values: analysisData.rmsd_to_alphafold.rmsd_values || [],
                        exported_at: new Date().toISOString()
                      };
                      downloadFile(JSON.stringify(rmsdData, null, 2), `${sequence.slice(0, 8)}_rmsd_comparison.json`);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                      isDarkMode
                        ? 'bg-cyan-900/20 border border-cyan-800 hover:bg-cyan-900/30'
                        : 'bg-cyan-50 border border-cyan-200 hover:bg-cyan-100'
                    }`}
                  >
                    <div className="text-2xl">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>RMSD Comparison</div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {inputMode === 'pdb' ? `vs Custom PDB (${pdbId})` : 'vs AlphaFold prediction'}
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-cyan-800 text-cyan-300' : 'bg-cyan-200 text-cyan-700'}`}>
                      .json
                    </div>
                  </button>
                )}

                {/* Contact Map Data Export */}
                {analysisData?.contact_map && (
                  <button
                    onClick={() => {
                      const contactData = {
                        distance_matrix: analysisData.contact_map,
                        protein_length: sequence.length,
                        sequence: sequence,
                        ensemble_averaged: true,
                        exported_at: new Date().toISOString()
                      };
                      downloadFile(JSON.stringify(contactData, null, 2), `${sequence.slice(0, 8)}_contact_map.json`);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                      isDarkMode
                        ? 'bg-teal-900/20 border border-teal-800 hover:bg-teal-900/30'
                        : 'bg-teal-50 border border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    <div className="text-2xl">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`}>Contact Map</div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Ensemble-averaged distance matrix</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-teal-800 text-teal-300' : 'bg-teal-200 text-teal-700'}`}>
                      .json
                    </div>
                  </button>
                )}
              </>
            )}

            {/* Summary */}
            <button
              onClick={() => {
                const summary = {
                  sequence: sequence,
                  length: sequence.length,
                  ensembleSize: numSamples,
                  generatedAt: new Date().toISOString(),
                  files: {
                    pdb: pdbFile ? 'included' : 'not available',
                    xtc: xtcFile ? 'included' : 'not available'
                  },
                  analysis: {
                    trajectoryAnalysis: analysisData ? 'available' : 'not available',
                    flexibilityData: analysisData?.real_flexibility ? 'available' : 'not available',
                    secondaryStructure: analysisData?.secondary_structure_stats ? 'available' : 'not available'
                  }
                };
                downloadFile(JSON.stringify(summary, null, 2), `${sequence.slice(0, 8)}_summary.json`);
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${
                isDarkMode
                  ? 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                  : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <div className="text-2xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Project Summary</div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Metadata and file inventory</div>
              </div>
              <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700'}`}>
                .json
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Conformational Explorer Tab Content - using new PCA-based explorer
  const EnergyLandscapeTab = () => {
    return (
      <ConformationalExplorer
        bioEmuFiles={pdbFile && xtcFile ? { pdbFile, xtcFile } : null}
        analysisData={analysisData}
        isDarkMode={isDarkMode}
        sequence={sequence}
        setActiveTab={setActiveTab}
      />
    );
  };

  // Helper function to get current context for copilot
  const getCopilotContext = useCallback(() => {
    // Map tab IDs to user-friendly names
    const getTabDisplayName = (tabId) => {
      const tabMap = {
        'input': 'Generate Ensemble',
        'visualization': 'Structure',
        'alphafold': 'Compare',
        'landscape': 'Analyze',
        'data': 'Export'
      };
      return tabMap[tabId] || tabId;
    };

    const context = {
      // UI & Navigation
      isDarkMode,
      activeTab,
      activeTabName: getTabDisplayName(activeTab),
      
      // Protein Information
      currentProtein: proteinInfo || (sequence ? { sequence, name: 'Custom Sequence' } : null),
      uniprotId,
      proteinName: proteinInfo?.name || (sequence ? 'Custom Sequence' : 'Unknown'),
      sequenceLength: sequence?.length || proteinInfo?.sequence?.length,
      currentSequence: sequence, // Add the actual sequence data
      sequencePreview: sequence ? sequence.slice(0, 50) + (sequence.length > 50 ? '...' : '') : null,
      
      // Structure Data - clarify what's available where
      hasAlphaFoldStructure: !!alphafoldPdbFile,
      structureSource: alphafoldPdbFile ? 'AlphaFold' : (proteinInfo ? 'PDB' : null),
      alphaFoldAvailableOnTab: alphafoldPdbFile ? 'Compare tab' : null,
      
      // Analysis Data & Results (corrected to match actual data structure)
      hasRMSDData: !!(analysisData?.real_rg_ensemble?.length),
      hasFlexibilityData: !!(analysisData?.real_flexibility?.length),
      hasEnergyData: !!(analysisData?.energyLandscape?.length),
      hasTrajectoryData: !!(pdbFile && xtcFile),
      rmsdRange: analysisData?.real_rg_ensemble ? {
        min: Math.min(...analysisData.real_rg_ensemble),
        max: Math.max(...analysisData.real_rg_ensemble),
        frameCount: analysisData.real_rg_ensemble.length
      } : null,
      
      // Current Analysis State
      hasAnalysisData: !!analysisData,
      ensembleStats: analysisData?.ensemble_stats || null,
      
      // App State
      isAnalyzing,
      isDemoMode,
      apiStatus,
      
      // User Experience Level (enhanced detection)
      userLevel: getUserExpertiseLevel(isDemoMode, analysisData, sequence, proteinInfo),
      
      // Recent Activity Context
      lastAction: isAnalyzing ? 'analyzing' : (analysisData ? 'viewing_results' : 'browsing'),
      timestamp: Date.now()
    };
    return context;
  }, [isDarkMode, activeTab, proteinInfo, sequence, alphafoldPdbFile, analysisData, isAnalyzing, isDemoMode, uniprotId, apiStatus, pdbFile, xtcFile]);

  return (
    <CopilotProvider>
      <div className="app-shell"
           data-theme={isDarkMode ? undefined : 'light'}>
      
      {/* AppHeader */}
      <header className="app-header">
        <div className="app-header__inner">

          {/* Back link row — only when arrived from Labs site */}
          {showLabsBack && !isEmbedded && (
            <div className="app-header__back-row">
              <a href={process.env.REACT_APP_LABS_URL || 'https://aka.ms/ai4science'} className="app-header__back">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
                AI for Science Labs
              </a>
            </div>
          )}

          {/* Brand row */}
          <div className="app-header__main">
            <div className="app-header__brand">
              <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="10" height="10" fill="#f25022" />
                <rect x="11" width="10" height="10" fill="#7fba00" />
                <rect y="11" width="10" height="10" fill="#00a4ef" />
                <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
              </svg>
              <div>
                <div className="app-header__title">
                  <span className="app-header__name">BioEmu</span>
                </div>
                <span className="app-header__subtitle">
                  Equilibrium Conformation Sampling &middot; Microsoft Research AI for Science
                  <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary, #aaa)', verticalAlign: 'middle', letterSpacing: '0.04em', fontWeight: 500 }}>RESEARCH PREVIEW</span>
                </span>
              </div>
            </div>

            {/* Right-side tools slot */}
            <div className="app-header__actions">
              <button onClick={() => setShowTour(true)} className="app-header__btn" aria-label="Take a guided tour">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                Tour
              </button>
              <button onClick={toggleAppTheme} className="app-header__btn" title={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isDarkMode
                    ? <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    : <><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>
                  }
                </svg>
                {isDarkMode ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>

        </div>
      </header>

      <div style={{ padding: isEmbedded ? 0 : '24px 32px' }}>

        {/* Main Content Area with Tab Navigation */}
        <div className="content-panel">
          {/* Segmented Control Tab Navigation */}
          <div className="tab-bar" data-tour="tab-bar">
              <div className="tab-bar__track">
                {[
                  { 
                    id: 'input', 
                    label: 'Generate',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )
                  },
                  { 
                    id: 'visualization', 
                    label: 'Structure',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    )
                  },
                  { 
                    id: 'alphafold', 
                    label: 'Compare',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )
                  },
                  { 
                    id: 'landscape', 
                    label: 'Analyze',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )
                  },
                  { 
                    id: 'data', 
                    label: 'Export',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )
                  }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      ContextIntegration.onTabChanged(tab.id);
                    }}
                    className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
          </div>

          {/* Tab Content */}
          <div className={`${activeTab === 'landscape' ? 'p-0 h-[calc(100vh-200px)] overflow-hidden' : activeTab === 'alphafold' ? 'p-0 overflow-auto' : 'p-6 overflow-auto'}`}>
            {activeTab === 'input' && <InputTab />}
            {activeTab === 'visualization' && <VisualizationTab />}
            {activeTab === 'landscape' && <EnergyLandscapeTab />}
            {activeTab === 'data' && <DataExplorerTab />}
            {activeTab === 'alphafold' && (
              <ProteinAnalysisPage 
                isDarkMode={isDarkMode}
                bioEmuFiles={pdbFile && xtcFile ? { pdbFile, xtcFile } : null}
                alphafoldPdbFile={alphafoldPdbFile}
                sequence={sequence}
                analysisData={analysisData}
                proteinInfo={proteinInfo}
                uniprotId={uniprotId}
                onBioEmuLaunch={(sequence, name) => {
                  setActiveTab('input');
                  setSequence(sequence);
                }}
                onTabChange={setActiveTab}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Feature Tour */}
      {showTour && (
        <FeatureTour
          steps={tourSteps}
          onComplete={() => {
            setShowTour(false);
            localStorage.setItem('bioemu-tour-completed', '1');
          }}
        />
      )}

      {/* Copilot Widget - Floating AI Assistant */}
      <CopilotWidget 
        context={getCopilotContext()}
        isDarkMode={isDarkMode}
        position="bottom-right"
      />
    </div>
    </CopilotProvider>
  );
};

export default App;
