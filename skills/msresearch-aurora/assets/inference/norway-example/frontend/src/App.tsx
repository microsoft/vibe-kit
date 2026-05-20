import { useEffect, useMemo, useState } from "react";
import {
  Body1,
  Caption1 as CaptionNote,
  Card,
  CardHeader,
  Dropdown,
  Label,
  Option,
  Slider,
  Title3,
  Badge,
  Switch,
  makeStyles,
  shorthands,
  tokens,
  type DropdownOnSelectData,
  type SwitchOnChangeData,
  type SliderOnChangeData,
} from "@fluentui/react-components";
import { MapContainer, TileLayer } from "react-leaflet";
import {
  type Forecast,
  type ForecastCell,
  type ForecastStep,
} from "./data/auroraForecast";
import { HeatmapOverlay } from "./components/HeatmapOverlay";
import { convertToGrid } from "./utils/gridUtils";
import {
  ColormapName,
  getColormapColor,
  thermalDefaultStops,
} from "./utils/colormaps";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  header: {
    ...shorthands.padding(
      tokens.spacingVerticalXXL,
      tokens.spacingHorizontalXXXL
    ),
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerContent: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  title: {
    marginBottom: tokens.spacingVerticalS,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXL,
    display: "block",
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "900px",
  },
  tutorialHint: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    marginBottom: tokens.spacingVerticalXL,
    display: "block",
    maxWidth: "900px",
  },
  controls: {
    display: "flex",
    gap: tokens.spacingHorizontalXXL,
    alignItems: "flex-end",
    marginTop: tokens.spacingVerticalXL,
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    minWidth: "240px",
  },
  switchHint: {
    color: tokens.colorNeutralForeground2,
  },
  mapSection: {
    flexGrow: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    ...shorthands.padding(
      tokens.spacingVerticalXXL,
      tokens.spacingHorizontalXL
    ),
  },
  mapCard: {
    width: "100%",
    maxWidth: "1200px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  mapCardHeader: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  mapStats: {
    display: "flex",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap",
    alignItems: "center",
  },
  mapContainer: {
    height: "640px",
    width: "100%",
    borderRadius: tokens.borderRadiusMedium,
    overflow: "hidden",
    position: "relative",
  },
  legend: {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backdropFilter: "blur(6px)",
    zIndex: 1000,
    minWidth: "160px",
  },
  legendTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground1,
  },
  legendScale: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  legendColor: {
    width: "24px",
    height: "16px",
    borderRadius: tokens.borderRadiusSmall,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  legendLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
});

const variableOptions = ["windSpeed", "temperature", "pressure"] as const;
type VariableKey = (typeof variableOptions)[number];

type LegendStop = { value: number; label: string; color: string };

const variableLabels: Record<VariableKey, string> = {
  windSpeed: "Wind speed",
  temperature: "Temperature",
  pressure: "Sea-level pressure",
};

const degreeEntity = "\u00B0"; // HTML &deg; escape rendered via unicode

const valueUnits: Record<VariableKey, string> = {
  windSpeed: "m/s",
  temperature: `${degreeEntity}C`,
  pressure: "hPa",
};

const isVariableKey = (value: string): value is VariableKey =>
  variableOptions.some((option) => option === value);

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

type HeatmapColormap = ColormapName;

const norwayBounds: [[number, number], [number, number]] = [
  [57, 4],
  [72.75, 31.75],
];

const mapCenter: [number, number] = [64.875, 17.875];

const emptyForecast: Forecast = {
  generatedAt: "",
  region: { name: "ERA5 Observations", center: mapCenter },
  variableRanges: { windSpeed: [0, 0], temperature: [0, 0], pressure: [0, 0] },
  steps: [],
};

const emptyPredictions: Forecast = {
  generatedAt: "",
  region: {
    name: "Aurora forecast",
    center: mapCenter,
  },
  variableRanges: {
    windSpeed: [0, 0],
    temperature: [0, 0],
    pressure: [0, 0],
  },
  steps: [],
};

function rgbToCss([r, g, b]: [number, number, number]) {
  const clampComponent = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${clampComponent(r)}, ${clampComponent(g)}, ${clampComponent(
    b
  )})`;
}
function getColormapName(variable: VariableKey): HeatmapColormap {
  if (variable === "temperature") {
    return "thermal";
  }
  if (variable === "windSpeed") {
    return "cividis";
  }
  return "plasma";
}

function formatLegendLabel(variable: VariableKey, value: number) {
  if (variable === "temperature") {
    return `${value.toFixed(1)}${degreeEntity}C`;
  }
  if (variable === "windSpeed") {
    return `${value.toFixed(1)} m/s`;
  }
  return `${value.toFixed(0)} hPa`;
}

function formatRangeValue(variable: VariableKey, value: number) {
  if (variable === "temperature") {
    return value.toFixed(1);
  }
  if (variable === "windSpeed") {
    return value.toFixed(1);
  }
  return value.toFixed(0);
}

function getLegendStops(
  variable: VariableKey,
  range: [number, number],
  colormap: HeatmapColormap,
  gamma: number
): LegendStop[] {
  const [min, max] = range;
  const stops = 5;
  const step = stops > 1 ? (max - min) / (stops - 1) : 0;

  const values = Array.from(
    { length: stops },
    (_, index) => min + step * index
  );

  return values
    .map((value) => {
      const normalized = max > min ? (value - min) / (max - min) : 0;
      const adjusted = gamma === 1 ? normalized : Math.pow(normalized, gamma);
      return {
        value,
        label: formatLegendLabel(variable, value),
        color: rgbToCss(
          getColormapColor(
            adjusted,
            colormap,
            colormap === "thermal" ? thermalDefaultStops : undefined
          )
        ),
      };
    })
    .reverse();
}

function getVariableRange(
  dataset: Forecast,
  key: VariableKey
): [number, number] {
  switch (key) {
    case "windSpeed":
      return dataset.variableRanges.windSpeed;
    case "temperature":
      return dataset.variableRanges.temperature;
    case "pressure":
    default:
      return dataset.variableRanges.pressure;
  }
}

function getCellValue(cell: ForecastCell, key: VariableKey): number {
  switch (key) {
    case "windSpeed":
      return cell.windSpeed;
    case "temperature":
      return cell.temperature;
    case "pressure":
    default:
      return cell.pressure;
  }
}

function parseSummaryMetrics(summary: string) {
  const metrics: Array<{ label: string; value: string }> = [];

  // Extract mean wind and gusts
  const windMatch = summary.match(
    /Mean wind ([\d.]+) m\/s with gusts to ([\d.]+) m\/s/
  );
  if (windMatch) {
    metrics.push({ label: "Mean wind", value: `${windMatch[1]} m/s` });
    metrics.push({ label: "Gusts", value: `${windMatch[2]} m/s` });
  }

  // Extract temperature
  const tempMatch = summary.match(
    new RegExp(`Average temperature ([+-]?[\\d.]+) ${degreeEntity}C`)
  );
  if (tempMatch) {
    metrics.push({
      label: "Avg temperature",
      value: `${tempMatch[1]} ${degreeEntity}C`,
    });
  }

  // Extract pressure range
  const pressureMatch = summary.match(
    /Sea-level pressure spans ([\d]+)–([\d]+) hPa/
  );
  if (pressureMatch) {
    metrics.push({
      label: "Pressure span",
      value: `${pressureMatch[1]}–${pressureMatch[2]} hPa`,
    });
  }

  return metrics;
}

export default function App() {
  const styles = useStyles();
  const [stepIndex, setStepIndex] = useState(0);
  const [variable, setVariable] = useState<VariableKey>("windSpeed");
  const [showPredictions, setShowPredictions] = useState(false);
  const [auroraForecast, setAuroraForecast] = useState<Forecast>(emptyForecast);
  const [auroraPredictions, setAuroraPredictions] = useState<Forecast>(emptyPredictions);
  const [obsLoading, setObsLoading] = useState(true);

  useEffect(() => {
    fetch("/data/auroraForecast.json")
      .then((r) => r.json())
      .then((data: Forecast) => {
        setAuroraForecast(data);
        setObsLoading(false);
      })
      .catch(() => setObsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/data/auroraForecastPredictions.json")
      .then((r) => {
        if (!r.ok) return;
        return r.json();
      })
      .then((data?: Forecast) => {
        if (data) setAuroraPredictions(data);
      })
      .catch(() => {});
  }, []);

  const predictionsAvailable = auroraPredictions.steps.length > 0;

  useEffect(() => {
    if (!predictionsAvailable && showPredictions) {
      setShowPredictions(false);
    }
  }, [predictionsAvailable, showPredictions]);

  // Switch between CDS observations and Aurora predictions
  const activeDataset = showPredictions ? auroraPredictions : auroraForecast;
  const step = activeDataset.steps[stepIndex];
  const range = getVariableRange(activeDataset, variable);
  const summaryMetrics = parseSummaryMetrics(step?.summary ?? "");
  const colormap = getColormapName(variable);
  const gamma = variable === "windSpeed" ? 0.85 : 1;

  const gridData = useMemo(() => {
    if (!step?.cells?.length) {
      return null;
    }
    return convertToGrid(step, variable);
  }, [step, variable]);

  const legendStops = useMemo<LegendStop[]>(
    () => getLegendStops(variable, range, colormap, gamma),
    [colormap, gamma, range, variable]
  );

  const sliderMarks = useMemo(
    () =>
      activeDataset.steps.map((item: ForecastStep, index: number) => ({
        value: index,
        label: formatter.format(new Date(item.timestamp + "Z")), // Add Z to force UTC
      })),
    [activeDataset]
  );

  if (obsLoading) {
    return (
      <div className={styles.page} style={{ justifyContent: "center", alignItems: "center" }}>
        <Body1>Loading ERA5 observations…</Body1>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Title3 className={styles.title}>Aurora Norway Prototype</Title3>
          <Body1 className={styles.subtitle}>
            Learn to use Aurora&apos;s weather forecasting AI. Start with ERA5
            observations, run your first inference, and visualize
            predictions—all in one interactive prototype covering Norway&apos;s
            mainland (64×112 grid, 6-hour steps).
          </Body1>
          <Body1 className={styles.tutorialHint}>
            {predictionsAvailable ? (
              <>
                <strong>Want to go further?</strong> Ask GitHub Copilot to
                help you adapt Aurora to a different region, or fine-tune it
                for your own forecasting needs.
              </>
            ) : (
              <>
                <strong>Ready to get started?</strong> Ask GitHub Copilot to
                guide you through generating Aurora predictions for June 8.
              </>
            )}
          </Body1>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <Label htmlFor="data-source">Data Source</Label>
              <Switch
                id="data-source"
                checked={showPredictions}
                disabled={!predictionsAvailable}
                onChange={(_event: unknown, data: SwitchOnChangeData) => {
                  if (!predictionsAvailable) {
                    return;
                  }
                  setShowPredictions(data.checked);
                  setStepIndex(0); // Reset to first step when switching
                }}
                label={
                  showPredictions
                    ? "Aurora Predictions (June 8, 24h)"
                    : "CDS Observations (June 1-7)"
                }
              />
              {!predictionsAvailable && (
                <CaptionNote className={styles.switchHint}>
                  Run the inference script to enable Aurora predictions.
                </CaptionNote>
              )}
            </div>
            <div className={styles.controlGroup}>
              <Label htmlFor="forecast-variable">Variable</Label>
              <Dropdown
                id="forecast-variable"
                value={variableLabels[variable]}
                selectedOptions={[variable]}
                onOptionSelect={(
                  _event: unknown,
                  data: DropdownOnSelectData
                ) => {
                  if (data.optionValue && isVariableKey(data.optionValue)) {
                    setVariable(data.optionValue);
                  }
                }}
              >
                {variableOptions.map((key) => (
                  <Option value={key} key={key}>
                    {variableLabels[key]}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.controlGroup}>
              <Label htmlFor="time-step">Forecast time</Label>
              <Slider
                id="time-step"
                value={stepIndex}
                min={0}
                max={activeDataset.steps.length - 1}
                step={1}
                marks={sliderMarks}
                onChange={(_event: unknown, data: SliderOnChangeData) =>
                  setStepIndex(Number(data.value))
                }
              />
              <CaptionNote>
                {formatter.format(new Date(step.timestamp + "Z"))}
              </CaptionNote>
            </div>
          </div>
        </div>
      </header>
      <section className={styles.mapSection}>
        <Card className={styles.mapCard} appearance="filled">
          <CardHeader
            header={
              <div className={styles.mapCardHeader}>
                <Title3>{variableLabels[variable]}</Title3>
                <div className={styles.mapStats}>
                  <Badge appearance="tint" size="large">
                    Range: {formatRangeValue(variable, range[0])}–
                    {formatRangeValue(variable, range[1])}{" "}
                    {valueUnits[variable]}
                  </Badge>
                  {summaryMetrics.map((metric, idx) => (
                    <Badge key={idx} appearance="outline" size="medium">
                      {metric.label}: {metric.value}
                    </Badge>
                  ))}
                </div>
              </div>
            }
          />
          <div className={styles.mapContainer}>
            <MapContainer
              center={mapCenter}
              bounds={norwayBounds}
              zoom={5.25}
              minZoom={4}
              maxZoom={10}
              zoomSnap={0.25}
              zoomDelta={0.5}
              maxBounds={norwayBounds}
              maxBoundsViscosity={1.0}
              worldCopyJump={false}
              scrollWheelZoom={true}
              preferCanvas
              style={{ height: "100%", width: "100%" }}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                noWrap
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
              />
              {gridData && (
                <HeatmapOverlay
                  data={gridData.data}
                  bounds={gridData.bounds}
                  colormap={colormap}
                  vmin={range[0]}
                  vmax={range[1]}
                  opacity={0.75}
                  gamma={gamma}
                />
              )}
            </MapContainer>
            <div className={styles.legend}>
              <div className={styles.legendTitle}>
                {variableLabels[variable]}
              </div>
              <div className={styles.legendScale}>
                {legendStops.map((stop: LegendStop, idx: number) => (
                  <div key={idx} className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ backgroundColor: stop.color }}
                    />
                    <span className={styles.legendLabel}>{stop.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
