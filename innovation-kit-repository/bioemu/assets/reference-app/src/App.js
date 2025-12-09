import React, { useState, useEffect, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MolstarViewerEnhanced from './components/MolstarViewerEnhanced';
import ProteinAnalysisPage from './components/ProteinAnalysisPage';
import ConformationalExplorer from './components/ConformationalExplorer';
import SecondaryStructureVisualization from './components/SecondaryStructureVisualization';
import ContactMapVisualization from './components/ContactMapVisualization';
import { CopilotProvider } from './components/copilot/CopilotContext';
import CopilotWidget from './components/copilot/CopilotWidget';
import { UnifiedSequenceInput } from './components/UnifiedSequenceInput';
import { generateProteinSamples, generateProteinSamplesFromUniProt, decodeApiResults, prepareFilesForMolViewer, analyzeTrajectory, getBackendUrl } from './services/BioEmuService';
import { UBIQUITIN_DEMO_DATA } from './data/ubiquitin_demo_data';
import { ContextIntegration } from './services/ContextIntegration';
import { logger } from './utils/logger';

// Stable Number Input Component (same pattern as StableInputs)
const NumberInput = React.memo(({ value, onChange, min, max, isDarkMode, disabled }) => {
  // Internal state to prevent re-renders from parent
  const [internalValue, setInternalValue] = useState(value?.toString() || '');

  // Only update internal state if value prop changes from outside
  useEffect(() => {
    if (value?.toString() !== internalValue) {
      setInternalValue(value?.toString() || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Only depend on value prop, not internal value

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    // NO parent updates during typing - only internal state changes
  };

  // Only update parent when user finishes editing (blur)
  const handleBlur = () => {
    const num = parseInt(internalValue) || 50;
    const clampedValue = Math.max(min, Math.min(max, num));
    onChange(clampedValue);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-20 px-2 py-1 text-sm rounded border ${isDarkMode
        ? 'bg-gray-700 border-gray-600 text-white'
        : 'bg-white border-gray-300 text-gray-900'
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
  const [alphafoldPdbFile, setAlphafoldPdbFile] = useState(null);

  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false);

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
    logger.debug('PDB sequence fetched', { sequenceLength: sequence.length, pdbData });
    setSequence(sequence);
  }, []);

  const loadExample = async (proteinKey) => {
    const protein = EXAMPLE_PROTEINS[proteinKey];
    setSequence(protein.sequence);
    setInputMode('sequence'); // Switch to sequence mode when loading example

    // If this protein has a known UniProt ID, also fetch its AlphaFold structure
    if (protein.uniprotId) {
      logger.debug(`Example protein ${proteinKey} has UniProt ID ${protein.uniprotId}, fetching AlphaFold structure`);

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
            logger.debug(`Loaded protein info for ${protein.name}`);
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
            logger.debug(`Loaded AlphaFold structure for ${protein.name}`);
          } else {
            logger.warn(`No AlphaFold structure available for ${protein.name}: ${alphafoldData.message}`);
            // Show alert for API outages during demo protein loading
            if (alphafoldData.message && alphafoldData.message.includes('server issues')) {
              console.error(`🚨 AlphaFold API outage detected while loading ${protein.name}`);
            }
          }
        } else if (alphafoldResponse.status === 503) {
          console.error(`🚨 AlphaFold API outage detected while loading ${protein.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to fetch AlphaFold structure for ${protein.name}:`, error);
      }
    } else {
      logger.debug(`Example protein ${proteinKey} has no UniProt ID - no AlphaFold structure available`);
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
    setUniprotId(protein.uniprotId);
    setInputMode('uniprot'); // Switch to UniProt mode when loading example
    setProteinInfo(null); // Clear any existing protein info

    // Set ensemble size to 50 for the Polyubiquitin-B demo
    if (proteinKey === 'ubiquitin_human') {
      setNumSamples(50);
    }
  };

  const fetchProteinInfo = useCallback(async () => {
    if (!uniprotId.trim()) return;

    setIsFetchingProtein(true);
    setProteinInfo(null);
    // Clean up previous AlphaFold object URL to prevent memory leaks
    if (alphafoldPdbFile?.url) {
      URL.revokeObjectURL(alphafoldPdbFile.url);
    }
    setAlphafoldPdbFile(null);

    try {
      // DEMO MODE: Check if this is Polyubiquitin-B (P0CG47) and use demo data
      if (uniprotId.trim().toUpperCase() === 'P0CG47') {
        logger.info('DEMO MODE: Using pre-loaded Polyubiquitin-B (P0CG47) data');
        setIsDemoMode(true);

        // Extract protein info from demo data
        const demoProteinInfo = UBIQUITIN_DEMO_DATA.data.uniprot_data.protein_info;
        setProteinInfo(demoProteinInfo);
        // Don't auto-set sequence to prevent infinite loop
        // setSequence(demoProteinInfo.sequence);

        // Load AlphaFold structure from demo data
        try {
          logger.debug('Loading AlphaFold structure from demo data');
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
          logger.info('DEMO MODE: AlphaFold structure loaded from demo data');
        } catch (demoError) {
          logger.warn('Failed to load AlphaFold structure from demo data:', demoError);
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
            logger.debug('Fetching AlphaFold structure');
            const alphafoldResponse = await fetch(`${backendUrl}/api/alphafold-structure/${uniprotId.trim()}`);
            if (alphafoldResponse.ok) {
              const alphafoldData = await alphafoldResponse.json();
              if (alphafoldData.status === 'success') {
                // Structure data is directly the PDB string content
                const pdbString = alphafoldData.structure_data;
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
                logger.info('AlphaFold structure loaded successfully');
              } else {
                logger.warn('AlphaFold structure not available:', alphafoldData.message);
                // Show user-friendly error message for API outages
                if (alphafoldData.message && alphafoldData.message.includes('server issues')) {
                  alert(`🚨 AlphaFold API Outage Detected\n\nThe AlphaFold EBI API is currently experiencing server issues (returning 500 errors). This is a temporary infrastructure problem on their end.\n\n⏳ Please try again in a few minutes.`);
                } else {
                  console.warn("AlphaFold structure not available for this protein");
                }
              }
            } else if (alphafoldResponse.status === 503) {
              // Service Unavailable - API outage
              const errorData = await alphafoldResponse.json();
              alert(`🚨 AlphaFold API Outage\n\n${errorData.message || 'AlphaFold EBI API is currently experiencing issues.'}\n\n⏳ Please try again later.`);
            } else {
              console.warn("AlphaFold request failed:", alphafoldResponse.status);
            }
          } catch (alphafoldError) {
            console.warn("Failed to fetch AlphaFold structure:", alphafoldError);
            // Check if it's a network error
            if (alphafoldError.message && alphafoldError.message.includes('fetch')) {
              alert(`🔌 Network Error\n\nUnable to connect to AlphaFold service. Please check your internet connection and try again.`);
            }
          }
        } else {
          console.error('Failed to fetch protein info:', data.message);
          alert(`Failed to fetch protein info: ${data.message}`);
        }
      } else {
        console.error('Failed to fetch protein info:', response.status);
        alert(`Failed to fetch protein info. Server returned ${response.status}.`);
      }
    } catch (error) {
      console.error('Error fetching protein info:', error);
      alert('Error fetching protein info. Please check your connection.');
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

    logger.debug('generateEnsemble called', {
      inputMode,
      sequenceLength: inputSequence.length,
      uniprotId,
      samples
    });

    try {
      let apiResults;

      if (inputMode === 'uniprot' && proteinInfo) {
        // Use UniProt-based prediction
        logger.debug('Using UniProt API for prediction');

        const proteinData = {
          uniprot_id: uniprotId,
          sequence: proteinInfo.sequence,
          protein_info: proteinInfo,
          alphafold_available: true // We can check this from the previous API call
        };

        apiResults = await generateProteinSamplesFromUniProt(proteinData, samples, true);
      } else {
        // Use regular sequence-based prediction
        logger.debug('Using sequence API for prediction');
        apiResults = await generateProteinSamples(inputSequence, samples);
      }

      // Decode and prepare results (same for both methods)
      logger.debug('Decoding API results');
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
          logger.debug('Starting trajectory analysis');

          const analysis = await analyzeTrajectory(decodedResults);
          setAnalysisData(analysis);

          logger.info('Trajectory analysis completed', {
            frames: analysis.ensemble_stats?.n_frames,
            residues: analysis.real_flexibility?.length
          });

        } catch (analysisError) {
          logger.warn('Trajectory analysis failed:', analysisError);
          // Don't fail the whole process if analysis fails
        } finally {
          setIsAnalyzing(false);
        }
      }

    } catch (error) {
      logger.error('Ensemble generation failed:', error);
      setResults({ error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = () => {
    logger.debug('handleSubmit called', {
      inputMode,
      sequenceLength: sequence.length,
      uniprotId,
      isValid: isValidInput()
    });

    if (isValidInput()) {
      // Use protein sequence for UniProt mode, current sequence for sequence/pdb mode
      const sequenceToUse = inputMode === 'uniprot' ? proteinInfo.sequence : sequence;
      generateEnsemble(sequenceToUse, numSamples);
    } else {
      logger.warn('Invalid input, not proceeding');
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
    <>
      {/* Add CSS for contentEditable placeholders */}
      <style>
        {`
          [contenteditable][data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: ${isDarkMode ? '#9CA3AF' : '#6B7280'};
            font-style: italic;
          }
          [contenteditable]:focus {
            outline: none;
          }
        `}
      </style>

      <div className="space-y-6">

        {/* API Offline Banner - Prominently direct to demo */}
        <div className={`rounded-lg p-4 border-l-4 border-blue-500 ${apiStatus === 'failed' ? 'block' : 'hidden'} ${isDarkMode ? 'bg-gray-800/50 border-blue-400' : 'bg-blue-50 border-blue-500'
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-blue-500 text-2xl">ℹ️</div>
              <div>
                <h3 className={`font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  API Currently Offline
                </h3>
                <div className={`text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                  Try our <strong>Polyubiquitin-B demo</strong> below - it works offline with real data!
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                // Scroll to demo section
                const demoSection = document.querySelector('[data-demo-section]');
                if (demoSection) {
                  demoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              View Demo ↓
            </button>
          </div>
        </div>

        {/* Platform Header */}
        <div className={`text-center mb-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          <h1 className="text-3xl font-bold mb-2">Biomolecular Emulator (BioEmu) Research Platform</h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Interactive platform for protein ensemble generation and structural analysis, powered by BioEmu's equilibrium ensemble emulation
          </p>
        </div>

        {/* Clean Two-Box Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT BOX: Protein Input Configuration */}
          <div className={`lg:col-span-2 rounded-xl p-6 border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center space-x-2 mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Input Protein
              </h3>
              {/* Info Icon with Tooltip */}
              <div className="relative group">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center cursor-help ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'
                  }`}>
                  <span className="text-white text-xs font-semibold">i</span>
                </div>
                {/* Tooltip */}
                <div className={`absolute left-6 top-0 w-80 p-4 rounded-lg border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
                  }`}>
                  <h4 className={`font-medium text-sm mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    Choose Your Input Method
                  </h4>
                  <div className={`text-sm space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    <div><strong>Manual Sequence:</strong> Analyze any protein sequence with BioEmu-powered structure prediction.</div>
                    <div><strong>UniProt ID:</strong> Recommended for known proteins - includes AlphaFold reference structure + BioEmu-generated structures.</div>
                    <div><strong>PDB ID:</strong> Extract sequence from crystal structure with disulfide bridge information.</div>
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Input a protein for sequence for ensemble generation
            </p>

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

          {/* RIGHT BOX: Generation Controls */}
          <div className={`lg:col-span-1 rounded-xl p-6 border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
            <h3 className={`text-lg font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Generate Ensemble
            </h3>

            {/* Quick Demo */}
            <div className="mb-6 text-center">
              <button
                onClick={() => loadUniProtExample('ubiquitin_human')}
                disabled={isGenerating || isFetchingProtein}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border-2 border-dashed ${isGenerating || isFetchingProtein
                  ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                  : isDarkMode
                    ? 'border-blue-400 text-blue-300 hover:bg-blue-900/20'
                    : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                  }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <span>⚡</span>
                  <span>Try Demo: Polyubiquitin-B</span>
                </div>
              </button>
            </div>

            {/* Ensemble Size */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Ensemble Size
                </label>
                <div className="flex items-center space-x-2">
                  <NumberInput
                    value={numSamples}
                    onChange={setNumSamples}
                    min={10}
                    max={1000}
                    isDarkMode={isDarkMode}
                    disabled={isGenerating}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    conformations
                  </span>
                </div>
              </div>
              <style>
                {`
                  .blue-slider {
                    -webkit-appearance: none;
                    appearance: none;
                  }
                  .blue-slider::-webkit-slider-thumb {
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    height: 20px !important;
                    width: 20px !important;
                    border-radius: 50% !important;
                    background: #3b82f6 !important;
                    cursor: pointer !important;
                    border: none !important;
                  }
                  .blue-slider::-moz-range-thumb {
                    height: 20px !important;
                    width: 20px !important;
                    border-radius: 50% !important;
                    background: #3b82f6 !important;
                    cursor: pointer !important;
                    border: none !important;
                    -moz-appearance: none !important;
                  }
                  .blue-slider::-ms-thumb {
                    height: 20px !important;
                    width: 20px !important;
                    border-radius: 50% !important;
                    background: #3b82f6 !important;
                    cursor: pointer !important;
                    border: none !important;
                  }
                `}
              </style>
              <input
                type="range"
                min="10"
                max="1000"
                step="1"
                value={numSamples}
                onChange={(e) => setNumSamples(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer dark:bg-gray-700 blue-slider"
                disabled={isGenerating}
                style={{
                  background: isDarkMode ? '#374151' : '#e5e7eb'
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10</span>
                <span>1000</span>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={isGenerating || !isValidInput()}
                className={`px-8 py-3 rounded-lg font-medium transition-colors ${isGenerating || !isValidInput()
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                    </svg>
                    <span>Generate Ensemble</span>
                  </div>
                )}
              </button>
            </div>            {/* Simple Status */}
            <div className="mt-4 text-center">
              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {apiStatus === 'failed' && (
                  <div className="flex items-center justify-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Demo Mode
                  </div>
                )}
                {apiStatus === 'checking' && (
                  <div className="flex items-center justify-center">
                    <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </div>
                )}
                {isValidInput() && apiStatus === 'connected' && (
                  <span>{numSamples <= 50 ? 'Fast (~1-2 min)' : numSamples <= 200 ? 'Medium (~3-5 min)' : 'Longer (~5+ min)'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Microsoft Research Attribution */}
        <div className={`rounded-lg p-6 text-center ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <p className="mb-2">
              Prototype created by the Microsoft Research (MSR) Creative Technology Team in collaboration with the BioEmu research team
            </p>
            <p className="mb-4">
              Learn more about the team behind BioEmu at Microsoft Research (MSR) AI for Science
            </p>

            {/* Links Section */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="https://www.microsoft.com/en-us/research/lab/microsoft-research-ai-for-science"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                MSR AI for Science
              </a>

              <a
                href="https://www.science.org/doi/10.1126/science.adv9817"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Science Paper
              </a>

              <a
                href="https://github.com/microsoft/bioemu"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                BioEmu GitHub repo
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Visualization Tab Content - Clean layout with working components
  const VisualizationTab = () => {
    if (!results || results.error) {
      return (
        <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="text-center">
            <div className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {results?.error ? 'Generation Failed' : 'No Structure Available'}
            </h4>
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {results?.error ? results.error : 'Generate a protein ensemble first to view 3D molecular structures and dynamics.'}
            </p>
            <button
              onClick={() => setActiveTab('input')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center space-x-2 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Go to Generate</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Structure Explorer
          </h2>
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Sequence: {sequence.slice(0, 20)}... • {analysisData ? 'Analysis Complete' : 'Analysis Pending'}
          </div>
        </div>

        {/* 3D Molecular Viewer */}
        <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Interactive 3D Molecular Viewer
          </h3>
          <div className="h-[600px] w-full">
            {pdbFile && xtcFile ? (
              <MolstarViewerEnhanced
                pdbFile={pdbFile}
                xtcFile={xtcFile}
              />
            ) : (
              <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">Loading 3D Viewer...</div>
                  <div className="text-sm">Preparing molecular data</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading Indicator for Generation/Analysis */}
        {(isGenerating || isAnalyzing) && (
          <div className={`rounded-xl p-12 text-center mb-6 border ${isDarkMode
            ? 'bg-gray-800 border-gray-600 shadow-lg'
            : 'bg-white border-gray-200 shadow-lg'
            }`}>
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {isGenerating ? 'Generating Protein Ensemble' : 'Analyzing Conformations'}
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isGenerating
                    ? 'Creating molecular dynamics trajectories...'
                    : 'Computing contact maps and structural metrics...'}
                </p>
                <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
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
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Ensemble Analysis
              </h3>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                BioEmu conformational analysis powered by MDTraj
              </div>
            </div>

            {/* Optimized 40/60 Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

              {/* LEFT COLUMN (40%): Ensemble Statistics + Contact Map */}
              <div className="xl:col-span-2 flex flex-col space-y-6">

                {/* Ensemble Statistics */}
                <div className={`rounded-xl p-6 border ${isDarkMode
                  ? 'bg-gray-800 border-gray-600 shadow-lg'
                  : 'bg-white border-gray-200 shadow-lg'
                  }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Ensemble Statistics
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                        Conformational ensemble overview
                      </p>
                    </div>
                  </div>
                  <EnsembleStatsCard analysis={analysisData} />
                </div>

                {/* Contact Map Analysis - Match Flex Profile Height */}
                <div className={`rounded-xl border flex-1 ${isDarkMode
                  ? 'bg-gray-800 border-gray-600 shadow-lg'
                  : 'bg-white border-gray-200 shadow-lg'
                  }`}>
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Contact Map Analysis
                        </h3>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                          Cα-Cα Distance Map
                        </p>
                      </div>
                    </div>

                    {/* Contact Map Visualization - Larger Map Size */}
                    <div className="flex-1 flex items-center justify-center">
                      {isAnalyzing ? (
                        <div className={`w-96 h-96 flex items-center justify-center rounded-lg border-2 border-dashed ${isDarkMode
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
                        <div className={`w-96 h-96 flex items-center justify-center rounded-lg border-2 border-dashed ${isDarkMode
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
                <div className={`rounded-xl border ${isDarkMode
                  ? 'bg-gray-800 border-gray-600 shadow-lg'
                  : 'bg-white border-gray-200 shadow-lg'
                  }`}>
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Radius of Gyration Distribution
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                        Conformational compactness profile
                      </p>
                    </div>
                  </div>
                  <RgHistogramChart analysis={analysisData} />
                </div>

                {/* Molecular Flexibility Profile */}
                <div className={`rounded-xl border flex-1 ${isDarkMode
                  ? 'bg-gray-800 border-gray-600 shadow-lg'
                  : 'bg-white border-gray-200 shadow-lg'
                  }`}>
                  <div className="flex items-center justify-between p-6 pb-4">
                    <div>
                      <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Molecular Flexibility Profile
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
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
                  logger.debug('Selected structural region:', region);
                }}
                showConfidenceIntervals={true}
              />
            </div>
          </div>
        )}

        {/* No Analysis Data State - only show if not currently generating */}
        {!analysisData && !isGenerating && (
          <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <div className="text-center">
              <div className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19c-5 0-8-3-8-9s3-9 8-9 8 4 8 9-3 9-8 9zm0-16C5.134 3 2 6.134 2 10s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Trajectory Analysis Required</h4>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generate conformational ensemble and run MD trajectory analysis to access detailed structural dynamics, flexibility profiles, and secondary structure transitions.</p>
              <button
                onClick={() => setActiveTab('visualization')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Go to Structure Explorer
              </button>
            </div>
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
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity={0.7} />
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
                    Residue {label} ({flexibilityData[label - 1]?.aminoAcid})
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
        <div className={`mt-4 p-4 rounded-xl ${isDarkMode
          ? 'bg-gray-800/50 border border-gray-700/50'
          : 'bg-gray-50/50 border border-gray-200/50'
          }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.7} />
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
        <div className={`mt-6 p-4 rounded-xl ${isDarkMode
          ? 'bg-gray-800/50 border border-gray-700/50'
          : 'bg-gray-50/50 border border-gray-200/50'
          }`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
      <div className={`rounded-2xl p-8 ${isDarkMode
        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
        : 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg'
        }`}>
        <h3 className={`text-xl font-bold mb-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Ensemble Statistics
        </h3>

        {/* Primary Metrics - Perfectly centered and balanced */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="text-center">
            <div className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
              {stats.n_frames}
            </div>
            <div className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              BioEmu Samples
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Conformations in ensemble
            </div>
          </div>

          <div className="text-center">
            <div className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              {stats.mean_rg?.toFixed(2) || 'N/A'}
            </div>
            <div className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Mean R<sub>g</sub> (Å)
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Overall compactness
            </div>
          </div>

          <div className="text-center">
            <div className={`text-4xl font-bold mb-3 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
              {analysis.flexibility_stats?.mean_rmsf?.toFixed(2) || 'N/A'}
            </div>
            <div className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Mean RMSF (Å)
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Average flexibility
            </div>
          </div>
        </div>

        {/* Methodology info - Clean and subtle */}
        <div className={`border-t pt-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`text-xs leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
        <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="text-center">
            <div className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className={`text-base font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Data to Export</h4>
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generate a protein ensemble first to access downloadable analysis data and structure files.</p>
            <button
              onClick={() => setActiveTab('input')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center space-x-2 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Go to Generate</span>
            </button>
          </div>
        </div>
      );
    }

    if (results.error) {
      return (
        <div className="text-center py-12">

          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-red-400 mb-2">No Data to Explore</h3>
            <p className="text-red-300 text-sm">{results.error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Data Explorer
          </h2>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Download and explore generated data
          </div>
        </div>

        {/* Data Overview Card */}
        <div className={`rounded-lg p-4 border ${isDarkMode
          ? 'bg-gray-700/50 border-gray-600'
          : 'bg-blue-50 border-blue-200'
          }`}>
          <h4 className={`font-medium mb-3 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>Available Data Types:</h4>
          <div className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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

        <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Available Downloads
          </h3>

          <div className="space-y-3">
            {/* Primary Data Files */}
            {results['topology.pdb'] && (
              <button
                onClick={() => downloadFile(results['topology.pdb'].data, `${sequence.slice(0, 8)}_topology.pdb`)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                  className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                    className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
                    className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
              className={`w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left ${isDarkMode
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
      <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-6 py-6 2xl:max-w-none 2xl:px-12">
          {/* Theme Toggle - positioned in top right */}
          <div className="flex justify-end mb-4">
            <button
              onClick={toggleAppTheme}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 border ${isDarkMode
                ? 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-300'
                : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
                }`}
              title={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
            >
              <span className="text-sm">
                {isDarkMode ? '🌙' : '☀️'}
              </span>
              <span className="text-xs">
                {isDarkMode ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>

          {/* Main Content Area with Tab Navigation */}
          <div className={`rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Segmented Control Tab Navigation */}
            <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="px-6 py-4">
                <div className={`inline-flex rounded-lg p-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
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
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center space-x-2 ${activeTab === tab.id
                        ? isDarkMode
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'bg-white text-gray-900 shadow-sm'
                        : isDarkMode
                          ? 'text-gray-300 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className={`${activeTab === 'landscape' ? 'p-0 h-[calc(100vh-200px)] overflow-hidden' : 'p-6 overflow-auto'}`}>
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
