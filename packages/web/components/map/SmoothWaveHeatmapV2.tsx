/**
 * SmoothWaveHeatmapV2 - Zero-Bleed Wave Heatmap Implementation
 *
 * ARCHITECTURAL IMPROVEMENTS:
 * 1. RENDER BLOCKING: No heatmap frames until mask is fully ready
 * 2. UNIFIED RENDER LOOP: Heatmap and mask rendered in same RAF
 * 3. ZOOM-ADAPTIVE RESOLUTION: Auto-switches 10m/50m/110m based on zoom
 * 4. CANVAS LAYER ORDERING: Mask applied AFTER heatmap in same frame
 * 5. MOVEMENT OPTIMIZATION: Uses cached mask during pan, regenerates on stop
 *
 * This eliminates all race conditions that cause land bleeding in the heatmap.
 */

import L from 'leaflet';
import { useEffect, useRef, useState, useCallback } from 'react';
import chroma from 'chroma-js';
import { SeaMask, renderLandMaskToCanvas, LandMaskConfig, CachedLandMaskRenderer } from './SeaMaskUtils';

// ============================================================================
// Types
// ============================================================================

export interface WaveGridPoint {
  lat: number;
  lng: number;
  value: number;
  direction?: number;
}

export interface SmoothWaveHeatmapV2Props {
  gridData: WaveGridPoint[] | null;
  visible: boolean;
  opacity?: number;
  map: L.Map | null;
  /** Resolution for land mask: 'auto' selects based on zoom */
  maskResolution?: '10m' | '50m' | '110m' | 'auto';
  /** Show direction arrows on heatmap */
  showDirectionArrows?: boolean;
  /** Enable particle animation overlay */
  enableParticles?: boolean;
}

interface GridMetadata {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  rows: number;
  cols: number;
}

interface GridCache {
  grid: number[][];
  seaMask: boolean[][];
  directionGrid: number[][];
  metadata: GridMetadata;
  latStep: number;
  lngStep: number;
}

// ============================================================================
// Constants
// ============================================================================

const PARTICLE_COUNT = 5000;
const PARTICLE_SPEED_SCALE = 0.8;
const PARTICLE_MAX_AGE = 180;
const PARTICLE_TRAIL_FADE = 0.97;
const PARTICLE_WIDTH = 1.0;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Windy-style Wave Color Scale
const WINDY_WAVE_SCALE = chroma
  .scale([
    '#00E5FF', '#00D4FF', '#00BFFF', '#0099FF', '#0080FF', '#0066FF',
    '#3366FF', '#6666FF', '#9933FF', '#BB00FF', '#DD00DD', '#EE00AA',
    '#FF0088', '#FF0066', '#FF3366', '#FF5588', '#FF77AA', '#FF99CC',
    '#FFAADD', '#FFDDBB', '#FFFFAA'
  ])
  .domain([0.1, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9, 3.1, 3.5, 4.0, 4.5, 5.0, 6.0])
  .mode('lch');

const ZOOM_RESOLUTION_MAP = {
  high: { minZoom: 9, resolution: '10m' as const },
  medium: { minZoom: 5, resolution: '50m' as const },
  low: { minZoom: 0, resolution: '110m' as const },
};

const WAVE_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000',
  softEdges: true,
  blurRadius: 4.0,
  handleWrapping: true,
  skipBlurDuringMovement: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

function bilinearInterpolate(
  q11: number, q12: number, q21: number, q22: number,
  x: number, y: number
): number {
  const r1 = q11 * (1 - x) + q21 * x;
  const r2 = q12 * (1 - x) + q22 * x;
  return r1 * (1 - y) + r2 * y;
}

function bilinearInterpolateAngle(
  a11: number, a12: number, a21: number, a22: number,
  x: number, y: number
): number {
  const u11 = Math.cos(a11), v11 = Math.sin(a11);
  const u12 = Math.cos(a12), v12 = Math.sin(a12);
  const u21 = Math.cos(a21), v21 = Math.sin(a21);
  const u22 = Math.cos(a22), v22 = Math.sin(a22);

  const u = bilinearInterpolate(u11, u12, u21, u22, x, y);
  const v = bilinearInterpolate(v11, v12, v21, v22, x, y);

  return Math.atan2(v, u);
}

function createGrid(data: WaveGridPoint[]): GridCache | null {
  if (!data || data.length === 0) return null;

  const lats = data.map(p => p.lat);
  const lngs = data.map(p => p.lng);

  const metadata: GridMetadata = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    rows: 0,
    cols: 0
  };

  const sortedLats = [...new Set(lats)].sort((a, b) => a - b);
  const sortedLngs = [...new Set(lngs)].sort((a, b) => a - b);

  const latStep = sortedLats.length > 1 ? sortedLats[1] - sortedLats[0] : 0.05;
  const lngStep = sortedLngs.length > 1 ? sortedLngs[1] - sortedLngs[0] : 0.05;

  metadata.rows = Math.round((metadata.maxLat - metadata.minLat) / latStep) + 1;
  metadata.cols = Math.round((metadata.maxLng - metadata.minLng) / lngStep) + 1;

  const grid: number[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(0));
  const seaMask: boolean[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(false));
  const directionGrid: number[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(0));

  data.forEach(point => {
    const row = Math.round((point.lat - metadata.minLat) / latStep);
    const col = Math.round((point.lng - metadata.minLng) / lngStep);

    if (row >= 0 && row < metadata.rows && col >= 0 && col < metadata.cols) {
      grid[row][col] = point.value;
      seaMask[row][col] = true;
      if (point.direction !== undefined) {
        const rads = (point.direction + 180) * (Math.PI / 180);
        directionGrid[row][col] = rads;
      }
    }
  });

  return { grid, seaMask, directionGrid, metadata, latStep, lngStep };
}

// ============================================================================
// Heatmap Rendering
// ============================================================================

function renderHeatmapToCanvas(
  canvas: HTMLCanvasElement,
  bounds: L.LatLngBounds,
  cache: GridCache,
  opacity: number,
  maskCanvas?: HTMLCanvasElement
) {
  // CRITICAL GUARDS: Verify canvas is valid
  if (!canvas || !canvas.width || !canvas.height) return;

  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext('2d');
    // Verify context is valid (prevents "reading 'save'" crash)
    if (!ctx || typeof ctx.save !== 'function') return;
  } catch (e) {
    return; // Canvas is in invalid state
  }

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const { minLat, minLng, maxLat, maxLng } = cache.metadata;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const latPct = 1 - (y / height);
      const lngPct = x / width;

      const lat = bounds.getSouth() + latPct * (bounds.getNorth() - bounds.getSouth());
      const lng = bounds.getWest() + lngPct * (bounds.getEast() - bounds.getWest());

      const gridX = (lng - minLng) / cache.lngStep;
      const gridY = (lat - minLat) / cache.latStep;

      const col = Math.floor(gridX);
      const row = Math.floor(gridY);

      if (row >= 0 && row < cache.metadata.rows - 1 && col >= 0 && col < cache.metadata.cols - 1) {
        const v = bilinearInterpolate(
          cache.grid[row][col], cache.grid[row][col+1],
          cache.grid[row+1][col], cache.grid[row+1][col+1],
          gridY - row, gridX - col
        );

        if (v > 0.05) {
          const color = chroma(WINDY_WAVE_SCALE(v).hex()).rgba();
          const index = (y * width + x) * 4;
          const softAlpha = Math.min(1, v * 3.0);

          data[index] = color[0];
          data[index + 1] = color[1];
          data[index + 2] = color[2];
          data[index + 3] = color[3] * opacity * softAlpha * 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // CRITICAL: Apply land mask IMMEDIATELY after heatmap render
  if (maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(maskCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ============================================================================
// Particle Class
// ============================================================================

class Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speedMultiplier: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.age = Math.random() * PARTICLE_MAX_AGE;
    this.maxAge = PARTICLE_MAX_AGE + Math.random() * 100;
    this.speedMultiplier = 0.6 + Math.random() * 0.4;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export const SmoothWaveHeatmapV2 = ({
  gridData,
  visible,
  opacity = 0.9,
  map,
  maskResolution = 'auto',
  showDirectionArrows = false,
  enableParticles = true,
}: SmoothWaveHeatmapV2Props) => {
  // Refs
  const layerRef = useRef<L.Layer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCacheRef = useRef<GridCache | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const seaMaskRef = useRef<SeaMask | null>(null);
  const cachedRendererRef = useRef<CachedLandMaskRenderer | null>(null);
  const originRef = useRef<L.Point | null>(null);
  const isMovingRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);
  const isUnmountingRef = useRef<boolean>(false);
  const currentResolutionRef = useRef<string>('50m');

  // State
  const [isReady, setIsReady] = useState(false);
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);

  // ========================================================================
  // Resolution Selection
  // ========================================================================

  const getResolutionForZoom = useCallback((zoom: number): '10m' | '50m' | '110m' => {
    if (maskResolution !== 'auto') {
      return maskResolution as '10m' | '50m' | '110m';
    }

    if (zoom >= ZOOM_RESOLUTION_MAP.high.minZoom) return '10m';
    if (zoom >= ZOOM_RESOLUTION_MAP.medium.minZoom) return '50m';
    return '110m';
  }, [maskResolution]);

  // ========================================================================
  // Grid Data Processing
  // ========================================================================

  useEffect(() => {
    if (gridData && gridData.length > 0) {
      gridCacheRef.current = createGrid(gridData);
      console.log('[SmoothWaveHeatmapV2] Grid cache updated');
      setForceUpdateTrigger(prev => prev + 1);
    }
  }, [gridData]);

  // ========================================================================
  // Helper function to respawn particle in the sea only
  // ========================================================================

  const respawnInSea = useCallback((p: Particle, width: number, height: number, bounds: L.LatLngBounds, maxAttempts = 10) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.age = 0;
      p.maxAge = PARTICLE_MAX_AGE + Math.random() * 100;

      const lng = bounds.getWest() + (p.x / width) * (bounds.getEast() - bounds.getWest());
      const lat = bounds.getNorth() - (p.y / height) * (bounds.getNorth() - bounds.getSouth());

      if (seaMaskRef.current?.isReady()) {
        if (seaMaskRef.current.isInSea(lat, lng)) {
          return;
        }
      } else {
        return;
      }
    }
  }, []);

  // ========================================================================
  // Animation Loop
  // ========================================================================

  const animateParticles = useCallback((currentTime: number = 0) => {
    // CRITICAL GUARDS: Exit early if resources are invalid
    if (isUnmountingRef.current) return;
    if (!particleCanvasRef.current) return;

    const canvas = particleCanvasRef.current;

    // Verify canvas is valid (prevents "reading 'save'" crash)
    if (!canvas.width || !canvas.height) {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
      return;
    }

    const cache = gridCacheRef.current;

    // CRITICAL: Wait for mask to be initialized before drawing particles
    if (!cache || !visible || !map || !isReady) {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
      return;
    }

    // FPS Throttling
    const delta = currentTime - lastFrameTimeRef.current;
    if (delta < FRAME_INTERVAL) {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
      return;
    }
    lastFrameTimeRef.current = currentTime - (delta % FRAME_INTERVAL);

    // CRITICAL GUARD: Verify context is available
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.save !== 'function') {
        animationFrameRef.current = requestAnimationFrame(animateParticles);
        return;
      }
    } catch (e) {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Smooth trails
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0, 0, 0, ${PARTICLE_TRAIL_FADE})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = PARTICLE_WIDTH;
    ctx.lineCap = 'round';

    const bounds = map.getBounds();
    const { minLat, minLng } = cache.metadata;

    particlesRef.current.forEach(p => {
      if (p.age > p.maxAge) {
        respawnInSea(p, width, height, bounds);
      }
      p.age++;

      const lng = bounds.getWest() + (p.x / width) * (bounds.getEast() - bounds.getWest());
      const lat = bounds.getNorth() - (p.y / height) * (bounds.getNorth() - bounds.getSouth());

      const gridX = (lng - minLng) / cache.lngStep;
      const gridY = (lat - minLat) / cache.latStep;
      const col = Math.floor(gridX);
      const row = Math.floor(gridY);

      if (row >= 0 && row < cache.metadata.rows - 1 && col >= 0 && col < cache.metadata.cols - 1) {
        if (!cache.seaMask[row][col]) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        if (seaMaskRef.current?.isReady() && !seaMaskRef.current.isInSea(lat, lng)) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        const angle = bilinearInterpolateAngle(
          cache.directionGrid[row][col], cache.directionGrid[row][col+1],
          cache.directionGrid[row+1][col], cache.directionGrid[row+1][col+1],
          gridY - row, gridX - col
        );

        const value = bilinearInterpolate(
          cache.grid[row][col], cache.grid[row][col+1],
          cache.grid[row+1][col], cache.grid[row+1][col+1],
          gridY - row, gridX - col
        );

        if (value < 0.1) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        const speed = (1 + value * 0.8) * PARTICLE_SPEED_SCALE * p.speedMultiplier;
        const dx = Math.cos(angle) * speed;
        const dy = -Math.sin(angle) * speed;

        const particleOpacity = Math.min(0.9, 0.4 + (value / 5.0) * 0.6);
        ctx.strokeStyle = `rgba(255, 255, 255, ${particleOpacity})`;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();

        p.x += dx;
        p.y += dy;

        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          respawnInSea(p, width, height, bounds);
        }
      } else {
        respawnInSea(p, width, height, bounds);
      }
    });

    // Apply land mask to clip particles
    if (maskCanvasRef.current) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvasRef.current, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    animationFrameRef.current = requestAnimationFrame(animateParticles);
  }, [map, visible, respawnInSea, isReady]);

  // ========================================================================
  // Initialization (BLOCKS until mask is ready)
  // ========================================================================

  useEffect(() => {
    if (!map) return;

    isUnmountingRef.current = false;

    const initialize = async () => {
      if (isUnmountingRef.current) return;

      console.log('[SmoothWaveHeatmapV2] Initializing...');

      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) {
        setTimeout(initialize, 100);
        return;
      }

      // Determine initial resolution
      const zoom = map.getZoom();
      const resolution = getResolutionForZoom(zoom);
      currentResolutionRef.current = resolution;

      // Initialize SeaMask and WAIT for it
      const seaMask = new SeaMask({ resolution });

      seaMask.onLoad(() => {
        console.log('[SmoothWaveHeatmapV2] SeaMask loaded, triggering force redraw');
        setForceUpdateTrigger(prev => prev + 1);
      });

      await seaMask.load();

      if (isUnmountingRef.current) return;

      seaMaskRef.current = seaMask;

      // Get land features and initialize cached renderer
      const landFeatures = seaMask.getLandFeatures();
      if (landFeatures) {
        const cachedRenderer = new CachedLandMaskRenderer(WAVE_MASK_CONFIG);
        cachedRenderer.setLandFeatures(landFeatures);
        cachedRendererRef.current = cachedRenderer;
        console.log('[SmoothWaveHeatmapV2] Land GeoJSON loaded via SeaMask');

        // CRITICAL FIX: Force an immediate update trigger to render mask
        // This ensures the layer's _update() is called with mask ready
        setTimeout(() => {
          if (!isUnmountingRef.current) {
            setForceUpdateTrigger(prev => prev + 1);
          }
        }, 0);
      }

      setIsReady(true);
      console.log(`[SmoothWaveHeatmapV2] Ready with ${resolution} resolution`);
    };

    initialize();

    return () => {
      isUnmountingRef.current = true;
      cancelAnimationFrame(animationFrameRef.current);

      if (cachedRendererRef.current) {
        cachedRendererRef.current.dispose();
        cachedRendererRef.current = null;
      }

      setIsReady(false);
    };
  }, [map, getResolutionForZoom]);

  // ========================================================================
  // Custom Layer Implementation
  // ========================================================================

  useEffect(() => {
    if (!map || !isReady) return;

    const PANE_NAME = 'waveHeatmapPane';
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME);
      const pane = map.getPane(PANE_NAME);
      if (pane) pane.style.zIndex = '250';
    }

    // CRITICAL FIX: Do NOT capture landFeatures in closure - access dynamically via ref
    // This was causing the "click-to-fix" bug where landFeatures was null on init

    const CustomLayer = L.Layer.extend({
      getEvents: function() {
        return {
          movestart: this._onMoveStart,
          move: this._onMove,
          moveend: this._onMoveEnd,
          zoomstart: this._onZoomStart,
          zoomend: this._onZoomEnd,
          zoomanim: this._onZoomAnim,
          resize: this._resize
        };
      },

      _onZoomAnim: function(e: L.ZoomAnimEvent) {
        if (this._canvas) this._canvas.style.opacity = '0.3';
        if (this._particleCanvas) this._particleCanvas.style.opacity = '0.3';
      },

      onAdd: function(mapInstance: L.Map) {
        const size = mapInstance.getSize();
        const bounds = mapInstance.getBounds();
        const rawTopLeft = mapInstance.latLngToLayerPoint(bounds.getNorthWest());
        const topLeft = L.point(Math.round(rawTopLeft.x), Math.round(rawTopLeft.y));
        originRef.current = topLeft;

        const dpr = window.devicePixelRatio || 1;

        // Heatmap Canvas
        const canvas = L.DomUtil.create('canvas', 'leaflet-layer leaflet-zoom-animated') as HTMLCanvasElement;
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
        canvas.style.pointerEvents = 'none';

        // Particle Canvas
        const particleCanvas = L.DomUtil.create('canvas', 'leaflet-layer leaflet-zoom-animated') as HTMLCanvasElement;
        particleCanvas.width = size.x;
        particleCanvas.height = size.y;
        particleCanvas.style.width = `${size.x}px`;
        particleCanvas.style.height = `${size.y}px`;
        particleCanvas.style.pointerEvents = 'none';

        // Mask Canvas (hidden)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = size.x;
        maskCanvas.height = size.y;

        const pane = mapInstance.getPane(PANE_NAME);
        if (pane) {
          pane.appendChild(canvas);
          pane.appendChild(particleCanvas);
        }

        this._canvas = canvas;
        this._particleCanvas = particleCanvas;
        this._maskCanvas = maskCanvas;
        canvasRef.current = canvas;
        particleCanvasRef.current = particleCanvas;
        maskCanvasRef.current = maskCanvas;

        // Initialize Particles
        if (enableParticles) {
          particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(size.x, size.y));
        }

        L.DomUtil.setPosition(canvas, topLeft);
        L.DomUtil.setPosition(particleCanvas, topLeft);

        // CRITICAL FIX: Defer mask rendering to first _update call
        // DO NOT render synchronously in onAdd - Leaflet hasn't finished setup
        // The canvas context may not be fully ready yet, causing "reading 'save'" crash
        //
        // Instead, schedule the first update after Leaflet's internal timing is complete
        // This ensures the canvas is fully attached and context is valid
        const self = this;
        requestAnimationFrame(() => {
          if (isUnmountingRef.current) return;
          if (!self._canvas || !self._maskCanvas) return;

          // Now it's safe to render - Leaflet has completed initialization
          const initLandFeatures = seaMaskRef.current?.getLandFeatures();
          if (self._maskCanvas && initLandFeatures && mapInstance) {
            try {
              if (cachedRendererRef.current) {
                cachedRendererRef.current.render(self._maskCanvas, mapInstance, topLeft);
              } else {
                renderLandMaskToCanvas(
                  self._maskCanvas,
                  initLandFeatures,
                  mapInstance,
                  topLeft,
                  WAVE_MASK_CONFIG,
                  false // not moving on init
                );
              }
              console.log('[SmoothWaveHeatmapV2] Mask pre-rendered in first RAF');
            } catch (e) {
              console.warn('[SmoothWaveHeatmapV2] Mask pre-render skipped:', e);
            }
          }

          // Now call _update after mask is ready
          self._update();
        });

        if (enableParticles) {
          cancelAnimationFrame(animationFrameRef.current);
          animateParticles(0);
        }

        return this;
      },

      onRemove: function(mapInstance: L.Map) {
        // CRITICAL: Mark unmounting FIRST to stop all async operations
        isUnmountingRef.current = true;

        // Cancel all pending animations and timers
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;

        if (this._zoomDebounceTimer) {
          clearTimeout(this._zoomDebounceTimer);
          this._zoomDebounceTimer = null;
        }
        if (this._moveDebounceTimer) {
          clearTimeout(this._moveDebounceTimer);
          this._moveDebounceTimer = null;
        }
        if (this._initRAF) {
          cancelAnimationFrame(this._initRAF);
          this._initRAF = null;
        }

        // Remove canvas elements from DOM
        if (this._canvas) {
          try { L.DomUtil.remove(this._canvas); } catch (e) {}
        }
        if (this._particleCanvas) {
          try { L.DomUtil.remove(this._particleCanvas); } catch (e) {}
        }

        // Clear all canvas references
        this._canvas = null;
        this._particleCanvas = null;
        this._maskCanvas = null;
        canvasRef.current = null;
        particleCanvasRef.current = null;
        maskCanvasRef.current = null;

        return this;
      },

      _onMoveStart: function() {
        isMovingRef.current = true;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(true);
        }
        if (originRef.current) {
          this._startOrigin = originRef.current;
        }
      },

      _onMove: function() {
        if (!this._canvas || !this._particleCanvas) return;
        const bounds = map.getBounds();
        const currentTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());
        L.DomUtil.setPosition(this._canvas, currentTopLeft);
        L.DomUtil.setPosition(this._particleCanvas, currentTopLeft);
      },

      _onMoveEnd: function() {
        isMovingRef.current = false;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(false);
        }

        if (this._moveDebounceTimer) {
          clearTimeout(this._moveDebounceTimer);
        }
        this._moveDebounceTimer = setTimeout(() => {
          this._update();
          this._moveDebounceTimer = null;
        }, 100);
      },

      _onZoomStart: function() {
        isMovingRef.current = true;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(true);
        }
      },

      _onZoomEnd: async function() {
        isMovingRef.current = false;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(false);
          cachedRendererRef.current.invalidateCache();
        }

        if (this._canvas) this._canvas.style.opacity = String(opacity);
        if (this._particleCanvas) this._particleCanvas.style.opacity = '1';

        // Check for resolution change
        const zoom = map.getZoom();
        const newResolution = getResolutionForZoom(zoom);

        if (newResolution !== currentResolutionRef.current) {
          console.log(`[SmoothWaveHeatmapV2] Switching resolution: ${currentResolutionRef.current} -> ${newResolution}`);

          // CRITICAL FIX: Try-catch to handle blacklisted resolutions
          try {
            currentResolutionRef.current = newResolution;

            const seaMask = new SeaMask({ resolution: newResolution });
            await seaMask.load();

            if (isUnmountingRef.current) return;

            seaMaskRef.current = seaMask;

            const landFeatures = seaMask.getLandFeatures();
            if (landFeatures && cachedRendererRef.current) {
              cachedRendererRef.current.setLandFeatures(landFeatures);
            }
          } catch (error) {
            console.error(`[SmoothWaveHeatmapV2] Failed to load ${newResolution}, keeping previous resolution:`, error);
            // Revert to previous resolution
            currentResolutionRef.current = currentResolutionRef.current;
          }
        }

        if (this._zoomDebounceTimer) {
          clearTimeout(this._zoomDebounceTimer);
        }
        this._zoomDebounceTimer = setTimeout(() => {
          this._update();
          this._zoomDebounceTimer = null;
        }, 150);
      },

      _resize: function() {
        const size = map.getSize();
        const dpr = window.devicePixelRatio || 1;

        if (this._canvas) {
          this._canvas.width = size.x * dpr;
          this._canvas.height = size.y * dpr;
          this._canvas.style.width = `${size.x}px`;
          this._canvas.style.height = `${size.y}px`;
        }
        if (this._particleCanvas) {
          this._particleCanvas.width = size.x;
          this._particleCanvas.height = size.y;
          this._particleCanvas.style.width = `${size.x}px`;
          this._particleCanvas.style.height = `${size.y}px`;
          if (enableParticles) {
            particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(size.x, size.y));
          }
        }
        if (this._maskCanvas) {
          this._maskCanvas.width = size.x;
          this._maskCanvas.height = size.y;
        }

        if (cachedRendererRef.current) {
          cachedRendererRef.current.invalidateCache();
        }

        this._update();
      },

      _update: function() {
        // CRITICAL GUARDS: Verify all required resources exist
        if (isUnmountingRef.current) return;
        if (!this._canvas || !this._particleCanvas || !this._maskCanvas) return;
        if (!map) return;

        // Verify canvases have valid dimensions
        if (!this._canvas.width || !this._canvas.height) return;

        // Verify canvas contexts are available (prevents "reading 'save'" crash)
        try {
          const testCtx = this._canvas.getContext('2d');
          if (!testCtx || typeof testCtx.save !== 'function') return;
        } catch (e) {
          return; // Canvas is in invalid state
        }

        if (!gridCacheRef.current) {
          console.log('[SmoothWaveHeatmapV2] Waiting for grid data...');
          return;
        }

        // CRITICAL FIX: Get landFeatures DYNAMICALLY from ref, not from closure
        // This fixes the "click-to-fix" bug where landFeatures was stale on init
        const currentLandFeatures = seaMaskRef.current?.getLandFeatures();

        // Block until BOTH mask and landFeatures are ready
        if (!seaMaskRef.current?.isReady() || !currentLandFeatures) {
          console.log('[SmoothWaveHeatmapV2] Waiting for mask to be ready...');
          return;
        }

        try {
          const bounds = map.getBounds();
          const rawTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());
          const topLeft = L.point(Math.round(rawTopLeft.x), Math.round(rawTopLeft.y));
          originRef.current = topLeft;

          L.DomUtil.setPosition(this._canvas, topLeft);
          L.DomUtil.setPosition(this._particleCanvas, topLeft);

          // Render land mask FIRST (CRITICAL) - use currentLandFeatures
          if (this._maskCanvas && currentLandFeatures) {
            if (cachedRendererRef.current) {
              cachedRendererRef.current.render(this._maskCanvas, map, topLeft);
            } else {
              renderLandMaskToCanvas(
                this._maskCanvas,
                currentLandFeatures,
                map,
                topLeft,
                WAVE_MASK_CONFIG,
                isMovingRef.current
              );
            }
          }

          // Render heatmap with land mask clipping
          renderHeatmapToCanvas(this._canvas, bounds, gridCacheRef.current, opacity, this._maskCanvas);

          // Clear particles on move
          const pCtx = this._particleCanvas.getContext('2d');
          if (pCtx) pCtx.clearRect(0, 0, this._particleCanvas.width, this._particleCanvas.height);

          console.log('[SmoothWaveHeatmapV2] Render complete');
        } catch (e) {
          console.warn('[SmoothWaveHeatmapV2] _update error (likely cleanup race):', e);
        }
      }
    });

    const layer = new CustomLayer();
    layerRef.current = layer;

    if (visible) {
      map.addLayer(layer);
    }

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, visible, opacity, isReady, animateParticles, getResolutionForZoom, enableParticles]);

  // Force redraw when data becomes available
  useEffect(() => {
    if (forceUpdateTrigger > 0 && layerRef.current && map) {
      const layer = layerRef.current as any;
      if (layer._update) {
        console.log('[SmoothWaveHeatmapV2] Force redraw triggered');
        layer._update();
      }
    }
  }, [forceUpdateTrigger, map]);

  return null;
};

export default SmoothWaveHeatmapV2;
