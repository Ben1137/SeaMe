# ColorScaleLegend Component

A beautiful, professional vertical color scale legend component for map overlays. Inspired by Israeli Meteorological Service and Windy.com, with full support for dark theme and RTL languages (Hebrew).

## Features

- Vertical gradient bar with smooth color transitions
- Automatic value sorting (highest to lowest)
- Customizable positioning (4 corners)
- Responsive design optimized for mobile
- Full Hebrew/English RTL support via i18next
- Beautiful dark theme styling matching the app
- Glass morphism effects and smooth animations
- Professional tick marks and value labels

## Installation

The component is already available in your project at:
```
packages/web/components/map/ColorScaleLegend.tsx
```

## Basic Usage

```tsx
import { ColorScaleLegend } from './components/map';

function MyMapComponent() {
  const waveScale = [
    { value: 0, color: '#93c5fd', label: '0' },
    { value: 0.5, color: '#3b82f6' },
    { value: 1.0, color: '#34d399' },
    { value: 2.0, color: '#facc15' },
    { value: 3.0, color: '#ef4444', label: '3+' }
  ];

  return (
    <div className="relative h-screen">
      {/* Your map component */}

      <ColorScaleLegend
        scale={waveScale}
        unit="m"
        title="Wave Height"
        position="bottomright"
      />
    </div>
  );
}
```

## Props

### `ColorScaleLegendProps`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `scale` | `ColorScaleItem[]` | Yes | - | Array of color scale items defining the gradient |
| `unit` | `string` | Yes | - | Unit of measurement (e.g., "m", "km/h", "°C") |
| `title` | `string` | Yes | - | Title displayed at the top of the legend |
| `position` | `'topleft' \| 'topright' \| 'bottomleft' \| 'bottomright'` | No | `'bottomright'` | Position on the screen |
| `className` | `string` | No | `''` | Additional CSS classes |

### `ColorScaleItem`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `value` | `number` | Yes | Numeric value for this color stop |
| `color` | `string` | Yes | CSS color (hex, rgb, rgba, etc.) |
| `label` | `string` | No | Optional custom label (if not provided, uses value) |

## Complete Examples

### Wind Speed Legend

```tsx
import { ColorScaleLegend } from './components/map';
import { useTranslation } from 'react-i18next';

function WindMap() {
  const { t } = useTranslation();

  const windScale = [
    { value: 0, color: '#60a5fa' },
    { value: 10, color: '#22d3ee' },
    { value: 20, color: '#4ade80' },
    { value: 30, color: '#facc15' },
    { value: 50, color: '#f87171' }
  ];

  return (
    <div className="relative h-screen">
      <ColorScaleLegend
        scale={windScale}
        unit={t('units.kmh')}
        title={t('map.wind')}
        position="topright"
      />
    </div>
  );
}
```

### Wave Height with Custom Labels

```tsx
const waveScale = [
  { value: 0, color: '#93c5fd', label: 'Calm' },
  { value: 0.5, color: '#3b82f6', label: '0.5m' },
  { value: 1.0, color: '#34d399', label: '1m' },
  { value: 2.0, color: '#facc15', label: '2m' },
  { value: 3.0, color: '#ef4444', label: 'High' }
];

<ColorScaleLegend
  scale={waveScale}
  unit="meters"
  title="Significant Wave Height"
  position="bottomleft"
/>
```

### Temperature with Many Stops

```tsx
const tempScale = [
  { value: -5, color: '#0ea5e9' },
  { value: 0, color: '#38bdf8' },
  { value: 5, color: '#7dd3fc' },
  { value: 10, color: '#34d399' },
  { value: 15, color: '#4ade80' },
  { value: 20, color: '#facc15' },
  { value: 25, color: '#fb923c' },
  { value: 30, color: '#f87171' },
  { value: 35, color: '#dc2626' }
];

<ColorScaleLegend
  scale={tempScale}
  unit="°C"
  title="Sea Temperature"
  position="topleft"
/>
```

### Ocean Currents

```tsx
const currentScale = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.2, color: '#22d3ee' },
  { value: 0.5, color: '#34d399' },
  { value: 1.0, color: '#facc15' },
  { value: 1.5, color: '#ef4444', label: '1.5+' }
];

<ColorScaleLegend
  scale={currentScale}
  unit="m/s"
  title="Current Velocity"
  position="bottomright"
/>
```

## Integration with MapComponent

Here's how to integrate it with your existing map:

```tsx
import React, { useState } from 'react';
import MapComponent from './components/MapComponent';
import { ColorScaleLegend } from './components/map';

type MapLayer = 'NONE' | 'WIND' | 'WAVE' | 'SWELL' | 'CURRENTS';

function EnhancedMap() {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('NONE');

  const getWaveScale = () => [
    { value: 0, color: '#93c5fd' },
    { value: 0.5, color: '#3b82f6' },
    { value: 1.0, color: '#34d399' },
    { value: 2.0, color: '#facc15' },
    { value: 3.0, color: '#ef4444' }
  ];

  const getWindScale = () => [
    { value: 0, color: '#60a5fa' },
    { value: 10, color: '#22d3ee' },
    { value: 20, color: '#4ade80' },
    { value: 30, color: '#facc15' },
    { value: 50, color: '#f87171' }
  ];

  return (
    <div className="relative h-full w-full">
      <MapComponent currentLocation={{ lat: 32.0, lng: 34.8 }} />

      {activeLayer === 'WAVE' && (
        <ColorScaleLegend
          scale={getWaveScale()}
          unit="m"
          title="Wave Height"
          position="bottomright"
        />
      )}

      {activeLayer === 'WIND' && (
        <ColorScaleLegend
          scale={getWindScale()}
          unit="km/h"
          title="Wind Speed"
          position="bottomright"
        />
      )}
    </div>
  );
}
```

## Styling

The component uses your app's existing CSS variables for theming:

- `--app-bg-card`: Background color
- `--app-border`: Border color
- `--app-border-subtle`: Subtle border color
- `--app-bg-elevated`: Elevated background
- `--text-primary`: Primary text color
- `--text-muted`: Muted text color
- `--text-accent`: Accent color

It automatically adapts to light/dark themes via these CSS variables.

## RTL Support

The component automatically detects Hebrew language and applies RTL layout:

```tsx
// In Hebrew mode, the component will automatically flip
// No additional configuration needed
<ColorScaleLegend
  scale={waveScale}
  unit="מטר"
  title="גובה גלים"
  position="bottomright"
/>
```

## Mobile Responsiveness

The component is designed to work on mobile devices:
- Compact size (140px min width)
- Touch-friendly spacing
- Optimized z-index (450) to stay above map but below modals
- Smooth animations

## Best Practices

1. **Keep scale items to 5-7 stops** for readability
2. **Use consistent color schemes** across similar data types
3. **Position legends** where they won't overlap important map controls
4. **Use descriptive titles** that match your layer names
5. **Provide custom labels** for extreme values (e.g., "3+" instead of "3")
6. **Match colors** with your map markers/overlays exactly

## Accessibility

- Uses semantic HTML
- High contrast text on dark backgrounds
- Clear visual hierarchy
- Proper z-index layering

## Browser Support

Works in all modern browsers that support:
- CSS Grid and Flexbox
- CSS Gradients
- CSS Custom Properties (CSS Variables)
- Backdrop filter (for blur effect)
