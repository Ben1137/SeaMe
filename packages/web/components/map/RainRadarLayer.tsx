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

// RainViewer color scheme 2 precipitation scale (mm/h)
// Colors match the tile color scheme used in TILE_URL_TEMPLATE
const PRECIPITATION_SCALE = [
  { color: '#78c5f5', label: '0.1', description: 'Light drizzle' },
  { color: '#3eb8fa', label: '0.5', description: 'Drizzle' },
  { color: '#1eb41e', label: '1', description: 'Light rain' },
  { color: '#f5f53c', label: '2', description: 'Moderate rain' },
  { color: '#f5a03c', label: '4', description: 'Heavy rain' },
  { color: '#f53c3c', label: '8', description: 'Very heavy rain' },
  { color: '#c81e1e', label: '16', description: 'Intense rain' },
  { color: '#a01ea0', label: '32', description: 'Extreme rain' },
] as const;

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
  // Debug: Log on every render
  console.log('[RainRadarLayer] Render - visible:', visible, 'map:', map ? 'present' : 'null', 'opacity:', opacity);

  // Use a cache of tile layers for smooth transitions (no flickering)
  const layerCacheRef = useRef<Map<string, L.TileLayer>>(new Map());
  const currentLayerRef = useRef<L.TileLayer | null>(null);
  const animationRef = useRef<number | null>(null);
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [pastFrameCount, setPastFrameCount] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(animated);

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
      setPastFrameCount(data.radar.past.length);
      // Set to latest past frame (most recent actual radar data)
      setCurrentFrameIndex(data.radar.past.length - 1);

      console.log('[RainRadarLayer] Loaded', allFrames.length, 'frames (', data.radar.past.length, 'past,', data.radar.nowcast.length, 'forecast)');
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
    console.log('[RainRadarLayer] Fetch effect - visible:', visible);
    if (!visible) return;

    console.log('[RainRadarLayer] Starting fetch...');
    fetchFrames();
    const interval = setInterval(fetchFrames, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchFrames, visible]);

  // Create custom pane for z-index control
  useEffect(() => {
    console.log('[RainRadarLayer] Pane effect - map:', map ? 'present' : 'null', 'paneName:', paneName);
    if (!map) return;

    if (!map.getPane(paneName)) {
      console.log('[RainRadarLayer] Creating custom pane:', paneName);
      const pane = map.createPane(paneName);
      // Place radar above wind particles but below popups
      pane.style.zIndex = '490';
      console.log('[RainRadarLayer] Pane created with z-index 490');
    } else {
      console.log('[RainRadarLayer] Pane already exists:', paneName);
    }
  }, [map, paneName]);

  // Helper to get or create a cached tile layer for a frame
  const getOrCreateLayer = useCallback((frame: RainViewerFrame, targetMap: L.Map): L.TileLayer => {
    const cache = layerCacheRef.current;

    if (cache.has(frame.path)) {
      return cache.get(frame.path)!;
    }

    const tileUrl = TILE_URL_TEMPLATE.replace('{path}', frame.path);
    const layer = L.tileLayer(tileUrl, {
      opacity: 0, // Start invisible
      attribution: '&copy; <a href="https://rainviewer.com">RainViewer</a>',
      tileSize: 512,
      zoomOffset: -1,
      pane: paneName,
    });

    // Add to map immediately (invisible) to start preloading
    layer.addTo(targetMap);
    cache.set(frame.path, layer);

    return layer;
  }, [paneName]);

  // Preload all frames when frames change
  useEffect(() => {
    if (!map || frames.length === 0 || !visible) return;

    console.log('[RainRadarLayer] Preloading', frames.length, 'frames...');

    // Create layers for all frames (they start with opacity 0)
    frames.forEach((frame) => {
      getOrCreateLayer(frame, map);
    });

    console.log('[RainRadarLayer] All frames preloaded');

    // Cleanup: remove all cached layers when component unmounts or frames change
    return () => {
      const cache = layerCacheRef.current;
      cache.forEach((layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      cache.clear();
      currentLayerRef.current = null;
    };
  }, [map, frames, visible, getOrCreateLayer]);

  // Handle frame changes with smooth crossfade
  useEffect(() => {
    if (!map || frames.length === 0) return;

    const frame = frames[currentFrameIndex];
    if (!frame) return;

    const cache = layerCacheRef.current;
    const newLayer = cache.get(frame.path);
    const oldLayer = currentLayerRef.current;

    if (!newLayer) return;

    // If it's the same layer, just ensure opacity is correct
    if (newLayer === oldLayer) {
      newLayer.setOpacity(visible ? opacity : 0);
      return;
    }

    // Crossfade: show new layer, hide old layer
    if (visible) {
      // Show new layer
      newLayer.setOpacity(opacity);

      // Hide old layer (don't remove, keep in cache)
      if (oldLayer && oldLayer !== newLayer) {
        oldLayer.setOpacity(0);
      }
    }

    currentLayerRef.current = newLayer;
  }, [map, frames, currentFrameIndex, opacity, visible]);

  // Handle visibility changes
  useEffect(() => {
    if (!map) return;

    const cache = layerCacheRef.current;

    if (visible) {
      // Show current frame
      const frame = frames[currentFrameIndex];
      if (frame) {
        const layer = cache.get(frame.path);
        if (layer) {
          layer.setOpacity(opacity);
          currentLayerRef.current = layer;
        }
      }
    } else {
      // Hide all layers
      cache.forEach((layer) => {
        layer.setOpacity(0);
      });
    }
  }, [map, visible, frames, currentFrameIndex, opacity]);

  // Handle animation playback (controlled by isPlaying state)
  useEffect(() => {
    if (!isPlaying || !visible || frames.length === 0) {
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
  }, [isPlaying, visible, frames.length, animationSpeed]);

  // Sync isPlaying with animated prop when it changes
  useEffect(() => {
    setIsPlaying(animated);
  }, [animated]);

  // Handle opacity changes on current layer
  useEffect(() => {
    if (currentLayerRef.current && visible) {
      currentLayerRef.current.setOpacity(opacity);
    }
  }, [opacity, visible]);

  // Get timestamp for current frame
  const currentFrame = frames[currentFrameIndex];
  const frameTime = currentFrame
    ? new Date(currentFrame.time * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Determine if current frame is forecast (nowcast) or past
  const isForecast = currentFrameIndex >= pastFrameCount;

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Step forward/backward
  const stepForward = useCallback(() => {
    setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
  }, [frames.length]);

  const stepBackward = useCallback(() => {
    setCurrentFrameIndex((prev) => (prev - 1 + frames.length) % frames.length);
  }, [frames.length]);

  // Handle slider change
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentFrameIndex(parseInt(e.target.value, 10));
    setIsPlaying(false); // Pause when manually scrubbing
  }, []);

  // Render legend when visible
  if (!visible) return null;

  return (
    <div
      className="absolute z-[1000] bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-white text-xs"
      style={{ bottom: '120px', right: '10px', minWidth: '180px' }}
    >
      {/* Header */}
      <div className="font-semibold mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z" />
        </svg>
        Rain Radar
      </div>

      {/* Animation Controls */}
      {frames.length > 0 && (
        <div className="mb-3 pb-2 border-b border-gray-700">
          {/* Time and type indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-300">
              {frameTime || '--:--'}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded ${
                isForecast
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-cyan-500/20 text-cyan-400'
              }`}
            >
              {isForecast ? 'Forecast' : 'Radar'}
            </span>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-1 mb-2">
            {/* Step backward */}
            <button
              onClick={stepBackward}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Previous frame"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="p-1.5 bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Step forward */}
            <button
              onClick={stepForward}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Next frame"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Timeline slider */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={currentFrameIndex}
              onChange={handleSliderChange}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              style={{
                background: `linear-gradient(to right,
                  #22d3ee 0%,
                  #22d3ee ${((pastFrameCount - 1) / (frames.length - 1)) * 100}%,
                  #f59e0b ${((pastFrameCount - 1) / (frames.length - 1)) * 100}%,
                  #f59e0b 100%)`
              }}
            />
            {/* Markers */}
            <div className="flex justify-between mt-1 text-[8px] text-gray-500">
              <span>Past</span>
              <span>Now</span>
              <span>Forecast</span>
            </div>
          </div>
        </div>
      )}

      {/* Color scale */}
      <div className="mb-1 text-[10px] text-gray-400">Precipitation (mm/h)</div>
      <div className="flex flex-col gap-0.5">
        {PRECIPITATION_SCALE.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] w-6">{item.label}</span>
            <span className="text-[10px] text-gray-400 truncate">
              {item.description}
            </span>
          </div>
        ))}
      </div>

      {/* Loading/Error states */}
      {isLoading && (
        <div className="mt-2 text-gray-400 text-[10px]">Loading...</div>
      )}
      {error && (
        <div className="mt-2 text-red-400 text-[10px]">Error: {error}</div>
      )}

      {/* Attribution */}
      <div className="mt-2 pt-2 border-t border-gray-700 text-[9px] text-gray-500">
        Data: RainViewer.com
      </div>
    </div>
  );
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
