import L from 'leaflet';
import { useEffect, useRef, useState, useCallback } from 'react';
import chroma from 'chroma-js';
import { SeaMask, renderLandMaskToCanvas, LandMaskConfig, CachedLandMaskRenderer } from './SeaMaskUtils';

// ------------------------------------------------------------------
// Types & Interfaces
// ------------------------------------------------------------------

export interface WaveGridPoint {
  lat: number;
  lng: number;
  value: number;       // Wave height (m)
  direction?: number;  // Wave direction (degrees 0-360)
}

interface SmoothWaveHeatmapProps {
  gridData: WaveGridPoint[];
  visible: boolean;
  opacity: number;
  map?: L.Map;
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
  grid: number[][];              // Wave heights
  seaMask: boolean[][];          // True = Ocean, False = Land
  directionGrid: number[][];     // Wave directions (radians)
  metadata: GridMetadata;
  latStep: number;
  lngStep: number;
}

// ------------------------------------------------------------------
// Constants & Configuration - "Windy Look" Tuning
// ------------------------------------------------------------------

const PARTICLE_COUNT = 5000;         // High density for professional look
const PARTICLE_SPEED_SCALE = 2.5;    // Fluid movement speed
const PARTICLE_MAX_AGE = 150;        // Particles live longer
const PARTICLE_TRAIL_FADE = 0.96;    // 0.96 = Long, silky trails (Windy style)
const PARTICLE_WIDTH = 1.0;          // Thinner, crisper lines

// Windy-style Wave Color Scale
// Note: We handle 0.0 - 0.1 manually as transparent
const WINDY_WAVE_SCALE = chroma
  .scale([
    '#00E5FF', '#00D4FF', '#00BFFF', '#0099FF', '#0080FF', '#0066FF',
    '#3366FF', '#6666FF', '#9933FF', '#BB00FF', '#DD00DD', '#EE00AA',
    '#FF0088', '#FF0066', '#FF3366', '#FF5588', '#FF77AA', '#FF99CC',
    '#FFAADD', '#FFDDBB', '#FFFFAA'
  ])
  .domain([0.1, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9, 3.1, 3.5, 4.0, 4.5, 5.0, 6.0])
  .mode('lch');

// ------------------------------------------------------------------
// Math Helpers
// ------------------------------------------------------------------

/**
 * Bilinearly interpolate a scalar value (wave height)
 */
function bilinearInterpolate(
  q11: number, q12: number, q21: number, q22: number,
  x: number, y: number
): number {
  const r1 = q11 * (1 - x) + q21 * x;
  const r2 = q12 * (1 - x) + q22 * x;
  return r1 * (1 - y) + r2 * y;
}

/**
 * Bilinearly interpolate an angle (handling 0/360 wrapping)
 */
function bilinearInterpolateAngle(
  a11: number, a12: number, a21: number, a22: number,
  x: number, y: number
): number {
  // Convert angles to unit vectors
  const u11 = Math.cos(a11), v11 = Math.sin(a11);
  const u12 = Math.cos(a12), v12 = Math.sin(a12);
  const u21 = Math.cos(a21), v21 = Math.sin(a21);
  const u22 = Math.cos(a22), v22 = Math.sin(a22);

  // Interpolate components
  const u = bilinearInterpolate(u11, u12, u21, u22, x, y);
  const v = bilinearInterpolate(v11, v12, v21, v22, x, y);

  return Math.atan2(v, u);
}

// ------------------------------------------------------------------
// Data Processing
// ------------------------------------------------------------------

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

  // Determine grid resolution
  const sortedLats = [...new Set(lats)].sort((a, b) => a - b);
  const sortedLngs = [...new Set(lngs)].sort((a, b) => a - b);

  const latStep = sortedLats.length > 1 ? sortedLats[1] - sortedLats[0] : 0.05;
  const lngStep = sortedLngs.length > 1 ? sortedLngs[1] - sortedLngs[0] : 0.05;

  metadata.rows = Math.round((metadata.maxLat - metadata.minLat) / latStep) + 1;
  metadata.cols = Math.round((metadata.maxLng - metadata.minLng) / lngStep) + 1;

  // Initialize grids
  const grid: number[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(0));
  const seaMask: boolean[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(false));
  const directionGrid: number[][] = Array(metadata.rows).fill(0).map(() => Array(metadata.cols).fill(0));

  // Populate grids
  data.forEach(point => {
    const row = Math.round((point.lat - metadata.minLat) / latStep);
    const col = Math.round((point.lng - metadata.minLng) / lngStep);

    if (row >= 0 && row < metadata.rows && col >= 0 && col < metadata.cols) {
      grid[row][col] = point.value;
      seaMask[row][col] = true;
      // Convert degrees to radians and adjust direction (API is 'FROM', we need 'TO')
      // Meteorological standard: 0 = N, 90 = E.
      // Add 180 degrees (PI radians) to point "to" the direction of travel
      if (point.direction !== undefined) {
        const rads = (point.direction + 180) * (Math.PI / 180);
        directionGrid[row][col] = rads;
      }
    }
  });

  return { grid, seaMask, directionGrid, metadata, latStep, lngStep };
}

// ------------------------------------------------------------------
// Canvas Rendering (Land Mask) - Uses cached renderer for performance
// ------------------------------------------------------------------

// Configuration for wave heatmap land mask (used for destination-out clipping)
const WAVE_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000', // Solid black for clipping (destination-out composite)
  softEdges: true,
  blurRadius: 1.5,
  handleWrapping: true,
  skipBlurDuringMovement: true, // Performance optimization
};

// ------------------------------------------------------------------
// Canvas Rendering (Heatmap)
// ------------------------------------------------------------------

function renderHeatmapToCanvas(
  canvas: HTMLCanvasElement,
  bounds: L.LatLngBounds,
  cache: GridCache,
  opacity: number,
  maskCanvas?: HTMLCanvasElement
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  // Create an offscreen buffer for the heatmap to ensure smooth pixel manipulation
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const { minLat, minLng, maxLat, maxLng } = cache.metadata;

  // Iterate over every pixel in the canvas
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Convert pixel to lat/lng
      // Note: canvas Y increases downwards, Lat decreases downwards
      const latPct = 1 - (y / height);
      const lngPct = x / width;

      const lat = bounds.getSouth() + latPct * (bounds.getNorth() - bounds.getSouth());
      const lng = bounds.getWest() + lngPct * (bounds.getEast() - bounds.getWest());

      // Convert lat/lng to grid coordinates
      const gridX = (lng - minLng) / cache.lngStep;
      const gridY = (lat - minLat) / cache.latStep;

      const col = Math.floor(gridX);
      const row = Math.floor(gridY);

      // Relaxed boundary check to allow smooth interpolation at edges
      if (row >= 0 && row < cache.metadata.rows - 1 && col >= 0 && col < cache.metadata.cols - 1) {
        // Interpolate wave height
        const v = bilinearInterpolate(
          cache.grid[row][col], cache.grid[row][col+1],
          cache.grid[row+1][col], cache.grid[row+1][col+1],
          gridY - row, gridX - col
        );

        // Soft Fade: Instead of hard threshold, fade opacity near 0
        // This removes the "blocky" cyan edges on land
        if (v > 0.05) {
          const color = chroma(WINDY_WAVE_SCALE(v).hex()).rgba();
          const index = (y * width + x) * 4;

          // Smoothly fade alpha based on wave height
          // Small waves (0.05 - 0.2m) will be semi-transparent
          const softAlpha = Math.min(1, v * 3.0);

          data[index] = color[0];     // R
          data[index + 1] = color[1]; // G
          data[index + 2] = color[2]; // B
          data[index + 3] = color[3] * opacity * softAlpha * 255; // Alpha with soft fade
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply land mask to clip out wave pixels on land
  if (maskCanvas) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------------
// Particle Animation Class
// ------------------------------------------------------------------

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
    this.maxAge = PARTICLE_MAX_AGE + Math.random() * 100; // Longer random lifespan
    this.speedMultiplier = 0.6 + Math.random() * 0.4; // Random speed variance
  }

  respawn(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.age = 0;
    this.maxAge = PARTICLE_MAX_AGE + Math.random() * 100;
  }
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const SmoothWaveHeatmap = ({ gridData, visible, opacity, map }: SmoothWaveHeatmapProps) => {
  const layerRef = useRef<L.Layer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);        // Heatmap layer
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null); // Animation layer
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);    // Land mask for clipping
  const gridCache = useRef<GridCache | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);

  // Land features for clipping mask
  const [landFeatures, setLandFeatures] = useState<any>(null);

  // SeaMask for accurate point-in-sea checking
  const seaMaskRef = useRef<SeaMask | null>(null);

  // Cached mask renderer for performance
  const cachedRendererRef = useRef<CachedLandMaskRenderer | null>(null);

  // Track origin for proper positioning
  const originRef = useRef<L.Point | null>(null);

  // Track if we're actively moving (for performance optimization)
  const isMovingRef = useRef<boolean>(false);

  // Track if initial render is complete
  const [isInitialized, setIsInitialized] = useState(false);

  // Force update trigger
  const [forceUpdateTrigger, setForceUpdateTrigger] = useState(0);

  // Initialize Grid Data
  useEffect(() => {
    if (gridData && gridData.length > 0) {
      gridCache.current = createGrid(gridData);
      console.log('[SmoothWaveHeatmap] Grid cache updated with direction');
      // Trigger force update when grid data changes
      setForceUpdateTrigger(prev => prev + 1);
    }
  }, [gridData]);

  // Fetch Land GeoJSON for Clipping Mask and initialize SeaMask for accurate particle clipping
  useEffect(() => {
    const loadLandGeoJSON = async () => {
      // Initialize SeaMask for accurate point-in-sea checking (use 50m for good balance)
      const seaMask = new SeaMask({ resolution: '50m' });

      // Register callback for when data loads - this triggers a force redraw
      seaMask.onLoad(() => {
        console.log('[SmoothWaveHeatmap] SeaMask loaded, triggering force redraw');
        setForceUpdateTrigger(prev => prev + 1);
      });

      await seaMask.load();
      seaMaskRef.current = seaMask;

      // Get land features from SeaMask for canvas rendering
      const features = seaMask.getLandFeatures();
      if (features) {
        setLandFeatures(features);

        // Initialize cached renderer with land features
        if (!cachedRendererRef.current) {
          cachedRendererRef.current = new CachedLandMaskRenderer(WAVE_MASK_CONFIG);
        }
        cachedRendererRef.current.setLandFeatures(features);

        console.log('[SmoothWaveHeatmap] Land GeoJSON loaded via SeaMask (50m resolution)');
        setIsInitialized(true);
        return;
      }

      console.error('[SmoothWaveHeatmap] Failed to load land GeoJSON');
    };

    loadLandGeoJSON();

    return () => {
      // Cleanup cached renderer
      if (cachedRendererRef.current) {
        cachedRendererRef.current.dispose();
        cachedRendererRef.current = null;
      }
    };
  }, []);

  // Helper function to respawn particle in the sea only
  const respawnInSea = useCallback((p: Particle, width: number, height: number, bounds: L.LatLngBounds, maxAttempts = 10) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.age = 0;
      p.maxAge = PARTICLE_MAX_AGE + Math.random() * 100;

      // Convert to lat/lng and check if in sea
      const lng = bounds.getWest() + (p.x / width) * (bounds.getEast() - bounds.getWest());
      const lat = bounds.getNorth() - (p.y / height) * (bounds.getNorth() - bounds.getSouth());

      // Check with SeaMask if available
      if (seaMaskRef.current?.isReady()) {
        if (seaMaskRef.current.isInSea(lat, lng)) {
          return; // Found a valid sea position
        }
      } else {
        return; // If SeaMask not ready, accept any position
      }
    }
    // After max attempts, just use the last position (will be filtered later)
  }, []);

  // Animation Loop with proper requestAnimationFrame throttling
  const animateParticles = useCallback(() => {
    // Safety check for cleanup
    if (!particleCanvasRef.current) return;

    const canvas = particleCanvasRef.current;
    const cache = gridCache.current;

    if (!cache || !visible || !map) {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Smooth trails
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0, 0, 0, ${PARTICLE_TRAIL_FADE})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw new frame
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = PARTICLE_WIDTH;
    ctx.lineCap = 'round';

    const bounds = map.getBounds();
    const { minLat, minLng } = cache.metadata;

    // 3. Update and Draw Particles
    particlesRef.current.forEach(p => {
      // Kill old particles - respawn in sea only
      if (p.age > p.maxAge) {
        respawnInSea(p, width, height, bounds);
      }
      p.age++;

      // Convert Screen Pixel (x,y) -> Lat/Lng
      const lng = bounds.getWest() + (p.x / width) * (bounds.getEast() - bounds.getWest());
      const lat = bounds.getNorth() - (p.y / height) * (bounds.getNorth() - bounds.getSouth());

      // Get Grid Indices
      const gridX = (lng - minLng) / cache.lngStep;
      const gridY = (lat - minLat) / cache.latStep;
      const col = Math.floor(gridX);
      const row = Math.floor(gridY);

      // Check strictly against grid bounds
      if (row >= 0 && row < cache.metadata.rows - 1 && col >= 0 && col < cache.metadata.cols - 1) {
        // ACCURATE Sea Mask Check using GeoJSON coastline data
        // First check cached grid mask (fast), then verify with accurate polygon check if needed
        if (!cache.seaMask[row][col]) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        // Additional accurate check using SeaMask (polygon-based)
        // This catches particles that slip through grid-based check near coastlines
        if (seaMaskRef.current?.isReady() && !seaMaskRef.current.isInSea(lat, lng)) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        // Get Direction & Intensity
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

        // If wave height is near zero (land/calm), kill particle
        if (value < 0.1) {
          respawnInSea(p, width, height, bounds);
          return;
        }

        // Speed with variance
        const speed = (1 + value * 0.8) * PARTICLE_SPEED_SCALE * p.speedMultiplier;
        const dx = Math.cos(angle) * speed;
        const dy = -Math.sin(angle) * speed; // Canvas Y is inverted

        // Dynamic Opacity based on wave intensity
        const particleOpacity = Math.min(0.9, 0.4 + (value / 5.0) * 0.6);
        ctx.strokeStyle = `rgba(255, 255, 255, ${particleOpacity})`;

        // Draw Line Segment
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();

        // Update Position
        p.x += dx;
        p.y += dy;

        // Boundary Check (Screen) - respawn in sea
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          respawnInSea(p, width, height, bounds);
        }
      } else {
        // Particle hit land or went out of bounds -> Respawn in sea
        respawnInSea(p, width, height, bounds);
      }
    });

    // Apply land mask to clip particles on land
    if (maskCanvasRef.current) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvasRef.current, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    animationFrameRef.current = requestAnimationFrame(animateParticles);
  }, [map, visible, respawnInSea]);

  // Custom Layer Implementation
  useEffect(() => {
    if (!map) return;

    // --- STEP 1: CREATE CUSTOM PANE ---
    // This allows us to place the heatmap BETWEEN tiles and land labels
    const PANE_NAME = 'waveHeatmapPane';
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME);
      // Z-Index Strategy:
      // 200: TilePane (Base Map)
      // 250: **Wave Heatmap** (Sits on top of water, below land)
      // 400: OverlayPane (Land Mask / Labels)
      const pane = map.getPane(PANE_NAME);
      if (pane) pane.style.zIndex = '250';
    }

    const CustomLayer = L.Layer.extend({
      onAdd: function(map: L.Map) {
        const size = map.getSize();
        const bounds = map.getBounds();
        // Use Math.round to avoid sub-pixel jitter
        const rawTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());
        const topLeft = L.point(Math.round(rawTopLeft.x), Math.round(rawTopLeft.y));
        originRef.current = topLeft;

        const dpr = window.devicePixelRatio || 1;

        // --- Heatmap Canvas (Background) ---
        const canvas = L.DomUtil.create('canvas', 'leaflet-layer leaflet-zoom-animated') as HTMLCanvasElement;
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
        canvas.style.pointerEvents = 'none';

        // --- Particle Canvas (Foreground) ---
        const particleCanvas = L.DomUtil.create('canvas', 'leaflet-layer leaflet-zoom-animated') as HTMLCanvasElement;
        particleCanvas.width = size.x;  // Particles run better at native res
        particleCanvas.height = size.y;
        particleCanvas.style.width = `${size.x}px`;
        particleCanvas.style.height = `${size.y}px`;
        particleCanvas.style.pointerEvents = 'none';

        // --- Land Mask Canvas (Hidden, for clipping) ---
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = size.x;
        maskCanvas.height = size.y;
        // Don't add to DOM, used only for compositing

        // Add to CUSTOM PANE instead of overlayPane
        const pane = map.getPane(PANE_NAME);
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
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(size.x, size.y));

        // Position canvases using Leaflet's layer point system
        L.DomUtil.setPosition(canvas, topLeft);
        L.DomUtil.setPosition(particleCanvas, topLeft);

        // Initial Draw - only if data is ready
        // Use setTimeout to ensure React state is settled
        setTimeout(() => {
          this._update();
        }, 0);

        // Start Animation Loop
        cancelAnimationFrame(animationFrameRef.current);
        animateParticles();

        // Event Listeners - optimized for smooth pan/zoom
        map.on('movestart', this._onMoveStart, this);
        map.on('move', this._onMove, this);
        map.on('moveend', this._onMoveEnd, this);
        map.on('zoomstart', this._onZoomStart, this);
        map.on('zoomend', this._onZoomEnd, this);
        map.on('resize', this._resize, this);
      },

      onRemove: function(map: L.Map) {
        // Stop animation FIRST to prevent "undefined context" errors
        cancelAnimationFrame(animationFrameRef.current);

        if (this._canvas) L.DomUtil.remove(this._canvas);
        if (this._particleCanvas) L.DomUtil.remove(this._particleCanvas);
        // Mask canvas is not in DOM, no need to remove

        // Nullify refs immediately
        canvasRef.current = null;
        particleCanvasRef.current = null;
        maskCanvasRef.current = null;

        map.off('movestart', this._onMoveStart, this);
        map.off('move', this._onMove, this);
        map.off('moveend', this._onMoveEnd, this);
        map.off('zoomstart', this._onZoomStart, this);
        map.off('zoomend', this._onZoomEnd, this);
        map.off('resize', this._resize, this);
      },

      _onMoveStart: function() {
        // Mark as moving for performance optimization
        isMovingRef.current = true;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(true);
        }

        // Store the starting origin for smooth CSS transforms during pan
        if (originRef.current) {
          this._startOrigin = originRef.current;
        }
      },

      _onMove: function() {
        // During pan, use CSS transforms for smooth movement (no canvas redraw)
        if (!this._canvas || !this._particleCanvas) return;

        const bounds = map.getBounds();
        const currentTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());

        // Move canvases using Leaflet's positioning (uses CSS transforms internally)
        L.DomUtil.setPosition(this._canvas, currentTopLeft);
        L.DomUtil.setPosition(this._particleCanvas, currentTopLeft);
      },

      _onMoveEnd: function() {
        // Mark movement complete
        isMovingRef.current = false;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(false);
        }

        // Full redraw with blur
        this._update();
      },

      _onZoomStart: function() {
        // Mark as moving for performance optimization
        isMovingRef.current = true;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(true);
        }
      },

      _onZoomEnd: function() {
        // Mark movement complete
        isMovingRef.current = false;
        if (cachedRendererRef.current) {
          cachedRendererRef.current.setMoving(false);
          // Invalidate cache on zoom change (projection changed)
          cachedRendererRef.current.invalidateCache();
        }

        // Full redraw
        this._update();
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
          this._particleCanvas.width = size.x; // Use logical pixels for particles for performance
          this._particleCanvas.height = size.y;
          this._particleCanvas.style.width = `${size.x}px`;
          this._particleCanvas.style.height = `${size.y}px`;
          // Reset particles on resize
          particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => new Particle(size.x, size.y));
        }
        if (this._maskCanvas) {
          this._maskCanvas.width = size.x;
          this._maskCanvas.height = size.y;
        }

        // Invalidate cache on resize
        if (cachedRendererRef.current) {
          cachedRendererRef.current.invalidateCache();
        }

        this._update();
      },

      _update: function() {
        // Check if we have the required data
        if (!this._canvas) return;

        // IMPORTANT: Check gridCache.current exists before rendering
        // This fixes the "ghost arrows" bug where particles appear before heatmap
        if (!gridCache.current) {
          console.log('[SmoothWaveHeatmap] Waiting for grid data...');
          return;
        }

        const bounds = map.getBounds();
        // Use Math.round to avoid sub-pixel jitter
        const rawTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());
        const topLeft = L.point(Math.round(rawTopLeft.x), Math.round(rawTopLeft.y));
        originRef.current = topLeft;

        // Position canvases using Leaflet's layer point system
        L.DomUtil.setPosition(this._canvas, topLeft);
        L.DomUtil.setPosition(this._particleCanvas, topLeft);

        // Render land mask if available - use cached renderer for performance
        if (this._maskCanvas && landFeatures) {
          if (cachedRendererRef.current) {
            // Use cached renderer (fast - just draws from cache)
            cachedRendererRef.current.render(this._maskCanvas, map, topLeft);
          } else {
            // Fallback to direct rendering
            renderLandMaskToCanvas(
              this._maskCanvas,
              landFeatures,
              map,
              topLeft,
              WAVE_MASK_CONFIG,
              isMovingRef.current
            );
          }
        }

        // Render Static Heatmap with land mask clipping
        renderHeatmapToCanvas(this._canvas, bounds, gridCache.current, opacity, this._maskCanvas);

        // Clear particles on move to prevent "streaking" artifacts during pan
        const pCtx = this._particleCanvas.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, this._particleCanvas.width, this._particleCanvas.height);

        console.log('[SmoothWaveHeatmap] Render complete');
      }
    });

    const layer = new CustomLayer();
    layerRef.current = layer;

    if (visible) {
      map.addLayer(layer);
    }

    return () => {
      // Robust Cleanup
      cancelAnimationFrame(animationFrameRef.current);
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, visible, opacity, landFeatures, animateParticles]);

  // Force redraw when data becomes available or changes
  useEffect(() => {
    if (forceUpdateTrigger > 0 && layerRef.current && map) {
      // Trigger a manual update
      const layer = layerRef.current as any;
      if (layer._update) {
        console.log('[SmoothWaveHeatmap] Force redraw triggered');
        layer._update();
      }
    }
  }, [forceUpdateTrigger, map]);

  return null;
};

export default SmoothWaveHeatmap;
