/**
 * MaskedVelocityLayer - VelocityLayer with GeoJSON-based land masking
 *
 * This component wraps the VelocityLayer and adds a canvas-based land mask
 * to prevent particles from rendering over land areas.
 *
 * Features:
 * - Canvas alignment using Leaflet's layer point system
 * - CSS transform during pan for smooth movement
 * - Proper coordinate projection sync
 * - Anti-aliased soft edges for natural coastline appearance
 * - Date-line wrapping for seamless Pacific crossing
 * - Semi-transparent mask for layered aesthetic
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import { VelocityLayer, VelocityLayerProps } from './VelocityLayer';
import { SeaMask, renderLandMaskToCanvas, LandMaskConfig } from './SeaMaskUtils';

export interface MaskedVelocityLayerProps extends VelocityLayerProps {
  /**
   * Enable land masking using GeoJSON coastline data
   * @default true
   */
  enableLandMask?: boolean;

  /**
   * Resolution for land mask data ('10m' | '50m' | '110m')
   * @default '50m'
   */
  maskResolution?: '10m' | '50m' | '110m';

  /**
   * Opacity of the land mask (0-1)
   * Lower values allow map features to show through
   * @default 0.85
   */
  maskOpacity?: number;
}

// Default mask configuration for velocity layer
const VELOCITY_MASK_CONFIG: LandMaskConfig = {
  // Semi-transparent dark color - allows map labels/borders to show through slightly
  fillStyle: 'rgba(26, 26, 28, 0.85)',
  // Enable soft edges for natural coastline appearance
  softEdges: true,
  blurRadius: 1.5,
  // Enable date-line wrapping for seamless Pacific crossing
  handleWrapping: true,
};

/**
 * MaskedVelocityLayer - Wraps VelocityLayer with land masking capability
 */
export function MaskedVelocityLayer({
  enableLandMask = true,
  maskResolution = '50m',
  maskOpacity = 0.85,
  ...velocityProps
}: MaskedVelocityLayerProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seaMaskRef = useRef<SeaMask | null>(null);
  const maskPaneRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Track the origin point for proper positioning
  const originRef = useRef<L.Point | null>(null);

  const { map, visible } = velocityProps;

  // Build mask config with current opacity
  const getMaskConfig = useCallback((): LandMaskConfig => ({
    ...VELOCITY_MASK_CONFIG,
    fillStyle: `rgba(26, 26, 28, ${maskOpacity})`,
  }), [maskOpacity]);

  // Render land mask to canvas using the shared utility
  const renderMask = useCallback(() => {
    if (!maskCanvasRef.current || !map || !seaMaskRef.current?.isReady()) {
      return;
    }

    const landFeatures = seaMaskRef.current.getLandFeatures();
    if (!landFeatures) return;

    const canvas = maskCanvasRef.current;

    // Get the current map bounds and size
    const size = map.getSize();
    const bounds = map.getBounds();

    // Calculate the origin (top-left corner in layer coordinates)
    // Use Math.round to avoid sub-pixel jitter
    const rawTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    const topLeft = L.point(Math.round(rawTopLeft.x), Math.round(rawTopLeft.y));
    originRef.current = topLeft;

    // Resize canvas if needed
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    }

    // Use the shared rendering utility with all the improvements
    renderLandMaskToCanvas(canvas, landFeatures, map, topLeft, getMaskConfig());

    // Position the canvas using Leaflet's positioning system
    L.DomUtil.setPosition(canvas, topLeft);
  }, [map, getMaskConfig]);

  // Initialize SeaMask and create mask canvas
  useEffect(() => {
    if (!map || !enableLandMask) return;

    const initMask = async () => {
      // Load SeaMask data
      const seaMask = new SeaMask({ resolution: maskResolution });
      await seaMask.load();
      seaMaskRef.current = seaMask;

      // Create mask pane if it doesn't exist
      const MASK_PANE_NAME = 'velocityMaskPane';
      if (!map.getPane(MASK_PANE_NAME)) {
        map.createPane(MASK_PANE_NAME);
        const pane = map.getPane(MASK_PANE_NAME);
        if (pane) {
          // Position above velocity layer but still in overlay area
          pane.style.zIndex = '455';
          pane.style.pointerEvents = 'none';
        }
      }
      maskPaneRef.current = map.getPane(MASK_PANE_NAME) || null;

      // Create mask canvas
      const size = map.getSize();
      const canvas = document.createElement('canvas');
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      canvas.className = 'velocity-land-mask leaflet-zoom-animated';

      if (maskPaneRef.current) {
        maskPaneRef.current.appendChild(canvas);
      }
      maskCanvasRef.current = canvas;

      // Initial render
      renderMask();
      setIsReady(true);

      console.log('[MaskedVelocityLayer] Land mask initialized with soft edges and wrapping support');
    };

    initMask();

    return () => {
      // Cleanup canvas
      if (maskCanvasRef.current && maskCanvasRef.current.parentNode) {
        maskCanvasRef.current.parentNode.removeChild(maskCanvasRef.current);
      }
      maskCanvasRef.current = null;
    };
  }, [map, enableLandMask, maskResolution, renderMask]);

  // Update mask on map move/zoom with optimized performance
  useEffect(() => {
    if (!map || !enableLandMask || !isReady) return;

    // Track the start position for CSS transform during pan
    let startOrigin: L.Point | null = null;

    const handleMoveStart = () => {
      // Remember where we started
      if (originRef.current) {
        startOrigin = originRef.current;
      }
    };

    const handleMove = () => {
      // During pan, use CSS transform for smooth movement (no canvas redraw)
      if (!maskCanvasRef.current || !startOrigin) return;

      const bounds = map.getBounds();
      const currentTopLeft = map.latLngToLayerPoint(bounds.getNorthWest());

      // Apply CSS transform relative to original position
      // This moves the canvas smoothly without expensive redraws
      L.DomUtil.setPosition(maskCanvasRef.current, currentTopLeft);
    };

    const handleMoveEnd = () => {
      // On move end, do a full redraw to ensure accuracy
      renderMask();
      startOrigin = null;
    };

    const handleZoomEnd = () => {
      // Zoom requires full redraw due to projection changes
      renderMask();
    };

    const handleResize = () => {
      if (maskCanvasRef.current) {
        const size = map.getSize();
        maskCanvasRef.current.width = size.x;
        maskCanvasRef.current.height = size.y;
        maskCanvasRef.current.style.width = `${size.x}px`;
        maskCanvasRef.current.style.height = `${size.y}px`;
      }
      renderMask();
    };

    // Attach event listeners
    map.on('movestart', handleMoveStart);
    map.on('move', handleMove);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('resize', handleResize);

    return () => {
      map.off('movestart', handleMoveStart);
      map.off('move', handleMove);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('resize', handleResize);
    };
  }, [map, enableLandMask, isReady, renderMask]);

  // Show/hide mask based on visibility
  useEffect(() => {
    if (maskCanvasRef.current) {
      maskCanvasRef.current.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);

  // Render the base VelocityLayer
  return <VelocityLayer {...velocityProps} />;
}

export default MaskedVelocityLayer;
