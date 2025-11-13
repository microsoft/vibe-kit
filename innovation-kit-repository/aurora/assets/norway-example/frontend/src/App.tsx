import { useMemo, useState } from "react";
import {
  Body1,
  Caption1,
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
  type SliderOnChangeData,
} from "@fluentui/react-components";
import { MapContainer, TileLayer } from "react-leaflet";
import {
  auroraForecast,
  type ForecastCell,
  type ForecastStep,
} from "./data/auroraForecast";
import { auroraForecast as auroraPredictions } from "./data/auroraForecastPredictions";
import { HeatmapOverlay } from "./components/HeatmapOverlay";
import { convertToGrid } from "./utils/gridUtils";

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
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow8,
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
    color: tokens.colorNeutralForeground2,
  },
});

const variableOptions = ["windSpeed", "temperature", "pressure"] as const;
type VariableKey = (typeof variableOptions)[number];

const variableLabels: Record<VariableKey, string> = {
  windSpeed: "Wind speed",
  temperature: "Temperature",
  pressure: "Sea-level pressure",
};

const valueUnits: Record<VariableKey, string> = {
  windSpeed: "m/s",
  temperature: "°C",
  pressure: "hPa",
};

const isVariableKey = (value: string): value is VariableKey =>
  variableOptions.some((option) => option === value);

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function interpolateHue(value: number, domain: [number, number]) {
  const [min, max] = domain;
  if (max - min <= 0.0001) {
    return 200;
  }
  const ratio = clamp((value - min) / (max - min), 0, 1);
  return 220 - ratio * 180; // 220 (blue) -> 40 (amber)
}

function getMarkerColor(value: number, domain: [number, number]) {
  const hue = interpolateHue(value, domain);
  return `hsl(${hue}, 70%, 48%)`;
}

function getMarkerRadius(variable: VariableKey, value: number) {
  if (variable === "windSpeed") {
    return clamp(6 + value * 0.6, 8, 20);
  }
  if (variable === "temperature") {
    return clamp(10 + value * 0.4, 6, 18);
  }
  return clamp(8 + (1020 - value) * 0.15, 6, 18);
}

function getLegendStops(
  variable: VariableKey,
  range: [number, number]
): Array<{ value: number; label: string; color: string }> {
  const [min, max] = range;
  const stops = 5;
  const step = (max - min) / (stops - 1);

  return Array.from({ length: stops }, (_, i) => {
    const value = min + step * i;
    const normalized = (value - min) / (max - min);
    const color = getMarkerColor(value, range);

    let label: string;
    if (variable === "windSpeed") {
      label = `${value.toFixed(0)} m/s`;
    } else if (variable === "temperature") {
      label = `${value.toFixed(0)}°C`;
    } else {
      label = `${value.toFixed(0)} hPa`;
    }

    return { value, label, color };
  }).reverse(); // High to low
}

function getVariableRange(key: VariableKey): [number, number] {
  switch (key) {
    case "windSpeed":
      return auroraForecast.variableRanges.windSpeed;
    case "temperature":
      return auroraForecast.variableRanges.temperature;
    case "pressure":
    default:
      return auroraForecast.variableRanges.pressure;
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
  const tempMatch = summary.match(/Average temperature ([+-]?[\d.]+) °C/);
  if (tempMatch) {
    metrics.push({ label: "Avg temperature", value: `${tempMatch[1]} °C` });
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

  // Switch between CDS observations and Aurora predictions
  const activeDataset = showPredictions ? auroraPredictions : auroraForecast;
  const step = activeDataset.steps[stepIndex];
  const range = getVariableRange(variable);
  const summaryMetrics = parseSummaryMetrics(step.summary);

  const sliderMarks = useMemo(
    () =>
      activeDataset.steps.map((item: ForecastStep, index: number) => ({
        value: index,
        label: formatter.format(new Date(item.timestamp + "Z")), // Add Z to force UTC
      })),
    [activeDataset]
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Title3 className={styles.title}>Aurora Norway Prototype</Title3>
          <Body1 className={styles.subtitle}>
            Learn to use Aurora&apos;s weather forecasting AI. Start with ERA5
            observations, run your first inference, and visualize
            predictions—all in one interactive prototype covering Norway&apos;s
            coastal region (48×48 grid, 6-hour steps).
          </Body1>
          <Body1 className={styles.tutorialHint}>
            <strong>Ready for the next step?</strong> Ask GitHub Copilot to
            guide you through generating Aurora predictions for June 8.
          </Body1>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <Label htmlFor="data-source">Data Source</Label>
              <Switch
                id="data-source"
                checked={showPredictions}
                onChange={(_, data) => {
                  setShowPredictions(data.checked);
                  setStepIndex(0); // Reset to first step when switching
                }}
                label={
                  showPredictions
                    ? "Aurora Predictions (June 8, 24h)"
                    : "CDS Observations (June 1-7)"
                }
              />
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
              <Caption1>
                {formatter.format(new Date(step.timestamp + "Z"))}
              </Caption1>
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
                    Range: {range[0].toFixed(0)}–{range[1].toFixed(0)}{" "}
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
              center={auroraForecast.region.center}
              zoom={6}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <HeatmapOverlay
                data={(() => {
                  const grid = convertToGrid(step, variable);
                  console.log(
                    `Rendering ${variable} at ${
                      step.timestamp
                    }: range ${Math.min(...grid.data.flat())}-${Math.max(
                      ...grid.data.flat()
                    )}`
                  );
                  return grid.data;
                })()}
                bounds={convertToGrid(step, variable).bounds}
                colormap={variable === "temperature" ? "coolwarm" : "viridis"}
                vmin={range[0]}
                vmax={range[1]}
                opacity={0.75}
              />
            </MapContainer>
            <div className={styles.legend}>
              <div className={styles.legendTitle}>
                {variableLabels[variable]}
              </div>
              <div className={styles.legendScale}>
                {getLegendStops(variable, range).map((stop, idx) => (
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
