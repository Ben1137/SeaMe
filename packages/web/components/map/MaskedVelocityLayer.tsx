/**
 * MaskedVelocityLayer - VelocityLayer with GeoJSON-based land masking
 *
 * This component wraps the VelocityLayer and applies a canvas-based land mask
 * using the "Context Proxy" pattern for frame-perfect synchronization.
 *
 * CONTEXT PROXY APPROACH:
 * - Pre-renders land polygons to a mask canvas (fast GPU image)
 * - Passes the mask canvas to VelocityLayer
 * - VelocityLayer wraps the canvas context to intercept stroke() calls
 * - Mask is applied in the SAME execution tick as particle drawing
 * - Zero flicker, zero race conditions
 *
 * Key improvement: Particles NEVER exist on land pixels in the final rendered frame.
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
  softEdges: false, // Disable soft edges for performance - we need crisp masking
  blurRadius: 0,
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

  // Lifecycle guards
  const isUnmountingRef = useRef<boolean>(false);

  const { map, visible } = velocityProps;

  // Get device pixel ratio for unified DPR handling
  const getDPR = useCallback(() => {
    return window.devicePixelRatio || 1;
  }, []);

  // Render land mask to the internal mask canvas
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

      // Use logical pixels (no DPR scaling) to match velocity canvas
      // leaflet-velocity doesn't use DPR scaling
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }

      if (canvas.width <= 0 || canvas.height <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, size.x, size.y);

      // Get the canvas position in layer coordinates
      const bounds = map.getBounds();
      const canvasOrigin = map.latLngToLayerPoint(bounds.getNorthWest());

      // Render mask - this creates a filled land shape that we'll use for destination-out
      renderLandMaskToCanvas(canvas, landFeatures, map, canvasOrigin, VELOCITY_MASK_CONFIG);

      console.log('[MaskedVelocityLayer] Mask rendered:', { w: canvas.width, h: canvas.height });
    } catch (error) {
      console.error('[MaskedVelocityLayer] Mask render error:', error);
    }
  }, [map]);

  // Initialize SeaMask and create mask canvas
  useEffect(() => {
    if (!map || !enableLandMask) return;

    isUnmountingRef.current = false;

    const initMask = async () => {
      if (isUnmountingRef.current) return;

      console.log('[MaskedVelocityLayer] Initializing SeaMask...');
      const seaMask = new SeaMask({ resolution: maskResolution });
      await seaMask.load();

      if (isUnmountingRef.current) return;

      seaMaskRef.current = seaMask;

      // Create mask canvas (NOT added to DOM - just used for compositing)
      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) {
        console.warn('[MaskedVelocityLayer] Map size not ready');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = size.x;
      canvas.height = size.y;

      maskCanvasRef.current = canvas;

      // Initial render
      renderMaskToInternalCanvas();

      setIsReady(true);
      console.log('[MaskedVelocityLayer] Ready with Context Proxy pattern');
    };

    initMask();

    return () => {
      isUnmountingRef.current = true;
      maskCanvasRef.current = null;
      seaMaskRef.current = null;
      setIsReady(false);
    };
  }, [map, enableLandMask, maskResolution, renderMaskToInternalCanvas]);

  // Re-render mask on map events
  useEffect(() => {
    if (!map || !enableLandMask || !isReady) return;

    const handleMoveEnd = () => {
      if (isUnmountingRef.current) return;
      renderMaskToInternalCanvas();
    };

    const handleZoomEnd = () => {
      if (isUnmountingRef.current) return;
      renderMaskToInternalCanvas();
    };

    const handleResize = () => {
      if (isUnmountingRef.current || !maskCanvasRef.current || !map) return;

      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) return;

      maskCanvasRef.current.width = size.x;
      maskCanvasRef.current.height = size.y;
      renderMaskToInternalCanvas();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('resize', handleResize);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('resize', handleResize);
    };
  }, [map, enableLandMask, isReady, renderMaskToInternalCanvas]);

  // Pass the mask canvas to VelocityLayer for Context Proxy masking
  // The VelocityLayer will wrap the canvas context and apply masking synchronously
  return (
    <VelocityLayer
      {...velocityProps}
      maskCanvas={enableLandMask && isReady ? maskCanvasRef.current : null}
    />
  );
}

export default MaskedVelocityLayer;
