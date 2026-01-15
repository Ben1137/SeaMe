/**
 * SeaMaskUtils - Utility functions for determining if a point is in the ocean/sea
 * Uses GeoJSON land polygons for accurate coastline-based particle clipping
 *
 * Performance optimizations:
 * - Cached mask rendering using OffscreenCanvas
 * - Blur filter only applied on final render (not during movement)
 * - Zoom-level based cache invalidation
 */

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Point {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface SeaMaskConfig {
  resolution: '10m' | '50m' | '110m';
  cacheSize?: number;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const GEOJSON_BASE_PATH = '/SeaYou/geojson';
const REMOTE_BASE_PATH = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const LAND_URLS = {
  '10m': {
    local: `${GEOJSON_BASE_PATH}/10m/land.json`,
    fallback: `${REMOTE_BASE_PATH}/ne_10m_land.geojson`,
  },
  '50m': {
    local: `${GEOJSON_BASE_PATH}/50m/land.json`,
    fallback: `${REMOTE_BASE_PATH}/ne_50m_land.geojson`,
  },
  '110m': {
    local: `${GEOJSON_BASE_PATH}/110m/land.json`,
    fallback: `${REMOTE_BASE_PATH}/ne_110m_land.geojson`,
  },
};

// ------------------------------------------------------------------
// Point-in-Polygon Algorithm (Ray Casting)
// ------------------------------------------------------------------

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * This is accurate and handles complex polygon shapes including holes
 */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is inside a GeoJSON polygon (handles holes)
 */
function pointInGeoJSONPolygon(point: [number, number], coordinates: [number, number][][]): boolean {
  // First ring is the outer boundary
  if (!pointInPolygon(point, coordinates[0])) {
    return false;
  }

  // Subsequent rings are holes - if point is in any hole, it's outside the polygon
  for (let i = 1; i < coordinates.length; i++) {
    if (pointInPolygon(point, coordinates[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Quick bounding box check before expensive point-in-polygon test
 */
function pointInBoundingBox(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const [px, py] of polygon) {
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

// ------------------------------------------------------------------
// SeaMask Class - Main utility for land/sea detection
// ------------------------------------------------------------------

export class SeaMask {
  private landFeatures: any = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private resolution: '10m' | '50m' | '110m';

  // Spatial index for faster lookups - grid-based caching
  private gridCache: Map<string, boolean> = new Map();
  private gridResolution = 0.1; // degrees per grid cell

  // Pre-computed bounding boxes for each land polygon
  private polygonBBoxes: Array<{
    bbox: BoundingBox;
    coordinates: [number, number][][];
    type: 'Polygon' | 'MultiPolygon';
  }> = [];

  // Load state callbacks
  private onLoadCallbacks: Array<() => void> = [];

  constructor(config: SeaMaskConfig = { resolution: '50m' }) {
    this.resolution = config.resolution;
  }

  /**
   * Load land GeoJSON data
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._loadData();
    return this.loadPromise;
  }

  private async _loadData(): Promise<void> {
    const urls = LAND_URLS[this.resolution];

    // Try local first
    try {
      const response = await fetch(urls.local);
      if (response.ok) {
        this.landFeatures = await response.json();
        console.log(`[SeaMask] Loaded land data from local (${this.resolution})`);
        this._buildSpatialIndex();
        this.isLoaded = true;
        this._notifyLoadCallbacks();
        return;
      }
    } catch (error) {
      // Continue to fallback
    }

    // Try remote fallback
    try {
      const response = await fetch(urls.fallback);
      if (response.ok) {
        this.landFeatures = await response.json();
        console.log(`[SeaMask] Loaded land data from remote fallback (${this.resolution})`);
        this._buildSpatialIndex();
        this.isLoaded = true;
        this._notifyLoadCallbacks();
        return;
      }
    } catch (error) {
      console.error('[SeaMask] Failed to load land data:', error);
    }
  }

  /**
   * Register a callback to be notified when data is loaded
   */
  onLoad(callback: () => void): void {
    if (this.isLoaded) {
      callback();
    } else {
      this.onLoadCallbacks.push(callback);
    }
  }

  private _notifyLoadCallbacks(): void {
    for (const callback of this.onLoadCallbacks) {
      try {
        callback();
      } catch (e) {
        console.error('[SeaMask] onLoad callback error:', e);
      }
    }
    this.onLoadCallbacks = [];
  }

  /**
   * Build spatial index for faster lookups
   */
  private _buildSpatialIndex(): void {
    if (!this.landFeatures?.features) return;

    this.polygonBBoxes = [];

    for (const feature of this.landFeatures.features) {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates;
        const bbox = this._computeBBox(coords[0]);
        this.polygonBBoxes.push({
          bbox,
          coordinates: coords,
          type: 'Polygon',
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const bbox = this._computeBBox(polygon[0]);
          this.polygonBBoxes.push({
            bbox,
            coordinates: polygon,
            type: 'Polygon',
          });
        }
      }
    }

    console.log(`[SeaMask] Built spatial index with ${this.polygonBBoxes.length} polygons`);
  }

  private _computeBBox(ring: [number, number][]): BoundingBox {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Check if a point is in the sea (not on land)
   * Returns true if the point is in the ocean/sea
   */
  isInSea(lat: number, lng: number): boolean {
    if (!this.isLoaded) {
      console.warn('[SeaMask] Data not loaded yet');
      return true; // Assume sea if not loaded
    }

    // Check grid cache first
    const gridKey = this._getGridKey(lat, lng);
    if (this.gridCache.has(gridKey)) {
      return this.gridCache.get(gridKey)!;
    }

    // Check if point is on land
    const isOnLand = this._isPointOnLand(lng, lat);
    const isInSea = !isOnLand;

    // Cache result
    this.gridCache.set(gridKey, isInSea);

    return isInSea;
  }

  /**
   * Check if a point is on land
   */
  private _isPointOnLand(lng: number, lat: number): boolean {
    const point: [number, number] = [lng, lat];

    // Check against all polygons with spatial filtering
    for (const { bbox, coordinates } of this.polygonBBoxes) {
      // Quick bounding box check
      if (lng < bbox.minLng || lng > bbox.maxLng ||
          lat < bbox.minLat || lat > bbox.maxLat) {
        continue;
      }

      // Full point-in-polygon test
      if (pointInGeoJSONPolygon(point, coordinates)) {
        return true;
      }
    }

    return false;
  }

  private _getGridKey(lat: number, lng: number): string {
    const gridLat = Math.floor(lat / this.gridResolution);
    const gridLng = Math.floor(lng / this.gridResolution);
    return `${gridLat},${gridLng}`;
  }

  /**
   * Clear the cache (useful when changing resolution)
   */
  clearCache(): void {
    this.gridCache.clear();
  }

  /**
   * Get the raw land features for canvas-based masking
   */
  getLandFeatures(): any {
    return this.landFeatures;
  }

  /**
   * Check if data is loaded
   */
  isReady(): boolean {
    return this.isLoaded;
  }
}

// ------------------------------------------------------------------
// Singleton instance for shared use across components
// ------------------------------------------------------------------

let sharedSeaMask: SeaMask | null = null;

/**
 * Get the shared SeaMask instance
 * Uses 50m resolution by default for good balance of accuracy and performance
 */
export function getSharedSeaMask(resolution: '10m' | '50m' | '110m' = '50m'): SeaMask {
  if (!sharedSeaMask || sharedSeaMask['resolution'] !== resolution) {
    sharedSeaMask = new SeaMask({ resolution });
  }
  return sharedSeaMask;
}

/**
 * Initialize the shared SeaMask (call early to preload data)
 */
export async function initializeSeaMask(resolution: '10m' | '50m' | '110m' = '50m'): Promise<SeaMask> {
  const mask = getSharedSeaMask(resolution);
  await mask.load();
  return mask;
}

// ------------------------------------------------------------------
// Canvas-based mask rendering utilities with CACHING
// ------------------------------------------------------------------

/**
 * Configuration for land mask rendering
 */
export interface LandMaskConfig {
  /** Fill color for land areas (default: solid black for clipping) */
  fillStyle?: string;
  /** Enable soft edges with blur (default: true for final render only) */
  softEdges?: boolean;
  /** Blur radius in pixels for soft edges (default: 1.5) */
  blurRadius?: number;
  /** Handle date-line wrapping for world copies (default: true) */
  handleWrapping?: boolean;
  /** Skip blur during active movement for performance (default: true) */
  skipBlurDuringMovement?: boolean;
}

const DEFAULT_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000',
  softEdges: true,
  blurRadius: 1.5,
  handleWrapping: true,
  skipBlurDuringMovement: true,
};

/**
 * Cached Land Mask Renderer
 *
 * This class caches the rendered mask at each zoom level to avoid
 * expensive polygon rendering on every frame. Only redraws when:
 * - Zoom level changes
 * - Canvas size changes
 * - Force invalidate is called
 *
 * Performance optimizations:
 * - Reduced padding (10% instead of 50%) to lower memory usage
 * - Viewport culling to skip off-screen polygons
 * - Debounced regeneration to wait for zoom completion
 * - Simplified rendering (no blur during cache generation)
 * - CHUNKED RENDERING: Draws polygons in batches to avoid blocking main thread
 */
export class CachedLandMaskRenderer {
  private cacheCanvas: HTMLCanvasElement | null = null;
  private cachedZoom: number = -1;
  private cachedWidth: number = 0;
  private cachedHeight: number = 0;
  private cachedOrigin: L.Point | null = null;
  private isMoving: boolean = false;
  private landFeatures: any = null;
  private config: LandMaskConfig;

  // Debounce timer for cache regeneration
  private regenerateTimer: ReturnType<typeof setTimeout> | null = null;
  private isRegenerating: boolean = false;

  // Chunked rendering state
  private chunkRenderAbort: boolean = false;
  private currentChunkIndex: number = 0;

  // Pre-computed polygon bounding boxes for viewport culling
  private polygonBounds: Array<{
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
    coordinates: [number, number][][];
  }> = [];

  constructor(config: LandMaskConfig = {}) {
    this.config = { ...DEFAULT_MASK_CONFIG, ...config };
  }

  /**
   * Set land features data and pre-compute bounding boxes
   */
  setLandFeatures(features: any): void {
    this.landFeatures = features;
    this._precomputeBounds();
    this.invalidateCache();
  }

  /**
   * Pre-compute bounding boxes for all polygons (for viewport culling)
   */
  private _precomputeBounds(): void {
    this.polygonBounds = [];
    if (!this.landFeatures?.features) return;

    for (const feature of this.landFeatures.features) {
      if (feature.geometry.type === 'Polygon') {
        const bounds = this._computePolygonBounds(feature.geometry.coordinates[0]);
        this.polygonBounds.push({ ...bounds, coordinates: feature.geometry.coordinates });
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          const bounds = this._computePolygonBounds(polygon[0]);
          this.polygonBounds.push({ ...bounds, coordinates: polygon });
        }
      }
    }

    console.log(`[CachedLandMaskRenderer] Pre-computed bounds for ${this.polygonBounds.length} polygons`);
  }

  /**
   * Compute bounding box for a polygon ring
   */
  private _computePolygonBounds(ring: [number, number][]): {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  } {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    return { minLng, maxLng, minLat, maxLat };
  }

  /**
   * Mark that we're in active movement (skip blur for performance)
   */
  setMoving(moving: boolean): void {
    this.isMoving = moving;
  }

  /**
   * Invalidate the cache to force a full redraw
   */
  invalidateCache(): void {
    this.cachedZoom = -1;
    this.cachedWidth = 0;
    this.cachedHeight = 0;
    this.cachedOrigin = null;

    // Cancel any pending regeneration
    if (this.regenerateTimer) {
      clearTimeout(this.regenerateTimer);
      this.regenerateTimer = null;
    }

    // Abort any in-progress chunked rendering
    this.chunkRenderAbort = true;
    this.currentChunkIndex = 0;
  }

  /**
   * Render the land mask to the target canvas
   * Uses cached rendering when possible for optimal performance
   */
  render(
    targetCanvas: HTMLCanvasElement,
    map: L.Map,
    origin: L.Point
  ): void {
    if (!this.landFeatures) return;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const zoom = Math.round(map.getZoom());
    const width = targetCanvas.width;
    const height = targetCanvas.height;

    // Check if we need to regenerate the cache
    const needsRedraw =
      zoom !== this.cachedZoom ||
      width !== this.cachedWidth ||
      height !== this.cachedHeight ||
      !this.cacheCanvas;

    if (needsRedraw && !this.isRegenerating) {
      // Debounce regeneration - wait 100ms after last call
      // This prevents regenerating during rapid zoom animations
      if (this.regenerateTimer) {
        clearTimeout(this.regenerateTimer);
      }

      this.regenerateTimer = setTimeout(() => {
        this._renderToCache(map, width, height, origin);
        this.cachedZoom = zoom;
        this.cachedWidth = width;
        this.cachedHeight = height;
        this.regenerateTimer = null;
      }, 100);
    }

    // Clear target canvas
    ctx.clearRect(0, 0, width, height);

    // If we have a cached canvas, just draw it (very fast!)
    if (this.cacheCanvas && this.cachedOrigin) {
      // Calculate offset from cached origin to current origin
      const offsetX = Math.round(origin.x - this.cachedOrigin.x);
      const offsetY = Math.round(origin.y - this.cachedOrigin.y);

      // Draw the cached mask offset by the pan amount
      ctx.drawImage(this.cacheCanvas, -offsetX, -offsetY);
    }
  }

  /**
   * Render land polygons to the cache canvas using CHUNKED RENDERING
   * This prevents main thread blocking by processing polygons in batches
   * and yielding to the browser between chunks using requestAnimationFrame
   */
  private _renderToCache(
    map: L.Map,
    width: number,
    height: number,
    origin: L.Point
  ): void {
    this.isRegenerating = true;
    this.chunkRenderAbort = false;

    // REDUCED PADDING: 10% instead of 50% to save memory
    const padding = Math.min(width, height) * 0.1;
    const cacheWidth = Math.round(width + padding * 2);
    const cacheHeight = Math.round(height + padding * 2);

    // Limit max canvas size to prevent memory issues
    const MAX_CANVAS_SIZE = 2048;
    const finalWidth = Math.min(cacheWidth, MAX_CANVAS_SIZE);
    const finalHeight = Math.min(cacheHeight, MAX_CANVAS_SIZE);

    if (!this.cacheCanvas ||
        this.cacheCanvas.width !== finalWidth ||
        this.cacheCanvas.height !== finalHeight) {
      this.cacheCanvas = document.createElement('canvas');
      this.cacheCanvas.width = finalWidth;
      this.cacheCanvas.height = finalHeight;
    }

    const ctx = this.cacheCanvas.getContext('2d');
    if (!ctx) {
      this.isRegenerating = false;
      return;
    }

    // Adjust origin for padding
    const actualPaddingX = (finalWidth - width) / 2;
    const actualPaddingY = (finalHeight - height) / 2;
    const paddedOrigin = L.point(
      Math.round(origin.x - actualPaddingX),
      Math.round(origin.y - actualPaddingY)
    );
    this.cachedOrigin = L.point(origin.x - actualPaddingX, origin.y - actualPaddingY);

    // Clear cache canvas
    ctx.clearRect(0, 0, finalWidth, finalHeight);

    // Set fill style - NO BLUR during cache generation for performance
    ctx.fillStyle = this.config.fillStyle || '#000000';

    // Get viewport bounds for culling
    const bounds = map.getBounds();
    const viewMinLng = bounds.getWest() - 10; // Add margin
    const viewMaxLng = bounds.getEast() + 10;
    const viewMinLat = bounds.getSouth() - 10;
    const viewMaxLat = bounds.getNorth() + 10;

    // Calculate world width for wrapping
    const worldWidth = getWorldWidthInPixels(map);

    // Filter visible polygons first (viewport culling)
    const visiblePolygons = this.polygonBounds.filter(poly =>
      !(poly.maxLng < viewMinLng || poly.minLng > viewMaxLng ||
        poly.maxLat < viewMinLat || poly.minLat > viewMaxLat)
    );

    // CHUNKED RENDERING: Process 25 polygons per frame to avoid blocking
    const CHUNK_SIZE = 25;
    let drawnCount = 0;

    const renderChunk = (startIndex: number) => {
      // Check if rendering was aborted (e.g., zoom changed)
      if (this.chunkRenderAbort) {
        this.isRegenerating = false;
        return;
      }

      const endIndex = Math.min(startIndex + CHUNK_SIZE, visiblePolygons.length);

      // Draw this chunk of polygons
      for (let i = startIndex; i < endIndex; i++) {
        const poly = visiblePolygons[i];

        // Draw this polygon
        drawPolygonToCanvasSimple(ctx, map, poly.coordinates, paddedOrigin);

        // Handle wrapping if enabled
        if (this.config.handleWrapping && worldWidth > 0) {
          const wrappedOriginLeft = L.point(paddedOrigin.x + worldWidth, paddedOrigin.y);
          const wrappedOriginRight = L.point(paddedOrigin.x - worldWidth, paddedOrigin.y);
          drawPolygonToCanvasSimple(ctx, map, poly.coordinates, wrappedOriginLeft);
          drawPolygonToCanvasSimple(ctx, map, poly.coordinates, wrappedOriginRight);
        }

        drawnCount++;
      }

      // If more polygons to process, schedule next chunk
      if (endIndex < visiblePolygons.length) {
        // Use requestAnimationFrame to yield to the browser
        // This prevents "Page Unresponsive" warnings
        requestAnimationFrame(() => renderChunk(endIndex));
      } else {
        // Rendering complete
        this.isRegenerating = false;
        console.log(`[CachedLandMaskRenderer] Cache regenerated: ${drawnCount}/${this.polygonBounds.length} polygons at zoom ${Math.round(map.getZoom())}`);
      }
    };

    // Start chunked rendering
    if (visiblePolygons.length > 0) {
      renderChunk(0);
    } else {
      this.isRegenerating = false;
      console.log(`[CachedLandMaskRenderer] No visible polygons at zoom ${Math.round(map.getZoom())}`);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Abort any in-progress chunked rendering
    this.chunkRenderAbort = true;

    if (this.regenerateTimer) {
      clearTimeout(this.regenerateTimer);
      this.regenerateTimer = null;
    }
    this.cacheCanvas = null;
    this.landFeatures = null;
    this.polygonBounds = [];
    this.isRegenerating = false;
  }
}

/**
 * Simplified polygon drawing without blur filter
 * Much faster for bulk rendering
 */
function drawPolygonToCanvasSimple(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  coordinates: [number, number][][],
  origin: L.Point
): void {
  ctx.beginPath();

  // Outer ring
  const outerRing = coordinates[0];
  for (let i = 0; i < outerRing.length; i++) {
    const [lng, lat] = outerRing[i];
    const layerPoint = map.latLngToLayerPoint([lat, lng]);
    const x = layerPoint.x - origin.x;
    const y = layerPoint.y - origin.y;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  // Handle holes
  for (let h = 1; h < coordinates.length; h++) {
    const hole = coordinates[h];
    for (let i = 0; i < hole.length; i++) {
      const [lng, lat] = hole[i];
      const layerPoint = map.latLngToLayerPoint([lat, lng]);
      const x = layerPoint.x - origin.x;
      const y = layerPoint.y - origin.y;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }

  ctx.fill('evenodd');
}

/**
 * Render land features to a canvas for use as a clipping mask
 * This is the legacy non-cached version, kept for compatibility
 *
 * For better performance, use CachedLandMaskRenderer instead
 */
export function renderLandMaskToCanvas(
  canvas: HTMLCanvasElement,
  landFeatures: any,
  map: L.Map,
  origin?: L.Point,
  config: LandMaskConfig = {},
  isMoving: boolean = false
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !landFeatures) return;

  const mergedConfig = { ...DEFAULT_MASK_CONFIG, ...config };
  const { width, height } = canvas;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Calculate origin if not provided, using Math.round to avoid sub-pixel jitter
  const bounds = map.getBounds();
  const rawOrigin = origin || map.latLngToLayerPoint(bounds.getNorthWest());
  const topLeft = L.point(Math.round(rawOrigin.x), Math.round(rawOrigin.y));

  // Calculate world width in pixels for date-line wrapping
  const worldWidth = getWorldWidthInPixels(map);

  // Apply soft edge blur filter - but SKIP during active movement for performance
  const shouldBlur = mergedConfig.softEdges &&
                     mergedConfig.blurRadius &&
                     (!isMoving || !mergedConfig.skipBlurDuringMovement);

  if (shouldBlur) {
    ctx.filter = `blur(${mergedConfig.blurRadius}px)`;
  }

  // Set fill style
  ctx.fillStyle = mergedConfig.fillStyle || '#000000';

  // Draw all land polygons
  for (const feature of landFeatures.features) {
    if (feature.geometry.type === 'Polygon') {
      drawPolygonWithWrapping(ctx, map, feature.geometry.coordinates, topLeft, worldWidth, mergedConfig.handleWrapping);
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const polygon of feature.geometry.coordinates) {
        drawPolygonWithWrapping(ctx, map, polygon, topLeft, worldWidth, mergedConfig.handleWrapping);
      }
    }
  }

  // Reset filter after drawing
  ctx.filter = 'none';
}

/**
 * Get the width of one world copy in pixels at current zoom
 */
function getWorldWidthInPixels(map: L.Map): number {
  const zoom = map.getZoom();
  // Leaflet uses 256px tiles, world width = 256 * 2^zoom
  return 256 * Math.pow(2, zoom);
}

/**
 * Draw a polygon with date-line wrapping support
 * Handles the case where the map is panned across the 180° meridian
 */
function drawPolygonWithWrapping(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  coordinates: [number, number][][],
  origin: L.Point,
  worldWidth: number,
  handleWrapping?: boolean
): void {
  // Draw the polygon at its primary position
  drawPolygonToCanvas(ctx, map, coordinates, origin);

  // If wrapping is enabled, draw additional copies for seamless scrolling
  if (handleWrapping && worldWidth > 0) {
    const canvasWidth = ctx.canvas.width;

    // Check if we need to draw wrapped copies
    // Draw copies to the left and right to handle infinite horizontal scrolling
    const wrappingOffsets = [-worldWidth, worldWidth];

    for (const offset of wrappingOffsets) {
      // Create an offset origin for the wrapped copy
      const wrappedOrigin = L.point(origin.x - offset, origin.y);

      // Only draw if the wrapped polygon might be visible
      // Quick check: if the offset would put the polygon completely off-screen, skip it
      const potentiallyVisible = Math.abs(offset) < canvasWidth + worldWidth;

      if (potentiallyVisible) {
        drawPolygonToCanvas(ctx, map, coordinates, wrappedOrigin);
      }
    }
  }
}

/**
 * Helper to draw a GeoJSON polygon to canvas using layer points
 * This ensures consistent coordinate projection across all layers
 */
function drawPolygonToCanvas(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  coordinates: [number, number][][],
  origin: L.Point
): void {
  ctx.beginPath();

  // Outer ring
  const outerRing = coordinates[0];
  for (let i = 0; i < outerRing.length; i++) {
    // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
    const [lng, lat] = outerRing[i];
    const layerPoint = map.latLngToLayerPoint([lat, lng]);

    // Convert to canvas coordinates relative to origin (rounded to avoid sub-pixel issues)
    const x = Math.round(layerPoint.x - origin.x);
    const y = Math.round(layerPoint.y - origin.y);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  // Handle holes (inner rings) - use evenodd fill rule
  for (let h = 1; h < coordinates.length; h++) {
    const hole = coordinates[h];
    for (let i = 0; i < hole.length; i++) {
      const [lng, lat] = hole[i];
      const layerPoint = map.latLngToLayerPoint([lat, lng]);
      const x = Math.round(layerPoint.x - origin.x);
      const y = Math.round(layerPoint.y - origin.y);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }

  ctx.fill('evenodd');
}

export default SeaMask;
