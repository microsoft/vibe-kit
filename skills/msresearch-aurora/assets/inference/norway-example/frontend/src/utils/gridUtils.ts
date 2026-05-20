import type { ForecastStep, ForecastCell } from "../data/auroraForecast";

type VariableKey = "windSpeed" | "temperature" | "pressure";

/**
 * Convert ForecastStep data to a 2D grid for heatmap rendering
 * Returns [lat, lon] grid matching the spatial extent
 */
export function convertToGrid(
  step: ForecastStep,
  variable: VariableKey
): {
  data: number[][];
  bounds: [[number, number], [number, number]];
} {
  // Normalize longitudes from 0-360 to -180 to 180 range for Leaflet compatibility
  const normalizeLon = (lon: number) => (lon > 180 ? lon - 360 : lon);

  // Find spatial bounds
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLon = Infinity,
    maxLon = -Infinity;

  for (const cell of step.cells) {
    const lon = normalizeLon(cell.longitude);
    minLat = Math.min(minLat, cell.latitude);
    maxLat = Math.max(maxLat, cell.latitude);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  // Determine grid resolution from data
  const lats = Array.from(
    new Set(step.cells.map((c) => Math.round(c.latitude * 100) / 100))
  ).sort((a, b) => b - a); // Descending (north to south)

  const lons = Array.from(
    new Set(
      step.cells.map((c) => Math.round(normalizeLon(c.longitude) * 100) / 100)
    )
  ).sort((a, b) => a - b); // Ascending (west to east)

  // Extract value based on selected variable
  const getValue = (cell: ForecastCell): number => {
    switch (variable) {
      case "windSpeed":
        return cell.windSpeed;
      case "temperature":
        return cell.temperature;
      case "pressure":
        return cell.pressure;
    }
  };

  // Create grid indexed by lat/lon (round to avoid floating point issues)
  const gridMap = new Map<string, number>();
  for (const cell of step.cells) {
    const lat = Math.round(cell.latitude * 100) / 100;
    const lon = Math.round(normalizeLon(cell.longitude) * 100) / 100;
    gridMap.set(`${lat},${lon}`, getValue(cell));
  }

  // Build 2D array [lat, lon]
  const data: number[][] = [];
  for (const lat of lats) {
    const row: number[] = [];
    for (const lon of lons) {
      const value = gridMap.get(`${lat},${lon}`) ?? 0;
      row.push(value);
    }
    data.push(row);
  }

  return {
    data,
    bounds: [
      [minLat, minLon],
      [maxLat, maxLon],
    ],
  };
}
