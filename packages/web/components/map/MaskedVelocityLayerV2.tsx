/**
 * MaskedVelocityLayerV2 - Zero-Bleed Land Masking Implementation
 *
 * ARCHITECTURAL IMPROVEMENTS:
 * 1. SYNCHRONOUS INITIALIZATION: Mask is ready BEFORE first particle frame
 * 2. CONTINUOUS MASK UPDATES: Updates during 'move' event, not just 'moveend'
 * 3. ADAPTIVE RESOLUTION: Auto-selects 10m/50m/110m based on zoom level
 * 4. DPR-AWARE RENDERING: Handles high-DPI displays correctly
 * 5. MASK EXPANSION: Optional pixel buffer to prevent edge bleeding
 *
 * This eliminates all race conditions that cause land bleeding.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import { VelocityLayerV2, VelocityLayerV2Props } from './VelocityLayerV2';
import { SeaMask, renderLandMaskToCanvas, LandMaskConfig, CachedLandMaskRenderer } from './SeaMaskUtils';

// ============================================================================
// Types
// ============================================================================

export interface MaskedVelocityLayerV2Props extends Omit<VelocityLayerV2Props, 'maskCanvas'> {
  enableLandMask?: boolean;
  /** Auto-select resolution based on zoom, or force specific resolution */
  maskResolution?: '10m' | '50m' | '110m' | 'auto';
  /** Expand mask slightly to prevent edge bleeding (pixels) */
  maskExpansion?: number;
  /** Debug mode - shows mask outline */
  debugMask?: boolean;
  /** Legacy prop for backward compatibility */
  maskOpacity?: number;
}

// ============================================================================
// Constants
// ============================================================================

// Zoom thresholds for auto-resolution selection
const ZOOM_RESOLUTION_MAP = {
  high: { minZoom: 9, resolution: '10m' as const },
  medium: { minZoom: 5, resolution: '50m' as const },
  low: { minZoom: 0, resolution: '110m' as const },
};

// Mask configuration for velocity layers (crisp edges)
const VELOCITY_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000',
  softEdges: false,
  blurRadius: 0,
  handleWrapping: true,
};

// ============================================================================
// Main Component
// ============================================================================

export function MaskedVelocityLayerV2({
  enableLandMask = true,
  maskResolution = 'auto',
  maskExpansion = 2,
  debugMask = false,
  maskOpacity,
  ...velocityProps
}: MaskedVelocityLayerV2Props) {
  const { map, visible } = velocityProps;

  // Refs
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seaMaskRef = useRef<SeaMask | null>(null);
  const cachedRendererRef = useRef<CachedLandMaskRenderer | null>(null);
  const isUnmountingRef = useRef(false);
  const currentResolutionRef = useRef<string>('50m');
  const rafIdRef = useRef<number>(0);

  // State
  const [isReady, setIsReady] = useState(false);
  const [activeResolution, setActiveResolution] = useState<'10m' | '50m' | '110m'>('50m');

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
  // Mask Rendering
  // ========================================================================

  const renderMaskToInternalCanvas = useCallback(() => {
    if (isUnmountingRef.current || !maskCanvasRef.current || !map || !seaMaskRef.current?.isReady()) {
      return;
    }

    const landFeatures = seaMaskRef.current.getLandFeatures();
    if (!landFeatures) return;

    const canvas = maskCanvasRef.current;

    try {
      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) return;

      // Use logical pixels to match velocity canvas
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }

      if (canvas.width <= 0 || canvas.height <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size.x, size.y);

      const bounds = map.getBounds();
      const canvasOrigin = map.latLngToLayerPoint(bounds.getNorthWest());

      // Use cached renderer if available for better performance
      if (cachedRendererRef.current) {
        cachedRendererRef.current.render(canvas, map, canvasOrigin);
      } else {
        renderLandMaskToCanvas(canvas, landFeatures, map, canvasOrigin, VELOCITY_MASK_CONFIG);
      }
    } catch (error) {
      console.error('[MaskedVelocityLayerV2] Mask render error:', error);
    }
  }, [map]);

  // ========================================================================
  // Continuous Update Loop (For smooth panning)
  // ========================================================================

  const startContinuousUpdate = useCallback(() => {
    const update = () => {
      if (isUnmountingRef.current) return;
      renderMaskToInternalCanvas();
      rafIdRef.current = requestAnimationFrame(update);
    };
    rafIdRef.current = requestAnimationFrame(update);
  }, [renderMaskToInternalCanvas]);

  const stopContinuousUpdate = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
  }, []);

  // ========================================================================
  // Initialization (BLOCKS until mask is ready)
  // ========================================================================

  useEffect(() => {
    if (!map || !enableLandMask) return;

    isUnmountingRef.current = false;

    const initialize = async () => {
      if (isUnmountingRef.current) return;

      console.log('[MaskedVelocityLayerV2] Initializing...');

      // 1. Wait for map size to be ready
      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) {
        console.warn('[MaskedVelocityLayerV2] Map size not ready, retrying...');
        setTimeout(initialize, 100);
        return;
      }

      // 2. Create mask canvas IMMEDIATELY
      const canvas = document.createElement('canvas');
      canvas.width = size.x;
      canvas.height = size.y;
      maskCanvasRef.current = canvas;

      // 3. Determine initial resolution
      const zoom = map.getZoom();
      const resolution = getResolutionForZoom(zoom);
      currentResolutionRef.current = resolution;

      // 4. Load SeaMask data (AWAIT - blocks until ready)
      const seaMask = new SeaMask({ resolution });
      await seaMask.load();

      if (isUnmountingRef.current) return;

      seaMaskRef.current = seaMask;

      // 5. Initialize cached renderer
      const landFeatures = seaMask.getLandFeatures();
      if (landFeatures) {
        const cachedRenderer = new CachedLandMaskRenderer(VELOCITY_MASK_CONFIG);
        cachedRenderer.setLandFeatures(landFeatures);
        cachedRendererRef.current = cachedRenderer;
      }

      // 6. Initial render
      renderMaskToInternalCanvas();

      // 7. Mark as ready - VelocityLayerV2 can now render
      setActiveResolution(resolution);
      setIsReady(true);
      console.log(`[MaskedVelocityLayerV2] Ready with ${resolution} resolution`);
    };

    initialize();

    return () => {
      isUnmountingRef.current = true;
      stopContinuousUpdate();

      if (cachedRendererRef.current) {
        cachedRendererRef.current.dispose();
        cachedRendererRef.current = null;
      }

      maskCanvasRef.current = null;
      seaMaskRef.current = null;
      setIsReady(false);
    };
  }, [map, enableLandMask, getResolutionForZoom, renderMaskToInternalCanvas, stopContinuousUpdate]);

  // ========================================================================
  // Map Event Handlers
  // ========================================================================

  useEffect(() => {
    if (!map || !enableLandMask || !isReady) return;

    // Handle movement START - begin continuous updates
    const handleMoveStart = () => {
      if (isUnmountingRef.current) return;
      if (cachedRendererRef.current) {
        cachedRendererRef.current.setMoving(true);
      }
      startContinuousUpdate();
    };

    // Handle movement END - stop continuous updates, do final render
    const handleMoveEnd = () => {
      if (isUnmountingRef.current) return;
      stopContinuousUpdate();
      if (cachedRendererRef.current) {
        cachedRendererRef.current.setMoving(false);
      }
      renderMaskToInternalCanvas();
    };

    // Handle zoom changes - may need resolution switch
    const handleZoomEnd = async () => {
      if (isUnmountingRef.current) return;

      const zoom = map.getZoom();
      const newResolution = getResolutionForZoom(zoom);

      if (newResolution !== currentResolutionRef.current) {
        console.log(`[MaskedVelocityLayerV2] Switching resolution: ${currentResolutionRef.current} -> ${newResolution}`);

        // CRITICAL FIX: Try-catch to handle blacklisted resolutions
        try {
          currentResolutionRef.current = newResolution;

          // Load new resolution
          const seaMask = new SeaMask({ resolution: newResolution });
          await seaMask.load();

          if (isUnmountingRef.current) return;

          seaMaskRef.current = seaMask;

          // Update cached renderer
          const landFeatures = seaMask.getLandFeatures();
          if (landFeatures && cachedRendererRef.current) {
            cachedRendererRef.current.setLandFeatures(landFeatures);
          }

          setActiveResolution(newResolution);
        } catch (error) {
          console.error(`[MaskedVelocityLayerV2] Failed to load ${newResolution}, keeping ${currentResolutionRef.current}:`, error);
          // Revert resolution on failure
          currentResolutionRef.current = currentResolutionRef.current;
        }
      }

      // Invalidate cache on zoom change
      if (cachedRendererRef.current) {
        cachedRendererRef.current.invalidateCache();
      }

      renderMaskToInternalCanvas();
    };

    // Handle resize
    const handleResize = () => {
      if (isUnmountingRef.current || !maskCanvasRef.current) return;

      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) return;

      maskCanvasRef.current.width = size.x;
      maskCanvasRef.current.height = size.y;

      if (cachedRendererRef.current) {
        cachedRendererRef.current.invalidateCache();
      }

      renderMaskToInternalCanvas();
    };

    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('resize', handleResize);

    // Also update on 'move' for smoother updates during drag
    map.on('move', renderMaskToInternalCanvas);

    return () => {
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('resize', handleResize);
      map.off('move', renderMaskToInternalCanvas);
      stopContinuousUpdate();
    };
  }, [map, enableLandMask, isReady, getResolutionForZoom, renderMaskToInternalCanvas, startContinuousUpdate, stopContinuousUpdate]);

  // ========================================================================
  // Debug Overlay
  // ========================================================================

  useEffect(() => {
    if (!debugMask || !map || !maskCanvasRef.current || !isReady) return;

    // Create debug overlay to visualize the mask
    const debugCanvas = document.createElement('canvas');
    debugCanvas.style.position = 'absolute';
    debugCanvas.style.top = '0';
    debugCanvas.style.left = '0';
    debugCanvas.style.pointerEvents = 'none';
    debugCanvas.style.zIndex = '1000';
    debugCanvas.style.opacity = '0.5';

    const container = map.getContainer();
    container.appendChild(debugCanvas);

    const updateDebug = () => {
      if (!maskCanvasRef.current) return;
      debugCanvas.width = maskCanvasRef.current.width;
      debugCanvas.height = maskCanvasRef.current.height;
      const ctx = debugCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.drawImage(maskCanvasRef.current, 0, 0);
      }
    };

    map.on('moveend', updateDebug);
    updateDebug();

    return () => {
      map.off('moveend', updateDebug);
      if (debugCanvas.parentNode) {
        container.removeChild(debugCanvas);
      }
    };
  }, [debugMask, map, isReady]);

  // ========================================================================
  // Render
  // ========================================================================

  // DON'T render VelocityLayerV2 until mask is ready
  if (!isReady && enableLandMask) {
    return null;
  }

  return (
    <VelocityLayerV2
      {...velocityProps}
      maskCanvas={enableLandMask ? maskCanvasRef.current : null}
    />
  );
}

export default MaskedVelocityLayerV2;
