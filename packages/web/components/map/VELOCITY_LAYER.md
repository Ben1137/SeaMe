# VelocityLayer Component

A production-ready React component for rendering animated particle visualizations of wind and ocean current data using the leaflet-velocity library.

## Features

- Particle-based animation for wind and ocean currents
- Dynamic visibility toggling
- Real-time data updates
- Customizable styling and performance options
- Full TypeScript support with comprehensive type definitions
- Automatic cleanup on unmount
- Integration with Leaflet maps

## Installation

First, ensure you have the required dependencies installed:

```bash
npm install leaflet leaflet-velocity
# or
pnpm add leaflet leaflet-velocity
```

## Basic Usage

```tsx
import { useRef, useEffect, useState } from 'react';
import * as L from 'leaflet';
import { VelocityLayer } from './components/map/VelocityLayer';

function MyMapComponent() {
  const mapRef = useRef<L.Map | null>(null);
  const [velocityData, setVelocityData] = useState<L.VelocityData | null>(null);

  useEffect(() => {
    // Initialize your Leaflet map
    const map = L.map('map').setView([40.7128, -74.0060], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    // Load your velocity data
    loadVelocityData();
  }, []);

  async function loadVelocityData() {
    // Fetch your wind/current data
    const data = await fetchMyVelocityData();
    setVelocityData(data);
  }

  return (
    <div>
      <div id="map" style={{ height: '600px', width: '100%' }} />
      <VelocityLayer
        data={velocityData}
        type="wind"
        visible={true}
        map={mapRef.current}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `L.VelocityData \| null` | Yes | - | Velocity field data in leaflet-velocity format |
| `type` | `'wind' \| 'currents'` | Yes | - | Type of velocity data being displayed |
| `visible` | `boolean` | Yes | - | Whether the layer should be visible |
| `map` | `L.Map \| null` | Yes | - | Leaflet map instance |
| `maxVelocity` | `number` | No | 15 (wind), 2 (currents) | Maximum velocity for color scaling |
| `minVelocity` | `number` | No | 0 | Minimum velocity threshold |
| `velocityScale` | `number` | No | 0.005 | Particle animation scale |
| `particleMultiplier` | `number` | No | 1/5000 | Number of particles (fraction of screen pixels) |
| `opacity` | `number` | No | 0.97 | Layer opacity (0-1) |
| `colorScale` | `string[]` | No | - | Custom color scale (array of CSS colors) |
| `frameRate` | `number` | No | 15 | Animation frame rate |

## Data Format

The `data` prop expects velocity data in the leaflet-velocity format, which consists of two components (U and V):

```typescript
interface VelocityData {
  [0]: {
    header: {
      parameterCategory: number;
      parameterNumber: number;
      dx: number;              // Grid spacing in longitude
      dy: number;              // Grid spacing in latitude
      nx: number;              // Number of grid points in x
      ny: number;              // Number of grid points in y
      la1: number;             // North latitude
      la2: number;             // South latitude
      lo1: number;             // West longitude
      lo2: number;             // East longitude
      refTime?: string;        // Reference time (ISO format)
    };
    data: number[];            // U component (east-west velocity)
  };
  [1]: {
    header: {
      // Same as above
    };
    data: number[];            // V component (north-south velocity)
  };
}
```

### Example Data Structure

```typescript
const windData: L.VelocityData = {
  0: {
    header: {
      parameterCategory: 2,
      parameterNumber: 2,
      dx: 0.5,
      dy: 0.5,
      nx: 100,
      ny: 100,
      la1: 45.0,
      la2: 35.0,
      lo1: -80.0,
      lo2: -70.0,
      refTime: '2025-01-15T12:00:00Z',
    },
    data: [/* U component values */],
  },
  1: {
    header: {
      parameterCategory: 2,
      parameterNumber: 3,
      dx: 0.5,
      dy: 0.5,
      nx: 100,
      ny: 100,
      la1: 45.0,
      la2: 35.0,
      lo1: -80.0,
      lo2: -70.0,
      refTime: '2025-01-15T12:00:00Z',
    },
    data: [/* V component values */],
  },
};
```

## Advanced Usage

### Custom Color Scale

```tsx
const customColorScale = [
  'rgba(0, 0, 255, 0.7)',      // Blue - slow
  'rgba(0, 255, 255, 0.7)',    // Cyan
  'rgba(0, 255, 0, 0.7)',      // Green
  'rgba(255, 255, 0, 0.7)',    // Yellow
  'rgba(255, 0, 0, 0.7)',      // Red - fast
];

<VelocityLayer
  data={data}
  type="wind"
  visible={true}
  map={map}
  colorScale={customColorScale}
/>
```

### Dynamic Visibility Toggle

```tsx
function MapWithToggle() {
  const [showWind, setShowWind] = useState(false);

  return (
    <>
      <button onClick={() => setShowWind(!showWind)}>
        Toggle Wind Layer
      </button>
      <VelocityLayer
        data={windData}
        type="wind"
        visible={showWind}
        map={mapRef.current}
      />
    </>
  );
}
```

### Performance Tuning

```tsx
<VelocityLayer
  data={data}
  type="currents"
  visible={true}
  map={map}
  particleMultiplier={1 / 10000}  // Fewer particles for better performance
  frameRate={10}                   // Lower frame rate for better performance
  velocityScale={0.01}             // Adjust particle speed
/>
```

### Multiple Layers

```tsx
function MultiLayerMap() {
  const [activeLayer, setActiveLayer] = useState<'wind' | 'currents' | 'none'>('none');

  return (
    <>
      <VelocityLayer
        data={windData}
        type="wind"
        visible={activeLayer === 'wind'}
        map={map}
      />
      <VelocityLayer
        data={currentData}
        type="currents"
        visible={activeLayer === 'currents'}
        map={map}
      />
    </>
  );
}
```

## Integration with Open-Meteo

To fetch velocity data from Open-Meteo or similar APIs:

```typescript
async function fetchWindVelocityData(
  lat: number,
  lon: number,
  gridSize: number = 50
): Promise<L.VelocityData> {
  // Example: Fetch from your API
  const response = await fetch(`/api/wind?lat=${lat}&lon=${lon}&grid=${gridSize}`);
  const apiData = await response.json();

  // Transform to velocity data format
  return {
    0: {
      header: {
        parameterCategory: 2,
        parameterNumber: 2,
        dx: apiData.dx,
        dy: apiData.dy,
        nx: apiData.nx,
        ny: apiData.ny,
        la1: apiData.latMax,
        la2: apiData.latMin,
        lo1: apiData.lonMin,
        lo2: apiData.lonMax,
        refTime: apiData.timestamp,
      },
      data: apiData.uComponent,
    },
    1: {
      header: {
        parameterCategory: 2,
        parameterNumber: 3,
        dx: apiData.dx,
        dy: apiData.dy,
        nx: apiData.nx,
        ny: apiData.ny,
        la1: apiData.latMax,
        la2: apiData.latMin,
        lo1: apiData.lonMin,
        lo2: apiData.lonMax,
        refTime: apiData.timestamp,
      },
      data: apiData.vComponent,
    },
  };
}
```

## TypeScript Support

The component includes comprehensive TypeScript type definitions:

```typescript
import type { VelocityLayerProps } from './components/map/VelocityLayer';
import type * as L from 'leaflet';

// All types are exported and can be used in your code
const props: VelocityLayerProps = {
  data: myVelocityData,
  type: 'wind',
  visible: true,
  map: myMap,
};
```

## Browser Compatibility

The component works in all modern browsers that support:
- ES6+ JavaScript
- Canvas API
- Leaflet 1.7+

## Performance Considerations

1. **Particle Count**: Adjust `particleMultiplier` based on device performance
   - Desktop: `1/5000` (default)
   - Mobile: `1/10000` or lower

2. **Frame Rate**: Lower frame rates improve performance
   - Default: 15 fps
   - Mobile: 10 fps or lower

3. **Grid Resolution**: Use appropriate grid sizes
   - High detail: 100x100 or more
   - Good performance: 50x50
   - Mobile: 30x30 or less

4. **Data Updates**: Debounce or throttle frequent data updates

## Troubleshooting

### Layer not visible
- Ensure `visible` prop is `true`
- Verify `map` prop is a valid Leaflet map instance
- Check that `data` is not `null`
- Confirm leaflet-velocity CSS is loaded

### Performance issues
- Reduce `particleMultiplier`
- Lower `frameRate`
- Use smaller grid sizes
- Reduce `opacity` for less rendering overhead

### TypeScript errors
- Ensure `@types/leaflet` is installed
- Import types from the module declaration in VelocityLayer.tsx
- Check that your data matches the `VelocityData` interface

## Examples

See `VelocityLayer.example.tsx` for complete working examples including:
- Basic wind layer
- Custom styled currents
- Dynamic data updates
- Integration with existing maps
- Sample data generation

## License

This component is part of the SeaMe project. See the main project LICENSE for details.

## Contributing

Contributions are welcome! Please ensure:
- TypeScript types are updated
- Examples are provided for new features
- Performance impact is considered
- Documentation is updated
