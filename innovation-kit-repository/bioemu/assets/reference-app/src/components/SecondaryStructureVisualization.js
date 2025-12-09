import React, { useState, useMemo, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, Line } from 'recharts';
import { getBackendUrl } from '../services/BioEmuService';

/**
 * Custom tooltip for secondary structure charts with proper confidence interval labeling
 */
const SecondaryStructureTooltip = ({ active, payload, label, structureType }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const structureKey = structureType === 'helix' ? 'helix' : 'sheet';
    const upperKey = structureType === 'helix' ? 'helixUpper' : 'sheetUpper';
    const lowerKey = structureType === 'helix' ? 'helixLower' : 'sheetLower';

    const mean = data[structureKey];
    const upper = data[upperKey];
    const lower = data[lowerKey];
    const structureLabel = structureType === 'helix' ? 'α-Helix' : 'β-Sheet';

    return (
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #CCCCCC',
        borderRadius: '3px',
        padding: '6px',
        fontSize: '11px',
        fontFamily: 'Arial'
      }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{`Residue ${label}`}</p>
        <p style={{ margin: '2px 0', color: '#000' }}>{`${structureLabel} (mean): ${mean?.toFixed(3) || 'N/A'}`}</p>
        <p style={{ margin: '2px 0', color: '#666' }}>{`${structureLabel} (+1σ): ${upper?.toFixed(3) || 'N/A'}`}</p>
        <p style={{ margin: '2px 0', color: '#666' }}>{`${structureLabel} (-1σ): ${lower?.toFixed(3) || 'N/A'}`}</p>
      </div>
    );
  }
  return null;
};

/**
 * Scientific Secondary Structure Visualization Component
 * 
 * Features:
 * - Multiple chart styles: Area Charts, Line Charts, Publication Ready
 * - Publication-quality vertically stacked subplots (helix/sheet) 
 * - Scientific color scheme and typography (black/gray for Publication style)
 * - Confidence intervals with error bars/shading
 * - Reference structure overlays (AlphaFold/X-ray/PDB)
 * - Interactive reference structure fetching and comparison
 * - Clean, minimal styling suitable for scientific publications
 * - Interactive region highlighting and selection
 * - CSV data export functionality
 * - Sequence alignment handling for overlays
 * 
 * Chart Styles:
 * - Area Charts: Colorful filled area plots (original style)
 * - Line Charts: Clean line versions of area charts
 * - Publication Ready: Compact, clean plots suitable for papers (like BioEmu style)
 */
const SecondaryStructureVisualization = ({
  analysis,
  isDarkMode = false,
  onRegionSelect = null, // Callback for region selection
  highlightedRegion = null, // External region highlighting
  showConfidenceIntervals = true,
  referenceStructures = null // Future: reference structure data
}) => {
  const [showStacked, setShowStacked] = useState(true); // true for stacked, false for combined
  const [confidenceToggle, setConfidenceToggle] = useState(showConfidenceIntervals);
  const [chartStyle, setChartStyle] = useState('area'); // 'area', 'line', 'publication'

  // Reference structure states
  const [showReferenceOverlay, setShowReferenceOverlay] = useState(false);
  const [referenceData, setReferenceData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [referenceType, setReferenceType] = useState('pdb'); // 'pdb', 'alphafold'
  const [referenceId, setReferenceId] = useState('');
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState(null);

  // Fetch reference structure from backend
  const fetchReferenceStructure = useCallback(async () => {
    if (!referenceId.trim()) {
      setReferenceError('Please provide a valid identifier');
      return;
    }

    setIsLoadingReference(true);
    setReferenceError(null);

    try {
      const backendUrl = getBackendUrl();
      const requestBody = {
        source: referenceType,
        sequence: analysis?.sequence
      };

      // Add the appropriate ID field based on reference type
      if (referenceType === 'pdb') {
        requestBody.pdb_id = referenceId.trim();
      } else if (referenceType === 'alphafold') {
        requestBody.uniprot_id = referenceId.trim();
      }

      const response = await fetch(`${backendUrl}/api/analyze-reference-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch reference structure: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Extract the analysis data from the response
      const analysisData = result.analysis || result;
      setReferenceData(analysisData);

      // Ensure overlay is enabled after data is fetched
      setShowReferenceOverlay(true);

      // Fetch comparison data if MD analysis available
      if (analysis?.secondary_structure_stats) {
        const compResponse = await fetch(`${backendUrl}/api/compare-md-reference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            md_analysis: analysis,
            reference_analysis: analysisData
          }),
        });

        if (compResponse.ok) {
          const compResult = await compResponse.json();
          setComparisonData(compResult);
        } else {
          const errorText = await compResponse.text();
          console.error('Comparison failed:', errorText);
        }
      } else {
        console.warn('No MD secondary structure stats available for comparison');
      }

    } catch (error) {
      console.error('Error fetching reference structure:', error);
      setReferenceError(error.message);
      setReferenceData(null);
    } finally {
      setIsLoadingReference(false);
    }
  }, [referenceType, referenceId, analysis]);

  // Clear reference data
  const clearReferenceData = useCallback(() => {
    setReferenceData(null);
    setComparisonData(null);
    setReferenceError(null);
  }, []);
  // Process secondary structure data from backend with reference overlay
  const structureData = useMemo(() => {
    if (!analysis?.secondary_structure_stats) return [];

    const stats = analysis.secondary_structure_stats;
    const helixFraction = stats.helix_fraction || [];
    const sheetFraction = stats.sheet_fraction || [];
    const coilFraction = stats.coil_fraction || [];

    // Variance data for confidence intervals
    const helixVariance = stats.helix_variance || [];
    const sheetVariance = stats.sheet_variance || [];

    return helixFraction.map((helix, idx) => {
      const helixFrac = helix;
      const sheetFrac = sheetFraction[idx] || 0;
      const coilFrac = coilFraction[idx] || 0;

      // Calculate confidence intervals (±1 standard deviation)
      const helixStd = Math.sqrt(helixVariance[idx] || 0);
      const sheetStd = Math.sqrt(sheetVariance[idx] || 0);

      const dataPoint = {
        residue: idx + 1,
        helix: helixFrac,
        sheet: sheetFrac,
        coil: coilFrac,
        helixUpper: Math.min(1.0, helixFrac + helixStd),
        helixLower: Math.max(0.0, helixFrac - helixStd),
        sheetUpper: Math.min(1.0, sheetFrac + sheetStd),
        sheetLower: Math.max(0.0, sheetFrac - sheetStd),
        // Add amino acid info if available
        aminoAcid: analysis.sequence?.[idx] || 'X'
      };

      // Add reference structure data if available and aligned
      if (showReferenceOverlay && referenceData) {
        const refHelix = referenceData.helix_fraction?.[idx] || 0;
        const refSheet = referenceData.sheet_fraction?.[idx] || 0;

        dataPoint.refHelix = refHelix;
        dataPoint.refSheet = refSheet;

        // Add agreement/disagreement metrics if comparison data available
        if (comparisonData?.agreement_metrics) {
          const agreement = comparisonData.agreement_metrics.per_residue_agreement?.[idx] || 0;
          dataPoint.agreement = agreement;
        }
      }

      return dataPoint;
    });
  }, [analysis, showReferenceOverlay, referenceData, comparisonData]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (!analysis?.secondary_structure_stats) return null;

    return {
      meanHelix: (analysis.secondary_structure_stats.mean_helix_content).toFixed(2),
      meanSheet: (analysis.secondary_structure_stats.mean_sheet_content).toFixed(2),
      meanCoil: (analysis.secondary_structure_stats.mean_coil_content).toFixed(2),
      totalFrames: analysis.ensemble_stats?.n_frames || 'N/A'
    };
  }, [analysis]);



  if (!structureData.length) {
    return (
      <div className={`rounded-lg p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Secondary Structure Analysis (DSSP)
        </h3>
        <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Secondary structure data is not available for this trajectory.
        </p>
      </div>
    );
  }

  // Scientific color palette for publication quality - enhanced contrast
  // Enhanced typography configuration for professional charts
  const chartTypography = {
    tick: {
      fontSize: chartStyle === 'publication' ? 14 : 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: chartStyle === 'publication' ? 600 : 500,
      fill: chartStyle === 'publication' ? '#000000' : (isDarkMode ? '#E5E7EB' : '#374151')
    },
    axisLabel: {
      fontSize: chartStyle === 'publication' ? 16 : 14,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: chartStyle === 'publication' ? 700 : 600,
      fill: chartStyle === 'publication' ? '#000000' : (isDarkMode ? '#F3F4F6' : '#1F2937')
    },
    chartTitle: {
      fontSize: chartStyle === 'publication' ? 15 : 13,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: chartStyle === 'publication' ? 700 : 600,
      fill: chartStyle === 'publication' ? '#000000' : (isDarkMode ? '#F9FAFB' : '#111827')
    }
  };

  const plotColors = {
    helix: {
      primary: chartStyle === 'publication' ? '#000000' : '#006400', // Black for publication, dark green for area
      light: chartStyle === 'publication' ? '#808080' : '#C8E6C9',   // Medium gray for publication confidence (50% gray - good middle ground)
      error: chartStyle === 'publication' ? '#606060' : '#004d00'    // Medium-dark gray for publication error bars (40% gray)
    },
    sheet: {
      primary: chartStyle === 'publication' ? '#404040' : '#0052CC', // Dark gray for publication, royal blue for area
      light: chartStyle === 'publication' ? '#909090' : '#BBDEFB',   // Medium-light gray for publication confidence (55% gray - good middle ground)
      error: chartStyle === 'publication' ? '#707070' : '#003d99'    // Medium gray for publication error bars (45% gray)
    },
    coil: {
      primary: chartStyle === 'publication' ? '#404040' : '#AAAAAA', // Darker gray for publication (25% gray)
    },
    reference: {
      helix: chartStyle === 'publication' ? '#000000' : '#D32F2F',   // Red for helix reference (high contrast vs green)
      sheet: chartStyle === 'publication' ? '#404040' : '#FF6F00',   // Orange for sheet reference (high contrast vs blue)
      line: chartStyle === 'publication' ? '#000000' : '#424242'     // Black for publication reference lines
    },
    agreement: {
      high: chartStyle === 'publication' ? '#000000' : '#4CAF50',    // Black for publication
      medium: chartStyle === 'publication' ? '#404040' : '#FF9800',  // Dark gray for publication
      low: chartStyle === 'publication' ? '#606060' : '#F44336'      // Medium gray for publication
    },
    background: chartStyle === 'publication' ? '#FFFFFF' : (isDarkMode ? '#1F2937' : '#FFFFFF'),
    text: chartStyle === 'publication' ? '#000000' : (isDarkMode ? '#F3F4F6' : '#212121'),
    grid: chartStyle === 'publication' ? '#606060' : (isDarkMode ? '#374151' : '#E0E0E0')  // Medium gray for publication grid (40% gray)
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* World-class professional header with progressive disclosure */}
      <div className={`mb-8 rounded-xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600' : 'bg-gradient-to-r from-white to-gray-50 border border-gray-200'}`}>
        {/* Primary header strip */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-600 bg-gray-800/90' : 'border-gray-100 bg-white/90'}`}>
          <div className="flex items-center justify-between">
            {/* Left side: Title and metadata */}
            <div className="flex flex-col space-y-2">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Secondary Structure Analysis
              </h3>
              <div className="flex items-center space-x-4">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="font-medium">DSSP</span> • {summaryStats?.totalFrames} MD frames
                  {confidenceToggle && ' • ±1σ intervals'}
                </div>

                {/* Elegant separated legend */}
                <div className="flex items-center space-x-4 pl-4 border-l border-gray-300 dark:border-gray-600">
                  <div className="flex items-center space-x-2 group cursor-pointer">
                    <div className="relative">
                      <div
                        className="w-5 h-3 rounded-md shadow-sm border border-white/30 group-hover:scale-110 transition-transform duration-200"
                        style={{ backgroundColor: plotColors.helix.primary }}
                      ></div>
                      <div className="absolute inset-0 rounded-md bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </div>
                    <span className={`font-semibold text-sm ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>α-Helix</span>
                  </div>
                  <div className="flex items-center space-x-2 group cursor-pointer">
                    <div className="relative">
                      <div
                        className="w-5 h-3 rounded-md shadow-sm border border-white/30 group-hover:scale-110 transition-transform duration-200"
                        style={{ backgroundColor: plotColors.sheet.primary }}
                      ></div>
                      <div className="absolute inset-0 rounded-md bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </div>
                    <span className={`font-semibold text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>β-Sheet</span>
                  </div>
                  {showReferenceOverlay && referenceData && (
                    <div className="flex items-center space-x-2 group cursor-pointer">
                      <div className="relative w-5 h-3 flex items-center justify-center">
                        <div className="w-full h-0.5 border-b-2 border-dashed border-orange-500 group-hover:border-orange-400 transition-colors duration-200"></div>
                      </div>
                      <span className={`font-semibold text-sm ${isDarkMode ? 'text-orange-300' : 'text-orange-600'}`}>Reference</span>
                    </div>
                  )}
                </div>

                {/* Visual indicators on same line */}
                <div className="flex items-center space-x-3 text-xs pl-4 border-l border-gray-300 dark:border-gray-600">
                  <div className="flex items-center space-x-1.5">
                    <div className={`w-4 h-0.5 rounded-full ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'}`}></div>
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Mean</span>
                  </div>
                  {confidenceToggle && (
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-4 h-px border-t border-dashed ${isDarkMode ? 'border-gray-400' : 'border-gray-500'}`}></div>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>±1σ</span>
                    </div>
                  )}
                  {showReferenceOverlay && referenceData && (
                    <div className="flex items-center space-x-1.5">
                      <div className="w-4 h-px border-t-2 border-dashed border-orange-500"></div>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Ref</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <select
                  value={chartStyle}
                  onChange={(e) => setChartStyle(e.target.value)}
                  className={`px-3 py-1.5 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'}`}
                >
                  <option value="area">Area Charts</option>
                  <option value="publication">Publication Style</option>
                </select>

                {chartStyle === 'area' && (
                  <button
                    onClick={() => setShowStacked(!showStacked)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${showStacked
                      ? `${isDarkMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'}`
                      : `${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow-md'}`
                      }`}
                  >
                    {showStacked ? 'Stacked' : 'Combined'}
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={confidenceToggle}
                    onChange={(e) => setConfidenceToggle(e.target.checked)}
                    className="mr-2.5 w-4 h-4 rounded border-2 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className={`text-sm font-medium group-hover:text-blue-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>±1σ bands</span>
                </label>

                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showReferenceOverlay}
                    onChange={(e) => setShowReferenceOverlay(e.target.checked)}
                    className="mr-2.5 w-4 h-4 rounded border-2 focus:ring-2 focus:ring-orange-500"
                  />
                  <span className={`text-sm font-medium group-hover:text-orange-400 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Reference</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible method panel with progressive disclosure */}
        <details className="group" open>
          <summary className={`cursor-pointer px-6 py-3 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <span className="text-sm font-medium flex items-center space-x-2">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span>Method & Interpretation</span>
            </span>
          </summary>

          <div className={`px-6 pb-4 border-t ${isDarkMode ? 'border-gray-600 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <div className={`space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Method</h4>
                <p className="text-sm leading-relaxed">
                  Secondary structure assignment using DSSP algorithm.
                  Ensemble averages computed over <span className="font-medium">{summaryStats?.totalFrames} MD trajectory frames</span>.
                  {confidenceToggle && ' Error bands represent ±1 standard deviation across the ensemble.'}
                  {showReferenceOverlay && referenceData && ' Reference structure overlaid for comparison.'}
                </p>
              </div>
              <div className={`space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <h4 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Interpretation</h4>
                <p className="text-sm leading-relaxed">
                  Values represent the <span className="font-medium">probability</span> (0-1) of each residue adopting{' '}
                  <span className={`font-medium ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>α-helical</span> or{' '}
                  <span className={`font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>β-sheet</span> structure.
                  Higher values indicate greater structural stability and consistency across the MD simulation.
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Reference structure controls */}
      {showReferenceOverlay && (
        <div className={`mt-4 p-3 border rounded ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
          <div className="flex items-center space-x-3 mb-2">
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
              className={`px-2 py-1 border rounded text-xs ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="pdb">PDB ID</option>
              <option value="alphafold">AlphaFold ID</option>
            </select>

            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder={referenceType === 'pdb' ? 'e.g., 1ABC' : 'e.g., P12345'}
              className={`px-2 py-1 border rounded text-xs flex-1 max-w-24 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />

            <button
              onClick={fetchReferenceStructure}
              disabled={isLoadingReference || !referenceId.trim()}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${isLoadingReference || !referenceId.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {isLoadingReference ? 'Loading...' : 'Fetch'}
            </button>

            {referenceData && (
              <button
                onClick={clearReferenceData}
                className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status messages */}
          {referenceError && (
            <div className="text-xs text-red-600 mb-1">
              Error: {referenceError}
            </div>
          )}

          {referenceData && (
            <div className={`text-xs space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                  <strong>Reference Structure</strong>
                </span>
                <span className="text-gray-500">•</span>
                <span>{referenceData.n_residues} residues</span>
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <span className="flex items-center">
                  <span className="text-green-600 font-medium">α-Helix:</span>
                  <span className="ml-1 font-mono">{(referenceData.mean_helix_content * 100).toFixed(1)}%</span>
                </span>
                <span className="flex items-center">
                  <span className="text-blue-600 font-medium">β-Sheet:</span>
                  <span className="ml-1 font-mono">{(referenceData.mean_sheet_content * 100).toFixed(1)}%</span>
                </span>
                {comparisonData?.agreement_metrics?.overall_agreement !== undefined && !isNaN(comparisonData.agreement_metrics.overall_agreement) && (
                  <span className="flex items-center">
                    <span className="text-purple-600 font-medium">Agreement:</span>
                    <span className="ml-1 font-mono">{(comparisonData.agreement_metrics.overall_agreement * 100).toFixed(1)}%</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main visualization area */}
      {chartStyle === 'publication' ? (
        // Publication style - separate helix and sheet subplots like BioEmu paper
        <div className="space-y-3">
          {/* α-Helix subplot */}
          <div>
            <div className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              style={{ fontFamily: '"Arial", sans-serif' }}>
              α-Helix Content
            </div>
            <div className={`h-${structureData.length <= 50 ? '32' : '48'} bg-white border border-gray-300`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={structureData}
                  margin={{
                    top: structureData.length <= 50 ? 8 : 10,
                    right: structureData.length <= 50 ? 10 : 15,
                    left: structureData.length <= 50 ? 40 : 50,
                    bottom: structureData.length <= 50 ? 25 : 30
                  }}
                >
                  <CartesianGrid strokeDasharray="1 1" stroke="#F0F0F0" strokeWidth={0.5} />

                  <XAxis
                    dataKey="residue"
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    interval={Math.max(1, Math.floor(structureData.length / (structureData.length <= 50 ? 8 : 12)))}
                  />

                  <YAxis
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    domain={[0, 1]}
                    tickFormatter={(value) => value.toFixed(1)}
                    label={{
                      value: 'helix',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <Tooltip
                    content={<SecondaryStructureTooltip structureType="helix" />}
                  />

                  {/* Confidence intervals */}
                  {confidenceToggle && (
                    <Area
                      dataKey="helixUpper"
                      stroke="none"
                      fill={plotColors.helix.light}
                      fillOpacity={chartStyle === 'publication' ? 0.4 : 0.2}
                    />
                  )}

                  {/* Main helix line */}
                  <Line
                    dataKey="helix"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Confidence interval lower bound */}
                  {confidenceToggle && (
                    <Line
                      dataKey="helixLower"
                      stroke="#000000"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                    />
                  )}

                  {/* Reference structure overlay */}
                  {showReferenceOverlay && referenceData && (
                    <Line
                      dataKey="refHelix"
                      stroke={plotColors.reference.helix}
                      strokeWidth={2.5}
                      strokeDasharray="5,2"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* β-Sheet subplot */}
          <div>
            <div className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              style={{ fontFamily: '"Arial", sans-serif' }}>
              β-Sheet Content
            </div>
            <div className={`h-${structureData.length <= 50 ? '32' : '48'} bg-white border border-gray-300`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={structureData}
                  margin={{
                    top: structureData.length <= 50 ? 8 : 10,
                    right: structureData.length <= 50 ? 10 : 15,
                    left: structureData.length <= 50 ? 40 : 50,
                    bottom: structureData.length <= 50 ? 30 : 40
                  }}
                >
                  <CartesianGrid strokeDasharray="1 1" stroke="#F0F0F0" strokeWidth={0.5} />

                  <XAxis
                    dataKey="residue"
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    interval={Math.max(1, Math.floor(structureData.length / (structureData.length <= 50 ? 8 : 12)))}
                    label={{
                      value: 'residue number',
                      position: 'insideBottom',
                      offset: structureData.length <= 50 ? -8 : -10,
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <YAxis
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    domain={[0, 1]}
                    tickFormatter={(value) => value.toFixed(1)}
                    label={{
                      value: 'sheet',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <Tooltip
                    content={<SecondaryStructureTooltip structureType="sheet" />}
                  />

                  {/* Confidence intervals */}
                  {confidenceToggle && (
                    <Area
                      dataKey="sheetUpper"
                      stroke="none"
                      fill={plotColors.sheet.light}
                      fillOpacity={chartStyle === 'publication' ? 0.4 : 0.2}
                    />
                  )}

                  {/* Main sheet line */}
                  <Line
                    dataKey="sheet"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Confidence interval lower bound */}
                  {confidenceToggle && (
                    <Line
                      dataKey="sheetLower"
                      stroke="#000000"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls={false}
                    />
                  )}

                  {/* Reference structure overlay */}
                  {showReferenceOverlay && referenceData && (
                    <Line
                      dataKey="refSheet"
                      stroke={plotColors.reference.sheet}
                      strokeWidth={2}
                      strokeDasharray="8,3"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : showStacked ? (
        // Stacked scientific subplots
        <div className="space-y-4">
          {/* Helix subplot */}
          <div>
            <div
              className={`text-base font-bold mb-3 ${chartStyle === 'publication' ? 'text-black' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}
              style={{
                fontFamily: chartTypography.chartTitle.fontFamily,
                fontSize: chartTypography.chartTitle.fontSize,
                fontWeight: chartTypography.chartTitle.fontWeight,
                color: chartTypography.chartTitle.fill
              }}
            >
              α-Helix Content
            </div>
            <div className={`h-48 ${chartStyle === 'publication' ? 'border-2 border-gray-800 bg-white' : 'border border-gray-300'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={structureData}
                  margin={{ top: 15, right: 25, left: 50, bottom: 40 }}
                >
                  <CartesianGrid
                    strokeDasharray="1 1"
                    stroke={plotColors.grid}
                    strokeWidth={chartStyle === 'publication' ? 0.8 : 0.5}
                  />

                  <XAxis
                    dataKey="residue"
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    interval={Math.max(1, Math.floor(structureData.length / 15))}
                    label={{
                      value: 'residue number',
                      position: 'insideBottom',
                      offset: -5,
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <YAxis
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    domain={[0, 1]}
                    tickFormatter={(value) => value.toFixed(1)}
                    label={{
                      value: 'helix',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <Tooltip
                    content={<SecondaryStructureTooltip structureType="helix" />}
                  />

                  {/* Confidence interval band - render before main data */}
                  {confidenceToggle && (
                    <Area
                      dataKey="helixUpper"
                      stroke={plotColors.helix.error}
                      strokeWidth={2}
                      fill={plotColors.helix.light}
                      fillOpacity={0.4}
                      strokeDasharray="4 4"
                    />
                  )}

                  {confidenceToggle && (
                    <Area
                      dataKey="helixLower"
                      stroke={plotColors.helix.error}
                      strokeWidth={2}
                      fill="none"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Main helix area */}
                  <Area
                    dataKey="helix"
                    fill={plotColors.helix.primary}
                    stroke={plotColors.helix.primary}
                    strokeWidth={2}
                    fillOpacity={0.4}
                  />

                  {/* Reference structure overlay */}
                  {showReferenceOverlay && referenceData && (
                    <Line
                      dataKey="refHelix"
                      stroke={plotColors.reference.helix}
                      strokeWidth={2}
                      strokeDasharray="8,3"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sheet subplot */}
          <div>
            <div
              className={`text-base font-bold mb-3 ${chartStyle === 'publication' ? 'text-black' : (isDarkMode ? 'text-white' : 'text-gray-900')}`}
              style={{
                fontFamily: chartTypography.chartTitle.fontFamily,
                fontSize: chartTypography.chartTitle.fontSize,
                fontWeight: chartTypography.chartTitle.fontWeight,
                color: chartTypography.chartTitle.fill
              }}
            >
              β-Sheet Content
            </div>
            <div className={`h-48 ${chartStyle === 'publication' ? 'border-2 border-gray-800 bg-white' : 'border border-gray-300'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={structureData}
                  margin={{ top: 15, right: 25, left: 50, bottom: 40 }}
                >
                  <CartesianGrid
                    strokeDasharray="1 1"
                    stroke={plotColors.grid}
                    strokeWidth={chartStyle === 'publication' ? 0.8 : 0.5}
                  />

                  <XAxis
                    dataKey="residue"
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    interval={Math.max(1, Math.floor(structureData.length / 15))}
                    label={{
                      value: 'residue number',
                      position: 'insideBottom',
                      offset: -5,
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <YAxis
                    tick={{
                      fill: chartTypography.tick.fill,
                      fontSize: chartTypography.tick.fontSize,
                      fontFamily: chartTypography.tick.fontFamily,
                      fontWeight: chartTypography.tick.fontWeight
                    }}
                    tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                    domain={[0, 1]}
                    tickFormatter={(value) => value.toFixed(1)}
                    label={{
                      value: 'sheet',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: chartTypography.axisLabel.fontSize,
                        fontFamily: chartTypography.axisLabel.fontFamily,
                        fill: chartTypography.axisLabel.fill,
                        fontWeight: chartTypography.axisLabel.fontWeight
                      }
                    }}
                  />

                  <Tooltip
                    content={<SecondaryStructureTooltip structureType="sheet" />}
                  />

                  {/* Confidence interval band - render before main data */}
                  {confidenceToggle && (
                    <Area
                      dataKey="sheetUpper"
                      stroke={plotColors.sheet.error}
                      strokeWidth={2}
                      fill={plotColors.sheet.light}
                      fillOpacity={0.4}
                      strokeDasharray="4 4"
                    />
                  )}

                  {confidenceToggle && (
                    <Area
                      dataKey="sheetLower"
                      stroke={plotColors.sheet.error}
                      strokeWidth={2}
                      fill="none"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Main sheet area */}
                  <Area
                    dataKey="sheet"
                    fill={plotColors.sheet.primary}
                    stroke={plotColors.sheet.primary}
                    strokeWidth={2}
                    fillOpacity={0.4}
                  />

                  {/* Reference structure overlay */}
                  {showReferenceOverlay && referenceData && (
                    <Line
                      dataKey="refSheet"
                      stroke={plotColors.reference.sheet}
                      strokeWidth={2}
                      strokeDasharray="8,3"
                      dot={false}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        // Area Charts - Enhanced for better readability
        <div className={`h-80 ${chartStyle === 'publication'
          ? 'border-2 border-black bg-white'
          : 'border border-gray-300'
          }`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={structureData}
              margin={chartStyle === 'publication'
                ? { top: 25, right: 30, left: 50, bottom: 50 }
                : { top: 20, right: 20, left: 40, bottom: 40 }
              }
            >
              <CartesianGrid
                strokeDasharray="1 1"
                stroke={plotColors.grid}
                strokeWidth={chartStyle === 'publication' ? 0.8 : 0.5}
              />

              <XAxis
                dataKey="residue"
                tick={{
                  fill: chartTypography.tick.fill,
                  fontSize: chartTypography.tick.fontSize,
                  fontFamily: chartTypography.tick.fontFamily,
                  fontWeight: chartTypography.tick.fontWeight
                }}
                tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                interval={Math.max(1, Math.floor(structureData.length / 20))}
                label={{
                  value: 'residue number',
                  position: 'insideBottom',
                  offset: -5,
                  style: {
                    textAnchor: 'middle',
                    fontSize: chartTypography.axisLabel.fontSize,
                    fontFamily: chartTypography.axisLabel.fontFamily,
                    fill: chartTypography.axisLabel.fill,
                    fontWeight: chartTypography.axisLabel.fontWeight
                  }
                }}
              />

              <YAxis
                tick={{
                  fill: chartTypography.tick.fill,
                  fontSize: chartTypography.tick.fontSize,
                  fontFamily: chartTypography.tick.fontFamily,
                  fontWeight: chartTypography.tick.fontWeight
                }}
                tickLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                axisLine={{ stroke: chartTypography.tick.fill, strokeWidth: 0.8 }}
                domain={[0, 1]}
                tickFormatter={(value) => value.toFixed(1)}
                label={{
                  value: 'probability',
                  angle: -90,
                  position: 'insideLeft',
                  style: {
                    textAnchor: 'middle',
                    fontSize: chartTypography.axisLabel.fontSize,
                    fontFamily: chartTypography.axisLabel.fontFamily,
                    fill: chartTypography.axisLabel.fill,
                    fontWeight: chartTypography.axisLabel.fontWeight
                  }
                }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: plotColors.background,
                  border: `1px solid ${plotColors.grid}`,
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontFamily: 'Arial'
                }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-2" style={{
                        backgroundColor: plotColors.background,
                        border: `1px solid ${plotColors.grid}`,
                        borderRadius: '2px',
                        fontSize: '11px',
                        fontFamily: 'Arial'
                      }}>
                        <p className="font-medium">{`Residue ${label}${data.aminoAcid ? ` (${data.aminoAcid})` : ''}`}</p>
                        <p style={{ color: plotColors.helix.primary }}>{`α-Helix: ${data.helix.toFixed(3)}`}</p>
                        <p style={{ color: plotColors.sheet.primary }}>{`β-Sheet: ${data.sheet.toFixed(3)}`}</p>
                        <p style={{ color: plotColors.coil.primary }}>{`Coil/Loop: ${data.coil.toFixed(3)}`}</p>
                        {showReferenceOverlay && referenceData && data.refHelix !== undefined && (
                          <>
                            <hr style={{ margin: '4px 0', borderColor: plotColors.grid }} />
                            <p style={{ color: plotColors.reference.helix }}>{`Ref α-Helix: ${data.refHelix.toFixed(3)}`}</p>
                            <p style={{ color: plotColors.reference.sheet }}>{`Ref β-Sheet: ${data.refSheet.toFixed(3)}`}</p>
                            {data.agreement !== undefined && (
                              <p style={{ fontSize: '10px', color: plotColors.text }}>{`Agreement: ${(data.agreement * 100).toFixed(1)}%`}</p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Combined confidence intervals with better styling */}
              {confidenceToggle && (
                <>
                  <Area
                    dataKey="helixUpper"
                    fill={plotColors.helix.light}
                    stroke={plotColors.helix.error}
                    strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                    strokeDasharray="4 4"
                    fillOpacity={chartStyle === 'publication' ? 0.4 : 0.3}
                  />
                  <Area
                    dataKey="helixLower"
                    fill="none"
                    stroke={plotColors.helix.error}
                    strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                    strokeDasharray="4 4"
                  />
                  <Area
                    dataKey="sheetUpper"
                    fill={plotColors.sheet.light}
                    stroke={plotColors.sheet.error}
                    strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                    strokeDasharray="4 4"
                    fillOpacity={chartStyle === 'publication' ? 0.4 : 0.3}
                  />
                  <Area
                    dataKey="sheetLower"
                    fill="none"
                    stroke={plotColors.sheet.error}
                    strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                    strokeDasharray="4 4"
                  />
                </>
              )}

              {/* Main structure areas with enhanced visibility */}
              <Area
                dataKey="helix"
                fill={plotColors.helix.primary}
                stroke={plotColors.helix.primary}
                strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                fillOpacity={chartStyle === 'publication' ? 0.5 : 0.4}
                name="helix"
              />
              <Area
                dataKey="sheet"
                fill={plotColors.sheet.primary}
                stroke={plotColors.sheet.primary}
                strokeWidth={chartStyle === 'publication' ? 2.5 : 2}
                fillOpacity={chartStyle === 'publication' ? 0.5 : 0.4}
                name="sheet"
              />

              {/* Reference structure overlays */}
              {showReferenceOverlay && referenceData && (
                <>
                  <Line
                    dataKey="refHelix"
                    stroke={plotColors.reference.helix}
                    strokeWidth={chartStyle === 'publication' ? 7 : 6}
                    dot={false}
                    connectNulls={false}
                    name="refHelix"
                  />
                  <Line
                    dataKey="refSheet"
                    stroke={plotColors.reference.sheet}
                    strokeWidth={chartStyle === 'publication' ? 7 : 6}
                    dot={false}
                    connectNulls={false}
                    name="refSheet"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default SecondaryStructureVisualization;
