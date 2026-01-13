/**
 * MaskedVelocityLayer - VelocityLayer with GeoJSON-based land masking
 *
 * This component wraps the VelocityLayer and adds a canvas-based land mask
 * to prevent particles from rendering over land areas.
 */

import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { VelocityLayer, VelocityLayerProps } from './VelocityLayer';
import { SeaMask, renderLandMaskToCanvas } from './SeaMaskUtils';

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
}

/**
 * MaskedVelocityLayer - Wraps VelocityLayer with land masking capability
 */
export function MaskedVelocityLayer({
  enableLandMask = true,
  maskResolution = '50m',
  ...velocityProps
}: MaskedVelocityLayerProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const seaMaskRef = useRef<SeaMask | null>(null);
  const maskPaneRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { map, visible } = velocityProps;

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
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.className = 'velocity-land-mask';

      if (maskPaneRef.current) {
        maskPaneRef.current.appendChild(canvas);
      }
      maskCanvasRef.current = canvas;

      // Initial render
      renderMask();
      setIsReady(true);

      console.log('[MaskedVelocityLayer] Land mask initialized');
    };

    initMask();

    return () => {
      // Cleanup canvas
      if (maskCanvasRef.current && maskCanvasRef.current.parentNode) {
        maskCanvasRef.current.parentNode.removeChild(maskCanvasRef.current);
      }
      maskCanvasRef.current = null;
    };
  }, [map, enableLandMask, maskResolution]);

  // Render land mask to canvas
  const renderMask = () => {
    if (!maskCanvasRef.current || !map || !seaMaskRef.current?.isReady()) {
      return;
    }

    const landFeatures = seaMaskRef.current.getLandFeatures();
    if (!landFeatures) return;

    const canvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw land as solid dark color (matches the dark map theme)
    // This covers particles that would otherwise show over land
    ctx.fillStyle = '#1a1a1c'; // Match dark map background

    for (const feature of landFeatures.features) {
      if (feature.geometry.type === 'Polygon') {
        drawPolygon(ctx, map, feature.geometry.coordinates);
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          drawPolygon(ctx, map, polygon);
        }
      }
    }
  };

  // Helper to draw polygon
  const drawPolygon = (
    ctx: CanvasRenderingContext2D,
    map: L.Map,
    coordinates: [number, number][][]
  ) => {
    ctx.beginPath();

    // Outer ring
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

    // Handle holes
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
  };

  // Update mask on map move/zoom
  useEffect(() => {
    if (!map || !enableLandMask) return;

    const handleMoveEnd = () => {
      // Resize canvas if needed
      if (maskCanvasRef.current) {
        const size = map.getSize();
        if (maskCanvasRef.current.width !== size.x || maskCanvasRef.current.height !== size.y) {
          maskCanvasRef.current.width = size.x;
          maskCanvasRef.current.height = size.y;
          maskCanvasRef.current.style.width = `${size.x}px`;
          maskCanvasRef.current.style.height = `${size.y}px`;
        }
      }
      renderMask();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);
    map.on('resize', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      map.off('resize', handleMoveEnd);
    };
  }, [map, enableLandMask, isReady]);

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
