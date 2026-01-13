import { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface GeoJSONLayersProps {
  map: L.Map | null;
  visibleLayers: {
    coastline?: boolean;
    bathymetry?: boolean;
    reefs?: boolean;
    ports?: boolean;
    marineAreas?: boolean;
  };
  opacity?: number;
}

interface LayerCache {
  coastline: L.GeoJSON | null;
  bathymetry: L.GeoJSON | null;
  reefs: L.GeoJSON | null;
  ports: L.LayerGroup | null;
  marineAreas: L.GeoJSON | null;
}

interface ResolutionConfig {
  low: string;
  medium: string;
  high: string;
}

// ------------------------------------------------------------------
// Constants & Configuration
// ------------------------------------------------------------------

// Pane z-index configuration for proper layer ordering
const PANE_CONFIG = {
  bathymetry: { name: 'bathymetryPane', zIndex: '210' },
  coastline: { name: 'coastlinePane', zIndex: '220' },
  marineAreas: { name: 'marineAreasPane', zIndex: '230' },
  reefs: { name: 'reefsPane', zIndex: '240' },
  ports: { name: 'portsPane', zIndex: '250' },
};

// GeoJSON base paths - local files with remote fallback
const GEOJSON_BASE_PATH = '/SeaYou/geojson';
const REMOTE_BASE_PATH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

// Natural Earth GeoJSON URLs - local first, then remote fallback
const GEOJSON_URLS: Record<string, ResolutionConfig> = {
  coastline: {
    low: `${GEOJSON_BASE_PATH}/110m/coastline.json`,
    medium: `${GEOJSON_BASE_PATH}/50m/coastline.json`,
    high: `${GEOJSON_BASE_PATH}/10m/coastline.json`,
  },
  reefs: {
    low: `${GEOJSON_BASE_PATH}/10m/reefs.json`,
    medium: `${GEOJSON_BASE_PATH}/10m/reefs.json`,
    high: `${GEOJSON_BASE_PATH}/10m/reefs.json`,
  },
  ports: {
    low: `${GEOJSON_BASE_PATH}/50m/ports.json`,
    medium: `${GEOJSON_BASE_PATH}/50m/ports.json`,
    high: `${GEOJSON_BASE_PATH}/10m/ports.json`,
  },
  marineAreas: {
    low: `${GEOJSON_BASE_PATH}/110m/marine_areas.json`,
    medium: `${GEOJSON_BASE_PATH}/50m/marine_areas.json`,
    high: `${GEOJSON_BASE_PATH}/10m/marine_areas.json`,
  },
  bathymetry: {
    low: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_200m.json`,
    medium: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_1000m.json`,
    high: `${GEOJSON_BASE_PATH}/10m/bathymetry/depth_2000m.json`,
  },
};

// Remote fallback URLs
const REMOTE_FALLBACK_URLS: Record<string, ResolutionConfig> = {
  coastline: {
    low: `${REMOTE_BASE_PATH}/ne_110m_coastline.geojson`,
    medium: `${REMOTE_BASE_PATH}/ne_50m_coastline.geojson`,
    high: `${REMOTE_BASE_PATH}/ne_10m_coastline.geojson`,
  },
  reefs: {
    low: `${REMOTE_BASE_PATH}/ne_10m_reefs.geojson`,
    medium: `${REMOTE_BASE_PATH}/ne_10m_reefs.geojson`,
    high: `${REMOTE_BASE_PATH}/ne_10m_reefs.geojson`,
  },
  ports: {
    low: `${REMOTE_BASE_PATH}/ne_10m_ports.geojson`,
    medium: `${REMOTE_BASE_PATH}/ne_10m_ports.geojson`,
    high: `${REMOTE_BASE_PATH}/ne_10m_ports.geojson`,
  },
  marineAreas: {
    low: `${REMOTE_BASE_PATH}/ne_110m_geography_marine_polys.geojson`,
    medium: `${REMOTE_BASE_PATH}/ne_50m_geography_marine_polys.geojson`,
    high: `${REMOTE_BASE_PATH}/ne_10m_geography_marine_polys.geojson`,
  },
  bathymetry: {
    low: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_K_200.geojson`,
    medium: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_J_1000.geojson`,
    high: `${REMOTE_BASE_PATH}/ne_10m_bathymetry_I_2000.geojson`,
  },
};

// Style configurations for each layer type
const LAYER_STYLES = {
  coastline: {
    color: '#e0e0e0',
    weight: 1.5,
    opacity: 0.9,
    fillOpacity: 0,
  },
  reefs: {
    color: '#ff7f50',
    weight: 2,
    opacity: 0.8,
    fillColor: '#ff6b35',
    fillOpacity: 0.4,
    dashArray: '4, 4',
  },
  marineAreas: {
    color: '#4a90d9',
    weight: 1,
    opacity: 0.6,
    fillColor: '#6ba3e0',
    fillOpacity: 0.15,
  },
  bathymetry: {
    weight: 0.5,
    opacity: 0.7,
    fillOpacity: 0.5,
  },
};

// Zoom thresholds for resolution switching
const ZOOM_THRESHOLDS = {
  low: 4,
  medium: 7,
};

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

/**
 * Determine resolution level based on current zoom
 */
function getResolutionForZoom(zoom: number): 'low' | 'medium' | 'high' {
  if (zoom < ZOOM_THRESHOLDS.low) return 'low';
  if (zoom < ZOOM_THRESHOLDS.medium) return 'medium';
  return 'high';
}

/**
 * Get bathymetry color based on depth
 */
function getBathymetryColor(depth: number): string {
  // Color gradient from light to dark blue based on depth
  const depthColors: Record<number, string> = {
    0: '#cce5ff',      // Shallow (0-200m)
    200: '#99ccff',    // Continental shelf
    1000: '#6699cc',   // Upper bathyal
    2000: '#336699',   // Lower bathyal
    3000: '#1a4d80',   // Abyssal
    4000: '#0d3366',   // Hadal
    6000: '#061a33',   // Deep trenches
  };

  const depths = Object.keys(depthColors).map(Number).sort((a, b) => a - b);

  for (let i = depths.length - 1; i >= 0; i--) {
    if (depth >= depths[i]) {
      return depthColors[depths[i]];
    }
  }

  return depthColors[0];
}

/**
 * Create custom port icon
 */
function createPortIcon(scaleRank: number = 1): L.DivIcon {
  const size = Math.max(8, 16 - scaleRank * 2);
  return L.divIcon({
    className: 'port-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, #2c5282 0%, #1a365d 100%);
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      "></div>
    `,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

// ------------------------------------------------------------------
// GeoJSON Service Functions
// ------------------------------------------------------------------

/**
 * Fetch GeoJSON data with caching
 */
const geoJsonCache: Map<string, any> = new Map();

async function fetchGeoJSON(url: string, fallbackUrl?: string): Promise<any> {
  if (geoJsonCache.has(url)) {
    return geoJsonCache.get(url);
  }

  // Try local URL first
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      geoJsonCache.set(url, data);
      console.log(`[GeoJSONLayers] Loaded from local: ${url}`);
      return data;
    }
  } catch (error) {
    // Local fetch failed, try fallback
  }

  // Try remote fallback if provided
  if (fallbackUrl) {
    try {
      const response = await fetch(fallbackUrl);
      if (response.ok) {
        const data = await response.json();
        geoJsonCache.set(url, data); // Cache using original key
        console.log(`[GeoJSONLayers] Loaded from remote fallback: ${fallbackUrl}`);
        return data;
      }
    } catch (error) {
      console.error('[GeoJSONLayers] Fetch error:', error);
    }
  }

  console.warn(`[GeoJSONLayers] Failed to load: ${url}`);
  return null;
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const GeoJSONLayers = ({ map, visibleLayers, opacity = 1 }: GeoJSONLayersProps) => {
  const layersRef = useRef<LayerCache>({
    coastline: null,
    bathymetry: null,
    reefs: null,
    ports: null,
    marineAreas: null,
  });

  const [currentResolution, setCurrentResolution] = useState<'low' | 'medium' | 'high'>('medium');
  const [loadedData, setLoadedData] = useState<Record<string, any>>({});
  const panesCreatedRef = useRef<boolean>(false);

  // Create custom panes for proper z-ordering
  const createPanes = useCallback(() => {
    if (!map || panesCreatedRef.current) return;

    Object.values(PANE_CONFIG).forEach(({ name, zIndex }) => {
      if (!map.getPane(name)) {
        map.createPane(name);
        const pane = map.getPane(name);
        if (pane) {
          pane.style.zIndex = zIndex;
          pane.style.pointerEvents = 'none';
        }
      }
    });

    // Enable pointer events for ports pane (clickable markers)
    const portsPane = map.getPane(PANE_CONFIG.ports.name);
    if (portsPane) {
      portsPane.style.pointerEvents = 'auto';
    }

    panesCreatedRef.current = true;
  }, [map]);

  // Handle zoom changes for resolution switching
  useEffect(() => {
    if (!map) return;

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      const newResolution = getResolutionForZoom(zoom);
      if (newResolution !== currentResolution) {
        setCurrentResolution(newResolution);
        console.log(`[GeoJSONLayers] Resolution changed to: ${newResolution}`);
      }
    };

    map.on('zoomend', handleZoomEnd);

    // Set initial resolution
    handleZoomEnd();

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, currentResolution]);

  // Load GeoJSON data based on resolution and visible layers
  useEffect(() => {
    const loadData = async () => {
      const layerTypes = Object.keys(visibleLayers) as Array<keyof typeof visibleLayers>;

      for (const layerType of layerTypes) {
        if (visibleLayers[layerType] && GEOJSON_URLS[layerType]) {
          const url = GEOJSON_URLS[layerType][currentResolution];
          const fallbackUrl = REMOTE_FALLBACK_URLS[layerType]?.[currentResolution];
          const cacheKey = `${layerType}-${currentResolution}`;

          if (!loadedData[cacheKey]) {
            const data = await fetchGeoJSON(url, fallbackUrl);
            if (data) {
              setLoadedData(prev => ({ ...prev, [cacheKey]: data }));
            }
          }
        }
      }
    };

    loadData();
  }, [visibleLayers, currentResolution]);

  // Create and manage layers
  useEffect(() => {
    if (!map) return;

    createPanes();

    const updateLayers = () => {
      // Coastline Layer
      if (visibleLayers.coastline) {
        const dataKey = `coastline-${currentResolution}`;
        if (loadedData[dataKey] && !layersRef.current.coastline) {
          layersRef.current.coastline = L.geoJSON(loadedData[dataKey], {
            pane: PANE_CONFIG.coastline.name,
            style: {
              ...LAYER_STYLES.coastline,
              opacity: LAYER_STYLES.coastline.opacity * opacity,
            },
          }).addTo(map);
        }
      } else if (layersRef.current.coastline) {
        map.removeLayer(layersRef.current.coastline);
        layersRef.current.coastline = null;
      }

      // Bathymetry Layer
      if (visibleLayers.bathymetry) {
        const dataKey = `bathymetry-${currentResolution}`;
        if (loadedData[dataKey] && !layersRef.current.bathymetry) {
          layersRef.current.bathymetry = L.geoJSON(loadedData[dataKey], {
            pane: PANE_CONFIG.bathymetry.name,
            style: (feature) => {
              const depth = feature?.properties?.depth || 0;
              return {
                ...LAYER_STYLES.bathymetry,
                fillColor: getBathymetryColor(depth),
                color: getBathymetryColor(depth),
                fillOpacity: LAYER_STYLES.bathymetry.fillOpacity * opacity,
              };
            },
          }).addTo(map);
        }
      } else if (layersRef.current.bathymetry) {
        map.removeLayer(layersRef.current.bathymetry);
        layersRef.current.bathymetry = null;
      }

      // Reefs Layer
      if (visibleLayers.reefs) {
        const dataKey = `reefs-${currentResolution}`;
        if (loadedData[dataKey] && !layersRef.current.reefs) {
          layersRef.current.reefs = L.geoJSON(loadedData[dataKey], {
            pane: PANE_CONFIG.reefs.name,
            style: {
              ...LAYER_STYLES.reefs,
              fillOpacity: LAYER_STYLES.reefs.fillOpacity * opacity,
              opacity: LAYER_STYLES.reefs.opacity * opacity,
            },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name || feature.properties?.NAME || 'Unnamed Reef';
              layer.bindTooltip(name, {
                permanent: false,
                direction: 'top',
                className: 'reef-tooltip',
              });
            },
          }).addTo(map);
        }
      } else if (layersRef.current.reefs) {
        map.removeLayer(layersRef.current.reefs);
        layersRef.current.reefs = null;
      }

      // Ports Layer
      if (visibleLayers.ports) {
        const dataKey = `ports-${currentResolution}`;
        if (loadedData[dataKey] && !layersRef.current.ports) {
          const portGroup = L.layerGroup([], { pane: PANE_CONFIG.ports.name });

          loadedData[dataKey].features?.forEach((feature: any) => {
            if (feature.geometry?.type === 'Point') {
              const [lng, lat] = feature.geometry.coordinates;
              const props = feature.properties || {};
              const scaleRank = props.scalerank || props.SCALERANK || 1;

              const marker = L.marker([lat, lng], {
                icon: createPortIcon(scaleRank),
                pane: PANE_CONFIG.ports.name,
              });

              const portName = props.name || props.NAME || 'Unknown Port';
              marker.bindPopup(`
                <div class="port-popup">
                  <h3 style="margin: 0 0 8px 0; color: #1a365d;">${portName}</h3>
                  ${props.website ? `<a href="${props.website}" target="_blank">Website</a>` : ''}
                </div>
              `);

              portGroup.addLayer(marker);
            }
          });

          layersRef.current.ports = portGroup.addTo(map);
        }
      } else if (layersRef.current.ports) {
        map.removeLayer(layersRef.current.ports);
        layersRef.current.ports = null;
      }

      // Marine Areas Layer
      if (visibleLayers.marineAreas) {
        const dataKey = `marineAreas-${currentResolution}`;
        if (loadedData[dataKey] && !layersRef.current.marineAreas) {
          layersRef.current.marineAreas = L.geoJSON(loadedData[dataKey], {
            pane: PANE_CONFIG.marineAreas.name,
            style: {
              ...LAYER_STYLES.marineAreas,
              fillOpacity: LAYER_STYLES.marineAreas.fillOpacity * opacity,
              opacity: LAYER_STYLES.marineAreas.opacity * opacity,
            },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name || feature.properties?.NAME;
              if (name) {
                layer.bindTooltip(name, {
                  permanent: false,
                  direction: 'center',
                  className: 'marine-area-tooltip',
                });
              }
            },
          }).addTo(map);
        }
      } else if (layersRef.current.marineAreas) {
        map.removeLayer(layersRef.current.marineAreas);
        layersRef.current.marineAreas = null;
      }
    };

    updateLayers();

    // Cleanup on unmount
    return () => {
      Object.values(layersRef.current).forEach(layer => {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      layersRef.current = {
        coastline: null,
        bathymetry: null,
        reefs: null,
        ports: null,
        marineAreas: null,
      };
    };
  }, [map, visibleLayers, loadedData, currentResolution, opacity, createPanes]);

  // Update opacity when it changes
  useEffect(() => {
    if (!map) return;

    if (layersRef.current.coastline) {
      layersRef.current.coastline.setStyle({
        opacity: LAYER_STYLES.coastline.opacity * opacity,
      });
    }

    if (layersRef.current.bathymetry) {
      layersRef.current.bathymetry.setStyle((feature: any) => ({
        fillOpacity: LAYER_STYLES.bathymetry.fillOpacity * opacity,
      }));
    }

    if (layersRef.current.reefs) {
      layersRef.current.reefs.setStyle({
        fillOpacity: LAYER_STYLES.reefs.fillOpacity * opacity,
        opacity: LAYER_STYLES.reefs.opacity * opacity,
      });
    }

    if (layersRef.current.marineAreas) {
      layersRef.current.marineAreas.setStyle({
        fillOpacity: LAYER_STYLES.marineAreas.fillOpacity * opacity,
        opacity: LAYER_STYLES.marineAreas.opacity * opacity,
      });
    }
  }, [map, opacity]);

  return null;
};

export default GeoJSONLayers;
