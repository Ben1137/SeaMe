# Particle Visualization Customization Guide

## Overview
This guide explains how to customize the particle colors, sizes, and behaviors in your SeaYou map.

## Color Customization

### Using Windy-Style Color Gradients

The `particleConfig.ts` includes pre-defined Windy-style color gradients. To use them:

**For Wind Particles:**
```typescript
import { WINDY_COLOR_GRADIENTS } from '../utils/particleConfig';

<VelocityLayer
  data={velocityData}
  type="wind"
  colorScale={WINDY_COLOR_GRADIENTS.wind} // ← Add this
  // ... other props
/>
```

**For Current Particles:**
```typescript
<VelocityLayer
  data={velocityData}
  type="currents"
  colorScale={WINDY_COLOR_GRADIENTS.current} // ← Add this
  // ... other props
/>
```

**For Wave Heatmap:**
The wave heatmap uses a custom color function. To change it, edit `getWindyWaveColor()` in `utils/colorScales.ts`.

### Creating Custom Color Gradients

Colors are arrays of RGBA strings from slow → fast speeds:

```typescript
const myCustomGradient = [
  'rgba(0, 255, 0, 0.85)',    // Slow - Green
  'rgba(255, 255, 0, 0.85)',  // Medium - Yellow
  'rgba(255, 0, 0, 0.85)',    // Fast - Red
];

<VelocityLayer
  colorScale={myCustomGradient}
  // ... other props
/>
```

## Particle Size Customization

### Making Particles Bigger or Smaller

Edit `UNIFIED_PARTICLE_CONFIG` in `particleConfig.ts`:

```typescript
export const UNIFIED_PARTICLE_CONFIG = {
  particleAge: 64,
  particleMultiplier: 0.003,
  lineWidth: 2.5,          // ← Increase for thicker arrows
  velocityScale: 0.008,    // ← Increase for longer arrows
  frameRate: 15,
  opacity: 0.85,
};
```

**Effect of each parameter:**
- `lineWidth`: Thickness of particle trails (1.0-5.0 typical)
- `velocityScale`: Length of arrows relative to speed (0.001-0.02 typical)
- `particleMultiplier`: Density of particles (0.001-0.01 typical)
- `particleAge`: How long particles live (30-100 typical)

### Different Sizes for Wind vs Currents (Not Recommended)

If you want different sizes (breaks the Windy-style consistency):

```typescript
// In MapComponent.tsx

// Wind - Larger particles
<VelocityLayer
  type="wind"
  lineWidth={3.0}
  velocityScale={0.01}
  // ... other props
/>

// Currents - Smaller particles
<VelocityLayer
  type="currents"
  lineWidth={1.5}
  velocityScale={0.005}
  // ... other props
/>
```

## Land Mask Customization

### Changing Land Color

Edit `LAND_MASK_CONFIG` in `particleConfig.ts`:

```typescript
export const LAND_MASK_CONFIG = {
  color: '#2a2a2c',   // ← Lighter gray
  opacity: 0.85,      // ← More transparent
};
```

**Popular land colors:**
- `'#3a3a3c'` - Windy-style dark gray (default)
- `'#2a2a2c'` - Lighter dark gray
- `'#4a4a4c'` - Even lighter gray
- `'#1a1a1c'` - Nearly black
- `'transparent'` - No land mask (not recommended)

### Hiding Land Mask (Show Particles Over Land)

In `MapComponent.tsx`, change the LandMaskLayer visibility:

```typescript
<LandMaskLayer
  map={mapInstance.current}
  visible={false}  // ← Disable land mask
  // ... other props
/>
```

## Base Map Customization

### Using Different Dark Tiles

Edit `DARK_MAP_CONFIG` in `particleConfig.ts`:

```typescript
export const DARK_MAP_CONFIG = {
  // Option 1: Darker CartoDB
  tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',

  // Option 2: Stamen Toner (very dark)
  // tileUrl: 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',

  // Option 3: Custom dark
  // tileUrl: 'https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png',

  attribution: '...',
  opacity: 0.4,
  backgroundColor: '#1a1a1c',
};
```

### Lighter/Darker Background

```typescript
export const DARK_MAP_CONFIG = {
  // ... tile config
  backgroundColor: '#0a0a0c',  // ← Darker (nearly black)
  // or
  backgroundColor: '#2a2a2c',  // ← Lighter (more gray)
};
```

## Performance Tuning

### Reducing Particle Count (Better Performance)

```typescript
export const UNIFIED_PARTICLE_CONFIG = {
  particleAge: 48,            // ← Shorter lifetime
  particleMultiplier: 0.001,  // ← Fewer particles
  lineWidth: 1.5,
  velocityScale: 0.005,
  frameRate: 10,              // ← Lower FPS
  opacity: 0.85,
};
```

### Increasing Particle Count (Better Visual)

```typescript
export const UNIFIED_PARTICLE_CONFIG = {
  particleAge: 80,            // ← Longer lifetime
  particleMultiplier: 0.005,  // ← More particles
  lineWidth: 1.5,
  velocityScale: 0.005,
  frameRate: 20,              // ← Higher FPS
  opacity: 0.85,
};
```

## Zoom-Based Particle Density (Advanced)

For better performance, adjust particle count based on zoom level:

```typescript
// In MapComponent.tsx
const [currentZoom, setCurrentZoom] = useState(8);

useEffect(() => {
  if (mapInstance.current) {
    const handleZoom = () => {
      setCurrentZoom(mapInstance.current!.getZoom());
    };
    mapInstance.current.on('zoomend', handleZoom);
    return () => mapInstance.current?.off('zoomend', handleZoom);
  }
}, []);

// Calculate particle multiplier based on zoom
const particleMultiplier = currentZoom > 10
  ? 0.005  // More particles when zoomed in
  : 0.001; // Fewer particles when zoomed out

<VelocityLayer
  particleMultiplier={particleMultiplier}
  // ... other props
/>
```

## Wave Heatmap Ocean Detection Tuning

### More Aggressive Ocean Detection (Less Coverage)

In `SmoothWaveHeatmap.tsx`:

```typescript
const OCEAN_THRESHOLD = 0.3; // ← Higher (was 0.2)

// In getInterpolatedValue():
if (oceanCount < 4) {  // ← Require ALL corners (was 3)
  return null;
}
```

### Less Aggressive (More Coverage)

```typescript
const OCEAN_THRESHOLD = 0.1; // ← Lower (was 0.2)

// In getInterpolatedValue():
if (oceanCount < 2) {  // ← Allow partial (was 3)
  return null;
}
```

## Quick Reference

### Particle Size Comparison
| lineWidth | velocityScale | Appearance |
|-----------|---------------|------------|
| 1.0 | 0.003 | Very thin, short |
| 1.5 | 0.005 | Default (Windy-style) |
| 2.5 | 0.008 | Thick, medium |
| 4.0 | 0.015 | Very thick, long |

### Performance Impact
| Setting | Low Impact | Medium Impact | High Impact |
|---------|------------|---------------|-------------|
| particleMultiplier | 0.001 | 0.003 | 0.01 |
| particleAge | 30 | 64 | 100 |
| frameRate | 10 | 15 | 30 |

## Examples

### "Calm" Style (Subtle)
```typescript
{
  particleAge: 40,
  particleMultiplier: 0.001,
  lineWidth: 1.0,
  velocityScale: 0.003,
  frameRate: 10,
  opacity: 0.6,
}
```

### "Intense" Style (Bold)
```typescript
{
  particleAge: 80,
  particleMultiplier: 0.008,
  lineWidth: 3.0,
  velocityScale: 0.012,
  frameRate: 20,
  opacity: 0.95,
}
```

### "Performance" Style (Fast)
```typescript
{
  particleAge: 30,
  particleMultiplier: 0.0005,
  lineWidth: 1.0,
  velocityScale: 0.005,
  frameRate: 8,
  opacity: 0.7,
}
```

Remember: After making changes, clear your browser cache and hard refresh (Ctrl+Shift+R) to see the updates!
