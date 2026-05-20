import { useEffect, useState, useMemo } from "react";
import Plot from "react-plotly.js";
import {
  fetchTrainingDatasets,
  fetchSurfaceVariables,
  fetchLossCurves,
  fetchPersistenceBaseline,
  fetchAvailableEpochs,
  fetchValidationSampleCount,
  fetchPredictionHeatmap,
  fetchPersistenceHeatmap,
  fetchGroundTruthHeatmap,
  fetchLandSeaMask,
} from "./api";
import type {
  DatasetOption,
  VariableOption,
  LossCurvesResponse,
  EpochOption,
  HeatmapData,
  StaticHeatmapData,
} from "./api";
import {
  AppHeader,
  InfoModal,
  Panel,
  Spinner,
  Tooltip,
  GuidedTour,
} from "./components";
import { useTour } from "./useTour";

/* ── Theme Colors (for Plotly, which can't read CSS vars) ── */
const C = {
  text: "#dceeff",
  muted: "#7a9cc6",
  grid: "#1c3348",
  accent: "#4ca6ff",
  val: "#ff6b8a",
  baseline: "#7a9cc6",
} as const;

const darkAxis = {
  gridcolor: C.grid,
  zerolinecolor: C.grid,
  tickfont: { color: C.muted },
};

const darkLayoutBase: Partial<Plotly.Layout> = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "rgba(13,26,39,0.5)",
  font: { color: C.text, family: "DM Sans, sans-serif" },
};

const darkTitle = (text: string) => ({
  text,
  font: { size: 14 as const, color: C.text },
});

const heatmapLayoutBase = {
  ...darkLayoutBase,
  xaxis: { ...darkAxis, title: { text: "Longitude" } },
  yaxis: { ...darkAxis, title: { text: "Latitude" } },
  margin: { t: 40, r: 20, b: 40, l: 50 },
  autosize: true,
};

/* ── Shared Styles ─────────────────────────────────────── */
const selectClassName =
  "w-full px-3 py-2 border border-border rounded-md bg-surface-alt text-text focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

/* ── Small Reusable Components ─────────────────────────── */
function ErrorAlert({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div className={`bg-error/10 border border-error/30 text-error px-4 py-3 rounded-md ${className}`}>
      {message}
    </div>
  );
}

function HeatmapPanel({
  title,
  data,
  loading,
  loadingLabel,
  sharedMin,
  sharedMax,
}: {
  title: string;
  data: HeatmapData | null;
  loading: boolean;
  loadingLabel: string;
  sharedMin: number;
  sharedMax: number;
}) {
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10 rounded-lg">
          <Spinner label={loadingLabel} />
        </div>
      )}
      {data ? (
        <Plot
          data={[
            {
              type: "heatmap",
              z: data.data,
              x: data.lon,
              y: data.lat,
              colorscale: "Viridis",
              zmin: sharedMin,
              zmax: sharedMax,
              colorbar: {
                title: { text: data.variable },
                tickfont: { color: C.muted },
              },
              hovertemplate:
                "Lat: %{y:.2f}<br>Lon: %{x:.2f}<br>Value: %{z:.4f}<extra></extra>",
            },
          ]}
          layout={{
            ...heatmapLayoutBase,
            title: darkTitle(title),
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "300px" }}
        />
      ) : (
        <div className="h-[300px] flex items-center justify-center text-text-muted border border-border rounded-lg">
          No data
        </div>
      )}
    </div>
  );
}

/* ── Main App ──────────────────────────────────────────── */
function App() {
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [variables, setVariables] = useState<VariableOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [selectedVariable, setSelectedVariable] = useState<string>("");
  const [lossCurves, setLossCurves] = useState<LossCurvesResponse | null>(null);
  const [persistenceBaseline, setPersistenceBaseline] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Heatmap visualization state
  const [epochs, setEpochs] = useState<EpochOption[]>([]);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [selectedEpochs, setSelectedEpochs] = useState<number>(8);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [predictionHeatmap, setPredictionHeatmap] =
    useState<HeatmapData | null>(null);
  const [persistenceHeatmap, setPersistenceHeatmap] =
    useState<HeatmapData | null>(null);
  const [groundTruthHeatmap, setGroundTruthHeatmap] =
    useState<HeatmapData | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [persistenceLoading, setPersistenceLoading] = useState(false);
  const [groundTruthLoading, setGroundTruthLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);
  const [landSeaMask, setLandSeaMask] = useState<StaticHeatmapData | null>(
    null
  );

  // UI state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const tour = useTour();

  // Fetch dropdown options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [datasetsData, variablesData] = await Promise.all([
          fetchTrainingDatasets(),
          fetchSurfaceVariables(),
        ]);
        setDatasets(datasetsData);
        setVariables(variablesData);

        if (datasetsData.length > 0) {
          setSelectedDataset(datasetsData[datasetsData.length - 1].value);
        }
        if (variablesData.length > 0) {
          setSelectedVariable(variablesData[0].value);
        }
      } catch {
        setError("Failed to load options. Is the backend running?");
      }
    }
    loadOptions();
  }, []);

  // Fetch loss curves when selection changes
  useEffect(() => {
    if (!selectedDataset || !selectedVariable) return;

    async function loadCurves() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLossCurves(selectedDataset, selectedVariable);
        setLossCurves(data);
      } catch {
        setError("Failed to load loss curves");
      } finally {
        setLoading(false);
      }
    }
    loadCurves();
  }, [selectedDataset, selectedVariable]);

  // Fetch persistence baseline when variable changes
  useEffect(() => {
    if (!selectedVariable) return;

    async function loadBaseline() {
      try {
        const data = await fetchPersistenceBaseline(selectedVariable);
        setPersistenceBaseline(data.mean_mae);
      } catch {
        setPersistenceBaseline(null);
      }
    }
    loadBaseline();
  }, [selectedVariable]);

  // Fetch heatmap options and land-sea mask on mount
  useEffect(() => {
    async function loadHeatmapOptions() {
      try {
        const [epochsData, sampleCountData, lsmData] = await Promise.all([
          fetchAvailableEpochs(),
          fetchValidationSampleCount(),
          fetchLandSeaMask(),
        ]);
        setEpochs(epochsData);
        setSampleCount(sampleCountData.count);
        setLandSeaMask(lsmData);
      } catch {
        setHeatmapError("Failed to load heatmap options");
      }
    }
    loadHeatmapOptions();
  }, []);

  // Fetch prediction heatmap when dataset, variable, epochs, or sample changes
  useEffect(() => {
    if (!selectedDataset || !selectedVariable || sampleCount === 0) return;

    async function loadPrediction() {
      setPredictionLoading(true);
      setHeatmapError(null);
      try {
        const prediction = await fetchPredictionHeatmap(
          selectedDataset,
          selectedVariable,
          selectedEpochs,
          selectedSampleIndex
        );
        setPredictionHeatmap(prediction);
      } catch {
        setHeatmapError("Failed to load prediction heatmap");
      } finally {
        setPredictionLoading(false);
      }
    }
    loadPrediction();
  }, [
    selectedDataset,
    selectedVariable,
    selectedEpochs,
    selectedSampleIndex,
    sampleCount,
  ]);

  // Fetch persistence heatmap only when variable or sample changes (not epochs)
  useEffect(() => {
    if (!selectedVariable || sampleCount === 0) return;

    async function loadPersistence() {
      setPersistenceLoading(true);
      try {
        const persistence = await fetchPersistenceHeatmap(
          selectedVariable,
          selectedSampleIndex
        );
        setPersistenceHeatmap(persistence);
      } catch {
        setHeatmapError("Failed to load persistence heatmap");
      } finally {
        setPersistenceLoading(false);
      }
    }
    loadPersistence();
  }, [selectedVariable, selectedSampleIndex, sampleCount]);

  // Fetch ground truth heatmap only when variable or sample changes (not epochs)
  useEffect(() => {
    if (!selectedVariable || sampleCount === 0) return;

    async function loadGroundTruth() {
      setGroundTruthLoading(true);
      try {
        const groundTruth = await fetchGroundTruthHeatmap(
          selectedVariable,
          selectedSampleIndex
        );
        setGroundTruthHeatmap(groundTruth);
      } catch {
        setHeatmapError("Failed to load ground truth heatmap");
      } finally {
        setGroundTruthLoading(false);
      }
    }
    loadGroundTruth();
  }, [selectedVariable, selectedSampleIndex, sampleCount]);

  // Derived data — memoized to avoid recomputing on every render
  const numEpochs = useMemo(
    () => lossCurves?.points.map((p) => p.num_epochs_trained) || [],
    [lossCurves]
  );
  const trainMae = useMemo(
    () => lossCurves?.points.map((p) => p.train_mae) || [],
    [lossCurves]
  );
  const valMae = useMemo(
    () => lossCurves?.points.map((p) => p.val_mae) || [],
    [lossCurves]
  );

  // Shared heatmap color scale
  const { sharedMin, sharedMax } = useMemo(() => {
    const allHeatmaps = [
      predictionHeatmap,
      persistenceHeatmap,
      groundTruthHeatmap,
    ].filter(Boolean) as HeatmapData[];
    return {
      sharedMin:
        allHeatmaps.length > 0
          ? Math.min(...allHeatmaps.map((h) => h.min_value))
          : 0,
      sharedMax:
        allHeatmaps.length > 0
          ? Math.max(...allHeatmaps.map((h) => h.max_value))
          : 1,
    };
  }, [predictionHeatmap, persistenceHeatmap, groundTruthHeatmap]);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        onInfoClick={() => setShowInfoModal(true)}
        onTourClick={() => tour.start()}
      />

      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}

      <GuidedTour
        active={tour.active}
        step={tour.step}
        steps={tour.steps}
        onNext={tour.next}
        onPrev={tour.prev}
        onDismiss={tour.dismiss}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Panel 1: Input Configuration */}
        <Panel
          title="Input Configuration"
          subtitle="Configure inputs for loss curves and prediction visualizations."
          data-tour="input-config"
        >
          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="dataset"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                Training Data Size
                <Tooltip
                  id="dataset-tooltip"
                  label="Information about training data size"
                >
                  Date range of ERA5 weather data used for finetuning the Aurora
                  model.
                </Tooltip>
              </label>
              <select
                id="dataset"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className={selectClassName}
              >
                {datasets.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label
                htmlFor="variable"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                Surface Variable
                <Tooltip
                  id="variable-tooltip"
                  label="Information about surface variable"
                >
                  The weather variable being predicted by the model.
                </Tooltip>
              </label>
              <select
                id="variable"
                value={selectedVariable}
                onChange={(e) => setSelectedVariable(e.target.value)}
                className={selectClassName}
              >
                {variables.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <ErrorAlert message={error} className="mt-4" />}
        </Panel>

        {/* Panel 2: Training & Validation Performance */}
        <Panel
          title="Training & Validation Performance"
          subtitle="Mean Absolute Error (MAE) over the course of 8 training epochs."
          data-tour="loss-curves"
        >
          {loading ? (
            <Spinner label="Loading loss curves..." />
          ) : lossCurves ? (
            <>
              {(() => {
                const allValues = [
                  ...trainMae,
                  ...valMae,
                  ...(persistenceBaseline !== null
                    ? [persistenceBaseline]
                    : []),
                ];
                const yMax = Math.max(...allValues) * 1.1;
                const sharedYAxis = {
                  ...darkAxis,
                  title: { text: "Mean Absolute Error (MAE)" },
                  range: [0, yMax],
                };
                const lossXAxis = {
                  ...darkAxis,
                  title: { text: "Num Epochs Trained" },
                  tickmode: "array" as const,
                  tickvals: numEpochs,
                  dtick: 1,
                };
                const lossLegend = {
                  x: 1,
                  xanchor: "right" as const,
                  y: 1,
                  font: { color: C.muted },
                };
                const lossMargin = { t: 40, r: 20, b: 60, l: 60 };

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <Plot
                      data={[
                        {
                          x: numEpochs,
                          y: trainMae,
                          type: "scatter",
                          mode: "lines+markers",
                          name: "Train MAE",
                          line: { color: C.accent, width: 2 },
                          marker: { size: 8 },
                        },
                      ]}
                      layout={{
                        ...darkLayoutBase,
                        title: darkTitle("Training Loss"),
                        xaxis: lossXAxis,
                        yaxis: sharedYAxis,
                        legend: lossLegend,
                        margin: lossMargin,
                        autosize: true,
                      }}
                      config={{ responsive: true }}
                      style={{ width: "100%", height: "400px" }}
                    />

                    <Plot
                      data={[
                        {
                          x: numEpochs,
                          y: valMae,
                          type: "scatter",
                          mode: "lines+markers",
                          name: "Validation MAE",
                          line: { color: C.val, width: 2 },
                          marker: { size: 8 },
                        },
                        ...(persistenceBaseline !== null
                          ? [
                              {
                                x: [
                                  numEpochs[0],
                                  numEpochs[numEpochs.length - 1],
                                ],
                                y: [persistenceBaseline, persistenceBaseline],
                                type: "scatter" as const,
                                mode: "lines" as const,
                                name: "Persistence Baseline",
                                line: {
                                  color: C.baseline,
                                  width: 2,
                                  dash: "dash" as const,
                                },
                              },
                            ]
                          : []),
                      ]}
                      layout={{
                        ...darkLayoutBase,
                        title: darkTitle("Validation Loss"),
                        xaxis: lossXAxis,
                        yaxis: sharedYAxis,
                        legend: lossLegend,
                        margin: lossMargin,
                        autosize: true,
                      }}
                      config={{ responsive: true }}
                      style={{ width: "100%", height: "400px" }}
                    />
                  </div>
                );
              })()}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-train/10 border border-train/20 p-3 rounded-lg">
                  <span className="font-medium text-train">
                    Final Train MAE:
                  </span>{" "}
                  <span className="text-text font-mono">
                    {trainMae[trainMae.length - 1]?.toFixed(4)}
                  </span>
                  <Tooltip
                    id="train-mae-tooltip"
                    label="Information about training loss"
                  >
                    Mean absolute error of the finetuned model's prediction,
                    computed over the selected training dataset.
                  </Tooltip>
                </div>
                <div className="flex gap-4">
                  <div className="bg-val/10 border border-val/20 p-3 rounded-lg flex-1">
                    <span className="font-medium text-val">
                      Final Validation MAE:
                    </span>{" "}
                    <span className="text-text font-mono">
                      {valMae[valMae.length - 1]?.toFixed(4)}
                    </span>
                    <Tooltip
                      id="val-mae-tooltip"
                      label="Information about validation loss"
                    >
                      Mean absolute error of the finetuned model's prediction,
                      computed over a fixed validation dataset (Jan 1-7, 2024)
                      that does not overlap with training data.
                    </Tooltip>
                  </div>
                  <div className="bg-surface-alt border border-border p-3 rounded-lg flex-1">
                    <span className="font-medium text-baseline">
                      Persistence Baseline:
                    </span>{" "}
                    <span className="text-text font-mono">
                      {persistenceBaseline?.toFixed(4) ?? "N/A"}
                    </span>
                    <Tooltip
                      id="persistence-baseline-tooltip"
                      label="Information about persistence baseline"
                    >
                      Persistence baseline model persists current timestep as
                      prediction for next time step.
                    </Tooltip>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-96 flex items-center justify-center text-text-muted">
              Select options to view loss curves
            </div>
          )}
        </Panel>

        {/* Panel 3: Prediction Visualization */}
        <Panel
          title="Prediction Visualization"
          subtitle="Compare model predictions against persistence baseline and ground truth."
          data-tour="heatmaps"
        >
          {/* Heatmap Controls */}
          <div className="flex gap-4 mb-6" data-tour="heatmap-controls">
            <div className="flex-1">
              <label
                htmlFor="epochs"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                Epochs Trained
                <Tooltip
                  id="epochs-tooltip"
                  label="Information about epochs trained"
                >
                  Selects the model checkpoint within the finetuning run (0 =
                  pretrained, 8 = fully finetuned).
                </Tooltip>
              </label>
              <select
                id="epochs"
                value={selectedEpochs}
                onChange={(e) => setSelectedEpochs(Number(e.target.value))}
                className={selectClassName}
              >
                {epochs.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label
                htmlFor="sampleIndex"
                className="block text-sm font-medium text-text-muted mb-1"
              >
                Sample Index:{" "}
                <span className="text-accent font-mono">
                  {selectedSampleIndex}
                </span>
                <Tooltip
                  id="sample-tooltip"
                  label="Information about sample index"
                >
                  Selects which 6-hour timestep within the validation dataset
                  (Jan 1-7, 2024) to predict.
                </Tooltip>
              </label>
              <input
                id="sampleIndex"
                type="range"
                min={0}
                max={sampleCount > 0 ? sampleCount - 1 : 0}
                value={selectedSampleIndex}
                onChange={(e) =>
                  setSelectedSampleIndex(Number(e.target.value))
                }
                className="w-full mt-2"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>0</span>
                <span>{sampleCount > 0 ? sampleCount - 1 : 0}</span>
              </div>
            </div>
          </div>

          {heatmapError && <ErrorAlert message={heatmapError} className="mb-4" />}

          {/* Sub-panel: Geographic Context */}
          {landSeaMask && (
            <div className="bg-surface-alt/50 border border-border rounded-lg p-4 mb-6">
              <h3 className="text-base font-medium text-text font-serif mb-1">
                Geographic Context
              </h3>
              <p className="text-sm text-text-muted mb-3">
                Land-sea mask showing the validation region (Greece, Jan 1-7
                2024)
              </p>
              <Plot
                data={[
                  {
                    type: "heatmap",
                    z: landSeaMask.data,
                    x: landSeaMask.lon,
                    y: landSeaMask.lat,
                    colorscale: [
                      [0, "#1e40af"],
                      [1, "#16a34a"],
                    ],
                    zmin: 0,
                    zmax: 1,
                    showscale: true,
                    colorbar: {
                      title: { text: "lsm" },
                      tickvals: [0, 1],
                      ticktext: ["Sea", "Land"],
                      tickfont: { color: C.muted },
                    },
                    hovertemplate:
                      "Lat: %{y:.2f}<br>Lon: %{x:.2f}<br>%{z:.0f} (0=Sea, 1=Land)<extra></extra>",
                  },
                ]}
                layout={{
                  ...heatmapLayoutBase,
                  title: darkTitle("Land-Sea Mask"),
                }}
                config={{ responsive: true }}
                style={{ width: "33%", height: "300px" }}
              />
            </div>
          )}

          {/* Sub-panel: Model Predictions */}
          <div className="bg-surface-alt/50 border border-border rounded-lg p-4">
            <h3 className="text-base font-medium text-text font-serif mb-1">
              Model Predictions
            </h3>
            <p className="text-sm text-text-muted mb-3">
              Compare finetuned model output against persistence baseline and
              ground truth
            </p>

            <div className="grid grid-cols-3 gap-4">
              <HeatmapPanel
                title="Finetuned Prediction"
                data={predictionHeatmap}
                loading={predictionLoading}
                loadingLabel="Running inference..."
                sharedMin={sharedMin}
                sharedMax={sharedMax}
              />
              <HeatmapPanel
                title="Persistence Baseline"
                data={persistenceHeatmap}
                loading={persistenceLoading}
                loadingLabel="Loading..."
                sharedMin={sharedMin}
                sharedMax={sharedMax}
              />
              <HeatmapPanel
                title="Ground Truth"
                data={groundTruthHeatmap}
                loading={groundTruthLoading}
                loadingLabel="Loading..."
                sharedMin={sharedMin}
                sharedMax={sharedMax}
              />
            </div>

            {groundTruthHeatmap && (
              <div className="mt-4 text-sm text-text-muted text-center">
                Timestamp: {groundTruthHeatmap.timestamp}
              </div>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}

export default App;
