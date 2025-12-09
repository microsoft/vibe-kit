import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

/**
 * RMSD Visualization Component
 * Displays RMSD time series and distribution plots for BioEmu vs chosen reference structure
 */
const RMSDVisualization = ({ rmsdData, referenceInfo, isDarkMode = false }) => {
  if (!rmsdData || !rmsdData.rmsd_time_series) {
    return (
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>No RMSD data available</p>
      </div>
    );
  }

  // Get reference information
  const referenceType = referenceInfo?.referenceType || 'alphafold';
  const referenceLabel = referenceInfo?.referenceLabel || 'AlphaFold';
  const isCustomPdb = referenceType === 'custom_pdb';

  // Prepare time series data
  const timeSeriesData = rmsdData.rmsd_time_series.map((rmsd, index) => ({
    frame: index + 1,
    rmsd: parseFloat(rmsd.toFixed(3))
  }));

  // Prepare histogram data (bin RMSD values)
  const createHistogramData = (values, bins = 20) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;
    
    const histogram = new Array(bins).fill(0).map((_, i) => ({
      range: `${(min + i * binWidth).toFixed(2)}-${(min + (i + 1) * binWidth).toFixed(2)}`,
      count: 0,
      midpoint: min + (i + 0.5) * binWidth
    }));

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex].count++;
    });

    return histogram;
  };

  // Prepare histogram data
  const histogramData = createHistogramData(rmsdData.rmsd_time_series);

  // Color scheme based on reference type
  const colors = {
    primary: isCustomPdb 
      ? isDarkMode ? '#EC4899' : '#DB2777'  // Pink for Custom PDB
      : isDarkMode ? '#A78BFA' : '#7C3AED', // Purple for AlphaFold
    grid: isDarkMode ? '#374151' : '#E5E7EB',
    text: isDarkMode ? '#F3F4F6' : '#374151',
    background: isDarkMode ? '#1F2937' : '#FFFFFF'
  };

  return (
    <div className="space-y-6">
      {/* Unified Horizontal Layout: 2x2 Stats + Details + Guide */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* 2x2 Summary Statistics */}
        <div className="xl:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {/* Top Row: Avg | Frames */}
            <div className={`${isCustomPdb ? (isDarkMode ? 'bg-pink-900' : 'bg-pink-50') : (isDarkMode ? 'bg-purple-900' : 'bg-purple-50')} p-3 rounded-lg text-center`}>
              <div className={`text-base font-semibold ${isCustomPdb ? (isDarkMode ? 'text-pink-300' : 'text-pink-600') : (isDarkMode ? 'text-purple-300' : 'text-purple-600')}`}>
                {rmsdData.avg_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className={`text-xs ${isCustomPdb ? (isDarkMode ? 'text-pink-300' : 'text-pink-600') : (isDarkMode ? 'text-purple-300' : 'text-purple-600')}`}>
                Avg (Å)
              </div>
            </div>
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-lg text-center`}>
              <div className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {rmsdData.n_frames_superposed}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Frames</div>
            </div>
            {/* Bottom Row: Min | Max */}
            <div className={`${isDarkMode ? 'bg-green-900' : 'bg-green-50'} p-3 rounded-lg text-center`}>
              <div className={`text-base font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                {rmsdData.min_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>Min (Å)</div>
            </div>
            <div className={`${isDarkMode ? 'bg-red-900' : 'bg-red-50'} p-3 rounded-lg text-center`}>
              <div className={`text-base font-semibold ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                {rmsdData.max_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>Max (Å)</div>
            </div>
          </div>
        </div>

        {/* Comparison Details */}
        <div className={`xl:col-span-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg h-fit`}>
          <div className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-3 text-sm`}>
            Comparison Details
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
            <div><strong>Method:</strong> {rmsdData.superposition_atoms} atoms</div>
            <div><strong>Reference:</strong> {referenceLabel}</div>
            <div><strong>Type:</strong> {isCustomPdb ? 'PDB experimental' : 'AlphaFold AI'}</div>
            <div><strong>Quality:</strong> {rmsdData.avg_rmsd_to_alphafold < 2.0 ? 'Excellent' : rmsdData.avg_rmsd_to_alphafold < 4.0 ? 'Good' : 'Moderate'} agreement</div>
          </div>
        </div>

        {/* Statistical Summary */}
        <div className={`xl:col-span-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg h-fit`}>
          <div className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'} mb-3 text-sm`}>
            Statistical Summary
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
            <div><strong>Frames:</strong> {rmsdData.n_frames_superposed} analyzed</div>
            <div><strong>Range:</strong> {rmsdData.min_rmsd_to_alphafold.toFixed(3)} - {rmsdData.max_rmsd_to_alphafold.toFixed(3)} Å</div>
            <div><strong>Comparison:</strong> BioEmu vs {referenceLabel}</div>
            <div><strong>Status:</strong> {isCustomPdb ? 'Custom PDB' : 'AlphaFold'} reference</div>
          </div>
        </div>

        {/* RMSD Analysis Guide */}
        <div className={`xl:col-span-1 ${isCustomPdb ? (isDarkMode ? 'bg-pink-900/50 border-pink-700' : 'bg-pink-50 border-pink-200') : (isDarkMode ? 'bg-purple-900/50 border-purple-700' : 'bg-purple-50 border-purple-200')} p-4 rounded-lg border h-fit`}>
          <div className={`font-semibold ${isCustomPdb ? (isDarkMode ? 'text-pink-200' : 'text-pink-800') : (isDarkMode ? 'text-purple-200' : 'text-purple-800')} mb-3 text-sm`}>
            RMSD Guide
          </div>
          <div className={`text-xs ${isCustomPdb ? (isDarkMode ? 'text-pink-300' : 'text-pink-700') : (isDarkMode ? 'text-purple-300' : 'text-purple-700')} space-y-1`}>
            <div><strong>0-1Å:</strong> Nearly identical</div>
            <div><strong>1-2Å:</strong> Very similar</div>
            <div><strong>2-4Å:</strong> Moderate differences</div>
            <div><strong>4+Å:</strong> Significant differences</div>
          </div>
        </div>
      </div>

      {/* Side-by-side RMSD Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RMSD Time Series Plot */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-lg shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            BioEmu vs {referenceLabel} RMSD vs Frame Number
          </h3>
          
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 15, left: 15, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="frame" 
                  stroke={colors.text}
                  label={{ value: 'Frame Number', position: 'insideBottom', offset: -15 }}
                />
                <YAxis 
                  stroke={colors.text}
                  label={{ value: 'RMSD (Å)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px'
                  }}
                  formatter={(value) => [`${value} Å`, `BioEmu vs ${referenceLabel}`]}
                  labelFormatter={(label) => `Frame ${label}`}
                />
                <Line 
                  type="linear" 
                  dataKey="rmsd" 
                  stroke={colors.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: colors.primary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RMSD Distribution Histogram */}
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-lg shadow-sm border`}>
          <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            BioEmu vs {referenceLabel} RMSD Distribution
          </h3>
          
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="range" 
                  stroke={colors.text}
                  angle={-30}
                  textAnchor="end"
                  height={20}
                  interval={2}
                  tick={{ fontSize: 9 }}
                />
                <YAxis 
                  stroke={colors.text}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px'
                  }}
                  formatter={(value) => [value, 'Frames']}
                  labelFormatter={(label) => `RMSD: ${label} Å`}
                />
                <Bar dataKey="count" fill={colors.primary}>
                  {histogramData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Manual X-axis label */}
          <div className={`text-center mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            RMSD Range (Å)
          </div>
        </div>

      </div> {/* End of grid container */}
    </div>
  );
};

export default RMSDVisualization;
