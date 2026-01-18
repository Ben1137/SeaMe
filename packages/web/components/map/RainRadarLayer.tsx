/**
 * RainRadarLayer - Precipitation radar overlay using RainViewer API
 *
 * Features:
 * - Real-time radar data from RainViewer
 * - Animation support with timeline control
 * - Auto-refresh every 10 minutes
 * - Proper TypeScript types
 *
 * @see https://www.rainviewer.com/api.html
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface RainRadarLayerProps {
  /** Whether the layer should be visible */
  visible: boolean;
  /** Layer opacity (0-1) */
  opacity?: number;
  /** Leaflet map instance */
  map: L.Map | null;
  /** Enable animation playback */
  animated?: boolean;
  /** Animation speed in milliseconds per frame */
  animationSpeed?: number;
  /** Custom pane name for z-index control */
  paneName?: string;
}

interface RainViewerFrame {
  time: number;
  path: string;
}

interface RainViewerData {
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
const TILE_URL_TEMPLATE = 'https://tilecache.rainviewer.com{path}/512/{z}/{x}/{y}/2/1_1.png';
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ANIMATION_SPEED = 500; // 500ms per frame
const DEFAULT_OPACITY = 0.5;

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function RainRadarLayer({
  visible,
  opacity = DEFAULT_OPACITY,
  map,
  animated = false,
  animationSpeed = DEFAULT_ANIMATION_SPEED,
  paneName = 'radarPane',
}: RainRadarLayerProps) {
  const layerRef = useRef<L.TileLayer | null>(null);
  const animationRef = useRef<number | null>(null);
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available radar frames from RainViewer API
  const fetchFrames = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(RAINVIEWER_API);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RainViewerData = await response.json();

      // Combine past and nowcast frames
      const allFrames = [
        ...data.radar.past,
        ...data.radar.nowcast,
      ];

      setFrames(allFrames);
      // Set to latest past frame (most recent actual radar data)
      setCurrentFrameIndex(data.radar.past.length - 1);

      console.log('[RainRadarLayer] Loaded', allFrames.length, 'frames');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch radar data';
      setError(message);
      console.error('[RainRadarLayer] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh interval
  useEffect(() => {
    if (!visible) return;

    fetchFrames();
    const interval = setInterval(fetchFrames, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchFrames, visible]);

  // Create custom pane for z-index control
  useEffect(() => {
    if (!map) return;

    if (!map.getPane(paneName)) {
      const pane = map.createPane(paneName);
      // Place radar above wind particles but below popups
      pane.style.zIndex = '490';
    }
  }, [map, paneName]);

  // Create/update tile layer when frame changes
  useEffect(() => {
    if (!map || frames.length === 0) return;

    const frame = frames[currentFrameIndex];
    if (!frame) return;

    // Remove existing layer
    if (layerRef.current && map.hasLayer(layerRef.current)) {
      map.removeLayer(layerRef.current);
    }

    // Create new tile layer with current frame
    const tileUrl = TILE_URL_TEMPLATE.replace('{path}', frame.path);

    const layer = L.tileLayer(tileUrl, {
      opacity: visible ? opacity : 0,
      attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
      tileSize: 512,
      zoomOffset: -1,
      pane: paneName,
    });

    layerRef.current = layer;

    if (visible) {
      layer.addTo(map);
    }

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, frames, currentFrameIndex, opacity, visible, paneName]);

  // Handle visibility changes
  useEffect(() => {
    if (!map || !layerRef.current) return;

    if (visible && !map.hasLayer(layerRef.current)) {
      layerRef.current.addTo(map);
    } else if (!visible && map.hasLayer(layerRef.current)) {
      map.removeLayer(layerRef.current);
    }
  }, [map, visible]);

  // Handle animation playback
  useEffect(() => {
    if (!animated || !visible || frames.length === 0) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    animationRef.current = window.setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, animationSpeed);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [animated, visible, frames.length, animationSpeed]);

  // Handle opacity changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(visible ? opacity : 0);
    }
  }, [opacity, visible]);

  // This component doesn't render any DOM elements
  // It only manages the Leaflet layer
  return null;
}

// ------------------------------------------------------------------
// Utility Hook for external control
// ------------------------------------------------------------------

export interface RainRadarControls {
  frames: RainViewerFrame[];
  currentFrameIndex: number;
  setCurrentFrameIndex: (index: number) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook for external control of rain radar frames
 * Useful for building custom timeline controls
 */
export function useRainRadarFrames(): RainRadarControls {
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(RAINVIEWER_API);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RainViewerData = await response.json();
      const allFrames = [...data.radar.past, ...data.radar.nowcast];

      setFrames(allFrames);
      setCurrentFrameIndex(data.radar.past.length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch radar data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    frames,
    currentFrameIndex,
    setCurrentFrameIndex,
    isLoading,
    error,
    refresh,
  };
}

export default RainRadarLayer;
