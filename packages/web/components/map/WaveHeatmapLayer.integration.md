# WaveHeatmapLayer Integration Guide

Quick guide for integrating WaveHeatmapLayer into MapComponent.tsx

## Quick Integration Steps

### 1. Import the Component

```typescript
import { WaveHeatmapLayer, createGridDataFromForecasts } from './map/WaveHeatmapLayer';
import type { GridCell } from './map/WaveHeatmapLayer';
```

### 2. Add State

```typescript
const [waveGridData, setWaveGridData] = useState<GridCell[]>([]);
const [showWaveHeatmap, setShowWaveHeatmap] = useState(false);
```

### 3. Add to Existing Layer Type

```typescript
type MapLayer = 'NONE' | 'WIND' | 'WAVE' | 'SWELL' | 'CURRENTS' | 'WAVE_HEATMAP';
```

### 4. Add Update Function

```typescript
const updateWaveHeatmap = async () => {
  if (!mapInstance.current || activeLayer !== 'WAVE_HEATMAP') return;

  const bounds = mapInstance.current.getBounds();
  const gridPoints: Coordinate[] = [];
  const cols = 8, rows = 8;
  const lngStep = (bounds.getEast() - bounds.getWest()) / cols;
  const latStep = (bounds.getNorth() - bounds.getSouth()) / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      gridPoints.push({
        lat: bounds.getNorth() - latStep * (r + 0.5),
        lng: bounds.getWest() + lngStep * (c + 0.5)
      });
    }
  }

  try {
    const forecasts = await fetchBulkPointForecast(gridPoints);
    const grid = createGridDataFromForecasts(forecasts);
    setWaveGridData(grid);
  } catch (error) {
    console.error('Failed to fetch wave heatmap:', error);
  }
};
```

### 5. Add Effect Hook

```typescript
useEffect(() => {
  if (activeLayer === 'WAVE_HEATMAP') {
    updateWaveHeatmap();
  }
}, [activeLayer]);

// Update on map move
useEffect(() => {
  if (!mapInstance.current) return;

  let timeoutId: ReturnType<typeof setTimeout>;
  const handleMove = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (activeLayer === 'WAVE_HEATMAP') {
        updateWaveHeatmap();
      }
    }, 500);
  };

  mapInstance.current.on('moveend', handleMove);
  return () => {
    clearTimeout(timeoutId);
    mapInstance.current?.off('moveend', handleMove);
  };
}, [activeLayer]);
```

### 6. Add UI Button

In your layer controls panel:

```typescript
<button
  onClick={() => setActiveLayer('WAVE_HEATMAP')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeLayer === 'WAVE_HEATMAP' ? 'bg-purple-600 text-primary' : 'text-muted hover:bg-hover'
  }`}
>
  <Waves size={12} /> {t('map.waveHeatmap')}
</button>
```

### 7. Render Component

Add after the map container:

```typescript
<WaveHeatmapLayer
  gridData={waveGridData}
  visible={activeLayer === 'WAVE_HEATMAP'}
  opacity={0.7}
/>
```

## Translation Keys

Add to your translation files:

```json
{
  "map": {
    "waveHeatmap": "Wave Heatmap"
  }
}
```

## Complete Minimal Example

```typescript
// State
const [waveGridData, setWaveGridData] = useState<GridCell[]>([]);

// Update function
const updateWaveHeatmap = async () => {
  const forecasts = await fetchBulkPointForecast(gridPoints);
  setWaveGridData(createGridDataFromForecasts(forecasts));
};

// Effect
useEffect(() => {
  if (activeLayer === 'WAVE_HEATMAP') updateWaveHeatmap();
}, [activeLayer]);

// Render
<WaveHeatmapLayer
  gridData={waveGridData}
  visible={activeLayer === 'WAVE_HEATMAP'}
/>
```

That's it! The heatmap will now appear when the layer is activated.
