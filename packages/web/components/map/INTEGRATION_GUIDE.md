# Integration Guide: Adding ColorScaleLegend to MapComponent

This guide shows you exactly how to add the ColorScaleLegend to your existing `MapComponent.tsx`.

## Quick Integration

### Step 1: Import the Component

Add this import at the top of `MapComponent.tsx`:

```tsx
import { ColorScaleLegend, ColorScaleItem } from './map';
```

### Step 2: Define Color Scales

Add these scale definitions before your component (or inside it). These match the colors already used in your `getWaveColor()` and `getWindColor()` helper functions:

```tsx
// Define color scales matching your existing color schemes
const WAVE_HEIGHT_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },      // Blue-300
  { value: 0.5, color: '#3b82f6' },                // Blue-500
  { value: 1.0, color: '#34d399' },                // Emerald-400
  { value: 2.0, color: '#facc15' },                // Yellow-400
  { value: 3.0, color: '#ef4444', label: '3+' }   // Red-500
];

const WIND_SPEED_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#60a5fa', label: '0' },      // Blue-400
  { value: 10, color: '#22d3ee' },                 // Cyan-400
  { value: 20, color: '#4ade80' },                 // Green-400
  { value: 30, color: '#facc15' },                 // Yellow-400
  { value: 50, color: '#f87171', label: '50+' }   // Red-400
];

const CURRENT_SPEED_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.2, color: '#22d3ee' },
  { value: 0.5, color: '#34d399' },
  { value: 1.0, color: '#facc15' },
  { value: 1.5, color: '#ef4444', label: '1.5+' }
];

const SWELL_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.5, color: '#3b82f6' },
  { value: 1.0, color: '#34d399' },
  { value: 2.0, color: '#facc15' },
  { value: 3.0, color: '#ef4444', label: '3+' }
];
```

### Step 3: Add Legend to JSX

Add the legend component right before the closing `</div>` of your main map container (around line 680):

```tsx
return (
  <div className="relative h-full w-full bg-card overflow-hidden">
    {/* Map Container */}
    <div ref={mapContainer} className="absolute inset-0 z-0" />

    {/* Map Layer Controls */}
    <div className="absolute top-4 right-4 z-[400] ...">
      {/* Your existing layer controls */}
    </div>

    {/* ... all your existing sidebars and UI ... */}

    {/* ADD LEGENDS HERE - Right before closing div */}

    {/* Wind Layer Legend */}
    {activeLayer === 'WIND' && (
      <ColorScaleLegend
        scale={WIND_SPEED_SCALE}
        unit={t('units.kmh')}
        title={t('map.legend.windSpeed')}
        position="bottomright"
      />
    )}

    {/* Wave Layer Legends */}
    {(activeLayer === 'WAVE' || activeLayer === 'SIGNIFICANT_WAVE') && (
      <ColorScaleLegend
        scale={WAVE_HEIGHT_SCALE}
        unit={t('units.meters')}
        title={t('map.legend.waveHeight')}
        position="bottomright"
      />
    )}

    {/* Wind Wave Legend */}
    {activeLayer === 'WIND_WAVE' && (
      <ColorScaleLegend
        scale={WAVE_HEIGHT_SCALE}
        unit={t('units.meters')}
        title={t('map.legend.windWaveHeight')}
        position="bottomright"
      />
    )}

    {/* Swell Legend */}
    {activeLayer === 'SWELL' && (
      <ColorScaleLegend
        scale={SWELL_SCALE}
        unit={t('units.meters')}
        title={t('map.legend.swellHeight')}
        position="bottomright"
      />
    )}

    {/* Currents Legend */}
    {activeLayer === 'CURRENTS' && (
      <ColorScaleLegend
        scale={CURRENT_SPEED_SCALE}
        unit="m/s"
        title={t('map.legend.currentVelocity')}
        position="bottomright"
      />
    )}
  </div>
);
```

## Advanced Integration: Dynamic Positioning

If you want the legend to automatically move when sidebars are open:

```tsx
// Calculate legend position based on open sidebars
const getLegendPosition = (): 'topleft' | 'topright' | 'bottomleft' | 'bottomright' => {
  if (isSidebarOpen) return 'bottomright'; // Route sidebar is left, so keep legend on right
  if (isDetailSidebarOpen) return 'bottomleft'; // Detail sidebar is right, move legend left
  return 'bottomright'; // Default position
};

// Then use it:
{activeLayer === 'WIND' && (
  <ColorScaleLegend
    scale={WIND_SPEED_SCALE}
    unit={t('units.kmh')}
    title={t('map.legend.windSpeed')}
    position={getLegendPosition()}
  />
)}
```

## Complete Example Code

Here's a complete snippet showing the legend integration:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { ColorScaleLegend, ColorScaleItem } from './map';
// ... your other imports

// Color scale definitions
const WAVE_HEIGHT_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.5, color: '#3b82f6' },
  { value: 1.0, color: '#34d399' },
  { value: 2.0, color: '#facc15' },
  { value: 3.0, color: '#ef4444', label: '3+' }
];

const WIND_SPEED_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#60a5fa', label: '0' },
  { value: 10, color: '#22d3ee' },
  { value: 20, color: '#4ade80' },
  { value: 30, color: '#facc15' },
  { value: 50, color: '#f87171', label: '50+' }
];

const MapComponent: React.FC<MapComponentProps> = ({ currentLocation }) => {
  const { t } = useTranslation();
  // ... your existing state and refs
  const [activeLayer, setActiveLayer] = useState<MapLayer>('NONE');

  // ... all your existing code ...

  return (
    <div className="relative h-full w-full bg-card overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Map Layer Controls */}
      <div className="absolute top-4 right-4 z-[400] ...">
        {/* Your layer buttons */}
      </div>

      {/* Route Sidebar */}
      {isSidebarOpen && (
        <div className="absolute top-0 left-0 bottom-0 w-80 ...">
          {/* Your route sidebar content */}
        </div>
      )}

      {/* Detail Sidebar */}
      {isDetailSidebarOpen && (
        <div className="absolute top-0 right-0 bottom-0 w-96 ...">
          {/* Your detail sidebar content */}
        </div>
      )}

      {/* Color Scale Legends - ADD THESE */}
      {activeLayer === 'WIND' && (
        <ColorScaleLegend
          scale={WIND_SPEED_SCALE}
          unit={t('units.kmh')}
          title={t('map.legend.windSpeed')}
          position="bottomright"
        />
      )}

      {(activeLayer === 'WAVE' || activeLayer === 'SIGNIFICANT_WAVE') && (
        <ColorScaleLegend
          scale={WAVE_HEIGHT_SCALE}
          unit={t('units.meters')}
          title={t('map.legend.waveHeight')}
          position="bottomright"
        />
      )}

      {activeLayer === 'SWELL' && (
        <ColorScaleLegend
          scale={WAVE_HEIGHT_SCALE}
          unit={t('units.meters')}
          title={t('map.legend.swellHeight')}
          position="bottomright"
        />
      )}

      {activeLayer === 'CURRENTS' && (
        <ColorScaleLegend
          scale={[
            { value: 0, color: '#93c5fd', label: '0' },
            { value: 0.2, color: '#22d3ee' },
            { value: 0.5, color: '#34d399' },
            { value: 1.0, color: '#facc15' },
            { value: 1.5, color: '#ef4444', label: '1.5+' }
          ]}
          unit="m/s"
          title={t('map.legend.currentVelocity')}
          position="bottomright"
        />
      )}
    </div>
  );
};

export default MapComponent;
```

## Positioning Tips

1. **Default Position**: `bottomright` works well for most cases
2. **With Left Sidebar Open**: Keep legend on `bottomright`
3. **With Right Sidebar Open**: Move to `bottomleft` to avoid overlap
4. **Mobile**: Consider `bottomleft` or `bottomright` based on controls

## Styling Customization

The legend automatically uses your app's theme variables, but you can customize with the `className` prop:

```tsx
<ColorScaleLegend
  scale={WIND_SPEED_SCALE}
  unit={t('units.kmh')}
  title={t('map.legend.windSpeed')}
  position="bottomright"
  className="mb-4" // Add extra bottom margin
/>
```

## Testing Checklist

After integration, test:

- [ ] Legend appears when layer is activated
- [ ] Legend disappears when layer is deactivated
- [ ] Colors match your map markers
- [ ] Position doesn't overlap controls
- [ ] Works in Hebrew (RTL layout)
- [ ] Works in English (LTR layout)
- [ ] Responsive on mobile
- [ ] Smooth transitions when switching layers

## Troubleshooting

### Legend not showing
- Check that `activeLayer` state matches the condition
- Verify import path is correct
- Check z-index doesn't conflict with other elements

### Colors don't match markers
- Use the exact same color values in both places
- Double-check hex codes match your `getWaveColor()` functions

### Overlaps with sidebar
- Adjust position based on which sidebars are open
- Use the dynamic positioning example above

### RTL issues
- The component handles RTL automatically
- Make sure i18next is configured correctly
- Test with Hebrew translations

## Next Steps

1. Copy the color scale definitions to your MapComponent
2. Add the import statement
3. Add legend conditionals before the closing div
4. Test with each layer type
5. Adjust positioning as needed
6. Deploy and enjoy!

For more examples, see `ColorScaleLegend.example.tsx`.
