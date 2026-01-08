# Wave Heatmap Layer - Visual Guide

## Component Overview

The WaveHeatmapLayer renders wave height data as a grid of colored rectangles on a Leaflet map, providing an intuitive visualization of wave conditions across a region.

## Visual Appearance

```
┌─────────────────────────────────────────┐
│                                         │
│   [Map Background - OpenStreetMap]      │
│                                         │
│     ┌──┬──┬──┬──┐                      │
│     │🟦│🔵│🟢│🟡│  ← Grid cells         │
│     ├──┼──┼──┼──┤    colored by        │
│     │🔵│🟢│🟡│🟠│    wave height        │
│     ├──┼──┼──┼──┤                      │
│     │🟢│🟡│🟠│🔴│                      │
│     └──┴──┴──┴──┘                      │
│                                         │
│   [Other map elements]                  │
│                                         │
└─────────────────────────────────────────┘
```

## Color Scale

The component uses a 6-level color scale based on wave height:

| Wave Height | Color | Hex Code | Description |
|-------------|-------|----------|-------------|
| < 0.5m | 🟦 Light Blue | `#93c5fd` | Calm conditions |
| 0.5 - 1.0m | 🔵 Blue | `#3b82f6` | Light waves |
| 1.0 - 2.0m | 🟢 Emerald | `#34d399` | Moderate waves |
| 2.0 - 3.0m | 🟡 Yellow | `#facc15` | Rough conditions |
| 3.0 - 4.0m | 🟠 Orange | `#fb923c` | Very rough |
| ≥ 4.0m | 🔴 Red | `#ef4444` | High waves |

## Interactive Elements

### Hover Tooltip
When you hover over a grid cell, a tooltip appears showing the exact wave height:

```
     ┌─────────┐
     │  2.3m   │  ← Tooltip
     └────┬────┘
          │
     ┌────▼────┐
     │   🟡   │  ← Grid cell
     └─────────┘
```

**Tooltip Styling:**
- Dark background: `rgba(15, 23, 42, 0.9)`
- Blue border: `rgba(59, 130, 246, 0.5)`
- White text, bold font
- Rounded corners

## Grid Layout

### Automatic Cell Sizing
The component automatically calculates cell size based on the spacing between data points:

```
Example with 0.1° spacing:

Latitude →
32.0°  ┌────┬────┬────┐
       │ A  │ B  │ C  │
32.1°  ├────┼────┼────┤
       │ D  │ E  │ F  │
32.2°  ├────┼────┼────┤
       │ G  │ H  │ I  │
       └────┴────┴────┘
       34.5° 34.6° 34.7°
              Longitude →
```

Each cell is centered on its coordinate and sized to fill the space between adjacent cells.

## Layer Characteristics

### Visual Properties
- **Fill Opacity**: 0.7 (default, configurable)
- **Border Weight**: 0.5px
- **Border Opacity**: 0.3
- **Border Color**: Matches fill color

### Performance
- Optimized for 50-100 grid cells
- Smooth rendering and updates
- Efficient memory usage with proper cleanup

## Integration Example

### In Map Context
```
┌───────────────────────────────────────────────┐
│  Map Controls                          [×]    │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─────┐  ← Current location marker          │
│  │  •  │                                      │
│  └─────┘                                      │
│                                               │
│     Grid overlay →  ┌──┬──┬──┐               │
│                     │🟦│🔵│🟢│               │
│                     ├──┼──┼──┤               │
│                     │🔵│🟢│🟡│               │
│                     ├──┼──┼──┤               │
│                     │🟢│🟡│🟠│               │
│                     └──┴──┴──┘               │
│                                               │
│  ← Route line (if present)                    │
│                                               │
└───────────────────────────────────────────────┘
```

## Real-World Use Cases

### 1. Marine Weather Dashboard
Display current wave conditions for offshore planning.

### 2. Route Planning
Show wave heights along a planned route to identify rough sections.

### 3. Beach Conditions
Visualize wave heights near coastal areas for beach-goers.

### 4. Research & Analysis
Study wave patterns and trends over different regions.

## Accessibility

- **Color blind friendly**: Uses distinct hues and intensity levels
- **Tooltip information**: Provides exact numeric values
- **Clear borders**: Grid cells have visible boundaries even at low opacity

## Technical Implementation

### Layer Stack
```
Top Layer:    [Tooltips]
              [Grid Rectangles] ← WaveHeatmapLayer
              [Markers & Routes]
              [Map Tiles]
Bottom Layer: [Map Container]
```

### DOM Structure
```html
<div class="leaflet-container">
  <div class="leaflet-pane leaflet-map-pane">
    <!-- Base tiles -->
    <div class="leaflet-pane leaflet-overlay-pane">
      <!-- Wave heatmap layer group -->
      <svg>
        <path d="..." /> <!-- Rectangle 1 -->
        <path d="..." /> <!-- Rectangle 2 -->
        <!-- ... more rectangles ... -->
      </svg>
    </div>
    <!-- Tooltips -->
  </div>
</div>
```

## Comparison with Other Visualizations

### vs. Point Markers
- **Heatmap**: Shows continuous coverage, better for area visualization
- **Markers**: Better for discrete points, more precise locations

### vs. Contour Lines
- **Heatmap**: Easier to read at a glance, clear color coding
- **Contours**: Better for exact value transitions, professional charts

### vs. Gradient Overlays
- **Heatmap**: Grid-based, clearer cell boundaries, Israeli Met Service style
- **Gradient**: Smooth transitions, may be harder to read exact values

## Best Practices

### Do's ✅
- Use consistent grid spacing (0.1° - 0.2°)
- Provide toggle control for visibility
- Show color legend alongside map
- Debounce updates on map movement

### Don'ts ❌
- Don't render more than 100 cells at once
- Don't update on every pixel of map movement
- Don't use very high opacity (makes underlying map hard to see)
- Don't forget to set `visible={false}` when not needed

## Future Enhancements

Potential improvements for future versions:
- [ ] Animated wave height changes over time
- [ ] Custom color scales per user preference
- [ ] Click-to-select cell for detailed forecast
- [ ] Export grid data as image
- [ ] Multiple overlapping layers (wind + waves)
