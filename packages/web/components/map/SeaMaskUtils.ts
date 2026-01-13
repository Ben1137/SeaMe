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
 * Render land features to a canvas for use as a clipping mask
 * This creates a mask where land areas are filled (to be cut out)
 */
export function renderLandMaskToCanvas(
  canvas: HTMLCanvasElement,
  landFeatures: any,
  map: L.Map
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !landFeatures) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  // Draw land polygons in black (to be cut out)
  ctx.fillStyle = '#000000';

  for (const feature of landFeatures.features) {
    if (feature.geometry.type === 'Polygon') {
      drawPolygonToCanvas(ctx, map, feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const polygon of feature.geometry.coordinates) {
        drawPolygonToCanvas(ctx, map, polygon);
      }
    }
  }
}

/**
 * Helper to draw a GeoJSON polygon to canvas
 */
function drawPolygonToCanvas(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  coordinates: [number, number][][]
): void {
  // Draw outer ring
  ctx.beginPath();

  const outerRing = coordinates[0];
  for (let i = 0; i < outerRing.length; i++) {
    const [lng, lat] = outerRing[i];
    const point = map.latLngToContainerPoint([lat, lng]);

    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.closePath();

  // Handle holes (inner rings) - use evenodd fill rule
  for (let h = 1; h < coordinates.length; h++) {
    const hole = coordinates[h];
    for (let i = 0; i < hole.length; i++) {
      const [lng, lat] = hole[i];
      const point = map.latLngToContainerPoint([lat, lng]);

      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.closePath();
  }

  ctx.fill('evenodd');
}

export default SeaMask;
