/**
 * SeaMaskUtils - Utility functions for determining if a point is in the ocean/sea
 * Uses GeoJSON land polygons for accurate coastline-based particle clipping
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
        return;
      }
    } catch (error) {
      console.error('[SeaMask] Failed to load land data:', error);
    }
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
// Canvas-based mask rendering utilities
// ------------------------------------------------------------------

/**
 * Configuration for land mask rendering
 */
export interface LandMaskConfig {
  /** Fill color for land areas (default: solid black for clipping) */
  fillStyle?: string;
  /** Enable soft edges with blur (default: true) */
  softEdges?: boolean;
  /** Blur radius in pixels for soft edges (default: 1.5) */
  blurRadius?: number;
  /** Handle date-line wrapping for world copies (default: true) */
  handleWrapping?: boolean;
}

const DEFAULT_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000',
  softEdges: true,
  blurRadius: 1.5,
  handleWrapping: true,
};

/**
 * Render land features to a canvas for use as a clipping mask
 * This creates a mask where land areas are filled (to be cut out)
 *
 * IMPORTANT: Uses latLngToLayerPoint for consistent projection with other layers.
 * The origin parameter is the top-left corner in layer coordinates.
 *
 * Features:
 * - Anti-aliased soft edges using canvas filter blur
 * - Date-line wrapping support for seamless Pacific crossing
 * - Configurable fill style for transparency effects
 */
export function renderLandMaskToCanvas(
  canvas: HTMLCanvasElement,
  landFeatures: any,
  map: L.Map,
  origin?: L.Point,
  config: LandMaskConfig = {}
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

  // Apply soft edge blur filter before drawing
  if (mergedConfig.softEdges && mergedConfig.blurRadius) {
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
