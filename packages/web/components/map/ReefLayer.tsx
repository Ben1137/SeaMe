import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface ReefFeature {
  id: string;
  name: string;
  geometry: GeoJSON.Geometry;
  properties: {
    scalerank?: number;
    featurecla?: string;
    [key: string]: any;
  };
}

export interface ReefLayerProps {
  map: L.Map | null;
  visible: boolean;
  opacity?: number;
}

// ------------------------------------------------------------------
// Constants & Configuration
// ------------------------------------------------------------------

const REEF_PANE = 'reefPane';
const PANE_Z_INDEX = '240';

// Natural Earth reefs data URLs - local first, then remote fallback
const REEFS_LOCAL_URL = '/SeaYou/geojson/10m/reefs.json';
const REEFS_FALLBACK_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_reefs.geojson';

// Reef styling configuration
const REEF_STYLE: L.PathOptions = {
  color: '#d95200',        // Darker coral outline
  weight: 2,
  opacity: 0.9,
  fillColor: '#ff7f50',    // Coral fill color
  fillOpacity: 0.5,
  dashArray: '5, 5',       // Dotted outline for reef boundaries
  dashOffset: '0',
};

const REEF_HIGHLIGHT_STYLE: L.PathOptions = {
  color: '#ff4500',
  weight: 3,
  opacity: 1,
  fillColor: '#ff6b35',
  fillOpacity: 0.7,
  dashArray: '5, 5',
};

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

/**
 * Get style based on reef classification
 */
function getReefStyle(feature: any, opacity: number): L.PathOptions {
  const featureClass = feature?.properties?.featurecla || '';

  // Different reef types can have subtle style variations
  const baseStyle = { ...REEF_STYLE };

  // Adjust fill opacity based on component opacity
  baseStyle.fillOpacity = (REEF_STYLE.fillOpacity || 0.5) * opacity;
  baseStyle.opacity = (REEF_STYLE.opacity || 0.9) * opacity;

  // Atoll reefs - slightly different appearance
  if (featureClass.toLowerCase().includes('atoll')) {
    baseStyle.fillColor = '#ffa07a'; // Light salmon for atolls
  }

  // Barrier reefs - more prominent
  if (featureClass.toLowerCase().includes('barrier')) {
    baseStyle.weight = 2.5;
    baseStyle.fillColor = '#ff6347'; // Tomato color for barrier reefs
  }

  return baseStyle;
}

/**
 * Create tooltip content for a reef
 */
function createReefTooltip(feature: any): string {
  const name = feature.properties?.name || feature.properties?.NAME || 'Unnamed Reef';
  const featureClass = feature.properties?.featurecla || 'Reef';

  return `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 4px 8px;
    ">
      <strong style="color: #d95200;">${name}</strong>
      ${featureClass !== 'Reef' ? `<br/><span style="color: #666; font-size: 11px;">${featureClass}</span>` : ''}
    </div>
  `;
}

// ------------------------------------------------------------------
// GeoJSON Service Functions
// ------------------------------------------------------------------

let reefsCache: any = null;

async function fetchReefsData(): Promise<any> {
  if (reefsCache) {
    return reefsCache;
  }

  // Try local URL first
  try {
    const response = await fetch(REEFS_LOCAL_URL);
    if (response.ok) {
      const data = await response.json();
      reefsCache = data;
      console.log('[ReefLayer] Loaded reefs data from local');
      return data;
    }
  } catch (error) {
    // Local fetch failed, try fallback
  }

  // Try remote fallback
  try {
    const response = await fetch(REEFS_FALLBACK_URL);
    if (response.ok) {
      const data = await response.json();
      reefsCache = data;
      console.log('[ReefLayer] Loaded reefs data from remote fallback');
      return data;
    }
  } catch (error) {
    console.error('[ReefLayer] Fetch error:', error);
  }

  return null;
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const ReefLayer = ({ map, visible, opacity = 0.8 }: ReefLayerProps) => {
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [reefsData, setReefsData] = useState<any>(null);
  const paneCreatedRef = useRef<boolean>(false);

  // Create custom pane for reefs
  const createPane = useCallback(() => {
    if (!map || paneCreatedRef.current) return;

    if (!map.getPane(REEF_PANE)) {
      map.createPane(REEF_PANE);
      const pane = map.getPane(REEF_PANE);
      if (pane) {
        pane.style.zIndex = PANE_Z_INDEX;
        pane.style.pointerEvents = 'auto';
      }
    }

    paneCreatedRef.current = true;
  }, [map]);

  // Load reefs data
  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      const data = await fetchReefsData();
      if (data) {
        setReefsData(data);
      }
    };

    loadData();
  }, [visible]);

  // Create and manage reef layer
  useEffect(() => {
    if (!map) return;

    createPane();

    // Remove existing layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!visible || !reefsData) return;

    // Create GeoJSON layer with reef styling
    const reefLayer = L.geoJSON(reefsData, {
      pane: REEF_PANE,
      style: (feature) => getReefStyle(feature, opacity),
      onEachFeature: (feature, layer) => {
        // Bind tooltip with reef name
        const tooltipContent = createReefTooltip(feature);
        layer.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          className: 'reef-tooltip',
          offset: [0, -10],
        });

        // Add hover effects
        layer.on({
          mouseover: (e) => {
            const targetLayer = e.target as L.Path;
            targetLayer.setStyle({
              ...REEF_HIGHLIGHT_STYLE,
              fillOpacity: (REEF_HIGHLIGHT_STYLE.fillOpacity || 0.7) * opacity,
              opacity: (REEF_HIGHLIGHT_STYLE.opacity || 1) * opacity,
            });

            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              targetLayer.bringToFront();
            }
          },
          mouseout: (e) => {
            const targetLayer = e.target as L.Path;
            reefLayer.resetStyle(targetLayer);
          },
        });
      },
    }).addTo(map);

    layerRef.current = reefLayer;

    // Cleanup on unmount
    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
      layerRef.current = null;
    };
  }, [map, visible, reefsData, opacity, createPane]);

  // Update opacity when it changes
  useEffect(() => {
    if (!map || !visible || !layerRef.current) return;

    layerRef.current.setStyle((feature) => getReefStyle(feature, opacity));
  }, [map, visible, opacity]);

  return null;
};

export default ReefLayer;
