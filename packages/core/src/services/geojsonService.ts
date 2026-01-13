/**
 * GeoJSON Service for SeaYou Marine Weather Application
 *
 * Provides comprehensive GeoJSON data management for marine cartography including:
 * - Multi-resolution coastlines (10m, 50m, 110m)
 * - Ocean and land polygons
 * - Bathymetry depth contours
 * - Marine features (ports, reefs, lakes, rivers)
 *
 * Features intelligent caching and zoom-based resolution selection
 * for optimal performance across different map zoom levels.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A single GeoJSON feature representing a geographic entity
 */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'MultiLineString';
    coordinates: any;
  };
  properties: Record<string, any>;
}

/**
 * A collection of GeoJSON features
 */
export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Available resolution levels for GeoJSON data
 * - 10m: High detail for close zoom levels (zoom > 7)
 * - 50m: Medium detail for intermediate zoom (zoom 5-7)
 * - 110m: Low detail for overview zoom (zoom <= 4)
 */
export type Resolution = '10m' | '50m' | '110m';

/**
 * Available layer types for GeoJSON data
 */
export type LayerType =
  | 'coastline'
  | 'ocean'
  | 'land'
  | 'lakes'
  | 'rivers'
  | 'marine_areas'
  | 'ports'
  | 'reefs'
  | 'minor_islands';

/**
 * Bathymetry depth layer configuration
 */
export interface BathymetryLayers {
  depth_200m?: GeoJSONCollection;
  depth_1000m?: GeoJSONCollection;
  depth_2000m?: GeoJSONCollection;
  depth_3000m?: GeoJSONCollection;
}

/**
 * Complete set of GeoJSON layers available for rendering
 */
export interface GeoJSONLayer {
  coastline?: GeoJSONCollection;
  ocean?: GeoJSONCollection;
  land?: GeoJSONCollection;
  lakes?: GeoJSONCollection;
  rivers?: GeoJSONCollection;
  marine_areas?: GeoJSONCollection;
  ports?: GeoJSONCollection;
  reefs?: GeoJSONCollection;
  minor_islands?: GeoJSONCollection;
  bathymetry?: BathymetryLayers;
}

/**
 * Cache entry metadata
 */
interface CacheEntry {
  data: GeoJSONCollection;
  timestamp: number;
  size: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Base path for GeoJSON files - configured for GitHub Pages deployment
 */
const GEOJSON_BASE_PATH = '/SeaYou/geojson';

/**
 * Available layers with their file patterns
 */
const AVAILABLE_LAYERS: LayerType[] = [
  'coastline',
  'ocean',
  'land',
  'lakes',
  'rivers',
  'marine_areas',
  'ports',
  'reefs',
  'minor_islands'
];

/**
 * Bathymetry depth values in meters
 */
const BATHYMETRY_DEPTHS = [200, 1000, 2000, 3000] as const;

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
};

// ============================================================================
// Caching System
// ============================================================================

/**
 * In-memory cache for GeoJSON data to avoid re-fetching
 */
const geoJSONCache: Map<string, CacheEntry> = new Map();

/**
 * Track in-flight requests to prevent duplicate fetches
 */
const pendingRequests: Map<string, Promise<GeoJSONCollection>> = new Map();

/**
 * Generate a cache key for a layer and resolution combination
 */
const getCacheKey = (layer: string, resolution: Resolution): string => {
  return `${layer}:${resolution}`;
};

/**
 * Get the total size of cached data in bytes
 */
const getCacheSize = (): number => {
  let totalSize = 0;
  geoJSONCache.forEach((entry) => {
    totalSize += entry.size;
  });
  return totalSize;
};

/**
 * Evict oldest entries from cache to make room for new data
 */
const evictOldestEntries = (neededBytes: number): void => {
  const entries = Array.from(geoJSONCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  let freedBytes = 0;
  for (const [key, entry] of entries) {
    if (freedBytes >= neededBytes) break;
    freedBytes += entry.size;
    geoJSONCache.delete(key);
  }
};

/**
 * Check if a cache entry is still valid
 */
const isCacheEntryValid = (entry: CacheEntry): boolean => {
  const age = Date.now() - entry.timestamp;
  return age < CACHE_CONFIG.MAX_AGE_MS;
};

/**
 * Get data from cache if available and valid
 */
const getFromCache = (key: string): GeoJSONCollection | null => {
  const entry = geoJSONCache.get(key);

  if (!entry) {
    return null;
  }

  if (!isCacheEntryValid(entry)) {
    geoJSONCache.delete(key);
    return null;
  }

  return entry.data;
};

/**
 * Store data in cache with size tracking
 */
const setInCache = (key: string, data: GeoJSONCollection): void => {
  const serialized = JSON.stringify(data);
  const size = new Blob([serialized]).size;

  // Check if we need to evict entries
  const currentSize = getCacheSize();
  if (currentSize + size > CACHE_CONFIG.MAX_SIZE_BYTES) {
    evictOldestEntries(size);
  }

  geoJSONCache.set(key, {
    data,
    timestamp: Date.now(),
    size,
  });
};

/**
 * Clear all cached GeoJSON data
 */
export const clearGeoJSONCache = (): void => {
  geoJSONCache.clear();
  pendingRequests.clear();
};

/**
 * Get cache statistics for debugging/monitoring
 */
export const getCacheStats = (): {
  entryCount: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  oldestEntryAge: number | null;
} => {
  let oldestTimestamp: number | null = null;

  geoJSONCache.forEach((entry) => {
    if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  });

  const totalSize = getCacheSize();

  return {
    entryCount: geoJSONCache.size,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    oldestEntryAge: oldestTimestamp ? Date.now() - oldestTimestamp : null,
  };
};

// ============================================================================
// Resolution Selection
// ============================================================================

/**
 * Get the appropriate resolution based on map zoom level
 *
 * Resolution mapping:
 * - zoom <= 4: 110m (coarse detail for world view)
 * - zoom 5-7: 50m (medium detail for regional view)
 * - zoom > 7: 10m (fine detail for local view)
 *
 * @param zoom - Current map zoom level
 * @returns Appropriate resolution for the zoom level
 */
export const getResolutionForZoom = (zoom: number): Resolution => {
  if (zoom <= 4) {
    return '110m';
  }
  if (zoom <= 7) {
    return '50m';
  }
  return '10m';
};

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Build the URL for a GeoJSON layer file
 */
const buildLayerUrl = (layer: string, resolution: Resolution): string => {
  return `${GEOJSON_BASE_PATH}/${resolution}/${layer}.json`;
};

/**
 * Build the URL for a bathymetry layer file
 */
const buildBathymetryUrl = (depth: number, resolution: Resolution): string => {
  return `${GEOJSON_BASE_PATH}/${resolution}/bathymetry/depth_${depth}m.json`;
};

/**
 * Create an empty GeoJSON collection for fallback scenarios
 */
const createEmptyCollection = (): GeoJSONCollection => ({
  type: 'FeatureCollection',
  features: [],
});

/**
 * Fetch a single GeoJSON layer from the server
 *
 * Features:
 * - In-memory caching to avoid duplicate fetches
 * - Request deduplication for concurrent requests
 * - Graceful error handling with empty collection fallback
 *
 * @param layer - Layer name to fetch (e.g., 'coastline', 'ocean')
 * @param resolution - Resolution level ('10m', '50m', '110m')
 * @returns GeoJSON collection for the requested layer
 */
export const fetchGeoJSON = async (
  layer: string,
  resolution: Resolution
): Promise<GeoJSONCollection> => {
  const cacheKey = getCacheKey(layer, resolution);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Check if request is already in flight
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = (async (): Promise<GeoJSONCollection> => {
    const url = buildLayerUrl(layer, resolution);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `GeoJSON fetch failed for ${layer} at ${resolution}: ${response.status} ${response.statusText}`
        );
        return createEmptyCollection();
      }

      const data: GeoJSONCollection = await response.json();

      // Validate response structure
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        console.warn(`Invalid GeoJSON structure for ${layer} at ${resolution}`);
        return createEmptyCollection();
      }

      // Cache the successful response
      setInCache(cacheKey, data);

      return data;
    } catch (error) {
      console.warn(`GeoJSON fetch error for ${layer} at ${resolution}:`, error);
      return createEmptyCollection();
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();

  // Track pending request
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Fetch a bathymetry depth contour layer
 *
 * @param depth - Depth in meters (200, 1000, 2000, 3000)
 * @param resolution - Resolution level
 * @returns GeoJSON collection for the bathymetry contour
 */
export const fetchBathymetryLayer = async (
  depth: number,
  resolution: Resolution
): Promise<GeoJSONCollection> => {
  const cacheKey = `bathymetry_${depth}m:${resolution}`;

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Check if request is already in flight
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  // Create new request
  const requestPromise = (async (): Promise<GeoJSONCollection> => {
    const url = buildBathymetryUrl(depth, resolution);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(
          `Bathymetry fetch failed for ${depth}m at ${resolution}: ${response.status} ${response.statusText}`
        );
        return createEmptyCollection();
      }

      const data: GeoJSONCollection = await response.json();

      // Validate response structure
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        console.warn(`Invalid bathymetry GeoJSON structure for ${depth}m at ${resolution}`);
        return createEmptyCollection();
      }

      // Cache the successful response
      setInCache(cacheKey, data);

      return data;
    } catch (error) {
      console.warn(`Bathymetry fetch error for ${depth}m at ${resolution}:`, error);
      return createEmptyCollection();
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();

  // Track pending request
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Fetch multiple bathymetry layers at once
 *
 * @param depths - Array of depth values in meters
 * @param resolution - Resolution level (defaults to '50m')
 * @returns Object with depth contour collections keyed by depth
 */
export const getBathymetryLayers = async (
  depths: number[],
  resolution: Resolution = '50m'
): Promise<BathymetryLayers> => {
  const result: BathymetryLayers = {};

  // Validate and filter requested depths
  const validDepths = depths.filter((d) =>
    BATHYMETRY_DEPTHS.includes(d as typeof BATHYMETRY_DEPTHS[number])
  );

  if (validDepths.length === 0) {
    console.warn('No valid bathymetry depths requested. Valid depths are:', BATHYMETRY_DEPTHS);
    return result;
  }

  // Fetch all requested depths in parallel
  const fetchPromises = validDepths.map(async (depth) => {
    const data = await fetchBathymetryLayer(depth, resolution);
    return { depth, data };
  });

  try {
    const results = await Promise.all(fetchPromises);

    for (const { depth, data } of results) {
      const key = `depth_${depth}m` as keyof BathymetryLayers;
      result[key] = data;
    }
  } catch (error) {
    console.warn('Error fetching bathymetry layers:', error);
  }

  return result;
};

/**
 * Preload all layers for a specific resolution
 *
 * Useful for preparing data before user interaction or
 * pre-caching data for offline use.
 *
 * @param resolution - Resolution level to preload
 * @param includeBathymetry - Whether to also preload bathymetry layers
 * @returns Promise that resolves when all layers are loaded
 */
export const preloadResolution = async (
  resolution: Resolution,
  includeBathymetry: boolean = false
): Promise<void> => {
  const layerPromises = AVAILABLE_LAYERS.map((layer) =>
    fetchGeoJSON(layer, resolution)
  );

  try {
    await Promise.all(layerPromises);

    if (includeBathymetry) {
      await getBathymetryLayers([...BATHYMETRY_DEPTHS], resolution);
    }

    console.log(`GeoJSON preload complete for resolution: ${resolution}`);
  } catch (error) {
    console.warn(`GeoJSON preload failed for resolution ${resolution}:`, error);
  }
};

/**
 * Fetch all available layers for a given resolution
 *
 * @param resolution - Resolution level
 * @param includeBathymetry - Whether to include bathymetry layers
 * @returns Complete GeoJSON layer set
 */
export const fetchAllLayers = async (
  resolution: Resolution,
  includeBathymetry: boolean = false
): Promise<GeoJSONLayer> => {
  const result: GeoJSONLayer = {};

  // Fetch standard layers in parallel
  const layerPromises = AVAILABLE_LAYERS.map(async (layer) => {
    const data = await fetchGeoJSON(layer, resolution);
    return { layer, data };
  });

  try {
    const results = await Promise.all(layerPromises);

    for (const { layer, data } of results) {
      result[layer as keyof Omit<GeoJSONLayer, 'bathymetry'>] = data;
    }

    // Optionally fetch bathymetry
    if (includeBathymetry) {
      result.bathymetry = await getBathymetryLayers([...BATHYMETRY_DEPTHS], resolution);
    }
  } catch (error) {
    console.warn(`Error fetching all layers for resolution ${resolution}:`, error);
  }

  return result;
};

/**
 * Fetch specific layers for a given resolution
 *
 * @param layers - Array of layer names to fetch
 * @param resolution - Resolution level
 * @returns Partial GeoJSON layer set with requested layers
 */
export const fetchLayers = async (
  layers: LayerType[],
  resolution: Resolution
): Promise<Partial<GeoJSONLayer>> => {
  const result: Partial<GeoJSONLayer> = {};

  const layerPromises = layers.map(async (layer) => {
    const data = await fetchGeoJSON(layer, resolution);
    return { layer, data };
  });

  try {
    const results = await Promise.all(layerPromises);

    for (const { layer, data } of results) {
      result[layer] = data;
    }
  } catch (error) {
    console.warn(`Error fetching layers:`, error);
  }

  return result;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a layer is available
 */
export const isLayerAvailable = (layer: string): layer is LayerType => {
  return AVAILABLE_LAYERS.includes(layer as LayerType);
};

/**
 * Get list of all available layer types
 */
export const getAvailableLayers = (): LayerType[] => {
  return [...AVAILABLE_LAYERS];
};

/**
 * Get list of available bathymetry depths
 */
export const getAvailableBathymetryDepths = (): readonly number[] => {
  return BATHYMETRY_DEPTHS;
};

/**
 * Get the base path for GeoJSON files
 */
export const getGeoJSONBasePath = (): string => {
  return GEOJSON_BASE_PATH;
};
