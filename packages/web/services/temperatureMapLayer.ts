/**
 * TEMPERATURE MAP LAYER SERVICE
 * Creates a semi-transparent temperature overlay using Open-Meteo API data
 * Canvas-based rendering with smooth interpolation
 */

import * as L from 'leaflet';
import { ForecastApiResponse } from '@seame/core';

interface TemperaturePoint {
  lat: number;
  lng: number;
  temp: number;
}

/**
 * Color scale: Blue (cold) → Green → Yellow → Red (hot)
 * Based on typical temperature ranges: -10°C to 40°C
 */
const getTemperatureColor = (temp: number): string => {
  // Normalize temperature to 0-1 range
  const minTemp = -10;
  const maxTemp = 40;
  const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

  // Define color stops
  const stops = [
    { pos: 0.0, r: 0, g: 0, b: 255 },      // Blue (cold)
    { pos: 0.25, r: 0, g: 128, b: 255 },   // Light Blue
    { pos: 0.5, r: 0, g: 255, b: 0 },      // Green (mild)
    { pos: 0.75, r: 255, g: 255, b: 0 },   // Yellow (warm)
    { pos: 1.0, r: 255, g: 0, b: 0 },      // Red (hot)
  ];

  // Find the two stops to interpolate between
  let lowerStop = stops[0];
  let upperStop = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (normalized >= stops[i].pos && normalized <= stops[i + 1].pos) {
      lowerStop = stops[i];
      upperStop = stops[i + 1];
      break;
    }
  }

  // Interpolate between the two stops
  const range = upperStop.pos - lowerStop.pos;
  const localNorm = range === 0 ? 0 : (normalized - lowerStop.pos) / range;

  const r = Math.round(lowerStop.r + (upperStop.r - lowerStop.r) * localNorm);
  const g = Math.round(lowerStop.g + (upperStop.g - lowerStop.g) * localNorm);
  const b = Math.round(lowerStop.b + (upperStop.b - lowerStop.b) * localNorm);

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Inverse Distance Weighting interpolation
 */
const interpolateTemperature = (
  lat: number,
  lng: number,
  points: TemperaturePoint[],
  power = 2
): number => {
  if (points.length === 0) return 15; // Default fallback

  let weightedSum = 0;
  let weightSum = 0;

  for (const point of points) {
    const dx = point.lng - lng;
    const dy = point.lat - lat;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.001) {
      // Very close to a data point, return its value
      return point.temp;
    }

    const weight = 1 / Math.pow(distance, power);
    weightedSum += point.temp * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? weightedSum / weightSum : 15;
};

export class TemperatureMapLayer {
  private map: L.Map | null = null;
  private canvasLayer: L.Layer | null = null;
  private temperatureData: TemperaturePoint[] = [];
  private opacity = 0.5;
  private isVisible = false;

  constructor(map: L.Map) {
    this.map = map;
  }

  /**
   * Fetch temperature data for the current map bounds
   */
  async fetchTemperatureData(): Promise<void> {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const north = bounds.getNorth();
    const south = bounds.getSouth();

    // Generate grid points (8x8 grid for good coverage)
    const gridPoints: { lat: number; lng: number }[] = [];
    const cols = 8;
    const rows = 8;

    const lngStep = (east - west) / cols;
    const latStep = (north - south) / rows;

    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows; r++) {
        gridPoints.push({
          lat: south + latStep * r,
          lng: west + lngStep * c,
        });
      }
    }

    try {
      // Fetch temperature data from Open-Meteo Forecast API
      const lats = gridPoints.map(p => p.lat.toFixed(4)).join(',');
      const lngs = gridPoints.map(p => p.lng.toFixed(4)).join(',');

      const params = new URLSearchParams({
        latitude: lats,
        longitude: lngs,
        current: 'temperature_2m',
        timezone: 'auto',
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch temperature data');
      }

      const data: ForecastApiResponse | ForecastApiResponse[] = await response.json();

      // Handle single vs array response
      const results = Array.isArray(data) ? data : [data];

      this.temperatureData = results
        .map((result, i) => ({
          lat: gridPoints[i].lat,
          lng: gridPoints[i].lng,
          temp: result.current?.temperature_2m ?? 15,
        }))
        .filter(point => point.temp !== null);

    } catch (error) {
      console.error('Failed to fetch temperature data:', error);
      this.temperatureData = [];
    }
  }

  /**
   * Render the temperature overlay on the map
   */
  async render(): Promise<void> {
    if (!this.map) return;

    // Fetch temperature data
    await this.fetchTemperatureData();

    if (this.temperatureData.length === 0) {
      console.warn('No temperature data available');
      return;
    }

    // Remove existing canvas layer
    if (this.canvasLayer) {
      this.map.removeLayer(this.canvasLayer);
    }

    // Create custom canvas layer
    const CanvasLayer = L.Layer.extend({
      onAdd: (map: L.Map) => {
        const canvas = L.DomUtil.create('canvas', 'temperature-overlay-canvas');
        const size = map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.opacity = this.opacity.toString();
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '400';

        map.getPanes().overlayPane?.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw temperature gradient
        this.drawTemperatureGradient(ctx, canvas.width, canvas.height, map);

        // Store canvas for later updates
        (CanvasLayer as any)._canvas = canvas;

        // Redraw on map move/zoom
        map.on('moveend zoomend', () => {
          this.updateCanvas(canvas, ctx, map);
        });
      },

      onRemove: (map: L.Map) => {
        const canvas = (CanvasLayer as any)._canvas;
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        map.off('moveend zoomend');
      },
    });

    this.canvasLayer = new CanvasLayer();

    if (this.isVisible) {
      this.canvasLayer.addTo(this.map);
    }
  }

  /**
   * Draw temperature gradient on canvas
   */
  private drawTemperatureGradient(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    map: L.Map
  ): void {
    const cellSize = 20; // Size of each gradient cell in pixels

    for (let x = 0; x < width; x += cellSize) {
      for (let y = 0; y < height; y += cellSize) {
        // Convert pixel coordinates to lat/lng
        const point = map.containerPointToLatLng([x, y]);

        // Interpolate temperature at this point
        const temp = interpolateTemperature(
          point.lat,
          point.lng,
          this.temperatureData
        );

        // Get color for this temperature
        const color = getTemperatureColor(temp);

        // Draw filled rectangle
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  /**
   * Update canvas when map moves or zooms
   */
  private async updateCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    map: L.Map
  ): Promise<void> {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Resize canvas to match map
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    // Fetch new data for new bounds
    await this.fetchTemperatureData();

    // Redraw
    this.drawTemperatureGradient(ctx, canvas.width, canvas.height, map);
  }

  /**
   * Set layer visibility
   */
  setVisible(visible: boolean): void {
    this.isVisible = visible;

    if (!this.map || !this.canvasLayer) return;

    if (visible) {
      if (!this.map.hasLayer(this.canvasLayer)) {
        this.canvasLayer.addTo(this.map);
      }
    } else {
      this.map.removeLayer(this.canvasLayer);
    }
  }

  /**
   * Set layer opacity
   */
  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));

    if (this.canvasLayer) {
      const canvas = (this.canvasLayer as any)._canvas;
      if (canvas) {
        canvas.style.opacity = this.opacity.toString();
      }
    }
  }

  /**
   * Get temperature at a specific point (interpolated)
   */
  getTemperatureAt(lat: number, lng: number): number | null {
    if (this.temperatureData.length === 0) return null;
    return interpolateTemperature(lat, lng, this.temperatureData);
  }

  /**
   * Destroy the layer
   */
  destroy(): void {
    if (this.canvasLayer && this.map) {
      this.map.removeLayer(this.canvasLayer);
    }
    this.canvasLayer = null;
    this.temperatureData = [];
    this.map = null;
  }
}

/**
 * Create temperature legend component
 */
export const createTemperatureLegend = (): HTMLDivElement => {
  const legend = document.createElement('div');
  legend.className = 'temperature-legend';
  legend.style.cssText = `
    position: absolute;
    bottom: 30px;
    left: 10px;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(8px);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Create gradient bar
  const gradientBar = document.createElement('div');
  gradientBar.style.cssText = `
    width: 200px;
    height: 20px;
    background: linear-gradient(to right,
      rgb(0, 0, 255) 0%,
      rgb(0, 128, 255) 25%,
      rgb(0, 255, 0) 50%,
      rgb(255, 255, 0) 75%,
      rgb(255, 0, 0) 100%
    );
    border-radius: 4px;
    margin-bottom: 8px;
  `;

  // Create labels
  const labels = document.createElement('div');
  labels.style.cssText = `
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #cbd5e1;
  `;
  labels.innerHTML = `
    <span>-10°C</span>
    <span>0°C</span>
    <span>15°C</span>
    <span>25°C</span>
    <span>40°C</span>
  `;

  // Title
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;
  title.innerHTML = '🌡️ Temperature';

  legend.appendChild(title);
  legend.appendChild(gradientBar);
  legend.appendChild(labels);

  return legend;
};

/**
 * Inject temperature layer styles
 */
export const injectTemperatureStyles = (): void => {
  if (document.getElementById('temperature-map-styles')) return;

  const style = document.createElement('style');
  style.id = 'temperature-map-styles';
  style.innerHTML = `
    .temperature-overlay-canvas {
      image-rendering: auto;
      image-rendering: -webkit-optimize-contrast;
    }

    .temperature-legend {
      animation: slideInLeft 0.3s ease-out;
    }

    @keyframes slideInLeft {
      from {
        transform: translateX(-20px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
};
