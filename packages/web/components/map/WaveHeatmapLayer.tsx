/**
 * WAVE HEATMAP LAYER COMPONENT
 * Renders a grid-based heatmap overlay for wave heights
 * Israeli Met Service style - performant grid visualization
 */

import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';

/**
 * Grid cell data structure
 */
export interface GridCell {
  lat: number;
  lng: number;
  value: number; // Wave height in meters
  color: string; // Hex color code for the cell
}

/**
 * Component props
 */
export interface WaveHeatmapLayerProps {
  gridData: GridCell[];
  visible: boolean;
  opacity?: number; // Optional opacity control (0-1)
  map: L.Map | null; // Leaflet map instance (required)
}

/**
 * WaveHeatmapLayer Component
 *
 * Renders a performant grid-based heatmap overlay using Leaflet canvas renderer.
 * Optimized for 50-100 grid cells with proper cleanup.
 *
 * @param gridData - Array of grid cells with lat/lng/value/color
 * @param visible - Whether the layer is visible
 * @param opacity - Optional opacity (default: 0.7)
 */
export const WaveHeatmapLayer: React.FC<WaveHeatmapLayerProps> = ({
  gridData,
  visible,
  opacity = 0.7,
  map,
}) => {
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const rectanglesRef = useRef<L.Rectangle[]>([]);

  // Initialize layer group
  useEffect(() => {
    // Use the map prop directly instead of finding from DOM
    if (!map) {
      console.log('[WaveHeatmapLayer] No map instance provided, skipping');
      return;
    }

    console.log('[WaveHeatmapLayer] Initializing with map instance');

    // Create layer group
    const layerGroup = L.layerGroup();
    layerGroupRef.current = layerGroup;

    // Add to map if visible
    if (visible) {
      layerGroup.addTo(map);
      console.log('[WaveHeatmapLayer] Layer group added to map');
    }

    // Cleanup on unmount
    return () => {
      if (layerGroupRef.current) {
        clearRectangles();
        if (map && map.hasLayer(layerGroupRef.current)) {
          map.removeLayer(layerGroupRef.current);
        }
        layerGroupRef.current = null;
      }
    };
  }, [map, visible]);

  // Clear all rectangles
  const clearRectangles = () => {
    rectanglesRef.current.forEach((rect) => {
      if (layerGroupRef.current && layerGroupRef.current.hasLayer(rect)) {
        layerGroupRef.current.removeLayer(rect);
      }
    });
    rectanglesRef.current = [];
  };

  // Update grid data
  useEffect(() => {
    console.log('[WaveHeatmapLayer] Grid data update effect:', {
      hasLayerGroup: !!layerGroupRef.current,
      hasMap: !!map,
      visible,
      gridDataLength: gridData.length
    });

    if (!layerGroupRef.current || !map || !visible || gridData.length === 0) {
      clearRectangles();
      return;
    }

    // Clear existing rectangles
    clearRectangles();

    // Calculate grid cell size based on data density
    // Assuming regular grid spacing
    const cellSize = calculateCellSize(gridData);
    console.log('[WaveHeatmapLayer] Calculated cell size:', cellSize);

    // Create rectangles for each grid cell with smooth blending
    gridData.forEach((cell) => {
      const bounds = calculateCellBounds(cell.lat, cell.lng, cellSize);

      const rectangle = L.rectangle(bounds, {
        color: cell.color,
        fillColor: cell.color,
        fillOpacity: opacity,
        weight: 0,  // No border for smoother appearance
        opacity: 0,  // No border stroke
        className: 'wave-heatmap-cell',
      });

      // Add tooltip with wave height
      rectangle.bindTooltip(`${cell.value.toFixed(1)}m`, {
        permanent: false,
        direction: 'center',
        className: 'wave-heatmap-tooltip',
      });

      // Add to layer group
      rectangle.addTo(layerGroupRef.current!);
      rectanglesRef.current.push(rectangle);
    });

    console.log('[WaveHeatmapLayer] Created', rectanglesRef.current.length, 'rectangles');

    // Inject CSS for tooltip styling
    injectTooltipStyles();
  }, [gridData, visible, opacity, map]);

  // Toggle visibility
  useEffect(() => {
    if (!layerGroupRef.current || !map) return;

    if (visible) {
      if (!map.hasLayer(layerGroupRef.current)) {
        layerGroupRef.current.addTo(map);
        console.log('[WaveHeatmapLayer] Layer made visible');
      }
    } else {
      if (map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current);
        console.log('[WaveHeatmapLayer] Layer hidden');
      }
    }
  }, [visible, map]);

  return null; // This is a pure map layer component, no DOM output
};

/**
 * Calculate cell size based on grid data
 * Estimates the spacing between grid points
 */
function calculateCellSize(gridData: GridCell[]): number {
  if (gridData.length < 2) return 0.1; // Default 0.1 degree cells

  // Find minimum distance between points to estimate cell size
  let minDistance = Infinity;

  for (let i = 0; i < Math.min(gridData.length, 20); i++) {
    for (let j = i + 1; j < Math.min(gridData.length, 20); j++) {
      const latDiff = Math.abs(gridData[i].lat - gridData[j].lat);
      const lngDiff = Math.abs(gridData[i].lng - gridData[j].lng);

      if (latDiff > 0) minDistance = Math.min(minDistance, latDiff);
      if (lngDiff > 0) minDistance = Math.min(minDistance, lngDiff);
    }
  }

  // Use the minimum distance as cell size, with fallback
  return minDistance === Infinity ? 0.1 : minDistance;
}

/**
 * Calculate bounds for a grid cell
 * Creates a rectangle centered on the cell coordinates
 */
function calculateCellBounds(
  lat: number,
  lng: number,
  cellSize: number
): L.LatLngBoundsExpression {
  const halfSize = cellSize / 2;

  return [
    [lat - halfSize, lng - halfSize], // Southwest corner
    [lat + halfSize, lng + halfSize], // Northeast corner
  ];
}

/**
 * Inject CSS styles for tooltips and cells
 * Only injects once to avoid duplicates
 */
function injectTooltipStyles(): void {
  if (document.getElementById('wave-heatmap-styles')) return;

  const style = document.createElement('style');
  style.id = 'wave-heatmap-styles';
  style.innerHTML = `
    .wave-heatmap-tooltip {
      background: rgba(15, 23, 42, 0.9) !important;
      border: 1px solid rgba(59, 130, 246, 0.5) !important;
      border-radius: 4px !important;
      padding: 4px 8px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
    }

    .wave-heatmap-tooltip::before {
      display: none !important;
    }

    /* Smooth blending for heatmap cells */
    .wave-heatmap-cell {
      filter: blur(3px);
      mix-blend-mode: normal;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Utility function to generate color based on wave height
 * Can be used externally to create consistent grid data
 */
export function getWaveHeightColor(height: number): string {
  if (height < 0.5) return '#93c5fd'; // Blue-300 (calm)
  if (height < 1.0) return '#3b82f6'; // Blue-500 (light)
  if (height < 2.0) return '#34d399'; // Emerald-400 (moderate)
  if (height < 3.0) return '#facc15'; // Yellow-400 (rough)
  if (height < 4.0) return '#fb923c'; // Orange-400 (very rough)
  return '#ef4444'; // Red-500 (high)
}

/**
 * Utility function to create grid data from forecast points
 * Helps convert forecast data to the expected GridCell format
 */
export function createGridDataFromForecasts(
  forecasts: Array<{ lat: number; lng: number; waveHeight: number }>
): GridCell[] {
  return forecasts.map((forecast) => ({
    lat: forecast.lat,
    lng: forecast.lng,
    value: forecast.waveHeight,
    color: getWaveHeightColor(forecast.waveHeight),
  }));
}

export default WaveHeatmapLayer;
