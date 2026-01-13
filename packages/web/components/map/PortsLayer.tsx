import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface PortFeature {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng]
  properties: {
    scalerank?: number;
    featurecla?: string;
    website?: string;
    natlscale?: number;
    [key: string]: any;
  };
}

export interface PortsLayerProps {
  map: L.Map | null;
  visible: boolean;
  onPortClick?: (port: PortFeature) => void;
}

// ------------------------------------------------------------------
// Constants & Configuration
// ------------------------------------------------------------------

const PORTS_PANE = 'portsPane';
const PANE_Z_INDEX = '450';

// Natural Earth ports data URLs - local first, then remote fallback
const PORTS_LOCAL_URL = '/SeaYou/geojson/10m/ports.json';
const PORTS_FALLBACK_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_ports.geojson';

// Note: Marker clustering removed for simplicity - using LayerGroup instead

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

/**
 * Create custom anchor/port icon marker
 */
function createPortIcon(scaleRank: number = 1, featureClass?: string): L.DivIcon {
  // Larger ports (lower scalerank) get bigger icons
  const baseSize = 24;
  const size = Math.max(12, baseSize - scaleRank * 2);

  // Different icon styles based on port type
  const isMajorPort = scaleRank <= 3;
  const bgColor = isMajorPort ? '#1a365d' : '#2c5282';
  const borderWidth = isMajorPort ? 3 : 2;

  // Anchor icon SVG
  const anchorSvg = `
    <svg viewBox="0 0 24 24" width="${size - 4}" height="${size - 4}" fill="white">
      <path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6c-1.1 0-2-.9-2-2h-1v2H7v2h2v6.1c-2.3.5-4 2.5-4 4.9h2c0-1.7 1.3-3 3-3s3 1.3 3 3h2c0-2.4-1.7-4.4-4-4.9V10h2V8h-2V6c0 1.1-.9 2-2 2z"/>
    </svg>
  `;

  return L.divIcon({
    className: 'port-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, ${bgColor} 0%, #0d2137 100%);
        border: ${borderWidth}px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
      " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
        ${anchorSvg}
      </div>
    `,
    iconSize: [size + borderWidth * 2, size + borderWidth * 2],
    iconAnchor: [(size + borderWidth * 2) / 2, (size + borderWidth * 2) / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

/**
 * Create popup content for a port
 */
function createPortPopup(port: PortFeature): string {
  const { name, properties } = port;
  const scaleRank = properties.scalerank || 0;
  const portSize = scaleRank <= 2 ? 'Major Port' : scaleRank <= 5 ? 'Medium Port' : 'Minor Port';

  return `
    <div class="port-popup" style="
      min-width: 180px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
      ">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#1a365d">
          <path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6c-1.1 0-2-.9-2-2h-1v2H7v2h2v6.1c-2.3.5-4 2.5-4 4.9h2c0-1.7 1.3-3 3-3s3 1.3 3 3h2c0-2.4-1.7-4.4-4-4.9V10h2V8h-2V6c0 1.1-.9 2-2 2z"/>
        </svg>
        <h3 style="margin: 0; color: #1a365d; font-size: 16px; font-weight: 600;">
          ${name}
        </h3>
      </div>
      <div style="color: #4a5568; font-size: 13px;">
        <div style="margin-bottom: 4px;">
          <span style="color: #718096;">Type:</span> ${portSize}
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #718096;">Coordinates:</span><br/>
          ${port.coordinates[0].toFixed(4)}, ${port.coordinates[1].toFixed(4)}
        </div>
        ${properties.website ? `
          <a href="${properties.website}" target="_blank" style="
            display: inline-block;
            margin-top: 8px;
            color: #2c5282;
            text-decoration: none;
          ">
            Visit Website
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------
// GeoJSON Service Functions
// ------------------------------------------------------------------

let portsCache: any = null;

async function fetchPortsData(): Promise<any> {
  if (portsCache) {
    return portsCache;
  }

  // Try local URL first
  try {
    const response = await fetch(PORTS_LOCAL_URL);
    if (response.ok) {
      const data = await response.json();
      portsCache = data;
      console.log('[PortsLayer] Loaded ports data from local');
      return data;
    }
  } catch (error) {
    // Local fetch failed, try fallback
  }

  // Try remote fallback
  try {
    const response = await fetch(PORTS_FALLBACK_URL);
    if (response.ok) {
      const data = await response.json();
      portsCache = data;
      console.log('[PortsLayer] Loaded ports data from remote fallback');
      return data;
    }
  } catch (error) {
    console.error('[PortsLayer] Fetch error:', error);
  }

  return null;
}

/**
 * Parse GeoJSON features into PortFeature objects
 */
function parsePortFeatures(geojson: any): PortFeature[] {
  if (!geojson?.features) return [];

  return geojson.features
    .filter((f: any) => f.geometry?.type === 'Point')
    .map((f: any, index: number) => ({
      id: f.properties?.name || `port-${index}`,
      name: f.properties?.name || f.properties?.NAME || 'Unknown Port',
      coordinates: [
        f.geometry.coordinates[1], // lat
        f.geometry.coordinates[0], // lng
      ] as [number, number],
      properties: f.properties || {},
    }));
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const PortsLayer = ({ map, visible, onPortClick }: PortsLayerProps) => {
  const markerClusterRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [ports, setPorts] = useState<PortFeature[]>([]);
  const paneCreatedRef = useRef<boolean>(false);

  // Create custom pane for ports
  const createPane = useCallback(() => {
    if (!map || paneCreatedRef.current) return;

    if (!map.getPane(PORTS_PANE)) {
      map.createPane(PORTS_PANE);
      const pane = map.getPane(PORTS_PANE);
      if (pane) {
        pane.style.zIndex = PANE_Z_INDEX;
        pane.style.pointerEvents = 'auto';
      }
    }

    paneCreatedRef.current = true;
  }, [map]);

  // Load ports data
  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      const data = await fetchPortsData();
      if (data) {
        const parsedPorts = parsePortFeatures(data);
        setPorts(parsedPorts);
      }
    };

    loadData();
  }, [visible]);

  // Create and manage port markers (using LayerGroup instead of MarkerCluster for simplicity)
  useEffect(() => {
    if (!map) return;

    createPane();

    // Remove existing layer group
    if (markerClusterRef.current) {
      map.removeLayer(markerClusterRef.current);
      markerClusterRef.current = null;
    }
    markersRef.current = [];

    if (!visible || ports.length === 0) return;

    // Create a simple layer group for ports
    const portGroup = L.layerGroup();

    // Create markers for each port
    ports.forEach(port => {
      const scaleRank = port.properties.scalerank || 5;
      const marker = L.marker(port.coordinates, {
        icon: createPortIcon(scaleRank, port.properties.featurecla),
        pane: PORTS_PANE,
      });

      // Bind popup
      marker.bindPopup(createPortPopup(port), {
        maxWidth: 250,
        className: 'port-popup-container',
      });

      // Handle click event
      marker.on('click', () => {
        if (onPortClick) {
          onPortClick(port);
        }
      });

      portGroup.addLayer(marker);
      markersRef.current.push(marker);
    });

    // Add layer group to map
    map.addLayer(portGroup);
    markerClusterRef.current = portGroup;

    // Cleanup on unmount
    return () => {
      if (markerClusterRef.current && map.hasLayer(markerClusterRef.current)) {
        map.removeLayer(markerClusterRef.current);
      }
      markerClusterRef.current = null;
      markersRef.current = [];
    };
  }, [map, visible, ports, onPortClick, createPane]);

  return null;
};

export default PortsLayer;
