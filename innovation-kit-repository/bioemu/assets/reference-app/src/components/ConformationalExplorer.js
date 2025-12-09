import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MolstarViewerFixed from './MolstarViewerTrajectoryControl';
import ContactMapVisualization from './ContactMapVisualization';

// Helper functions moved outside component to avoid dependency issues
const dotProduct = (a, b) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);
const normalize = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0 || !isFinite(norm)) {
    // Return a uniform vector if normalization fails
    const len = vector.length;
    return new Array(len).fill(1 / Math.sqrt(len));
  }
  return vector.map(val => val / norm);
};

const computePrincipalComponent = (data, orthogonalTo = null) => {
  const nFrames = data.length;
  const nFeatures = data[0].length;

  // Validate input data
  if (nFrames === 0 || nFeatures === 0) {
    console.warn('Empty data provided to PCA');
    return new Array(nFeatures).fill(0);
  }

  // Check for invalid data
  const hasInvalidData = data.some(frame =>
    frame.some(val => !isFinite(val) || isNaN(val))
  );

  if (hasInvalidData) {
    console.warn('Data contains NaN or infinite values');
    return new Array(nFeatures).fill(0);
  }

  // Initialize random vector
  let vector = new Array(nFeatures).fill(0).map(() => Math.random() - 0.5);

  // Normalize
  vector = normalize(vector);

  // Power iteration
  for (let iter = 0; iter < 20; iter++) {
    let newVector = new Array(nFeatures).fill(0);

    // Multiply by data covariance matrix
    for (let i = 0; i < nFrames; i++) {
      const projection = dotProduct(data[i], vector);
      if (!isFinite(projection)) {
        console.warn(`Non-finite projection at frame ${i}`);
        continue;
      }

      for (let j = 0; j < nFeatures; j++) {
        newVector[j] += projection * data[i][j];
      }
    }

    // Normalize
    newVector = normalize(newVector);

    // Check for convergence issues
    if (newVector.some(val => !isFinite(val))) {
      console.warn('PCA iteration produced non-finite values');
      break;
    }

    // Orthogonalize against previous component
    if (orthogonalTo) {
      const overlap = dotProduct(newVector, orthogonalTo);
      if (isFinite(overlap)) {
        for (let j = 0; j < nFeatures; j++) {
          newVector[j] -= overlap * orthogonalTo[j];
        }
        newVector = normalize(newVector);
      }
    }

    vector = newVector;
  }

  return vector;
};

const ConformationalExplorer = ({
  bioEmuFiles,
  analysisData,
  isDarkMode,
  sequence,
  setActiveTab
}) => {
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [pcaData, setPcaData] = useState(null);
  const [pcaStats, setPcaStats] = useState(null); // Statistical summaries
  const [showMethodDetails, setShowMethodDetails] = useState(false);
  const [activeResponsiveTab, setActiveResponsiveTab] = useState('pca'); // For small screen tabs
  const [contactMapDimensions, setContactMapDimensions] = useState({ width: 350, height: 350 });
  const molstarRef = useRef(null);
  const containerRef = useRef(null);

  // Memoized filtered PCA data for consistent rendering
  const filteredPcaData = useMemo(() => {
    if (!pcaData || !Array.isArray(pcaData)) {
      return [];
    }

    return pcaData.filter(point =>
      point &&
      typeof point === 'object' &&
      typeof point.frame === 'number' &&
      typeof point.pc1 === 'number' &&
      typeof point.pc2 === 'number' &&
      typeof point.cluster === 'number' &&
      isFinite(point.pc1) &&
      isFinite(point.pc2)
    );
  }, [pcaData]);

  // Sorted PCA data based on selected method
  // Real PCA calculation using Ca-Ca distance features with exp(-d_ij) transformation
  const calculatePCA = useMemo(() => {
    try {
      if (!analysisData?.real_contact_maps || !analysisData?.ensemble_stats?.n_frames) {
        return null;
      }

      // The backend provides contact maps as: real_contact_maps[frame][contact_pair_index]
      // We need to transform this into Ca-Ca distance features with exp(-d_ij) transformation
      const contactMaps = analysisData.real_contact_maps;
      const contactPairs = analysisData.contact_pairs;
      const nFrames = contactMaps.length;

      if (nFrames < 2) {
        console.warn('Not enough frames for PCA analysis');
        return null;
      }

      if (!contactPairs || contactPairs.length === 0) {
        console.warn('No contact pairs data available');
        return null;
      }

      // For each frame, compute Ca-Ca distance features with exp(-d_ij) transformation
      // Filter for j > i+3 (sequence separation > 3) as you mentioned
      const validContactIndices = [];
      contactPairs.forEach((pair, idx) => {
        const [i, j] = pair;
        if (j > i + 3) {  // Sequence separation > 3
          validContactIndices.push(idx);
        }
      });

      if (validContactIndices.length === 0) {
        console.warn('No valid contact pairs with sequence separation > 3');
        return null;
      }

      const nFeatures = validContactIndices.length;

      // Extract contact features for each frame: x_ij = exp(-d_ij)
      const contactFeatures = contactMaps.map(frameContacts => {
        return validContactIndices.map(idx => {
          const distance = frameContacts[idx];
          return Math.exp(-distance);  // exp(-d_ij) transformation
        });
      });

      // Center the data (subtract mean)
      const meanVector = new Array(nFeatures).fill(0);
      for (let i = 0; i < nFrames; i++) {
        for (let j = 0; j < nFeatures; j++) {
          meanVector[j] += contactFeatures[i][j];
        }
      }
      for (let j = 0; j < nFeatures; j++) {
        meanVector[j] /= nFrames;
      }

      // Subtract mean from each frame
      const centeredData = contactFeatures.map(frame =>
        frame.map((val, idx) => val - meanVector[idx])
      );

      // For performance, use a subset of features if too many
      const maxFeatures = Math.min(nFeatures, 500);
      const sampledIndices = [];
      for (let i = 0; i < maxFeatures; i++) {
        sampledIndices.push(Math.floor(i * nFeatures / maxFeatures));
      }

      const sampledData = centeredData.map(frame =>
        sampledIndices.map(idx => frame[idx])
      );

      // Compute first two principal components using power iteration
      const pc1 = computePrincipalComponent(sampledData);
      const pc2 = computePrincipalComponent(sampledData, pc1);

      // Calculate eigenvalues (variance explained) by computing variance of projections
      const pc1Scores = [];
      const pc2Scores = [];

      for (let i = 0; i < nFrames; i++) {
        const frame = sampledData[i];
        const pc1Score = dotProduct(frame, pc1);
        const pc2Score = dotProduct(frame, pc2);

        if (isFinite(pc1Score) && isFinite(pc2Score)) {
          pc1Scores.push(pc1Score);
          pc2Scores.push(pc2Score);
        }
      }

      // Calculate variances (eigenvalues) - CORRECTED CALCULATION
      const pc1Mean = pc1Scores.reduce((sum, val) => sum + val, 0) / pc1Scores.length;
      const pc2Mean = pc2Scores.reduce((sum, val) => sum + val, 0) / pc2Scores.length;

      const pc1Variance = pc1Scores.reduce((sum, val) => sum + (val - pc1Mean) ** 2, 0) / (pc1Scores.length - 1);
      const pc2Variance = pc2Scores.reduce((sum, val) => sum + (val - pc2Mean) ** 2, 0) / (pc2Scores.length - 1);

      // Calculate TOTAL variance from original centered data (not just PC1+PC2)
      let totalSystemVariance = 0;
      const nSampledFeatures = sampledData[0].length;
      for (let j = 0; j < nSampledFeatures; j++) {
        const featureMean = sampledData.reduce((sum, frame) => sum + frame[j], 0) / sampledData.length;
        const featureVariance = sampledData.reduce((sum, frame) => sum + (frame[j] - featureMean) ** 2, 0) / (sampledData.length - 1);
        totalSystemVariance += featureVariance;
      }

      // Now calculate PROPER variance explained percentages
      const pc1VarianceExplained = totalSystemVariance > 0 ? (pc1Variance / totalSystemVariance) * 100 : 0;
      const pc2VarianceExplained = totalSystemVariance > 0 ? (pc2Variance / totalSystemVariance) * 100 : 0;

      // Calculate data quality metrics
      const validFrameCount = pc1Scores.length;
      const dataQualityScore = validFrameCount / nFrames;

      // Project data onto principal components and create visualization data
      const pcaData = [];
      for (let i = 0; i < nFrames; i++) {
        const frame = sampledData[i];
        const pc1Score = dotProduct(frame, pc1);
        const pc2Score = dotProduct(frame, pc2);

        // Skip frames with invalid scores
        if (!isFinite(pc1Score) || !isFinite(pc2Score)) {
          console.warn(`Skipping frame ${i} due to invalid PCA scores: PC1=${pc1Score}, PC2=${pc2Score}`);
          continue;
        }

        // Assign clusters based on quadrants for interpretability
        let cluster = 1;
        if (pc1Score > 0 && pc2Score > 0) cluster = 1;
        else if (pc1Score < 0 && pc2Score > 0) cluster = 2;
        else if (pc1Score < 0 && pc2Score < 0) cluster = 3;
        else cluster = 4;

        pcaData.push({
          frame: i,
          pc1: pc1Score,
          pc2: pc2Score,
          cluster: cluster
        });
      }

      // Create statistical summary object with CORRECTED metrics
      const stats = {
        nFrames: validFrameCount,
        totalFrames: nFrames,
        nFeatures: maxFeatures,
        totalFeatures: nFeatures,
        pc1Variance: pc1Variance,
        pc2Variance: pc2Variance,
        totalSystemVariance: totalSystemVariance,
        pc1VarianceExplained: pc1VarianceExplained,
        pc2VarianceExplained: pc2VarianceExplained,
        cumulativeVarianceExplained: pc1VarianceExplained + pc2VarianceExplained,
        dataCoverage: dataQualityScore, // Renamed from 'dataQuality' to be clearer
        contactPairsUsed: validContactIndices.length,
        totalContactPairs: contactPairs.length
      };

      // Validate we have enough valid data points
      if (pcaData.length < 2) {
        console.warn('Not enough valid PCA data points for visualization');
        return null;
      }

      return { data: pcaData, stats };

    } catch (error) {
      console.error('PCA calculation failed:', error);
      return null;
    }
  }, [analysisData]);

  // Set PCA data from real calculation only
  useEffect(() => {
    if (calculatePCA) {
      try {
        const result = calculatePCA;
        if (result && result.data && result.stats) {
          setPcaData(result.data);
          setPcaStats(result.stats);
        } else {
          setPcaData(null);
          setPcaStats(null);
        }
      } catch (error) {
        console.error('Error setting PCA data:', error);
        setPcaData(null);
        setPcaStats(null);
      }
    }
  }, [calculatePCA, analysisData]);

  // Handle responsive dimensions using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Calculate optimal contact map size with better proportions
        let mapSize;
        const availableWidth = width;
        const availableHeight = height;

        if (availableWidth < 1700) { // Mobile/tablet tabbed view (below 1700px breakpoint)
          // In stacked view, contact map gets generous space
          mapSize = Math.min(availableWidth - 80, availableHeight - 120, 520); // Account for padding and header
          mapSize = Math.max(340, mapSize); // Good minimum
        } else { // Very large desktop 3-column view (1700px and above)
          // In grid layout, contact map gets the middle column (1.5fr out of 5.5fr total)
          const totalFractions = 2 + 1.5 + 2; // Total grid fractions: 2fr + 1.5fr + 2fr
          const contactMapFraction = 1.5 / totalFractions;
          const availableColumnWidth = (availableWidth - 120) * contactMapFraction; // Account for gaps and padding

          mapSize = Math.min(availableColumnWidth * 0.95, availableHeight * 0.7, 550);
          mapSize = Math.max(380, mapSize); // Higher minimum for very large screens
        }

        setContactMapDimensions({
          width: Math.round(mapSize),
          height: Math.round(mapSize)
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeResponsiveTab]);

  // Debounced click handler to prevent rapid-fire clicks
  const [clickDebounceTimeout, setClickDebounceTimeout] = useState(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickDebounceTimeout) {
        clearTimeout(clickDebounceTimeout);
      }
    };
  }, [clickDebounceTimeout]);

  const handleScatterClick = (data, event) => {
    // Clear any existing timeout
    if (clickDebounceTimeout) {
      clearTimeout(clickDebounceTimeout);
    }

    // Set new debounced timeout
    const newTimeout = setTimeout(() => {
      processScatterClick(data);
    }, 100); // 100ms debounce

    setClickDebounceTimeout(newTimeout);
  };

  const processScatterClick = (data) => {
    // Handle both direct point clicks and chart area clicks
    let frameData = null;

    if (data && data.payload) {
      // Direct point click
      frameData = data.payload;
    } else if (data && data.activePayload && data.activePayload[0]) {
      // Chart area click with hover data
      frameData = data.activePayload[0].payload;
    }

    if (frameData) {

      // Validate frame data structure
      if (!frameData || typeof frameData.frame !== 'number') {
        console.warn('Invalid frame data from click:', frameData);
        return;
      }

      const targetFrame = frameData.frame;

      // Double-check this frame exists in our data
      const frameExists = filteredPcaData.find(point => point.frame === targetFrame);
      if (!frameExists) {
        console.warn(`Frame ${targetFrame} not found in filtered PCA data!`);
        return;
      }

      setSelectedFrame(targetFrame);

      // Also jump to frame in Molstar viewer
      if (molstarRef.current && molstarRef.current.jumpToFrame) {
        molstarRef.current.jumpToFrame(targetFrame).then((success) => {
          if (!success) {
            console.warn(`Failed to jump to frame ${targetFrame} in Molstar`);
          }
        });
      }
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      // Validate data structure to prevent React child errors
      if (!data || typeof data !== 'object' ||
        typeof data.frame !== 'number' ||
        typeof data.pc1 !== 'number' ||
        typeof data.pc2 !== 'number' ||
        typeof data.cluster !== 'number') {
        console.warn('Invalid tooltip data:', data);
        return null;
      }

      return (
        <div className={`p-4 rounded-lg shadow-lg border ${isDarkMode
          ? 'bg-gray-800 border-gray-600 text-white'
          : 'bg-white border-gray-300 text-gray-900'
          } max-w-sm`}>
          <div className="space-y-2">
            <p className="font-semibold text-lg">Frame {data.frame + 1}</p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">PC1:</span> {data.pc1.toFixed(3)}
              </div>
              <div>
                <span className="font-medium">PC2:</span> {data.pc2.toFixed(3)}
              </div>
            </div>

            <div className="text-sm">
              <span className="font-medium">Conformational Cluster:</span> {data.cluster}
            </div>

            {pcaStats && (
              <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <strong>PC1 explains {pcaStats.pc1VarianceExplained.toFixed(1)}%</strong> of total system variance
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>PC2 explains {pcaStats.pc2VarianceExplained.toFixed(1)}%</strong> of total system variance
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
              <p className="text-xs text-blue-500 font-medium flex items-center">
                <svg id="icon-lightbulb-tip" className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1} role="img" aria-label="Tip">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Click to select this frame for analysis
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Position represents contact pattern similarity
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!bioEmuFiles?.pdbFile || !bioEmuFiles?.xtcFile || !analysisData) {
    return (
      <div className="p-6 overflow-auto">
        <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
          <div className="text-center">
            <div className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <svg id="icon-bar-chart" className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-label="Bar chart indicating no data available">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No Conformational Data</h4>
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generate a protein ensemble first to explore conformational space using Principal Component Analysis of structural features.</p>
            <button
              onClick={() => setActiveTab('input')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center space-x-2 mx-auto"
            >
              <svg id="icon-plus" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Go to Generate</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} overflow-hidden`}
    >
      <div className="flex flex-col h-full">

        {/* Header with Method Toggle */}
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Conformational Explorer</h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                Principal Component Analysis of structural features derived from Ca-Ca distance matrices
              </p>

              {/* Method Toggle Button */}
              <button
                onClick={() => setShowMethodDetails(!showMethodDetails)}
                className={`text-sm px-3 py-1 rounded-lg border transition-colors ${isDarkMode
                  ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                  }`}
              >
                {showMethodDetails ? '📖 Hide Method Details' : '📖 Show Method Details'}
              </button>
            </div>

            {/* Analysis Stats */}
            <div className={`px-3 py-2 rounded-lg ${isDarkMode ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-300'
              }`}>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  {analysisData?.ensemble_stats?.n_frames || 0} Conformations
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Frame {selectedFrame + 1} selected
                </div>
                {pcaStats && (
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                    {pcaStats.cumulativeVarianceExplained.toFixed(1)}% variance explained
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compact Method Details */}
          {showMethodDetails && (
            <div className={`mt-3 p-3 rounded border text-xs ${isDarkMode ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
              <div className="grid md:grid-cols-3 gap-3">
                {/* Method */}
                <div>
                  <h4 className="font-medium mb-1 text-blue-600 dark:text-blue-400">Contact Analysis</h4>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} leading-tight`}>
                    Ca-Ca distances → <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">exp(-d_ij)</code>.
                    Sequence separation &gt;3 to focus on tertiary structure changes.
                  </p>
                </div>

                {/* PCA */}
                <div>
                  <h4 className="font-medium mb-1 text-green-600 dark:text-green-400">PCA Method</h4>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} leading-tight`}>
                    Mean-centered exp(-d_ij) features decomposed via power iteration.
                    PC1/PC2 = major axes of conformational variation.
                  </p>
                </div>

                {/* Usage */}
                <div>
                  <h4 className="font-medium mb-1 text-purple-600 dark:text-purple-400">Interpretation</h4>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} leading-tight`}>
                    Each point represents a conformation. Proximity indicates structural similarity.
                    Click points to visualize specific frames.
                  </p>
                </div>
              </div>

              {/* Minimal Stats */}
              {pcaStats && (
                <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-4">
                      <span>PC1: <strong>{pcaStats.pc1VarianceExplained.toFixed(1)}%</strong></span>
                      <span>PC2: <strong>{pcaStats.pc2VarianceExplained.toFixed(1)}%</strong></span>
                      <span>Total: <strong>{pcaStats.cumulativeVarianceExplained.toFixed(1)}%</strong></span>
                    </div>
                    <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {pcaStats.nFrames}/{pcaStats.totalFrames} frames
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Flexible Main Content - Smart Responsive Layout */}
        <div className="flex-1 min-h-0 flex flex-col">

          {/* SMALL/MEDIUM SCREENS: Tab Navigation - Show until very large screens */}
          <div className="min-[1700px]:hidden flex-shrink-0">
            <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} mb-2`}>
              <div className="flex space-x-8 px-4">
                {[
                  { id: 'pca', label: 'PCA Analysis', icon: '📊' },
                  { id: 'contact', label: 'Contact Map', icon: '🔥' },
                  { id: 'structure', label: '3D Structure', icon: '🧬' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResponsiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeResponsiveTab === tab.id
                      ? isDarkMode
                        ? 'border-blue-400 text-blue-400'
                        : 'border-blue-500 text-blue-600'
                      : isDarkMode
                        ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Responsive Layout Container */}
          <div className="flex-1 min-h-[600px] overflow-auto p-2 md:p-4
                         grid grid-cols-1 gap-4
                         min-[1700px]:grid-cols-[2fr_1.5fr_2fr] min-[1700px]:gap-6">

            {/* Scatterplot Panel */}
            <div className={`
              min-h-[400px] min-[1700px]:min-h-[500px] flex flex-col
              ${activeResponsiveTab !== 'pca' ? 'hidden min-[1700px]:flex' : 'flex'}
            `}>
              <div className={`h-full rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                }`}>
                <div className="p-2 border-b border-gray-300 dark:border-gray-600">
                  {/* Row 1: Title, Description, and Legend */}
                  <div className="mb-3">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold mb-1">Conformational Space (PCA)</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Click any point to select that frame • The PCA plot shows all structures in their natural positions
                        </p>
                      </div>

                      {/* Legend - moved to top right for better spacing */}
                      <div className="flex items-center space-x-3 text-xs shrink-0">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Regular frames</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Selected frame</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Statistics and Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left side: Statistics Badges */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {pcaStats && (
                        <>
                          <div className={`px-2 py-1 rounded ${pcaStats.cumulativeVarianceExplained > 70
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : pcaStats.cumulativeVarianceExplained > 50
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                            PC1+PC2: {pcaStats.cumulativeVarianceExplained.toFixed(1)}% variance
                          </div>
                          <div className={`px-2 py-1 rounded ${pcaStats.dataCoverage > 0.95
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}>
                            {pcaStats.nFrames}/{pcaStats.totalFrames} frames valid
                          </div>
                          <div className={`px-2 py-1 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400`}>
                            {pcaStats.contactPairsUsed} contact features
                          </div>
                        </>
                      )}
                    </div>

                    {/* Simplified: Timeline Order Only */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        🔄 Timeline Order (Frame #)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4" style={{ height: 'calc(100% - 90px)' }}>
                  {pcaData && Array.isArray(pcaData) && pcaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 30, bottom: 50, left: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                        />
                        <XAxis
                          type="number"
                          dataKey="pc1"
                          name="PC1"
                          tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                          label={{
                            value: pcaStats
                              ? `PC1 - Contact Variation (${pcaStats.pc1VarianceExplained.toFixed(1)}% variance)`
                              : 'Principal Component 1 (Contact Variation)',
                            position: 'insideBottom',
                            offset: -10,
                            style: { textAnchor: 'middle', fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="pc2"
                          name="PC2"
                          tick={{ fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }}
                          label={{
                            value: pcaStats
                              ? `PC2 - Contact Variation (${pcaStats.pc2VarianceExplained.toFixed(1)}% variance)`
                              : 'Principal Component 2 (Contact Variation)',
                            angle: -90,
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fill: isDarkMode ? '#9CA3AF' : '#6b7280', fontSize: 12 }
                          }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Single scatter component with all points, styled based on selection */}
                        <Scatter
                          dataKey="pc2"
                          data={filteredPcaData}
                          onClick={handleScatterClick}
                          shape={(props) => {
                            const { payload } = props;
                            const isSelected = payload && payload.frame === selectedFrame;

                            return (
                              <g style={{ cursor: 'pointer' }}>
                                {/* Larger invisible click area for better UX */}
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={12}
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                />
                                {/* Visible circle */}
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={isSelected ? 6 : 4}
                                  fill={isSelected ? "#FF6B35" : "#3B82F6"}
                                  fillOpacity={isSelected ? 0.9 : 0.7}
                                  stroke={isSelected ? "#FF4500" : "#1D4ED8"}
                                  strokeWidth={isSelected ? 2 : 1}
                                  style={{ cursor: 'pointer', pointerEvents: 'none' }}
                                />
                              </g>
                            );
                          }}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center max-w-md">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className={`font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Computing Principal Component Analysis
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                          Analyzing structural features using exp(-d_ij) transformation and power iteration.
                          This may take a moment for large trajectories...
                        </p>

                        {analysisData?.ensemble_stats?.n_frames && (
                          <div className={`mt-3 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Processing {analysisData.ensemble_stats.n_frames} conformations
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Map Panel */}
            <div className={`
              min-h-[300px] md:min-h-[350px] lg:min-h-[400px] min-[1700px]:min-h-[500px] 
              flex flex-col
              ${activeResponsiveTab !== 'contact' ? 'hidden min-[1700px]:flex' : 'flex'}
            `}>
              <div className={`h-full rounded-lg border flex flex-col ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                }`}>
                <div className="p-2 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                  <h3 className="text-base font-semibold mb-1">Contact Map</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Instantaneous Ca-Ca contact map for Frame {selectedFrame + 1}
                  </p>
                </div>
                <div className="flex-1 min-h-0 p-3 flex items-center justify-center">
                  {analysisData?.ca_distance_matrices_per_frame && analysisData.ca_distance_matrices_per_frame.length > selectedFrame ? (
                    <ContactMapVisualization
                      distanceMatrix={analysisData.ca_distance_matrices_per_frame[selectedFrame]}
                      frameNumber={selectedFrame}
                      isDarkMode={isDarkMode}
                      width={contactMapDimensions.width}
                      height={contactMapDimensions.height}
                    />
                  ) : (
                    <div className={`h-full rounded ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
                      <div className="text-center">
                        <div className="text-4xl mb-4">🗺️</div>
                        <p className={`text-lg font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Contact Map
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Click points on PCA plot to explore different frames
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3D Structure Panel */}
            <div className={`
              min-h-[400px] min-[1700px]:min-h-[500px] min-[1700px]:flex-1 
              flex flex-col
              ${activeResponsiveTab !== 'structure' ? 'hidden min-[1700px]:flex' : 'flex'}
            `}>
              <div className={`h-full rounded-lg border flex flex-col ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                }`}>
                <div className="p-3 border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">3D Structure View</h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                        Frame {selectedFrame + 1} selected from PCA plot {window.innerWidth >= 1536 ? 'on the left' : window.innerWidth >= 1280 ? 'above' : 'from the Analysis tab'}
                      </p>

                      {/* Scientific Interpretation with Current Frame Context */}
                      {pcaStats && pcaData && (
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} space-y-1`}>
                          {(() => {
                            const currentPoint = pcaData.find(p => p.frame === selectedFrame);
                            if (currentPoint) {
                              return (
                                <>
                                  <p>
                                    <strong>Current Frame Analysis:</strong> Frame {selectedFrame + 1} has PC1={currentPoint.pc1.toFixed(2)}, PC2={currentPoint.pc2.toFixed(2)} (Cluster {currentPoint.cluster})
                                  </p>
                                  <p>
                                    <strong>Conformational Context:</strong> {
                                      currentPoint.pc1 > 0
                                        ? 'Above-average contact patterns along PC1'
                                        : 'Below-average contact patterns along PC1'
                                    }, {
                                      currentPoint.pc2 > 0
                                        ? 'above-average along PC2'
                                        : 'below-average along PC2'
                                    }.
                                  </p>
                                  <p>
                                    <strong>Similarity:</strong> Points close to this frame in the PCA plot represent conformations with similar Ca-Ca contact patterns.
                                  </p>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <p>
                                    �💡 <strong>Interpretation:</strong> This frame represents a conformation with specific contact patterns.
                                  </p>
                                  <p>
                                    📊 Similar points in the PCA plot have similar Ca-Ca contact distances and represent related conformational states.
                                  </p>
                                </>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Simple Frame Indicator */}
                    <div className="flex items-center">
                      <div className={`px-3 py-1 rounded-lg ${isDarkMode ? 'bg-blue-900/40 text-blue-200' : 'bg-blue-100 text-blue-700'
                        } text-sm font-medium`}>
                        Frame {selectedFrame + 1}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3D Structure Viewer - Full Height */}
                <div className="flex-1 min-h-0 p-4">
                  {bioEmuFiles?.pdbFile && bioEmuFiles?.xtcFile ? (
                    <div className="h-full w-full">
                      <MolstarViewerFixed
                        ref={molstarRef}
                        pdbFile={bioEmuFiles.pdbFile}
                        xtcFile={bioEmuFiles.xtcFile}
                      />
                    </div>
                  ) : (
                    <div className={`h-full rounded ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
                      <div className="text-center">
                        <div className="text-4xl mb-4">🧬</div>
                        <p className={`text-lg font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          3D Structure Viewer
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {bioEmuFiles?.pdbFile ? 'Loading trajectory data...' : 'No trajectory data available'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConformationalExplorer;
