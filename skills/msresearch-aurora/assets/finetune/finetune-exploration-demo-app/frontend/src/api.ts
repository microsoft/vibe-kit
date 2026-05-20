import { API_URL } from "./config";

const API_BASE = API_URL;

export interface DatasetOption {
  value: string;
  label: string;
}

export interface VariableOption {
  value: string;
  label: string;
}

export interface LossCurvePoint {
  num_epochs_trained: number;
  train_mae: number;
  val_mae: number;
}

export interface LossCurvesResponse {
  dataset: string;
  dataset_label: string;
  variable: string;
  variable_label: string;
  points: LossCurvePoint[];
}

export async function fetchTrainingDatasets(): Promise<DatasetOption[]> {
  const response = await fetch(`${API_BASE}/api/training-datasets`);
  if (!response.ok) {
    throw new Error("Failed to fetch training datasets");
  }
  return response.json();
}

export async function fetchSurfaceVariables(): Promise<VariableOption[]> {
  const response = await fetch(`${API_BASE}/api/surface-variables`);
  if (!response.ok) {
    throw new Error("Failed to fetch surface variables");
  }
  return response.json();
}

export async function fetchLossCurves(
  dataset: string,
  variable: string
): Promise<LossCurvesResponse> {
  const params = new URLSearchParams({ dataset, variable });
  const response = await fetch(`${API_BASE}/api/loss-curves?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch loss curves");
  }
  return response.json();
}

export interface PersistenceBaselineResponse {
  variable: string;
  mean_mae: number;
}

export async function fetchPersistenceBaseline(
  variable: string
): Promise<PersistenceBaselineResponse> {
  const params = new URLSearchParams({ variable });
  const response = await fetch(`${API_BASE}/api/persistence-baseline?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch persistence baseline");
  }
  return response.json();
}

// ============================================================================
// Heatmap Visualization API
// ============================================================================

export interface EpochOption {
  value: number;
  label: string;
}

export interface SampleCountResponse {
  count: number;
}

export interface HeatmapData {
  data: number[][];
  lat: number[];
  lon: number[];
  timestamp: string;
  variable: string;
  variable_label: string;
  min_value: number;
  max_value: number;
}

export interface StaticHeatmapData {
  data: number[][];
  lat: number[];
  lon: number[];
  variable: string;
  min_value: number;
  max_value: number;
}

export async function fetchAvailableEpochs(): Promise<EpochOption[]> {
  const response = await fetch(`${API_BASE}/api/available-epochs`);
  if (!response.ok) {
    throw new Error("Failed to fetch available epochs");
  }
  return response.json();
}

export async function fetchValidationSampleCount(): Promise<SampleCountResponse> {
  const response = await fetch(`${API_BASE}/api/validation-sample-count`);
  if (!response.ok) {
    throw new Error("Failed to fetch validation sample count");
  }
  return response.json();
}

export async function fetchPredictionHeatmap(
  dataset: string,
  variable: string,
  numEpochs: number,
  sampleIndex: number
): Promise<HeatmapData> {
  const params = new URLSearchParams({
    dataset,
    variable,
    num_epochs: numEpochs.toString(),
    sample_index: sampleIndex.toString(),
  });
  const response = await fetch(`${API_BASE}/api/heatmap/prediction?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch prediction heatmap");
  }
  return response.json();
}

export async function fetchPersistenceHeatmap(
  variable: string,
  sampleIndex: number
): Promise<HeatmapData> {
  const params = new URLSearchParams({
    variable,
    sample_index: sampleIndex.toString(),
  });
  const response = await fetch(`${API_BASE}/api/heatmap/persistence?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch persistence heatmap");
  }
  return response.json();
}

export async function fetchGroundTruthHeatmap(
  variable: string,
  sampleIndex: number
): Promise<HeatmapData> {
  const params = new URLSearchParams({
    variable,
    sample_index: sampleIndex.toString(),
  });
  const response = await fetch(`${API_BASE}/api/heatmap/ground-truth?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch ground truth heatmap");
  }
  return response.json();
}

export async function fetchLandSeaMask(): Promise<StaticHeatmapData> {
  const response = await fetch(`${API_BASE}/api/heatmap/land-sea-mask`);
  if (!response.ok) {
    throw new Error("Failed to fetch land-sea mask");
  }
  return response.json();
}
