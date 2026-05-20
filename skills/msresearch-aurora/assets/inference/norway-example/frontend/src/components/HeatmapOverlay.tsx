import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { ColormapStop, getColormapColor } from "../utils/colormaps";

interface HeatmapOverlayProps {
  data: number[][]; // [lat, lon] grid
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  colormap?: "viridis" | "coolwarm" | "plasma" | "cividis" | "thermal";
  vmin: number;
  vmax: number;
  opacity?: number;
  gamma?: number;
  colormapStops?: ColormapStop[];
}

/**
 * Canvas-based heatmap overlay for Leaflet - mimics matplotlib's imshow()
 * Renders continuous atmospheric fields like Aurora's official examples
 */
export function HeatmapOverlay({
  data,
  bounds,
  colormap = "viridis",
  vmin,
  vmax,
  opacity = 0.85,
  gamma = 1,
  colormapStops,
}: HeatmapOverlayProps) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Create canvas if needed
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const height = data.length;
    const width = data[0]?.length || 0;
    if (!height || !width) {
      return;
    }

    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);
    const isLowResolution = maxDimension <= 256;
    const smoothingPasses = isLowResolution ? 2 : maxDimension <= 512 ? 1 : 0;
    const source =
      smoothingPasses > 0 ? smoothGrid(data, smoothingPasses) : data;

    // Upscale low-resolution grids aggressively so interpolation has enough pixels
    const targetMinResolution = isLowResolution ? 2048 : 1024;
    const maxScaleFactor = isLowResolution ? 8 : 4;
    const scaleFactor = Math.min(
      maxScaleFactor,
      Math.max(1, Math.ceil(targetMinResolution / Math.max(1, minDimension)))
    );

    const scaledWidth = width * scaleFactor;
    const scaledHeight = height * scaleFactor;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Render data with bilinear interpolation to smooth gradients
    const imageData = ctx.createImageData(scaledWidth, scaledHeight);
    const alpha = Math.max(0, Math.min(255, Math.round(255 * opacity)));

    for (let y = 0; y < scaledHeight; y++) {
      const srcY = y / scaleFactor;

      for (let x = 0; x < scaledWidth; x++) {
        const srcX = x / scaleFactor;
        const interpolatedValue = sampleBicubic(source, srcX, srcY);

        const normalized = Math.max(
          0,
          Math.min(1, (interpolatedValue - vmin) / (vmax - vmin))
        );
        const adjusted = gamma === 1 ? normalized : Math.pow(normalized, gamma);
        const color = getColormapColor(adjusted, colormap, colormapStops);

        const idx = (y * scaledWidth + x) * 4;
        imageData.data[idx] = color[0];
        imageData.data[idx + 1] = color[1];
        imageData.data[idx + 2] = color[2];
        imageData.data[idx + 3] = alpha;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to data URL
    const imageUrl = canvas.toDataURL();

    // Remove old overlay
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
    }

    // Add new overlay
    overlayRef.current = L.imageOverlay(imageUrl, bounds, {
      opacity,
      interactive: false,
    });
    overlayRef.current.addTo(map);

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
      }
    };
  }, [data, bounds, colormap, vmin, vmax, opacity, gamma, colormapStops, map]);

  return null;
}

// 5x5 Gaussian kernel that smooths coarse forecast grids before interpolation
const mapSmoothingGaussianKernel = [
  [1, 4, 7, 4, 1],
  [4, 16, 26, 16, 4],
  [7, 26, 41, 26, 7],
  [4, 16, 26, 16, 4],
  [1, 4, 7, 4, 1],
];

const mapSmoothingGaussianKernelWeightSum = mapSmoothingGaussianKernel
  .flat()
  .reduce((total, weight) => total + weight, 0);

function smoothGrid(source: number[][], iterations = 1): number[][] {
  let current = source.map((row) => Float32Array.from(row));
  const height = current.length;
  const width = current[0]?.length ?? 0;
  const mapSmoothingGaussianKernelRowCount = mapSmoothingGaussianKernel.length;
  const half = Math.floor(mapSmoothingGaussianKernelRowCount / 2);

  for (let pass = 0; pass < iterations; pass++) {
    const next = Array.from({ length: height }, () => new Float32Array(width));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let accum = 0;

        for (let ky = 0; ky < mapSmoothingGaussianKernelRowCount; ky++) {
          const offsetY = ky - half;
          const sampleY = clampIndex(y + offsetY, height);

          for (let kx = 0; kx < mapSmoothingGaussianKernelRowCount; kx++) {
            const offsetX = kx - half;
            const sampleX = clampIndex(x + offsetX, width);
            const weight = mapSmoothingGaussianKernel[ky][kx];
            accum += current[sampleY][sampleX] * weight;
          }
        }

        next[y][x] = accum / mapSmoothingGaussianKernelWeightSum;
      }
    }

    current = next;
  }

  return current.map((row) => Array.from(row));
}

function sampleBicubic(source: number[][], x: number, y: number): number {
  const height = source.length;
  const width = source[0]?.length ?? 0;

  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;

  const sample = (sx: number, sy: number) => {
    const clampedX = clampIndex(sx, width);
    const clampedY = clampIndex(sy, height);
    return source[clampedY][clampedX];
  };

  const row0 = catmullRom(
    sample(xi - 1, yi - 1),
    sample(xi, yi - 1),
    sample(xi + 1, yi - 1),
    sample(xi + 2, yi - 1),
    tx
  );
  const row1 = catmullRom(
    sample(xi - 1, yi),
    sample(xi, yi),
    sample(xi + 1, yi),
    sample(xi + 2, yi),
    tx
  );
  const row2 = catmullRom(
    sample(xi - 1, yi + 1),
    sample(xi, yi + 1),
    sample(xi + 1, yi + 1),
    sample(xi + 2, yi + 1),
    tx
  );
  const row3 = catmullRom(
    sample(xi - 1, yi + 2),
    sample(xi, yi + 2),
    sample(xi + 1, yi + 2),
    sample(xi + 2, yi + 2),
    tx
  );

  return catmullRom(row0, row1, row2, row3, ty);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
  const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
  const c = -0.5 * p0 + 0.5 * p2;
  const d = p1;
  return ((a * t + b) * t + c) * t + d;
}

function clampIndex(value: number, upperBound: number) {
  if (upperBound <= 1) {
    return 0;
  }
  const floored = Math.floor(value);
  if (floored < 0) {
    return 0;
  }
  if (floored >= upperBound) {
    return upperBound - 1;
  }
  return floored;
}
