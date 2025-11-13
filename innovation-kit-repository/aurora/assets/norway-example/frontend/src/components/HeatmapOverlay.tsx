import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface HeatmapOverlayProps {
  data: number[][]; // [lat, lon] grid
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  colormap?: "viridis" | "coolwarm" | "plasma";
  vmin: number;
  vmax: number;
  opacity?: number;
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

    // Set canvas size to data dimensions
    const [height, width] = [data.length, data[0]?.length || 0];
    canvas.width = width;
    canvas.height = height;

    // Render data with colormap
    const imageData = ctx.createImageData(width, height);
    for (let lat = 0; lat < height; lat++) {
      for (let lon = 0; lon < width; lon++) {
        const value = data[lat][lon];
        const normalized = Math.max(
          0,
          Math.min(1, (value - vmin) / (vmax - vmin))
        );
        const color = getColormapColor(normalized, colormap);

        const idx = (lat * width + lon) * 4;
        imageData.data[idx] = color[0]; // R
        imageData.data[idx + 1] = color[1]; // G
        imageData.data[idx + 2] = color[2]; // B
        imageData.data[idx + 3] = 255 * opacity; // A
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
  }, [data, bounds, colormap, vmin, vmax, opacity, map]);

  return null;
}

/**
 * Get RGB color from colormap - mimics matplotlib colormaps
 */
function getColormapColor(
  t: number,
  colormap: "viridis" | "coolwarm" | "plasma"
): [number, number, number] {
  // Clamp to [0, 1]
  t = Math.max(0, Math.min(1, t));

  switch (colormap) {
    case "viridis":
      return viridis(t);
    case "coolwarm":
      return coolwarm(t);
    case "plasma":
      return plasma(t);
    default:
      return viridis(t);
  }
}

/**
 * Viridis colormap (approximation)
 * Used for wind speed, general scalar fields
 */
function viridis(t: number): [number, number, number] {
  // Simplified viridis - purple to yellow-green
  const r = Math.round(
    255 * (0.267 + 0.875 * t - 1.765 * t * t + 1.623 * t * t * t)
  );
  const g = Math.round(
    255 * (0.005 + 1.404 * t - 1.384 * t * t + 0.975 * t * t * t)
  );
  const b = Math.round(
    255 * (0.329 + 1.074 * t - 2.403 * t * t + 1.0 * t * t * t)
  );
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Coolwarm colormap (approximation)
 * Used for temperature (blue = cold, red = warm)
 */
function coolwarm(t: number): [number, number, number] {
  const r = Math.round(255 * (0.23 + 1.54 * t - 0.77 * t * t));
  const g = Math.round(255 * (0.3 + 1.21 * t - 1.51 * t * t));
  const b = Math.round(255 * (0.75 - 0.75 * t));
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Plasma colormap (approximation)
 * Purple to pink to yellow
 */
function plasma(t: number): [number, number, number] {
  const r = Math.round(255 * (0.05 + 1.95 * t * t));
  const g = Math.round(255 * (0.03 + 1.03 * t - 0.06 * t * t));
  const b = Math.round(255 * (0.53 + 0.47 * t - 1.0 * t * t));
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}
