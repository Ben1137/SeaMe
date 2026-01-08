# WaveHeatmapLayer Component

A performant React component that renders a grid-based heatmap overlay for wave heights on Leaflet maps, inspired by Israeli Met Service visualization style.

## Features

- **Grid-based visualization**: Displays wave height data as colored rectangular cells
- **High performance**: Optimized for 50-100 grid cells using Leaflet rectangles
- **Color-coded cells**: Automatic color mapping based on wave height
- **Interactive tooltips**: Shows wave height on hover
- **Automatic cleanup**: Properly removes layers when unmounted
- **TypeScript support**: Full type definitions included
- **Responsive**: Automatically calculates cell size based on grid density

## Installation

The component is already part of the project's map components.

```typescript
import { WaveHeatmapLayer, getWaveHeightColor, createGridDataFromForecasts } from './components/map';
import type { GridCell, WaveHeatmapLayerProps } from './components/map';
```

## Basic Usage

```typescript
import React, { useState } from 'react';
import { WaveHeatmapLayer, getWaveHeightColor } from './components/map/WaveHeatmapLayer';
import type { GridCell } from './components/map/WaveHeatmapLayer';

const MyMapComponent: React.FC = () => {
  const [visible, setVisible] = useState(true);

  const gridData: GridCell[] = [
    { lat: 32.0, lng: 34.5, value: 1.2, color: getWaveHeightColor(1.2) },
    { lat: 32.1, lng: 34.5, value: 2.5, color: getWaveHeightColor(2.5) },
    { lat: 32.2, lng: 34.5, value: 0.8, color: getWaveHeightColor(0.8) },
  ];

  return (
    <div>
      <button onClick={() => setVisible(!visible)}>Toggle Heatmap</button>
      <WaveHeatmapLayer gridData={gridData} visible={visible} />
    </div>
  );
};
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `gridData` | `GridCell[]` | Yes | - | Array of grid cells with position, value, and color |
| `visible` | `boolean` | Yes | - | Controls layer visibility |
| `opacity` | `number` | No | `0.7` | Fill opacity of cells (0-1) |

### GridCell Interface

```typescript
interface GridCell {
  lat: number;      // Latitude of cell center
  lng: number;      // Longitude of cell center
  value: number;    // Wave height in meters
  color: string;    // Hex color code (e.g., '#3b82f6')
}
```

## Helper Functions

### `getWaveHeightColor(height: number): string`

Returns the appropriate color for a given wave height.

**Color Scale:**
- < 0.5m: `#93c5fd` (Blue-300, calm)
- < 1.0m: `#3b82f6` (Blue-500, light)
- < 2.0m: `#34d399` (Emerald-400, moderate)
- < 3.0m: `#facc15` (Yellow-400, rough)
- < 4.0m: `#fb923c` (Orange-400, very rough)
- ≥ 4.0m: `#ef4444` (Red-500, high)

```typescript
const color = getWaveHeightColor(2.3); // Returns '#facc15'
```

### `createGridDataFromForecasts(forecasts): GridCell[]`

Converts forecast data to GridCell format.

```typescript
const forecasts = [
  { lat: 32.0, lng: 34.5, waveHeight: 1.2 },
  { lat: 32.1, lng: 34.5, waveHeight: 2.5 },
];

const gridData = createGridDataFromForecasts(forecasts);
// Returns: [{ lat: 32.0, lng: 34.5, value: 1.2, color: '#3b82f6' }, ...]
```

## Integration with MapComponent

To integrate with the existing `MapComponent.tsx`:

```typescript
import { WaveHeatmapLayer, createGridDataFromForecasts } from './map/WaveHeatmapLayer';
import type { GridCell } from './map/WaveHeatmapLayer';

// Inside MapComponent:
const [waveGridData, setWaveGridData] = useState<GridCell[]>([]);
const [showWaveHeatmap, setShowWaveHeatmap] = useState(false);

// Fetch and update wave grid
const updateWaveGrid = async () => {
  const bounds = mapInstance.current.getBounds();
  const gridPoints = generateGridPoints(bounds); // Your grid generation logic

  const forecasts = await fetchBulkPointForecast(gridPoints);
  const grid = createGridDataFromForecasts(forecasts);

  setWaveGridData(grid);
};

// In render:
<WaveHeatmapLayer
  gridData={waveGridData}
  visible={showWaveHeatmap}
  opacity={0.7}
/>
```

## Performance Considerations

- **Optimized for 50-100 cells**: The component efficiently handles this range
- **Automatic cell sizing**: Calculates grid cell size based on data density
- **Proper cleanup**: All Leaflet layers are removed on unmount
- **Rectangle reuse**: Updates existing rectangles instead of recreating

### Performance Tips

1. **Debounce updates**: When updating on map movement, debounce the update function
2. **Limit grid density**: Keep grid spacing reasonable (e.g., 0.1° - 0.2°)
3. **Toggle visibility**: Hide the layer when not needed to reduce rendering load

```typescript
// Example: Debounced map update
const updateGridDebounced = useRef(
  debounce(() => updateWaveGrid(), 500)
).current;

map.on('moveend', updateGridDebounced);
```

## Styling

The component includes built-in tooltip styling. You can customize by overriding the `.wave-heatmap-tooltip` class:

```css
.wave-heatmap-tooltip {
  background: rgba(15, 23, 42, 0.9) !important;
  border: 1px solid rgba(59, 130, 246, 0.5) !important;
  border-radius: 4px !important;
  padding: 4px 8px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  color: #ffffff !important;
}
```

## Advanced Examples

See `WaveHeatmapLayer.example.tsx` for:
- Dynamic data fetching
- Custom color schemes
- Performance testing
- Map integration patterns

## Architecture Notes

- **Map detection**: Automatically finds the Leaflet map instance via DOM query
- **Layer management**: Uses `L.LayerGroup` for efficient layer control
- **Cell sizing**: Intelligently estimates cell size from grid data
- **Memory management**: Clears all rectangles and removes event listeners on unmount

## Compatibility

- **Leaflet**: 1.9.x
- **React**: 19.x
- **TypeScript**: 5.8.x
- **Browser**: Modern browsers with ES2022 support

## Troubleshooting

### Layer not appearing
- Ensure the map container has class `.leaflet-container`
- Check that `visible` prop is `true`
- Verify `gridData` is not empty

### Performance issues
- Reduce grid density (fewer cells)
- Increase debounce time for updates
- Check cell count (should be < 100)

### Tooltips not showing
- Ensure tooltip CSS is injected (automatic)
- Check browser console for style conflicts

## License

Part of the SeaMe marine forecasting application.
