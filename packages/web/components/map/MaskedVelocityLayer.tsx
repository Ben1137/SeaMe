/**
 * MaskedVelocityLayer - VelocityLayer with GeoJSON-based land masking
 *
 * This component wraps the VelocityLayer and applies a canvas-based land mask
 * to CLIP particles from rendering over land areas.
 *
 * CONTINUOUS MASKING APPROACH:
 * - Uses the `onFrame` callback from VelocityLayer to apply masking on EVERY animation frame
 * - Mask canvas is a DOM element in the overlay pane (hidden, used only for compositing)
 * - On move: Uses L.DomUtil.setPosition for instant GPU-accelerated CSS transforms
 * - On moveend/zoomend: Re-renders the mask at the new viewport position
 * - Unified DPR handling ensures mask matches velocity canvas size
 *
 * Key improvement: Particles NEVER appear over land, not even briefly between events.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import { VelocityLayer, VelocityLayerProps } from './VelocityLayer';
import { SeaMask, renderLandMaskToCanvas, LandMaskConfig } from './SeaMaskUtils';

export interface MaskedVelocityLayerProps extends VelocityLayerProps {
  enableLandMask?: boolean;
  maskResolution?: '10m' | '50m' | '110m';
  maskOpacity?: number;
}

const VELOCITY_MASK_CONFIG: LandMaskConfig = {
  fillStyle: '#000000',
  softEdges: true,
  blurRadius: 1.5,
  handleWrapping: true,
};

export function MaskedVelocityLayer({
  enableLandMask = true,
  maskResolution = '50m',
  maskOpacity = 0.85,
  ...velocityProps
}: MaskedVelocityLayerProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seaMaskRef = useRef<SeaMask | null>(null);
  const [isReady, setIsReady] = useState(false);
  const velocityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastOriginRef = useRef<L.Point | null>(null);
  const isClippingPendingRef = useRef<boolean>(false);

  // Lifecycle guards to prevent operations during/after unmount
  const isUnmountingRef = useRef<boolean>(false);
  const pendingRAFRef = useRef<number | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { map, visible } = velocityProps;

  // Get device pixel ratio for unified DPR handling
  const getDPR = useCallback(() => {
    return window.devicePixelRatio || 1;
  }, []);

  // Update mask canvas position using CSS transforms (instant, GPU-accelerated)
  const updateMaskPosition = useCallback(() => {
    // Safety: Check if unmounting or refs are invalid
    if (isUnmountingRef.current || !maskCanvasRef.current || !map) return;

    try {
      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      // Use L.DomUtil.setPosition for hardware-accelerated CSS transform
      L.DomUtil.setPosition(maskCanvasRef.current, topLeft);
      lastOriginRef.current = topLeft;
    } catch (error) {
      // Silently ignore errors during map transitions
    }
  }, [map]);

  // Render land mask to the internal mask canvas
  const renderMaskToInternalCanvas = useCallback(() => {
    // Safety: Check if unmounting or refs are invalid
    if (isUnmountingRef.current || !maskCanvasRef.current || !map || !seaMaskRef.current?.isReady()) {
      return;
    }

    const landFeatures = seaMaskRef.current.getLandFeatures();
    if (!landFeatures) return;

    const canvas = maskCanvasRef.current;

    try {
      const size = map.getSize();
      // Guard against zero-dimension map (during transitions)
      if (!size || size.x <= 0 || size.y <= 0) return;

      const dpr = getDPR();

      // Match velocity canvas sizing with DPR
      const scaledWidth = Math.round(size.x * dpr);
      const scaledHeight = Math.round(size.y * dpr);

      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        // Set CSS size to logical pixels
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }

      // Guard: Ensure canvas has valid dimensions before drawing
      if (canvas.width <= 0 || canvas.height <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Scale context for DPR
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear canvas (guarded by dimension check above)
      ctx.clearRect(0, 0, size.x, size.y);

      // Get the canvas position in layer coordinates
      const bounds = map.getBounds();
      const canvasOrigin = map.latLngToLayerPoint(bounds.getNorthWest());

      // Render mask with canvas origin - the mask is drawn relative to where
      // the canvas will be positioned via L.DomUtil.setPosition
      renderLandMaskToCanvas(canvas, landFeatures, map, canvasOrigin, VELOCITY_MASK_CONFIG);

      // Position canvas using CSS transform (GPU-accelerated)
      updateMaskPosition();
    } catch (error) {
      // Silently ignore errors during map transitions
    }
  }, [map, getDPR, updateMaskPosition]);

  // Find and cache the velocity canvas reference
  const findVelocityCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!map) return null;

    // Check cached reference first
    if (velocityCanvasRef.current && velocityCanvasRef.current.isConnected) {
      return velocityCanvasRef.current;
    }

    const overlayPane = map.getPane('overlayPane');
    if (!overlayPane) return null;

    // Look for the velocity canvas (leaflet-velocity creates it)
    const velocityCanvas = overlayPane.querySelector('canvas.velocity-overlay') as HTMLCanvasElement ||
                          overlayPane.querySelector('canvas.leaflet-layer:not(.velocity-land-mask)') as HTMLCanvasElement;

    if (velocityCanvas) {
      velocityCanvasRef.current = velocityCanvas;
    }

    return velocityCanvas;
  }, [map]);

  // Apply clipping to velocity canvas - only called on moveend/zoomend
  const applyClipping = useCallback(() => {
    // Safety: Check if unmounting
    if (isUnmountingRef.current) {
      isClippingPendingRef.current = false;
      return;
    }

    const velocityCanvas = findVelocityCanvas();
    if (!velocityCanvas || !maskCanvasRef.current) {
      isClippingPendingRef.current = false;
      return;
    }

    const maskCanvas = maskCanvasRef.current;

    // CRITICAL: Guard against zero-dimension canvases to prevent InvalidStateError
    if (!maskCanvas.width || !maskCanvas.height ||
        !velocityCanvas.width || !velocityCanvas.height) {
      isClippingPendingRef.current = false;
      return;
    }

    const ctx = velocityCanvas.getContext('2d');
    if (!ctx) {
      isClippingPendingRef.current = false;
      return;
    }

    try {
      // Apply destination-out to erase land areas from velocity canvas
      // Scale mask to match velocity canvas size (handles DPR differences)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvas, 0, 0, velocityCanvas.width, velocityCanvas.height);
      ctx.restore();
    } catch (error) {
      // Silently ignore drawImage errors during transitions
    }

    isClippingPendingRef.current = false;
  }, [findVelocityCanvas]);

  /**
   * CONTINUOUS MASKING: Called after every animation frame
   * This applies the land mask on every render, ensuring particles
   * never appear over land areas (not just when map stops moving)
   */
  const handleFrame = useCallback((velocityCanvas: HTMLCanvasElement) => {
    // Safety guards
    if (isUnmountingRef.current || !enableLandMask || !isReady) return;
    if (!maskCanvasRef.current) return;

    const maskCanvas = maskCanvasRef.current;

    // Guard against zero-dimension canvases
    if (!maskCanvas.width || !maskCanvas.height ||
        !velocityCanvas.width || !velocityCanvas.height) {
      return;
    }

    const ctx = velocityCanvas.getContext('2d');
    if (!ctx) return;

    try {
      // Apply destination-out to erase land areas from velocity canvas
      // This runs on EVERY frame for continuous masking
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvas, 0, 0, velocityCanvas.width, velocityCanvas.height);
      ctx.restore();
    } catch (error) {
      // Silently ignore errors during transitions
    }
  }, [enableLandMask, isReady]);

  // Schedule clipping after movement stops (debounced)
  const scheduleClipping = useCallback(() => {
    // Safety: Don't schedule if unmounting
    if (isUnmountingRef.current) return;
    if (isClippingPendingRef.current) return;
    isClippingPendingRef.current = true;

    // Cancel any pending RAF
    if (pendingRAFRef.current) {
      cancelAnimationFrame(pendingRAFRef.current);
    }

    // Wait for velocity layer to finish rendering, then clip
    pendingRAFRef.current = requestAnimationFrame(() => {
      if (isUnmountingRef.current) return;
      pendingRAFRef.current = requestAnimationFrame(() => {
        if (isUnmountingRef.current) return;
        applyClipping();
        pendingRAFRef.current = null;
      });
    });
  }, [applyClipping]);

  // Initialize SeaMask and create mask canvas in DOM
  useEffect(() => {
    if (!map || !enableLandMask) return;

    // Reset unmounting flag on mount
    isUnmountingRef.current = false;

    const initMask = async () => {
      // Check if already unmounting (async race condition)
      if (isUnmountingRef.current) return;

      const seaMask = new SeaMask({ resolution: maskResolution });
      await seaMask.load();

      // Check again after async operation
      if (isUnmountingRef.current) return;

      seaMaskRef.current = seaMask;

      // Create mask canvas as a DOM element in the overlay pane
      const size = map.getSize();

      // Guard: Ensure map has valid size before creating canvas
      if (!size || size.x <= 0 || size.y <= 0) {
        console.warn('[MaskedVelocityLayer] Map size not ready, deferring initialization');
        return;
      }

      const dpr = getDPR();
      const canvas = document.createElement('canvas');

      // CRITICAL: Set canvas size with DPR scaling BEFORE adding to DOM
      // This ensures dimensions are valid before any render attempts
      canvas.width = Math.round(size.x * dpr);
      canvas.height = Math.round(size.y * dpr);
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;

      // Style the canvas for overlay
      canvas.className = 'velocity-land-mask';
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      canvas.style.opacity = '0'; // Hidden - only used for clipping, not display
      canvas.style.zIndex = '-1';

      // Add to overlay pane (same pane as velocity layer)
      const overlayPane = map.getPane('overlayPane');
      if (overlayPane) {
        overlayPane.appendChild(canvas);
      }

      // Set ref AFTER canvas is fully configured
      maskCanvasRef.current = canvas;

      // Initial render and position (canvas dimensions are guaranteed valid now)
      renderMaskToInternalCanvas();

      // Only set ready AFTER canvas is fully initialized with valid dimensions
      setIsReady(true);

      console.log('[MaskedVelocityLayer] Land mask initialized (CSS transform positioning)');
    };

    initMask();

    return () => {
      // CRITICAL: Set unmounting flag FIRST to prevent any operations
      isUnmountingRef.current = true;

      // Cancel any pending RAF
      if (pendingRAFRef.current) {
        cancelAnimationFrame(pendingRAFRef.current);
        pendingRAFRef.current = null;
      }

      // Cancel any pending timeouts
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }

      // Reset clipping state
      isClippingPendingRef.current = false;

      // Cleanup: remove canvas from DOM
      if (maskCanvasRef.current && maskCanvasRef.current.parentNode) {
        try {
          maskCanvasRef.current.parentNode.removeChild(maskCanvasRef.current);
        } catch (e) {
          // Ignore removal errors
        }
      }

      // Nullify refs
      maskCanvasRef.current = null;
      seaMaskRef.current = null;
      velocityCanvasRef.current = null;
    };
  }, [map, enableLandMask, maskResolution, renderMaskToInternalCanvas, getDPR]);

  // Handle map movement and zoom events
  useEffect(() => {
    if (!map || !enableLandMask || !isReady) return;

    // On move: Just update CSS transform position (instant, GPU-accelerated)
    const handleMove = () => {
      // Safety: Check refs are valid before operating
      if (isUnmountingRef.current || !maskCanvasRef.current) return;
      updateMaskPosition();
    };

    // On moveend: Re-render mask and apply clipping
    const handleMoveEnd = () => {
      // Safety: Check refs are valid before operating
      if (isUnmountingRef.current || !maskCanvasRef.current) return;

      // Clear cached velocity canvas (may have been recreated)
      velocityCanvasRef.current = null;

      // Re-render mask at new position
      renderMaskToInternalCanvas();

      // Schedule clipping after velocity layer updates
      scheduleClipping();
    };

    // On zoomend: Full re-render and clip
    const handleZoomEnd = () => {
      // Safety: Check refs are valid before operating
      if (isUnmountingRef.current || !maskCanvasRef.current) return;

      velocityCanvasRef.current = null;
      renderMaskToInternalCanvas();
      scheduleClipping();
    };

    // On resize: Resize canvas and re-render
    const handleResize = () => {
      // Safety: Check refs are valid before operating
      if (isUnmountingRef.current || !maskCanvasRef.current || !map) return;

      try {
        const size = map.getSize();
        // Guard against zero-dimension resize
        if (!size || size.x <= 0 || size.y <= 0) return;

        const dpr = getDPR();
        maskCanvasRef.current.width = Math.round(size.x * dpr);
        maskCanvasRef.current.height = Math.round(size.y * dpr);
        maskCanvasRef.current.style.width = `${size.x}px`;
        maskCanvasRef.current.style.height = `${size.y}px`;

        velocityCanvasRef.current = null;
        renderMaskToInternalCanvas();
        scheduleClipping();
      } catch (error) {
        // Silently ignore resize errors during transitions
      }
    };

    map.on('move', handleMove);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('resize', handleResize);

    return () => {
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('resize', handleResize);
    };
  }, [map, enableLandMask, isReady, updateMaskPosition, renderMaskToInternalCanvas, scheduleClipping, getDPR]);

  // Handle visibility changes
  useEffect(() => {
    if (!isReady || !enableLandMask) return;

    if (visible) {
      // When becoming visible, wait for velocity layer to render, then clip
      pendingTimeoutRef.current = setTimeout(() => {
        // Safety: Check if still mounted and refs valid
        if (isUnmountingRef.current || !maskCanvasRef.current) return;

        renderMaskToInternalCanvas();
        scheduleClipping();
        pendingTimeoutRef.current = null;
      }, 250);

      return () => {
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }
      };
    }
  }, [visible, isReady, enableLandMask, renderMaskToInternalCanvas, scheduleClipping]);

  // Pass onFrame callback for continuous land masking on every animation frame
  return <VelocityLayer {...velocityProps} onFrame={enableLandMask ? handleFrame : undefined} />;
}

export default MaskedVelocityLayer;
