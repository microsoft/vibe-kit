import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/**
 * Contact Map Visualization Component
 * 
 * Displays a ResearchGate-style contact map showing Cα-Cα distances as a symmetric heatmap matrix.
 * Can show either ensemble-averaged distances or frame-specific distances.
 * 
 * Based on: https://www.researchgate.net/figure/Residue-contact-maps-of-D40-on-membrane-surfaces-Protein-residue-contact-maps-of-the_fig5_297756164
 */
const ContactMapVisualization = ({ distanceMatrix, frameNumber, isDarkMode, width = 400, height = 400 }) => {
  const svgRef = useRef();
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const throttleRef = useRef(null);

  useEffect(() => {
    // Cleanup function for throttle timeout
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!distanceMatrix || !Array.isArray(distanceMatrix) || distanceMatrix.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Increased margins for better axis label spacing
    const margin = { top: 60, right: 60, bottom: 80, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const n = distanceMatrix.length; // Number of residues
    const cellSize = Math.min(innerWidth / n, innerHeight / n);

    // Ensure minimum cell size for large proteins and adjust stroke width accordingly
    const minCellSize = 1.5; // Minimum 1.5px per cell
    const effectiveCellSize = Math.max(cellSize, minCellSize);
    const strokeWidth = cellSize >= 3 ? 0.5 : 0.25; // Thinner strokes for very large proteins

    // Create main group
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Color scale for ensemble-averaged Cα-Cα distances (nanometers)
    // MDTraj outputs distances in nm: ~0.38 nm (adjacent) to ~2.0+ nm (distant)
    const allDistances = distanceMatrix.flat();
    const minDist = Math.min(...allDistances);
    const maxDist = Math.max(...allDistances);

    // High-contrast color scale for better visibility in large protein contact maps
    const colorScale = d3.scaleLinear()
      .domain([minDist, (minDist + maxDist) / 2, maxDist])
      .range(["#DC2626", "#FBBF24", "#3B82F6"]) // Red (close) -> Yellow (medium) -> Blue (far)
      .clamp(true);

    // Alternative softer scale (comment out above and uncomment below if too harsh):
    /*
    const colorScale = d3.scaleSequential()
      .domain([minDist, maxDist])
      .interpolator(d3.interpolateRdYlBu)
      .clamp(true);
    */

    // Create heatmap cells
    const rows = g.selectAll(".row")
      .data(distanceMatrix)
      .enter()
      .append("g")
      .attr("class", "row")
      .attr("transform", (d, i) => `translate(0, ${i * effectiveCellSize})`);

    const cells = rows.selectAll(".cell")
      .data((d, i) => d.map((value, j) => ({ value, i, j })))
      .enter()
      .append("rect")
      .attr("class", (d) => `cell row-${d.i} col-${d.j}`)
      .attr("x", (d) => d.j * effectiveCellSize)
      .attr("width", effectiveCellSize)
      .attr("height", effectiveCellSize)
      .style("fill", (d) => colorScale(d.value))
      .style("stroke", isDarkMode ? "#4B5563" : "#D1D5DB")
      .style("stroke-width", strokeWidth)
      .style("opacity", 1)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        // Only do expensive highlighting for smaller proteins (≤100 residues)
        // For larger proteins, skip highlighting to maintain performance
        if (n <= 100) {
          // Dim all cells for highlighting effect
          cells.style("opacity", 0.4);

          // Highlight current row and column with full opacity
          cells.filter(function (cellData) {
            return cellData.i === d.i || cellData.j === d.j;
          })
            .style("opacity", 1);
        }

        // Calculate tooltip position with null checks
        if (!svgRef.current) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const containerRect = svgRef.current.getBoundingClientRect();

        setTooltip({
          visible: true,
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top,
          content: `Residues ${d.i + 1}–${d.j + 1}: ${d.value.toFixed(2)} nm`
        });
      })
      .on("mousemove", function (event, d) {
        // Throttle tooltip position updates for better performance
        if (throttleRef.current) clearTimeout(throttleRef.current);

        throttleRef.current = setTimeout(() => {
          // Add null checks to prevent errors
          if (!svgRef.current) return;

          const rect = event.currentTarget?.getBoundingClientRect();
          const containerRect = svgRef.current.getBoundingClientRect();

          if (rect && containerRect) {
            setTooltip(prevTooltip => ({
              ...prevTooltip,
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top
            }));
          }
        }, 16); // ~60fps throttling
      })
      .on("mouseout", function () {
        // Only reset highlighting for smaller proteins to maintain performance
        if (n <= 100) {
          cells.style("opacity", 1);
        }

        // Hide tooltip (always fast)
        setTooltip(prevTooltip => ({ ...prevTooltip, visible: false }));
      });

    // Add axis labels with smart, adaptive formatting
    let tickValues = [];

    if (n <= 10) {
      // Small proteins: show every residue
      tickValues = d3.range(0, n);
    } else if (n <= 30) {
      // Medium proteins: show every 5th residue plus endpoints
      tickValues = [0];
      for (let i = 5; i < n; i += 5) {
        tickValues.push(i);
      }
      if (tickValues[tickValues.length - 1] !== n - 1) {
        tickValues.push(n - 1);
      }
    } else if (n <= 100) {
      // Medium-large proteins: show every 20th residue plus strategic points
      const step = 20;
      tickValues = [0];
      for (let i = step; i < n; i += step) {
        tickValues.push(i);
      }
      if (tickValues[tickValues.length - 1] !== n - 1) {
        tickValues.push(n - 1);
      }
    } else {
      // Large proteins: show nice round numbers with good spacing
      const targetTicks = 6; // Aim for 6 ticks including endpoints
      const rawStep = n / (targetTicks - 1);

      // Round to nice intervals (25, 50, 100, etc.)
      let niceStep;
      if (rawStep <= 25) niceStep = 25;
      else if (rawStep <= 50) niceStep = 50;
      else if (rawStep <= 100) niceStep = 100;
      else niceStep = Math.ceil(rawStep / 50) * 50;

      tickValues = [0]; // Always start with 1 (displayed as 0+1)
      for (let i = niceStep; i < n - 1; i += niceStep) {
        if (i < n) tickValues.push(i);
      }
      tickValues.push(n - 1); // Always end with last residue
    }

    // Add axis lines for professional appearance
    g.append("line")
      .attr("x1", 0)
      .attr("x2", n * effectiveCellSize)
      .attr("y1", n * effectiveCellSize)
      .attr("y2", n * effectiveCellSize)
      .style("stroke", isDarkMode ? "#6B7280" : "#9CA3AF")
      .style("stroke-width", 1);

    g.append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", n * effectiveCellSize)
      .style("stroke", isDarkMode ? "#6B7280" : "#9CA3AF")
      .style("stroke-width", 1);

    // X-axis tick marks
    g.append("g")
      .attr("class", "x-ticks")
      .selectAll("line")
      .data(tickValues)
      .enter()
      .append("line")
      .attr("x1", (d) => (d + 0.5) * effectiveCellSize)
      .attr("x2", (d) => (d + 0.5) * effectiveCellSize)
      .attr("y1", n * effectiveCellSize)
      .attr("y2", n * effectiveCellSize + 5)
      .style("stroke", isDarkMode ? "#6B7280" : "#9CA3AF")
      .style("stroke-width", 1);

    // Y-axis tick marks
    g.append("g")
      .attr("class", "y-ticks")
      .selectAll("line")
      .data(tickValues)
      .enter()
      .append("line")
      .attr("x1", -5)
      .attr("x2", 0)
      .attr("y1", (d) => (d + 0.5) * effectiveCellSize)
      .attr("y2", (d) => (d + 0.5) * effectiveCellSize)
      .style("stroke", isDarkMode ? "#6B7280" : "#9CA3AF")
      .style("stroke-width", 1);

    // X-axis labels (bottom) with better spacing and formatting
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${n * effectiveCellSize + 20})`)
      .selectAll("text")
      .data(tickValues)
      .enter()
      .append("text")
      .attr("x", (d) => (d + 0.5) * effectiveCellSize)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("fill", isDarkMode ? "#F3F4F6" : "#374151")
      .style("user-select", "none")
      .text((d) => d + 1);

    // Y-axis labels (left) with better spacing and formatting
    g.append("g")
      .attr("class", "y-axis")
      .attr("transform", "translate(-20, 0)")
      .selectAll("text")
      .data(tickValues)
      .enter()
      .append("text")
      .attr("x", 0)
      .attr("y", (d) => (d + 0.5) * effectiveCellSize + 4)
      .attr("text-anchor", "end")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("fill", isDarkMode ? "#F3F4F6" : "#374151")
      .style("user-select", "none")
      .text((d) => d + 1);

    // Add professional axis titles with better spacing
    g.append("text")
      .attr("x", (n * effectiveCellSize) / 2)
      .attr("y", n * effectiveCellSize + 55)
      .attr("text-anchor", "middle")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", isDarkMode ? "#E5E7EB" : "#1F2937")
      .style("user-select", "none")
      .text("Residue Index");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(n * effectiveCellSize) / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-family", "Inter, system-ui, sans-serif")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", isDarkMode ? "#E5E7EB" : "#374151")
      .style("user-select", "none")
      .text("Residue Index");

  }, [distanceMatrix, isDarkMode, width, height]);

  if (!distanceMatrix || !Array.isArray(distanceMatrix) || distanceMatrix.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No Contact Map Data</div>
          <div className="text-sm">Distance matrix not available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg ref={svgRef}></svg>

      {/* Performance notice for large proteins */}
      {distanceMatrix.length > 100 && (
        <div className={`absolute top-2 right-2 px-3 py-1 rounded-lg text-xs ${isDarkMode
            ? 'bg-gray-800/90 text-gray-300 border border-gray-600'
            : 'bg-white/90 text-gray-600 border border-gray-300'
          } backdrop-blur-sm`}>
          Large protein: Hover highlighting disabled for performance
        </div>
      )}

      {/* Compact color scale legend */}
      <div className="mt-3 px-1">
        <div className={`text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Cα-Cα Distance Scale (nm)
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} min-w-[32px]`}>
            Close
          </span>
          <div
            className="h-3 flex-1 rounded border"
            style={{
              background: 'linear-gradient(to right, #DC2626, #EF4444, #F59E0B, #FBBF24, #60A5FA, #3B82F6)'
            }}
          ></div>
          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} min-w-[24px]`}>
            Far
          </span>
        </div>
        <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} leading-tight`}>
          Red: Close contacts (≤0.8 nm) • Yellow: Intermediate • Blue: Distant pairs (≥2.0 nm)
        </div>
      </div>

      {/* Tooltip with better positioning and styling */}
      {tooltip.visible && (
        <div
          className={`absolute z-50 px-4 py-3 rounded-xl shadow-2xl pointer-events-none border-2 ${isDarkMode
              ? 'bg-gray-800 text-white border-gray-600 shadow-black/50'
              : 'bg-white text-gray-900 border-gray-200 shadow-gray-400/50'
            }`}
          style={{
            left: Math.min(tooltip.x + 20, width - 180), // Better spacing from cursor
            top: Math.max(tooltip.y - 50, 10), // Position above cursor
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'Inter, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            maxWidth: '220px',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.1s ease-out'
          }}
        >
          <div className="flex flex-col">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wide`}>
              Contact Distance
            </span>
            <span className="mt-1">
              {tooltip.content}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMapVisualization;
