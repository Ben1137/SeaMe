/**
 * WAVE HEATMAP LAYER - USAGE EXAMPLES
 *
 * This file demonstrates how to use the WaveHeatmapLayer component
 * in different scenarios.
 */

import React, { useState, useEffect } from 'react';
import { WaveHeatmapLayer, createGridDataFromForecasts, getWaveHeightColor } from './WaveHeatmapLayer';
import type { GridCell } from './WaveHeatmapLayer';

/**
 * Example 1: Basic Usage
 *
 * Render a simple wave heatmap with static data
 */
export const BasicExample: React.FC = () => {
  const [visible, setVisible] = useState(true);

  // Static grid data
  const gridData: GridCell[] = [
    { lat: 32.0, lng: 34.5, value: 1.2, color: getWaveHeightColor(1.2) },
    { lat: 32.1, lng: 34.5, value: 1.5, color: getWaveHeightColor(1.5) },
    { lat: 32.2, lng: 34.5, value: 2.1, color: getWaveHeightColor(2.1) },
    { lat: 32.0, lng: 34.6, value: 0.8, color: getWaveHeightColor(0.8) },
    { lat: 32.1, lng: 34.6, value: 1.9, color: getWaveHeightColor(1.9) },
    { lat: 32.2, lng: 34.6, value: 2.5, color: getWaveHeightColor(2.5) },
  ];

  return (
    <div>
      <button onClick={() => setVisible(!visible)}>
        Toggle Wave Heatmap
      </button>
      <WaveHeatmapLayer gridData={gridData} visible={visible} />
    </div>
  );
};

/**
 * Example 2: Dynamic Data from API
 *
 * Fetch wave forecast data and render as heatmap
 */
export const DynamicExample: React.FC = () => {
  const [gridData, setGridData] = useState<GridCell[]>([]);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWaveData();
  }, []);

  const fetchWaveData = async () => {
    setLoading(true);
    try {
      // Example: Fetch from your API
      // const response = await fetch('/api/wave-forecast');
      // const data = await response.json();

      // Mock data for demonstration
      const mockForecasts = generateMockForecasts();

      // Convert to grid data
      const grid = createGridDataFromForecasts(mockForecasts);
      setGridData(grid);
    } catch (error) {
      console.error('Failed to fetch wave data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchWaveData} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh Wave Data'}
      </button>
      <button onClick={() => setVisible(!visible)}>
        {visible ? 'Hide' : 'Show'} Heatmap
      </button>
      <WaveHeatmapLayer gridData={gridData} visible={visible} />
    </div>
  );
};

/**
 * Example 3: Integration with MapComponent
 *
 * Shows how to integrate with the existing MapComponent
 */
export const MapIntegrationExample: React.FC = () => {
  const [showWaveLayer, setShowWaveLayer] = useState(false);
  const [gridData, setGridData] = useState<GridCell[]>([]);

  // Example: Update grid based on map bounds
  const updateGridForBounds = (bounds: { north: number; south: number; east: number; west: number }) => {
    // Generate grid points within bounds
    const grid: GridCell[] = [];
    const step = 0.1; // 0.1 degree spacing

    for (let lat = bounds.south; lat <= bounds.north; lat += step) {
      for (let lng = bounds.west; lng <= bounds.east; lng += step) {
        // Mock wave height calculation
        const waveHeight = Math.random() * 4;
        grid.push({
          lat,
          lng,
          value: waveHeight,
          color: getWaveHeightColor(waveHeight),
        });
      }
    }

    setGridData(grid);
  };

  return (
    <div>
      <div className="controls">
        <label>
          <input
            type="checkbox"
            checked={showWaveLayer}
            onChange={(e) => setShowWaveLayer(e.target.checked)}
          />
          Show Wave Heatmap
        </label>
      </div>

      {/* Your map component here */}
      <WaveHeatmapLayer gridData={gridData} visible={showWaveLayer} opacity={0.7} />
    </div>
  );
};

/**
 * Example 4: Custom Color Scheme
 *
 * Use custom colors instead of the default wave height colors
 */
export const CustomColorExample: React.FC = () => {
  const [visible, setVisible] = useState(true);

  // Custom color mapping
  const getCustomColor = (value: number): string => {
    if (value < 1.0) return '#0ea5e9'; // Cyan
    if (value < 2.0) return '#8b5cf6'; // Purple
    if (value < 3.0) return '#ec4899'; // Pink
    return '#dc2626'; // Red
  };

  const gridData: GridCell[] = [
    { lat: 32.0, lng: 34.5, value: 0.8, color: getCustomColor(0.8) },
    { lat: 32.1, lng: 34.5, value: 1.5, color: getCustomColor(1.5) },
    { lat: 32.2, lng: 34.5, value: 2.3, color: getCustomColor(2.3) },
    { lat: 32.0, lng: 34.6, value: 3.2, color: getCustomColor(3.2) },
  ];

  return (
    <div>
      <button onClick={() => setVisible(!visible)}>
        Toggle Custom Colors
      </button>
      <WaveHeatmapLayer gridData={gridData} visible={visible} opacity={0.8} />
    </div>
  );
};

/**
 * Example 5: Performance Test
 *
 * Render 100 grid cells to test performance
 */
export const PerformanceExample: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [cellCount, setCellCount] = useState(50);

  const generateGrid = (count: number): GridCell[] => {
    const grid: GridCell[] = [];
    const gridSize = Math.ceil(Math.sqrt(count));
    const step = 0.1;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (grid.length >= count) break;

        const lat = 32.0 + i * step;
        const lng = 34.5 + j * step;
        const value = Math.random() * 4;

        grid.push({
          lat,
          lng,
          value,
          color: getWaveHeightColor(value),
        });
      }
    }

    return grid;
  };

  const gridData = generateGrid(cellCount);

  return (
    <div>
      <div>
        <label>
          Cell Count: {cellCount}
          <input
            type="range"
            min="10"
            max="100"
            value={cellCount}
            onChange={(e) => setCellCount(Number(e.target.value))}
          />
        </label>
      </div>
      <button onClick={() => setVisible(!visible)}>
        Toggle Heatmap
      </button>
      <p>Rendering {gridData.length} cells</p>
      <WaveHeatmapLayer gridData={gridData} visible={visible} />
    </div>
  );
};

/**
 * Helper function to generate mock forecast data
 */
function generateMockForecasts() {
  const forecasts = [];
  const baseLat = 32.0;
  const baseLng = 34.5;
  const step = 0.1;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      forecasts.push({
        lat: baseLat + i * step,
        lng: baseLng + j * step,
        waveHeight: Math.random() * 4,
      });
    }
  }

  return forecasts;
}

/**
 * USAGE IN MapComponent.tsx:
 *
 * import { WaveHeatmapLayer, createGridDataFromForecasts } from './map/WaveHeatmapLayer';
 *
 * // Inside MapComponent:
 * const [waveGridData, setWaveGridData] = useState<GridCell[]>([]);
 * const [showWaveHeatmap, setShowWaveHeatmap] = useState(false);
 *
 * // Fetch wave data when needed
 * const fetchWaveGrid = async () => {
 *   const forecasts = await fetchBulkPointForecast(gridPoints);
 *   const grid = createGridDataFromForecasts(forecasts);
 *   setWaveGridData(grid);
 * };
 *
 * // In render:
 * <WaveHeatmapLayer gridData={waveGridData} visible={showWaveHeatmap} />
 */
