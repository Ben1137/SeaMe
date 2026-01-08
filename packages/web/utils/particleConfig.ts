/**
 * UNIFIED PARTICLE CONFIGURATION
 *
 * Windy-style particle settings that ensure wind and current particles
 * have the SAME SIZE and appearance for visual consistency.
 */

/**
 * Unified particle configuration for both wind and ocean currents
 * These values create consistent particle sizes and behaviors across both layer types
 */
export const UNIFIED_PARTICLE_CONFIG = {
  /** Particle age in frames - how long particles persist */
  particleAge: 64,

  /** Particle multiplier - controls particle density (particles per pixel) */
  particleMultiplier: 0.003,

  /** Line width for particle trails (px) - CRITICAL for same-size appearance */
  lineWidth: 1.5,

  /** Velocity scale - controls arrow length relative to speed - CRITICAL for same-size appearance */
  velocityScale: 0.005,

  /** Frame rate for animation (fps) */
  frameRate: 15,

  /** Opacity of particles (0-1) */
  opacity: 0.85,
} as const;

/**
 * Windy-style color gradients
 */
export const WINDY_COLOR_GRADIENTS = {
  /** Purple-to-pink gradient for wave heights (matches Windy) */
  wave: [
    'rgba(147, 51, 234, 0.85)',   // Purple-600
    'rgba(168, 85, 247, 0.85)',   // Purple-500
    'rgba(192, 132, 252, 0.85)',  // Purple-400
    'rgba(216, 180, 254, 0.85)',  // Purple-300
    'rgba(232, 121, 249, 0.85)',  // Fuchsia-400
    'rgba(240, 171, 252, 0.85)',  // Fuchsia-300
    'rgba(245, 208, 254, 0.85)',  // Fuchsia-200
    'rgba(251, 207, 232, 0.85)',  // Pink-200
  ],

  /** Cyan-to-blue gradient for wind */
  wind: [
    'rgba(103, 232, 249, 0.85)',  // Cyan-300
    'rgba(34, 211, 238, 0.85)',   // Cyan-400
    'rgba(6, 182, 212, 0.85)',    // Cyan-600
    'rgba(59, 130, 246, 0.85)',   // Blue-500
    'rgba(37, 99, 235, 0.85)',    // Blue-600
    'rgba(29, 78, 216, 0.85)',    // Blue-700
  ],

  /** Teal-to-blue gradient for currents */
  current: [
    'rgba(94, 234, 212, 0.85)',   // Teal-300
    'rgba(45, 212, 191, 0.85)',   // Teal-400
    'rgba(20, 184, 166, 0.85)',   // Teal-500
    'rgba(13, 148, 136, 0.85)',   // Teal-600
    'rgba(96, 165, 250, 0.85)',   // Blue-400
    'rgba(59, 130, 246, 0.85)',   // Blue-500
  ],
} as const;

/**
 * Dark map configuration (Windy-style)
 */
export const DARK_MAP_CONFIG = {
  /** CartoDB Dark Matter tile URL with labels for better visibility */
  tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',

  /** Attribution for CartoDB tiles */
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',

  /** Tile layer opacity - higher value shows more detail */
  opacity: 0.7,

  /** Background color for the map container - lighter for better visibility */
  backgroundColor: '#2a2a2c',
} as const;

/**
 * Land mask styling (Windy-style)
 */
export const LAND_MASK_CONFIG = {
  /** Color for land areas - lighter gray for better country visibility */
  color: '#4a4a4c',

  /** Opacity of land mask - slightly lower to show underlying map details */
  opacity: 0.7,
} as const;
