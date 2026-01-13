# GeoJSON Layer Integration Plan for MapComponent

## Executive Summary

This document provides a comprehensive analysis of the existing layer control system in `MapComponent.tsx` and outlines a detailed implementation plan for adding new GeoJSON-based layer controls: Coastline, Bathymetry (with depth selection), Reefs (10m only), Ports, and Marine Areas.

---

## Part 1: Current Layer System Analysis

### 1.1 Layer Type Definitions

The MapComponent uses two separate type definitions for managing layers:

```typescript
// File: packages/web/components/MapComponent.tsx (Lines 39-40)

type MapLayer = 'NONE' | 'WIND' | 'WAVE' | 'SWELL' | 'CURRENTS' | 'WIND_WAVE' | 'SIGNIFICANT_WAVE';
type AdvancedLayer = 'NONE' | 'WIND_PARTICLES' | 'CURRENT_PARTICLES' | 'WAVE_HEATMAP';
```

**Key Observation**: The system uses a **two-tier architecture**:
- **MapLayer**: Traditional weather data overlays (grid markers)
- **AdvancedLayer**: Visualization enhancements (particles, heatmaps)

This design allows for orthogonal layer selection - users can have a MapLayer AND an AdvancedLayer active simultaneously.

### 1.2 State Management

The layer visibility is controlled by React state hooks:

```typescript
// File: packages/web/components/MapComponent.tsx (Lines 97, 108)

const [activeLayer, setActiveLayer] = useState<MapLayer>('NONE');
const [advancedLayer, setAdvancedLayer] = useState<AdvancedLayer>('NONE');
```

**Pattern Identified**:
- State is managed at the component level (not in global state/context)
- Each layer category has exactly one active option at a time
- Switching layers triggers `useEffect` hooks that fetch/update data

### 1.3 Layer Control UI Structure

The layer controls are rendered in a collapsible panel at the top-right of the map:

```typescript
// File: packages/web/components/MapComponent.tsx (Lines 662-745)

<div className="absolute top-4 right-4 z-[400] bg-elevated backdrop-blur border border-app rounded-lg shadow-xl text-xs w-36 animate-in fade-in slide-in-from-right-4 overflow-hidden">
    <button onClick={() => setIsLayersPanelExpanded(!isLayersPanelExpanded)}>
        {/* Header with Layers icon and expand/collapse chevron */}
    </button>
    <div style={{ maxHeight: isLayersPanelExpanded ? '500px' : '0' }}>
        {/* Layer buttons inside */}
    </div>
</div>
```

**UI Pattern**:
- Collapsible panel with `isLayersPanelExpanded` state
- Each layer button uses conditional styling based on active state
- Different background colors per layer type for visual distinction
- Icon + text labels with translation keys

### 1.4 Layer Button Pattern

Each layer button follows this structure:

```tsx
<button
  onClick={() => setActiveLayer('WIND')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeLayer === 'WIND'
      ? 'bg-blue-600 text-primary'
      : 'text-muted hover:bg-hover'
  }`}
>
  <Wind size={12} /> {t('map.wind')}
</button>
```

For toggle-style advanced layers:

```tsx
<button
  onClick={() => setAdvancedLayer(advancedLayer === 'WIND_PARTICLES' ? 'NONE' : 'WIND_PARTICLES')}
  className={`...`}
>
  <Wind size={12} /> Wind Particles
</button>
```

### 1.5 Layer Data Flow

1. **User clicks layer button** -> Updates state (`setActiveLayer` or `setAdvancedLayer`)
2. **useEffect triggers** -> Calls data fetch function (`updateWeatherGrid` or `updateAdvancedLayer`)
3. **Data is processed** -> Grid points are converted to markers or visualization data
4. **Rendering** -> Either via `renderGridMarkers()` or specialized components (`VelocityLayer`, `SmoothWaveHeatmap`)

### 1.6 Existing GeoJSON Usage

The `SmoothWaveHeatmap` component already uses GeoJSON for land masking:

```typescript
// File: packages/web/components/map/SmoothWaveHeatmap.tsx (Lines 46-52)

const LAND_GEOJSON_LOCAL = {
  '10m': '/SeaYou/geojson/10m/land.json',
  '50m': '/SeaYou/geojson/50m/land.json',
  '110m': '/SeaYou/geojson/110m/land.json'
};
const LAND_GEOJSON_FALLBACK = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson';
```

**Pattern**: Local files with CDN fallback for GeoJSON data.

---

## Part 2: Implementation Plan for New GeoJSON Layers

### 2.1 New Type Definitions

Add a new type for GeoJSON overlay layers:

```typescript
// Add to MapComponent.tsx after line 40

type GeoJSONLayer =
  | 'NONE'
  | 'COASTLINE'
  | 'BATHYMETRY_50M'
  | 'BATHYMETRY_100M'
  | 'BATHYMETRY_200M'
  | 'BATHYMETRY_500M'
  | 'BATHYMETRY_1000M'
  | 'REEFS'
  | 'PORTS'
  | 'MARINE_AREAS';

// For bathymetry depth selection
type BathymetryDepth = '50m' | '100m' | '200m' | '500m' | '1000m';
```

### 2.2 New State Variables

```typescript
// Add after line 111 in MapComponent.tsx

// GeoJSON Overlay Layers State
const [activeGeoJSONLayers, setActiveGeoJSONLayers] = useState<Set<GeoJSONLayer>>(new Set());
const [bathymetryDepth, setBathymetryDepth] = useState<BathymetryDepth>('200m');
const [loadingGeoJSON, setLoadingGeoJSON] = useState(false);

// Cached GeoJSON data (to avoid re-fetching)
const geoJSONCache = useRef<Record<string, any>>({});

// Leaflet layer groups for each GeoJSON type
const coastlineLayerRef = useRef<L.GeoJSON | null>(null);
const bathymetryLayerRef = useRef<L.GeoJSON | null>(null);
const reefsLayerRef = useRef<L.GeoJSON | null>(null);
const portsLayerRef = useRef<L.GeoJSON | null>(null);
const marineAreasLayerRef = useRef<L.GeoJSON | null>(null);
```

### 2.3 GeoJSON Data Sources Configuration

Create a new configuration file:

```typescript
// File: packages/web/utils/geoJSONConfig.ts

export const GEOJSON_SOURCES = {
  coastline: {
    local: '/SeaYou/geojson/10m/coastline.json',
    fallback: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson',
    style: {
      color: '#4fc3f7',
      weight: 1.5,
      opacity: 0.8
    }
  },
  bathymetry: {
    '50m': {
      local: '/SeaYou/geojson/bathymetry/50m.json',
      fallback: 'https://example.com/gebco/bathymetry_50m.geojson'
    },
    '100m': {
      local: '/SeaYou/geojson/bathymetry/100m.json',
      fallback: 'https://example.com/gebco/bathymetry_100m.geojson'
    },
    '200m': {
      local: '/SeaYou/geojson/bathymetry/200m.json',
      fallback: 'https://example.com/gebco/bathymetry_200m.geojson'
    },
    '500m': {
      local: '/SeaYou/geojson/bathymetry/500m.json',
      fallback: 'https://example.com/gebco/bathymetry_500m.geojson'
    },
    '1000m': {
      local: '/SeaYou/geojson/bathymetry/1000m.json',
      fallback: 'https://example.com/gebco/bathymetry_1000m.geojson'
    },
    style: {
      '50m': { color: '#bbdefb', weight: 1, opacity: 0.6 },
      '100m': { color: '#90caf9', weight: 1, opacity: 0.6 },
      '200m': { color: '#64b5f6', weight: 1, opacity: 0.6 },
      '500m': { color: '#42a5f5', weight: 1, opacity: 0.6 },
      '1000m': { color: '#2196f3', weight: 1, opacity: 0.6 }
    }
  },
  reefs: {
    local: '/SeaYou/geojson/10m/reefs.json',
    fallback: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_reefs.geojson',
    style: {
      color: '#ff7043',
      fillColor: '#ffab91',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.4
    }
  },
  ports: {
    local: '/SeaYou/geojson/10m/ports.json',
    fallback: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_ports.geojson',
    style: {
      // Point features - use circleMarker
      radius: 6,
      fillColor: '#ffc107',
      color: '#ff9800',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }
  },
  marineAreas: {
    local: '/SeaYou/geojson/10m/marine_polys.json',
    fallback: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson',
    style: {
      color: '#7e57c2',
      fillColor: '#b39ddb',
      weight: 1,
      opacity: 0.6,
      fillOpacity: 0.15
    }
  }
};
```

### 2.4 GeoJSON Layer Toggle Functions

```typescript
// Add to MapComponent.tsx

const toggleGeoJSONLayer = async (layer: GeoJSONLayer) => {
  const newLayers = new Set(activeGeoJSONLayers);

  if (newLayers.has(layer)) {
    newLayers.delete(layer);
    removeGeoJSONLayer(layer);
  } else {
    newLayers.add(layer);
    await loadGeoJSONLayer(layer);
  }

  setActiveGeoJSONLayers(newLayers);
};

const loadGeoJSONLayer = async (layer: GeoJSONLayer) => {
  if (!mapInstance.current) return;

  setLoadingGeoJSON(true);

  try {
    const config = getGeoJSONConfig(layer);
    let data = geoJSONCache.current[layer];

    if (!data) {
      // Try local first, fallback to remote
      try {
        const response = await fetch(config.local);
        data = await response.json();
      } catch {
        const response = await fetch(config.fallback);
        data = await response.json();
      }
      geoJSONCache.current[layer] = data;
    }

    // Create and add the layer
    const geoJSONLayer = L.geoJSON(data, {
      style: config.style,
      pointToLayer: (feature, latlng) => {
        if (layer === 'PORTS') {
          return L.circleMarker(latlng, config.style);
        }
        return L.marker(latlng);
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties?.name) {
          layer.bindPopup(feature.properties.name);
        }
      }
    });

    // Store reference and add to map
    setLayerRef(layer, geoJSONLayer);
    geoJSONLayer.addTo(mapInstance.current);

  } catch (error) {
    console.error(`Failed to load GeoJSON layer: ${layer}`, error);
  } finally {
    setLoadingGeoJSON(false);
  }
};

const removeGeoJSONLayer = (layer: GeoJSONLayer) => {
  const layerRef = getLayerRef(layer);
  if (layerRef && mapInstance.current) {
    mapInstance.current.removeLayer(layerRef);
    setLayerRef(layer, null);
  }
};
```

### 2.5 UI Component Updates

Add a new section to the layer control panel after the "Advanced Layers" divider:

```tsx
{/* GeoJSON Overlay Layers */}
<div className="border-t border-subtle my-2 pt-2">
  <div className="text-[10px] text-muted uppercase font-bold mb-1 px-2">
    {t('map.geoJSONLayers')}
  </div>
</div>

{/* Coastline Toggle */}
<button
  onClick={() => toggleGeoJSONLayer('COASTLINE')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeGeoJSONLayers.has('COASTLINE')
      ? 'bg-cyan-600 text-primary'
      : 'text-muted hover:bg-hover'
  }`}
>
  <MapPin size={12} /> {t('map.coastline')}
</button>

{/* Bathymetry with Depth Dropdown */}
<div className="relative">
  <button
    onClick={() => toggleGeoJSONLayer(`BATHYMETRY_${bathymetryDepth.toUpperCase()}`)}
    className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
      Array.from(activeGeoJSONLayers).some(l => l.startsWith('BATHYMETRY'))
        ? 'bg-blue-700 text-primary'
        : 'text-muted hover:bg-hover'
    }`}
  >
    <Droplets size={12} /> {t('map.bathymetry')}
  </button>

  {/* Depth Selector (show when bathymetry is active) */}
  {Array.from(activeGeoJSONLayers).some(l => l.startsWith('BATHYMETRY')) && (
    <select
      value={bathymetryDepth}
      onChange={(e) => handleBathymetryDepthChange(e.target.value as BathymetryDepth)}
      className="mt-1 w-full px-2 py-1 text-xs bg-card border border-subtle rounded"
    >
      <option value="50m">50m {t('map.depth')}</option>
      <option value="100m">100m {t('map.depth')}</option>
      <option value="200m">200m {t('map.depth')}</option>
      <option value="500m">500m {t('map.depth')}</option>
      <option value="1000m">1000m {t('map.depth')}</option>
    </select>
  )}
</div>

{/* Reefs Toggle (10m only) */}
<button
  onClick={() => toggleGeoJSONLayer('REEFS')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeGeoJSONLayers.has('REEFS')
      ? 'bg-orange-600 text-primary'
      : 'text-muted hover:bg-hover'
  }`}
>
  <Waves size={12} /> {t('map.reefs')}
</button>

{/* Ports Toggle */}
<button
  onClick={() => toggleGeoJSONLayer('PORTS')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeGeoJSONLayers.has('PORTS')
      ? 'bg-amber-600 text-primary'
      : 'text-muted hover:bg-hover'
  }`}
>
  <Navigation size={12} /> {t('map.ports')}
</button>

{/* Marine Areas Toggle */}
<button
  onClick={() => toggleGeoJSONLayer('MARINE_AREAS')}
  className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${
    activeGeoJSONLayers.has('MARINE_AREAS')
      ? 'bg-purple-600 text-primary'
      : 'text-muted hover:bg-hover'
  }`}
>
  <MapPin size={12} /> {t('map.marineAreas')}
</button>

{/* Loading Indicator */}
{loadingGeoJSON && (
  <div className="pb-2 px-2 text-[10px] text-center text-blue-300 animate-pulse">
    {t('map.loadingGeoJSON')}
  </div>
)}
```

---

## Part 3: Translation Keys Required

### 3.1 English Translations

Add to `packages/web/src/i18n/locales/en.json` under the `"map"` section:

```json
{
  "map": {
    // ... existing keys ...

    "geoJSONLayers": "GeoJSON Overlays",
    "coastline": "Coastline",
    "bathymetry": "Bathymetry",
    "depth": "Depth",
    "reefs": "Coral Reefs",
    "ports": "Ports",
    "marineAreas": "Marine Areas",
    "loadingGeoJSON": "Loading GeoJSON...",

    "legend": {
      // ... existing keys ...
      "bathymetryDepth": "Bathymetry Depth",
      "coralReefs": "Coral Reefs",
      "majorPorts": "Major Ports",
      "marineRegions": "Marine Regions"
    }
  }
}
```

### 3.2 Translations for Other Locales

The same keys need to be added to:
- `packages/web/src/i18n/locales/es.json`
- `packages/web/src/i18n/locales/fr.json`
- `packages/web/src/i18n/locales/de.json`
- `packages/web/src/i18n/locales/it.json`
- `packages/web/src/i18n/locales/ru.json`
- `packages/web/src/i18n/locales/he.json`

---

## Part 4: File Structure for GeoJSON Data

### 4.1 Recommended Directory Structure

```
packages/web/public/
  geojson/
    10m/
      land.json           (existing - used by SmoothWaveHeatmap)
      coastline.json      (NEW)
      reefs.json          (NEW)
      ports.json          (NEW)
      marine_polys.json   (NEW)
    50m/
      land.json           (existing)
    110m/
      land.json           (existing)
    bathymetry/
      50m.json            (NEW)
      100m.json           (NEW)
      200m.json           (NEW)
      500m.json           (NEW)
      1000m.json          (NEW)
```

### 4.2 GeoJSON Data Sources

| Layer | Natural Earth Dataset | Resolution | Notes |
|-------|----------------------|------------|-------|
| Coastline | `ne_10m_coastline` | 10m | LineString features |
| Reefs | `ne_10m_reefs` | 10m | Polygon features |
| Ports | `ne_10m_ports` | 10m | Point features |
| Marine Areas | `ne_10m_geography_marine_polys` | 10m | Polygon features |
| Bathymetry | GEBCO or custom | Various | Contour lines |

---

## Part 5: New Component Recommendations

### 5.1 GeoJSONLayerManager Component

Consider extracting the GeoJSON layer logic to a dedicated component:

```typescript
// File: packages/web/components/map/GeoJSONLayerManager.tsx

interface GeoJSONLayerManagerProps {
  map: L.Map | null;
  activeLayers: Set<GeoJSONLayer>;
  bathymetryDepth: BathymetryDepth;
}

export const GeoJSONLayerManager: React.FC<GeoJSONLayerManagerProps> = ({
  map,
  activeLayers,
  bathymetryDepth
}) => {
  // Layer management logic here
  return null; // Non-visual component
};
```

### 5.2 GeoJSONLegend Component

For showing legends when GeoJSON layers are active:

```typescript
// File: packages/web/components/map/GeoJSONLegend.tsx

interface GeoJSONLegendProps {
  activeLayers: Set<GeoJSONLayer>;
  position: 'topright' | 'bottomright' | 'bottomleft' | 'topleft';
}
```

---

## Part 6: Implementation Checklist

### Phase 1: Foundation
- [ ] Create `geoJSONConfig.ts` utility file
- [ ] Add new type definitions to `MapComponent.tsx`
- [ ] Add state variables for GeoJSON layers
- [ ] Create layer refs for each GeoJSON type

### Phase 2: Core Functionality
- [ ] Implement `toggleGeoJSONLayer` function
- [ ] Implement `loadGeoJSONLayer` function with caching
- [ ] Implement `removeGeoJSONLayer` function
- [ ] Add bathymetry depth change handler

### Phase 3: UI Implementation
- [ ] Add GeoJSON Layers section to layer control panel
- [ ] Create toggle buttons for each layer
- [ ] Add depth dropdown for bathymetry
- [ ] Add loading indicator

### Phase 4: GeoJSON Data
- [ ] Create `/public/geojson/` directory structure
- [ ] Download and process Natural Earth datasets
- [ ] Create bathymetry contour files
- [ ] Optimize GeoJSON files for web (simplify, minify)

### Phase 5: Internationalization
- [ ] Add English translation keys
- [ ] Add translations for all supported locales

### Phase 6: Testing & Polish
- [ ] Test layer toggle functionality
- [ ] Test layer styling
- [ ] Test popup functionality for ports
- [ ] Performance testing with multiple layers
- [ ] Mobile responsiveness testing

---

## Part 7: Performance Considerations

### 7.1 Large GeoJSON Optimization

1. **Simplification**: Use `mapshaper` or `tippecanoe` to reduce polygon complexity
2. **Tile-based loading**: For very large datasets, consider vector tiles
3. **Lazy loading**: Only load GeoJSON when layer is first activated
4. **Caching**: Cache loaded GeoJSON in `useRef` to avoid re-fetching

### 7.2 Z-Index Management

Ensure proper layer ordering:
```
Z-Index  | Layer
---------|------------------
200      | Base tile layer
250      | Wave heatmap
300      | Bathymetry
350      | Marine Areas
400      | Coastline
450      | Reefs
500      | Ports
600      | Route/Markers
```

---

## Appendix A: Full Type Definitions

```typescript
// Complete type definitions for implementation

type MapLayer = 'NONE' | 'WIND' | 'WAVE' | 'SWELL' | 'CURRENTS' | 'WIND_WAVE' | 'SIGNIFICANT_WAVE';

type AdvancedLayer = 'NONE' | 'WIND_PARTICLES' | 'CURRENT_PARTICLES' | 'WAVE_HEATMAP';

type GeoJSONLayer =
  | 'NONE'
  | 'COASTLINE'
  | 'BATHYMETRY_50M'
  | 'BATHYMETRY_100M'
  | 'BATHYMETRY_200M'
  | 'BATHYMETRY_500M'
  | 'BATHYMETRY_1000M'
  | 'REEFS'
  | 'PORTS'
  | 'MARINE_AREAS';

type BathymetryDepth = '50m' | '100m' | '200m' | '500m' | '1000m';

interface GeoJSONLayerStyle {
  color?: string;
  fillColor?: string;
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
  radius?: number;  // For point features
}

interface GeoJSONSourceConfig {
  local: string;
  fallback: string;
  style: GeoJSONLayerStyle;
}
```

---

## Appendix B: Recommended Import Additions

```typescript
// Add to MapComponent.tsx imports

import { GEOJSON_SOURCES } from '../utils/geoJSONConfig';
// Note: May need additional Lucide icons
import { Anchor, Map, Compass } from 'lucide-react';
```

---

## Conclusion

This implementation plan provides a systematic approach to adding GeoJSON layer controls that:

1. **Respects existing architecture**: Follows the established patterns for layer management
2. **Maintains UI consistency**: Uses the same styling patterns as existing layer buttons
3. **Supports i18n**: Integrates with the existing translation system
4. **Allows independent toggles**: GeoJSON layers can be toggled on/off independently
5. **Handles complexity**: Bathymetry depth selection is cleanly integrated
6. **Optimizes performance**: Includes caching and lazy loading strategies

The three-tier layer architecture (MapLayer + AdvancedLayer + GeoJSONLayer) provides maximum flexibility while keeping the code organized and maintainable.
