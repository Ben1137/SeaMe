/**
 * Application Constants
 *
 * Centralized configuration values and magic numbers extracted for maintainability.
 */

// ==================== API ENDPOINTS ====================
export const API_ENDPOINTS = {
  MARINE: 'https://marine-api.open-meteo.com/v1/marine',
  FORECAST: 'https://api.open-meteo.com/v1/forecast',
  GEOCODING: 'https://geocoding-api.open-meteo.com/v1/search',
  REVERSE_GEOCODING: 'https://geocoding-api.open-meteo.com/v1/reverse',
  OVERPASS: 'https://overpass-api.de/api/interpreter',
  NOMINATIM: 'https://nominatim.openstreetmap.org/search',
} as const;

// ==================== CACHE CONFIGURATION ====================
export const CACHE_CONFIG = {
  /** Maximum cache size in bytes (50 MB) */
  MAX_SIZE_BYTES: 50 * 1024 * 1024,

  /** Time-to-live for different data types (in milliseconds) */
  TTL: {
    MARINE: 30 * 60 * 1000,       // 30 minutes
    FORECAST: 60 * 60 * 1000,     // 1 hour
    CURRENT: 15 * 60 * 1000,      // 15 minutes
    MULTIMODEL: 60 * 60 * 1000,   // 1 hour
    GRIB: 24 * 60 * 60 * 1000,    // 24 hours
    GEOCODING: 7 * 24 * 60 * 60 * 1000, // 1 week
  },

  /** Workbox runtime caching configuration */
  WORKBOX: {
    API_MAX_ENTRIES: 100,
    API_MAX_AGE_SECONDS: 60 * 60,        // 1 hour
    MARINE_MAX_ENTRIES: 50,
    MARINE_MAX_AGE_SECONDS: 30 * 60,     // 30 minutes
    GEOCODING_MAX_ENTRIES: 100,
    GEOCODING_MAX_AGE_SECONDS: 7 * 24 * 60 * 60, // 1 week
    IMAGES_MAX_ENTRIES: 60,
    IMAGES_MAX_AGE_SECONDS: 30 * 24 * 60 * 60,  // 30 days
  },
} as const;

// ==================== API REQUEST CONFIGURATION ====================
export const REQUEST_CONFIG = {
  /** Default timeout for fetch requests (in milliseconds) */
  DEFAULT_TIMEOUT_MS: 10000,      // 10 seconds

  /** Overpass API specific timeout (in seconds) */
  OVERPASS_TIMEOUT_SECONDS: 25,

  /** Retry configuration */
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,       // 1 second
    MAX_DELAY_MS: 10000,          // 10 seconds
    BACKOFF_MULTIPLIER: 2,        // Exponential backoff
  },

  /** Rate limiting */
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 60,
    DEBOUNCE_MS: 500,             // Map movement debounce
  },
} as const;

// ==================== WEATHER & MARINE CONSTANTS ====================
export const WEATHER_CONSTANTS = {
  /** Forecast window in days */
  FORECAST_DAYS: 7,

  /** Hourly data points per day */
  HOURS_PER_DAY: 24,

  /** Timezone for API requests */
  TIMEZONE: 'GMT',

  /** Best match model selection */
  MODEL: 'best_match',

  /** Wave height threshold for ocean detection (meters) */
  WAVE_HEIGHT_LAND_THRESHOLD: 0.05,
} as const;

// ==================== NAVIGATION & GEOGRAPHY ====================
export const NAVIGATION_CONSTANTS = {
  /** Nautical mile in meters */
  NAUTICAL_MILE_METERS: 1852,

  /** Knot to m/s conversion */
  KNOT_TO_MS: 0.514444,

  /** Default map grid configuration */
  MAP_GRID: {
    ROWS: 4,
    COLS: 4,
    TOTAL_POINTS: 16,
  },

  /** Search configuration */
  SEARCH: {
    MIN_QUERY_LENGTH: 3,
    MAX_RESULTS: 5,
    MARINA_PARALLEL_REQUESTS: 4,
  },

  /** Default location (Tel Aviv) */
  DEFAULT_LOCATION: {
    name: 'Tel Aviv',
    lat: 32.0853,
    lng: 34.7818,
    country: 'Israel',
  },
} as const;

// ==================== UI CONSTANTS ====================
export const UI_CONSTANTS = {
  /** Auto-refresh interval for weather data (in milliseconds) */
  AUTO_REFRESH_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes

  /** Service worker update check interval (in milliseconds) */
  SW_UPDATE_CHECK_INTERVAL_MS: 60 * 60 * 1000, // 1 hour

  /** Chart and visualization */
  CHART: {
    MAX_VISIBLE_HOURS: 24,
    ANIMATION_DURATION_MS: 300,
  },

  /** Haptic feedback patterns */
  VIBRATION: {
    SHORT: [200],
    MEDIUM: [100, 50, 100],
    LONG: [200, 100, 200],
  },
} as const;

// ==================== VALIDATION THRESHOLDS ====================
export const VALIDATION_THRESHOLDS = {
  /** Weather alert thresholds */
  ALERTS: {
    WAVE_HEIGHT_WARNING_M: 3.0,
    WAVE_HEIGHT_DANGER_M: 5.0,
    WIND_SPEED_WARNING_MS: 10.0,  // ~20 knots
    WIND_SPEED_DANGER_MS: 15.0,   // ~30 knots
    SWELL_HEIGHT_WARNING_M: 2.5,
  },

  /** Coordinate validation */
  COORDINATES: {
    MIN_LATITUDE: -90,
    MAX_LATITUDE: 90,
    MIN_LONGITUDE: -180,
    MAX_LONGITUDE: 180,
  },

  /** Data quality thresholds */
  DATA_QUALITY: {
    MIN_VISIBILITY_M: 0,
    MAX_VISIBILITY_M: 100000,
    MIN_PRESSURE_HPA: 870,
    MAX_PRESSURE_HPA: 1085,
    MIN_TEMPERATURE_C: -50,
    MAX_TEMPERATURE_C: 60,
  },
} as const;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
  NETWORK: 'Network connection failed. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  GEOLOCATION_DENIED: 'Location access denied. Please enable location services.',
  GEOLOCATION_UNAVAILABLE: 'Location information is unavailable.',
  GEOLOCATION_TIMEOUT: 'Location request timed out.',
  API_ERROR: 'Failed to fetch weather data. Please try again later.',
  CACHE_ERROR: 'Cache operation failed.',
  INVALID_COORDINATES: 'Invalid coordinates provided.',
  GENERIC: 'An unexpected error occurred. Please try again.',
} as const;

// ==================== TYPE EXPORTS ====================
export type ApiEndpoint = keyof typeof API_ENDPOINTS;
export type CacheTTLType = keyof typeof CACHE_CONFIG.TTL;
export type ErrorMessageType = keyof typeof ERROR_MESSAGES;
