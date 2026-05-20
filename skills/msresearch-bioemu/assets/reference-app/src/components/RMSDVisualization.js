import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

/**
 * RMSD Visualization Component
 * Displays RMSD time series and distribution plots for BioEmu vs chosen reference structure
 */
const RMSDVisualization = ({ rmsdData, referenceInfo, isDarkMode = false }) => {
  if (!rmsdData || !rmsdData.rmsd_time_series) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <p className="text-body">No RMSD data available</p>
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
      range: `${(min + i * binWidth).toFixed(2)}–${(min + (i + 1) * binWidth).toFixed(2)}`,
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

  // Color scheme — AlphaFold = purple, PDB = pink (matches structure pills)
  const colors = {
    primary: isCustomPdb ? '#ec4899' : '#a855f7',      // pink-500 / purple-500
    primaryLight: isCustomPdb ? '#f9a8d4' : '#c4b5fd',  // pink-300 / purple-300
    grid: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    axis: isDarkMode ? '#9ca3af' : '#6b7280',           // gray-400 / gray-500
    tickText: isDarkMode ? '#d1d5db' : '#4b5563',       // gray-300 / gray-600
    background: isDarkMode ? '#1b1b1f' : '#ffffff',
    tooltipBorder: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    tooltipText: isDarkMode ? '#f3f4f6' : '#1f2937',
  };

  // Shared axis tick style
  const tickStyle = { fontSize: 11, fill: colors.tickText, fontFamily: 'inherit' };
  const axisLabelStyle = { fontSize: 12, fill: colors.axis, fontWeight: 500, fontFamily: 'inherit' };

  return (
    <div className="space-y-6">
      {/* Summary Stats + Details — horizontal layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        
        {/* 2x2 Key Metrics */}
        <div className="xl:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: colors.primary }}>
                {rmsdData.avg_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className="text-caption">Avg (Å)</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>
                {rmsdData.n_frames_superposed}
              </div>
              <div className="text-caption">Frames</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: colors.primaryLight }}>
                {rmsdData.min_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className="text-caption">Min (Å)</div>
            </div>
            <div className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div className="text-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-materials)' }}>
                {rmsdData.max_rmsd_to_alphafold.toFixed(3)}
              </div>
              <div className="text-caption">Max (Å)</div>
            </div>
          </div>
        </div>

        {/* Comparison Details */}
        <div className="card xl:col-span-1" style={{ padding: 16 }}>
          <div className="text-heading" style={{ fontSize: 13, marginBottom: 10 }}>Comparison Details</div>
          <div className="text-body" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>Method:</strong> {rmsdData.superposition_atoms} atoms</div>
            <div><strong>Reference:</strong> {referenceLabel}</div>
            <div><strong>Type:</strong> {isCustomPdb ? 'PDB experimental' : 'AlphaFold AI'}</div>
            <div><strong>Quality:</strong> {rmsdData.avg_rmsd_to_alphafold < 2.0 ? 'Excellent' : rmsdData.avg_rmsd_to_alphafold < 4.0 ? 'Good' : 'Moderate'} agreement</div>
          </div>
        </div>

        {/* Statistical Summary */}
        <div className="card xl:col-span-1" style={{ padding: 16 }}>
          <div className="text-heading" style={{ fontSize: 13, marginBottom: 10 }}>Statistical Summary</div>
          <div className="text-body" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>Frames:</strong> {rmsdData.n_frames_superposed} analyzed</div>
            <div><strong>Range:</strong> {rmsdData.min_rmsd_to_alphafold.toFixed(3)} – {rmsdData.max_rmsd_to_alphafold.toFixed(3)} Å</div>
            <div><strong>Comparison:</strong> BioEmu vs {referenceLabel}</div>
            <div><strong>Status:</strong> {isCustomPdb ? 'Custom PDB' : 'AlphaFold'} reference</div>
          </div>
        </div>

        {/* RMSD Guide */}
        <div className="card xl:col-span-1" style={{ padding: 16 }}>
          <div className="text-heading" style={{ fontSize: 13, marginBottom: 10 }}>RMSD Guide</div>
          <div className="text-body" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>0–1 Å:</strong> Nearly identical</div>
            <div><strong>1–2 Å:</strong> Very similar</div>
            <div><strong>2–4 Å:</strong> Moderate differences</div>
            <div><strong>4+ Å:</strong> Significant differences</div>
          </div>
        </div>
      </div>

      {/* Side-by-side RMSD Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RMSD Time Series Plot */}
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <h3 className="text-heading" style={{ fontSize: 14, marginBottom: 16 }}>
            RMSD per Frame
          </h3>
          
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 8, right: 20, left: 8, bottom: 44 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="frame" 
                  stroke={colors.axis}
                  tick={tickStyle}
                  tickLine={{ stroke: colors.axis }}
                  label={{ value: 'Frame Number', position: 'insideBottom', offset: -8, style: axisLabelStyle }}
                />
                <YAxis 
                  stroke={colors.axis}
                  tick={tickStyle}
                  tickLine={{ stroke: colors.axis }}
                  width={52}
                  label={{ value: 'RMSD (Å)', angle: -90, position: 'insideLeft', offset: 4, style: axisLabelStyle }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '8px',
                    fontSize: 12,
                    color: colors.tooltipText,
                    padding: '8px 12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  formatter={(value) => [`${value} Å`, `vs ${referenceLabel}`]}
                  labelFormatter={(label) => `Frame ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="rmsd" 
                  stroke={colors.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: colors.primary, stroke: colors.background, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RMSD Distribution Histogram */}
        <div className="card" style={{ padding: '20px 20px 16px' }}>
          <h3 className="text-heading" style={{ fontSize: 14, marginBottom: 16 }}>
            RMSD Distribution
          </h3>
          
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 8, right: 20, left: 8, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                <XAxis 
                  dataKey="range" 
                  stroke={colors.axis}
                  angle={-40}
                  textAnchor="end"
                  height={60}
                  interval={1}
                  tick={{ fontSize: 9, fill: colors.tickText, fontFamily: 'inherit' }}
                  tickLine={{ stroke: colors.axis }}
                  label={{ value: 'RMSD Range (Å)', position: 'insideBottom', offset: -4, style: axisLabelStyle }}
                />
                <YAxis 
                  stroke={colors.axis}
                  tick={tickStyle}
                  tickLine={{ stroke: colors.axis }}
                  width={44}
                  allowDecimals={false}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 8, style: axisLabelStyle }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '8px',
                    fontSize: 12,
                    color: colors.tooltipText,
                    padding: '8px 12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  formatter={(value) => [value, 'Frames']}
                  labelFormatter={(label) => `RMSD: ${label} Å`}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {histogramData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors.primary} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div> {/* End of grid container */}
    </div>
  );
};

export default RMSDVisualization;
