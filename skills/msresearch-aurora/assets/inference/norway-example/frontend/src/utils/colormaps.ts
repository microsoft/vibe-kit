export type RGB = [number, number, number];

export interface ColormapStop {
  position: number;
  color: RGB;
}

export type ColormapName =
  | "viridis"
  | "coolwarm"
  | "plasma"
  | "cividis"
  | "thermal";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const CIVIDIS_STOPS: RGB[] = [
  // Deep navy for coldest values
  [0, 32, 76],
  // Slate blue transition toward moderate temps
  [42, 72, 108],
  // Desaturated teal midtone
  [91, 125, 135],
  // Muted chartreuse for warmer conditions
  [155, 173, 124],
  // Golden highlight for hottest extremes
  [255, 212, 60],
];

const THERMAL_DEFAULT_STOPS: ColormapStop[] = [
  { position: 0, color: [8, 29, 88] }, // Deep blue
  { position: 0.55, color: [28, 144, 153] }, // Teal near freezing
  { position: 0.85, color: [252, 141, 89] }, // Warm orange (~20°C)
  { position: 1, color: [215, 48, 31] }, // Hot red
];

function interpolateRGB([r1, g1, b1]: RGB, [r2, g2, b2]: RGB, t: number): RGB {
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return [r, g, b];
}

// Polynomial fit approximating matplotlib's viridis colormap (source: https://github.com/BIDS/colormap/blob/master/colormaps.py)
export function sampleViridis(t: number): RGB {
  const clamped = clamp01(t);
  const r = Math.round(
    255 *
      (0.267 + 0.875 * clamped - 1.765 * clamped ** 2 + 1.623 * clamped ** 3)
  );
  const g = Math.round(
    255 *
      (0.005 + 1.404 * clamped - 1.384 * clamped ** 2 + 0.975 * clamped ** 3)
  );
  const b = Math.round(
    255 * (0.329 + 1.074 * clamped - 2.403 * clamped ** 2 + 1.0 * clamped ** 3)
  );
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

// Polynomial fit approximating the "coolwarm" diverging colormap
export function sampleCoolwarm(t: number): RGB {
  const clamped = clamp01(t);
  const r = Math.round(255 * (0.23 + 1.54 * clamped - 0.77 * clamped ** 2));
  const g = Math.round(255 * (0.3 + 1.21 * clamped - 1.51 * clamped ** 2));
  const b = Math.round(255 * (0.75 - 0.75 * clamped));
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

// Quadratic fit capturing the purple → yellow ramp of matplotlib's plasma scheme
export function samplePlasma(t: number): RGB {
  const clamped = clamp01(t);
  const r = Math.round(255 * (0.05 + 1.95 * clamped ** 2));
  const g = Math.round(255 * (0.03 + 1.03 * clamped - 0.06 * clamped ** 2));
  const b = Math.round(255 * (0.53 + 0.47 * clamped - 1.0 * clamped ** 2));
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

export function sampleCividis(t: number): RGB {
  const clamped = clamp01(t);
  const scaled = clamped * (CIVIDIS_STOPS.length - 1);
  const idx = Math.floor(scaled);

  if (idx >= CIVIDIS_STOPS.length - 1) {
    return CIVIDIS_STOPS[CIVIDIS_STOPS.length - 1];
  }

  const fraction = scaled - idx;
  const start = CIVIDIS_STOPS[idx];
  const end = CIVIDIS_STOPS[idx + 1];
  return interpolateRGB(start, end, fraction);
}

// Linear interpolation across sequential thermal stops (defaults mirror NOAA surface temperature palette)
export function thermalSequential(
  t: number,
  customStops?: ColormapStop[]
): RGB {
  const stops =
    customStops && customStops.length >= 2
      ? customStops
      : THERMAL_DEFAULT_STOPS;
  const clamped = clamp01(t);

  if (clamped <= stops[0].position) {
    return stops[0].color;
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];
    if (clamped <= next.position) {
      const localT =
        (clamped - current.position) / (next.position - current.position || 1);
      return interpolateRGB(current.color, next.color, localT);
    }
  }

  return stops[stops.length - 1].color;
}

export function getColormapColor(
  t: number,
  colormap: ColormapName,
  stops?: ColormapStop[]
): RGB {
  const clamped = clamp01(t);

  switch (colormap) {
    case "viridis":
      return sampleViridis(clamped);
    case "coolwarm":
      return sampleCoolwarm(clamped);
    case "plasma":
      return samplePlasma(clamped);
    case "cividis":
      return sampleCividis(clamped);
    case "thermal":
      return thermalSequential(clamped, stops);
    default:
      return sampleViridis(clamped);
  }
}

export const thermalDefaultStops = THERMAL_DEFAULT_STOPS;
