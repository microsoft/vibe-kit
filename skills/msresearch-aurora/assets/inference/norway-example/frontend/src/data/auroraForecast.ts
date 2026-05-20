// Type definitions for Aurora forecast data.
// Observation data is loaded at runtime from /data/auroraForecast.json

export type ForecastCell = {
  id: string;
  latitude: number;
  longitude: number;
  windSpeed: number;
  windDirection: number;
  temperature: number;
  pressure: number;
};

export type ForecastStep = {
  timestamp: string;
  summary: string;
  cells: ForecastCell[];
};

export type Forecast = {
  generatedAt: string;
  region: { name: string; center: [number, number] };
  variableRanges: {
    windSpeed: [number, number];
    temperature: [number, number];
    pressure: [number, number];
  };
  steps: ForecastStep[];
};
