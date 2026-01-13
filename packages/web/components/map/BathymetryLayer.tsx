import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface BathymetryLayerProps {
  map: L.Map | null;
  visible: boolean;
  opacity?: number;
  depths?: number[]; // [200, 1000, 2000, 3000] meters
}

interface DepthLayer {
  depth: number;
  layer: L.GeoJSON | null;
}

// ------------------------------------------------------------------
// Constants & Configuration
// ------------------------------------------------------------------

const BATHYMETRY_PANE = 'bathymetryPane';
const PANE_Z_INDEX = '205';

// Default depth contours in meters
const DEFAULT_DEPTHS = [200, 1000, 2000, 3000, 4000, 6000];

// Natural Earth bathymetry data URLs - local first, then remote fallback
const GEOJSON_BASE_PATH = '/SeaYou/geojson';
const REMOTE_BASE_PATH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

// Local bathymetry URLs
const BATHYMETRY_LOCAL_URLS: Record<number, string> = {
  200: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_200m.json`,
  1000: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_1000m.json`,
  2000: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_2000m.json`,
  3000: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_3000m.json`,
};

// Remote fallback URLs
const BATHYMETRY_FALLBACK_URLS: Record<number, string> = {
  200: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_K_200.geojson`,
  1000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_J_1000.geojson`,
  2000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_I_2000.geojson`,
  3000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_H_3000.geojson`,
  4000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_G_4000.geojson`,
  5000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_F_5000.geojson`,
  6000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_E_6000.geojson`,
  7000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_D_7000.geojson`,
  8000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_C_8000.geojson`,
  9000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_B_9000.geojson`,
  10000: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_A_10000.geojson`,
};

// Color gradient from light to dark blue based on depth
// Shallower depths are lighter, deeper depths are darker
const DEPTH_COLORS: Record<number, string> = {
  0: '#e6f2ff',      // Surface (lightest)
  200: '#cce5ff',    // Continental shelf
  1000: '#99ccff',   // Upper slope
  2000: '#6699cc',   // Lower slope
  3000: '#4d88b8',   // Upper bathyal
  4000: '#336699',   // Lower bathyal
  5000: '#264d73',   // Abyssal plain
  6000: '#1a4d80',   // Deep abyssal
  7000: '#133d66',   // Hadal zone
  8000: '#0d3366',   // Deep hadal
  9000: '#082a52',   // Extreme depths
  10000: '#061a33',  // Maximum depths
};

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

/**
 * Get color for a specific depth
 */
function getDepthColor(depth: number): string {
  const depths = Object.keys(DEPTH_COLORS).map(Number).sort((a, b) => a - b);

  // Find the appropriate color for the depth
  for (let i = depths.length - 1; i >= 0; i--) {
    if (depth >= depths[i]) {
      return DEPTH_COLORS[depths[i]];
    }
  }

  return DEPTH_COLORS[0];
}

/**
 * Get the URLs for a depth (local and fallback)
 */
function getDepthUrls(targetDepth: number): { local: string | null; fallback: string | null } {
  // Try exact match first
  if (BATHYMETRY_LOCAL_URLS[targetDepth]) {
    return {
      local: BATHYMETRY_LOCAL_URLS[targetDepth],
      fallback: BATHYMETRY_FALLBACK_URLS[targetDepth] || null,
    };
  }

  // Find closest available depth for fallback
  const availableDepths = Object.keys(BATHYMETRY_FALLBACK_URLS).map(Number).sort((a, b) => a - b);
  let closestDepth = availableDepths[0];
  let minDiff = Math.abs(targetDepth - closestDepth);

  for (const depth of availableDepths) {
    const diff = Math.abs(targetDepth - depth);
    if (diff < minDiff) {
      minDiff = diff;
      closestDepth = depth;
    }
  }

  return {
    local: BATHYMETRY_LOCAL_URLS[closestDepth] || null,
    fallback: BATHYMETRY_FALLBACK_URLS[closestDepth] || null,
  };
}

// ------------------------------------------------------------------
// GeoJSON Service Functions
// ------------------------------------------------------------------

const bathymetryCache: Map<string, any> = new Map();

async function fetchBathymetryData(localUrl: string | null, fallbackUrl: string | null): Promise<any> {
  const cacheKey = localUrl || fallbackUrl || '';
  if (bathymetryCache.has(cacheKey)) {
    return bathymetryCache.get(cacheKey);
  }

  // Try local URL first
  if (localUrl) {
    try {
      const response = await fetch(localUrl);
      if (response.ok) {
        const data = await response.json();
        bathymetryCache.set(cacheKey, data);
        console.log(`[BathymetryLayer] Loaded from local: ${localUrl}`);
        return data;
      }
    } catch (error) {
      // Local fetch failed, try fallback
    }
  }

  // Try remote fallback
  if (fallbackUrl) {
    try {
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        const data = await response.json();
        bathymetryCache.set(cacheKey, data);
        console.log(`[BathymetryLayer] Loaded from remote fallback: ${fallbackUrl}`);
        return data;
      }
    } catch (error) {
      console.error('[BathymetryLayer] Fetch error:', error);
    }
  }

  return null;
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const BathymetryLayer = ({
  map,
  visible,
  opacity = 0.6,
  depths = DEFAULT_DEPTHS,
}: BathymetryLayerProps) => {
  const depthLayersRef = useRef<DepthLayer[]>([]);
  const [loadedDepths, setLoadedDepths] = useState<Record<number, any>>({});
  const paneCreatedRef = useRef<boolean>(false);

  // Create custom pane for bathymetry
  const createPane = useCallback(() => {
    if (!map || paneCreatedRef.current) return;

    if (!map.getPane(BATHYMETRY_PANE)) {
      map.createPane(BATHYMETRY_PANE);
      const pane = map.getPane(BATHYMETRY_PANE);
      if (pane) {
        pane.style.zIndex = PANE_Z_INDEX;
        pane.style.pointerEvents = 'none';
      }
    }

    paneCreatedRef.current = true;
  }, [map]);

  // Load bathymetry data for specified depths
  useEffect(() => {
    if (!visible) return;

    const loadDepthData = async () => {
      // Sort depths from deepest to shallowest for proper layering
      const sortedDepths = [...depths].sort((a, b) => b - a);

      for (const depth of sortedDepths) {
        if (!loadedDepths[depth]) {
          const urls = getDepthUrls(depth);
          if (urls.local || urls.fallback) {
            const data = await fetchBathymetryData(urls.local, urls.fallback);
            if (data) {
              setLoadedDepths(prev => ({ ...prev, [depth]: data }));
            }
          }
        }
      }
    };

    loadDepthData();
  }, [visible, depths]);

  // Create and manage depth layers
  useEffect(() => {
    if (!map) return;

    createPane();

    // Remove all existing layers first
    depthLayersRef.current.forEach(({ layer }) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    depthLayersRef.current = [];

    if (!visible) return;

    // Sort depths from deepest to shallowest
    // This ensures deeper layers are rendered first (behind shallower layers)
    const sortedDepths = [...depths].sort((a, b) => b - a);

    sortedDepths.forEach(depth => {
      const data = loadedDepths[depth];
      if (!data) return;

      const fillColor = getDepthColor(depth);

      const layer = L.geoJSON(data, {
        pane: BATHYMETRY_PANE,
        style: {
          color: fillColor,
          weight: 0.5,
          opacity: opacity * 0.5,
          fillColor: fillColor,
          fillOpacity: opacity,
        },
        onEachFeature: (feature, featureLayer) => {
          // Add tooltip showing depth
          const depthValue = feature.properties?.depth || depth;
          featureLayer.bindTooltip(`Depth: ${depthValue}m`, {
            permanent: false,
            direction: 'center',
            className: 'bathymetry-tooltip',
          });
        },
      }).addTo(map);

      depthLayersRef.current.push({ depth, layer });
    });

    // Cleanup on unmount
    return () => {
      depthLayersRef.current.forEach(({ layer }) => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      depthLayersRef.current = [];
    };
  }, [map, visible, loadedDepths, depths, opacity, createPane]);

  // Update opacity when it changes
  useEffect(() => {
    if (!map || !visible) return;

    depthLayersRef.current.forEach(({ depth, layer }) => {
      if (layer) {
        const fillColor = getDepthColor(depth);
        layer.setStyle({
          opacity: opacity * 0.5,
          fillOpacity: opacity,
        });
      }
    });
  }, [map, visible, opacity]);

  return null;
};

export default BathymetryLayer;
