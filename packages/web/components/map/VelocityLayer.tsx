import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet-velocity';

// Extend Leaflet namespace to include velocity types
declare module 'leaflet' {
  interface VelocityLayerOptions {
    displayValues?: boolean;
    displayOptions?: {
      velocityType?: 'Global Wind' | 'Ocean Currents' | string;
      position?: 'bottomleft' | 'bottomright' | 'topleft' | 'topright';
      emptyString?: string;
      angleConvention?: string;
      displayPosition?: string;
      displayEmptyString?: string;
      speedUnit?: 'kt' | 'm/s' | 'k/h' | string;
    };
    maxVelocity?: number;
    velocityScale?: number;
    colorScale?: string[];
    data?: VelocityData;
    opacity?: number;
    minVelocity?: number;
    particleAge?: number;
    lineWidth?: number;
    particleMultiplier?: number;
    frameRate?: number;
  }

  interface VelocityData {
    [0]: {
      header: {
        parameterCategory: number;
        parameterNumber: number;
        dx: number;
        dy: number;
        nx: number;
        ny: number;
        la1: number;
        la2: number;
        lo1: number;
        lo2: number;
        refTime?: string;
        forecastTime?: number;
        gridDefinitionTemplate?: number;
        scanMode?: number;
        parameterNumberName?: string;
      };
      data: number[];
    };
    [1]: {
      header: {
        parameterCategory: number;
        parameterNumber: number;
        dx: number;
        dy: number;
        nx: number;
        ny: number;
        la1: number;
        la2: number;
        lo1: number;
        lo2: number;
        refTime?: string;
        forecastTime?: number;
        gridDefinitionTemplate?: number;
        scanMode?: number;
        parameterNumberName?: string;
      };
      data: number[];
    };
  }

  interface VelocityLayer extends Layer {
    setData(data: VelocityData): this;
    setOpacity(opacity: number): this;
  }

  namespace velocityLayer {
    function velocityLayer(options: VelocityLayerOptions): VelocityLayer;
  }

  function velocityLayer(options: VelocityLayerOptions): VelocityLayer;
}

/**
 * Props for VelocityLayer component
 */
export interface VelocityLayerProps {
  /**
   * Velocity field data in leaflet-velocity format
   * Should contain u and v components for wind or ocean currents
   */
  data: L.VelocityData | null;

  /**
   * Type of velocity data being displayed
   */
  type: 'wind' | 'currents';

  /**
   * Whether the layer should be visible
   */
  visible: boolean;

  /**
   * Leaflet map instance (required)
   */
  map: L.Map | null;

  /**
   * Maximum velocity for color scaling (optional)
   * @default 15 for wind, 2 for currents
   */
  maxVelocity?: number;

  /**
   * Minimum velocity threshold (optional)
   * @default 0
   */
  minVelocity?: number;

  /**
   * Particle animation scale (optional)
   * @default 0.005
   */
  velocityScale?: number;

  /**
   * Number of particles to display (optional)
   * @default 1/5000 of screen pixels
   */
  particleMultiplier?: number;

  /**
   * Layer opacity (optional)
   * @default 0.97
   */
  opacity?: number;

  /**
   * Custom color scale (optional)
   */
  colorScale?: string[];

  /**
   * Frame rate for animation (optional)
   * @default 15
   */
  frameRate?: number;

  /**
   * Line width for particle trails (optional)
   * @default 2
   */
  lineWidth?: number;

  /**
   * Pre-rendered land mask canvas for Context Proxy masking
   * When provided, the canvas context will be wrapped to intercept stroke() calls
   * and apply the mask synchronously in the same execution tick.
   * This achieves frame-perfect synchronization with zero flicker.
   */
  maskCanvas?: HTMLCanvasElement | null;
}

/**
 * VelocityLayer - React component for rendering particle animations for wind or ocean currents
 *
 * This component integrates the leaflet-velocity library with React and TypeScript,
 * providing an animated particle visualization of velocity fields on a Leaflet map.
 *
 * Features:
 * - Particle-based animation for wind and ocean currents
 * - Dynamic visibility toggling
 * - Customizable styling and performance options
 * - Automatic cleanup on unmount
 * - TypeScript type safety
 *
 * @example
 * ```tsx
 * const map = useMap(); // from react-leaflet context
 *
 * <VelocityLayer
 *   data={velocityData}
 *   type="wind"
 *   visible={showWindLayer}
 *   map={map}
 *   maxVelocity={20}
 * />
 * ```
 */
export function VelocityLayer({
  data,
  type,
  visible,
  map,
  maxVelocity,
  minVelocity = 0,
  velocityScale = 0.005,
  particleMultiplier,
  opacity = 0.97,
  colorScale,
  frameRate = 15,
  lineWidth = 2,
  maskCanvas,
}: VelocityLayerProps) {
  const velocityLayerRef = useRef<L.VelocityLayer | null>(null);
  const isCleaningUpRef = useRef(false);
  // Store maskCanvas in a ref so the context proxy can access the latest canvas
  const maskCanvasRef = useRef<HTMLCanvasElement | null | undefined>(maskCanvas);

  // Keep maskCanvas ref updated
  useEffect(() => {
    maskCanvasRef.current = maskCanvas;
  }, [maskCanvas]);

  useEffect(() => {
    console.log('[VelocityLayer] useEffect triggered');
    console.log('[VelocityLayer] map:', map);
    console.log('[VelocityLayer] data:', data);
    console.log('[VelocityLayer] visible:', visible);

    // Reset cleanup flag
    isCleaningUpRef.current = false;

    // Don't create layer if map is not available or data is null
    if (!map || !data) {
      console.log('[VelocityLayer] Returning early - no map or data');
      return;
    }

    // Check if map container is ready
    let mapContainer: HTMLElement | null = null;
    try {
      mapContainer = map.getContainer();
    } catch (error) {
      console.log('[VelocityLayer] Could not get map container:', error);
      return;
    }

    if (!mapContainer) {
      console.log('[VelocityLayer] Map container not ready, returning');
      return;
    }

    // Check if map size is valid (indicates map is fully initialized)
    try {
      const mapSize = map.getSize();
      if (!mapSize || mapSize.x === 0 || mapSize.y === 0) {
        console.log('[VelocityLayer] Map size not ready yet:', mapSize);
        return;
      }
      console.log('[VelocityLayer] Map size is valid:', mapSize);
    } catch (error) {
      console.log('[VelocityLayer] Could not get map size:', error);
      return;
    }

    console.log('[VelocityLayer] Proceeding to create layer');

    // Default configurations based on type
    const defaultMaxVelocity = type === 'wind' ? 15 : 2;
    const displayType = type === 'wind' ? 'Global Wind' : 'Ocean Currents';
    const speedUnit = type === 'wind' ? 'kt' : 'm/s';

    // Default color scales
    const defaultColorScale = type === 'wind'
      ? [
          'rgba(36, 104, 180, 0.85)',   // Blue - calm
          'rgba(60, 157, 194, 0.85)',   // Light blue
          'rgba(128, 205, 193, 0.85)',  // Cyan
          'rgba(151, 218, 168, 0.85)',  // Green
          'rgba(198, 231, 181, 0.85)',  // Light green
          'rgba(238, 247, 217, 0.85)',  // Yellow-green
          'rgba(255, 238, 159, 0.85)',  // Yellow
          'rgba(252, 217, 125, 0.85)',  // Orange-yellow
          'rgba(255, 182, 100, 0.85)',  // Orange
          'rgba(252, 150, 75, 0.85)',   // Dark orange
          'rgba(250, 112, 52, 0.85)',   // Red-orange
          'rgba(245, 64, 32, 0.85)',    // Red
          'rgba(237, 45, 28, 0.85)',    // Dark red
          'rgba(220, 24, 32, 0.85)',    // Very dark red
          'rgba(180, 0, 35, 0.85)',     // Extreme
        ]
      : [
          'rgba(147, 197, 253, 0.85)',  // Blue-300 - slow
          'rgba(96, 165, 250, 0.85)',   // Blue-400
          'rgba(59, 130, 246, 0.85)',   // Blue-500
          'rgba(37, 99, 235, 0.85)',    // Blue-600
          'rgba(34, 211, 238, 0.85)',   // Cyan-400
          'rgba(6, 182, 212, 0.85)',    // Cyan-600
          'rgba(52, 211, 153, 0.85)',   // Emerald-400
          'rgba(16, 185, 129, 0.85)',   // Emerald-500
          'rgba(250, 204, 21, 0.85)',   // Yellow-400
          'rgba(234, 179, 8, 0.85)',    // Yellow-500
          'rgba(251, 146, 60, 0.85)',   // Orange-400
          'rgba(239, 68, 68, 0.85)',    // Red-500
          'rgba(220, 38, 38, 0.85)',    // Red-600 - fast
        ];

    // Create velocity layer options
    const options: L.VelocityLayerOptions = {
      displayValues: true,
      displayOptions: {
        velocityType: displayType,
        position: 'bottomleft',
        emptyString: 'No velocity data',
        angleConvention: 'bearingCW',
        speedUnit,
      },
      maxVelocity: maxVelocity ?? defaultMaxVelocity,
      minVelocity,
      velocityScale,
      colorScale: colorScale ?? defaultColorScale,
      data,
      opacity,
      particleAge: 64, // Unified particle age for consistent behavior
      lineWidth,
      particleMultiplier: particleMultiplier ?? 1 / 5000,
      frameRate,
    };

    // Create and add the velocity layer with proper error handling
    try {
      console.log('[VelocityLayer] Creating layer with options:', {
        dataExists: !!data,
        dataIsArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        hasU: data?.[0] ? true : false,
        hasV: data?.[1] ? true : false,
        visible,
        type,
      });

      // Detailed data format validation
      if (Array.isArray(data) && data.length >= 2) {
        const uComponent = data[0];
        const vComponent = data[1];

        console.log('[VelocityLayer] U-Component structure:', {
          hasHeader: !!uComponent?.header,
          hasData: !!uComponent?.data,
          dataLength: uComponent?.data?.length,
          headerFields: uComponent?.header ? Object.keys(uComponent.header) : [],
        });

        console.log('[VelocityLayer] U-Component header:', uComponent?.header);
        console.log('[VelocityLayer] U-Component data sample:', uComponent?.data?.slice(0, 5));

        console.log('[VelocityLayer] V-Component structure:', {
          hasHeader: !!vComponent?.header,
          hasData: !!vComponent?.data,
          dataLength: vComponent?.data?.length,
          headerFields: vComponent?.header ? Object.keys(vComponent.header) : [],
        });

        console.log('[VelocityLayer] V-Component header:', vComponent?.header);
        console.log('[VelocityLayer] V-Component data sample:', vComponent?.data?.slice(0, 5));

        // Validate required header fields for leaflet-velocity
        const requiredFields = ['nx', 'ny', 'lo1', 'la1', 'lo2', 'la2', 'dx', 'dy', 'parameterCategory', 'parameterNumber'];
        const uMissingFields = requiredFields.filter(f => uComponent?.header?.[f] === undefined);
        const vMissingFields = requiredFields.filter(f => vComponent?.header?.[f] === undefined);

        if (uMissingFields.length > 0) {
          console.warn('[VelocityLayer] U-Component missing required fields:', uMissingFields);
        }
        if (vMissingFields.length > 0) {
          console.warn('[VelocityLayer] V-Component missing required fields:', vMissingFields);
        }

        // Validate data array length matches grid size
        const expectedDataLength = (uComponent?.header?.nx || 0) * (uComponent?.header?.ny || 0);
        console.log('[VelocityLayer] Expected data length (nx * ny):', expectedDataLength);
        console.log('[VelocityLayer] Actual U data length:', uComponent?.data?.length);
        console.log('[VelocityLayer] Actual V data length:', vComponent?.data?.length);
      }

      let layer: L.VelocityLayer | null = null;
      try {
        layer = L.velocityLayer(options);
      } catch (createError) {
        console.error('[VelocityLayer] Failed to create layer:', createError);
        throw createError;
      }

      if (!layer) {
        console.error('[VelocityLayer] Layer creation returned null');
        return;
      }

      // Comprehensive monkey-patching to prevent crashes from null map access
      // leaflet-velocity doesn't handle cleanup well, so we patch all map-accessing methods
      const originalOnLayerDidMove = (layer as any)._onLayerDidMove;
      if (originalOnLayerDidMove) {
        (layer as any)._onLayerDidMove = function(this: any) {
          if (!this._map || isCleaningUpRef.current) {
            return; // Silently skip
          }
          try {
            originalOnLayerDidMove.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      const originalDrawLayer = (layer as any).drawLayer;
      if (originalDrawLayer) {
        (layer as any).drawLayer = function(this: any) {
          if (!this._map || isCleaningUpRef.current) {
            return; // Silently skip
          }
          try {
            const size = this._map.getSize();
            if (!size || size.x === 0 || size.y === 0) {
              return;
            }
            originalDrawLayer.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      // Debug: Log available methods on the layer
      console.log('[VelocityLayer] Layer methods:', Object.keys(layer).filter(k => typeof (layer as any)[k] === 'function'));
      console.log('[VelocityLayer] Layer has _windy:', !!(layer as any)._windy);
      console.log('[VelocityLayer] Layer has _canvas:', !!(layer as any)._canvas);

      // =================================================================
      // CONTEXT PROXY PATTERN FOR FRAME-PERFECT LAND MASKING
      // =================================================================
      // Since we cannot hook into leaflet-velocity's internal animation loop,
      // we wrap the canvas context itself. When stroke() is called (which draws
      // particle trails), we intercept it and apply the land mask IMMEDIATELY
      // in the same execution tick. This eliminates all flicker and race conditions.
      //
      // How it works:
      // 1. Override canvas.getContext('2d') to return our wrapped context
      // 2. The wrapped context intercepts stroke() calls
      // 3. After each stroke(), we apply destination-out compositing with the mask
      // 4. This happens synchronously - particles NEVER exist on land in ANY frame
      // =================================================================

      // We'll apply the context proxy after the layer creates its canvas
      const applyContextProxy = (canvas: HTMLCanvasElement) => {
        if (!canvas || (canvas as any).__contextProxyApplied) {
          return; // Already applied or no canvas
        }

        const originalGetContext = canvas.getContext.bind(canvas);
        let wrappedCtx: CanvasRenderingContext2D | null = null;

        // Override getContext to return our wrapped context
        (canvas as any).getContext = function(contextId: string, options?: any) {
          if (contextId !== '2d') {
            return originalGetContext(contextId, options);
          }

          // Return cached wrapped context if already created
          if (wrappedCtx) {
            return wrappedCtx;
          }

          const realCtx = originalGetContext('2d', options);
          if (!realCtx) return null;

          // Create a proxy that intercepts stroke() calls
          const handler: ProxyHandler<CanvasRenderingContext2D> = {
            get(target, prop, receiver) {
              const value = Reflect.get(target, prop, receiver);

              // Intercept stroke() to apply mask immediately after
              if (prop === 'stroke') {
                return function(this: CanvasRenderingContext2D, ...args: any[]) {
                  // Execute the original stroke
                  const result = (target.stroke as Function).apply(target, args);

                  // Apply land mask immediately if available
                  const mask = maskCanvasRef.current;
                  if (mask && mask.width > 0 && mask.height > 0 && !isCleaningUpRef.current) {
                    try {
                      // Save current state
                      const prevComposite = target.globalCompositeOperation;

                      // Use destination-out to "erase" pixels where mask is opaque (land)
                      target.globalCompositeOperation = 'destination-out';
                      target.drawImage(mask, 0, 0);

                      // Restore composite operation
                      target.globalCompositeOperation = prevComposite;
                    } catch (e) {
                      // Silently ignore masking errors
                    }
                  }

                  return result;
                };
              }

              // For functions, bind them to the target
              if (typeof value === 'function') {
                return value.bind(target);
              }

              return value;
            },

            set(target, prop, value) {
              return Reflect.set(target, prop, value);
            }
          };

          wrappedCtx = new Proxy(realCtx, handler);
          return wrappedCtx;
        };

        (canvas as any).__contextProxyApplied = true;
        console.log('[VelocityLayer] Context Proxy applied for frame-perfect masking');
      };

      // Apply context proxy after a short delay to ensure canvas is created
      setTimeout(() => {
        const canvas = (layer as any)._canvas;
        if (canvas) {
          applyContextProxy(canvas);
        } else {
          console.warn('[VelocityLayer] Canvas not found for Context Proxy');
        }
      }, 50);

      // Patch clear method with comprehensive guards
      const originalClear = (layer as any)._clear;
      if (originalClear) {
        (layer as any)._clear = function(this: any) {
          // Guard: Check if cleaning up or canvas is invalid
          if (isCleaningUpRef.current) return;

          const canvas = this._canvas;
          if (!canvas || !canvas.getContext) {
            return;
          }

          // Guard: Ensure canvas has valid dimensions before clearing
          if (!canvas.width || !canvas.height) {
            return;
          }

          try {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          } catch (error) {
            // Silently ignore clearRect errors during transitions
          }
        };
      }

      // Patch redraw method
      const originalRedraw = (layer as any)._redraw;
      if (originalRedraw) {
        (layer as any)._redraw = function(this: any) {
          // CRITICAL: Check for context existence before calling _clear
          if (!this._canvas || !this._map || isCleaningUpRef.current) {
            return;
          }
          // Additional guard: ensure canvas context exists
          const ctx = this._canvas?.getContext?.('2d');
          if (!ctx) {
            return;
          }
          try {
            originalRedraw.call(this);
          } catch (error) {
            // Silently ignore clearRect and other errors during cleanup
          }
        };
      }

      // Patch onRemove to clean up safely
      const originalOnRemove = (layer as any).onRemove;
      if (originalOnRemove) {
        (layer as any).onRemove = function(this: any, map: L.Map) {
          // STEP 1: Set cleanup flag to mute our patched methods (_redraw, _update, _clear)
          // This prevents OUR code from running, but still lets the library clean up
          isCleaningUpRef.current = true;
          console.log('[VelocityLayer] onRemove triggered - cleanup flag set');

          // STEP 2: Stop animations manually (but don't null refs yet!)
          if (this._windy) {
            try {
              this._windy.stop?.();
            } catch (e) { /* ignore */ }
          }
          if (this._animationFrame) {
            try {
              cancelAnimationFrame(this._animationFrame);
              this._animationFrame = null;
            } catch (e) { /* ignore */ }
          }

          // STEP 3: Let the library clean itself up FIRST
          // The library needs this._map to call getBounds() and finish its cleanup
          try {
            originalOnRemove.call(this, map);
          } catch (error) {
            // Silently ignore - library cleanup may partially fail
            console.log('[VelocityLayer] originalOnRemove error (ignored):', error);
          }

          // STEP 4: NOW null out refs AFTER library has finished cleanup
          const canvas = this._canvas;
          this._canvas = null;
          this._map = null;

          // STEP 5: Clean up canvas from DOM if it still exists
          if (canvas?.parentNode) {
            try {
              canvas.parentNode.removeChild(canvas);
            } catch (e) { /* ignore */ }
          }
        };
      }

      // Patch _update method to prevent operations during cleanup
      const originalUpdate = (layer as any)._update;
      if (originalUpdate) {
        (layer as any)._update = function(this: any) {
          if (isCleaningUpRef.current || !this._map || !this._canvas) {
            return;
          }
          try {
            originalUpdate.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      // Patch _reset method (called during map events)
      const originalReset = (layer as any)._reset;
      if (originalReset) {
        (layer as any)._reset = function(this: any) {
          if (isCleaningUpRef.current || !this._map || !this._canvas) {
            return;
          }
          try {
            originalReset.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      velocityLayerRef.current = layer;

      console.log('[VelocityLayer] Layer created successfully:', {
        layerExists: !!layer,
        layerType: layer?.constructor?.name,
        layerHasAddTo: typeof layer?.addTo === 'function',
      });

      // Add to map if visible
      if (visible) {
        console.log('[VelocityLayer] Attempting to add layer to map...');

        try {
          // Add layer to map synchronously first
          layer.addTo(map);
          console.log('[VelocityLayer] Layer added to map successfully');

          // Verify canvas was created after a brief delay
          setTimeout(() => {
            try {
              if (mapContainer) {
                // Look for any canvas elements
                const allCanvases = mapContainer.querySelectorAll('canvas');
                console.log('[VelocityLayer] All canvas elements in map:', allCanvases.length);

                // Log details of each canvas
                allCanvases.forEach((canvas, i) => {
                  console.log(`[VelocityLayer] Canvas ${i}:`, {
                    className: canvas.className,
                    id: canvas.id,
                    width: canvas.width,
                    height: canvas.height,
                    style: canvas.style.cssText.substring(0, 100),
                  });
                });

                // Check overlay pane for canvas
                const overlayPane = mapContainer.querySelector('.leaflet-overlay-pane');
                if (overlayPane) {
                  const overlayCanvases = overlayPane.querySelectorAll('canvas');
                  console.log('[VelocityLayer] Canvases in overlay pane:', overlayCanvases.length);
                }

                // Check if layer has internal canvas reference
                const velocityCanvas = (layer as any)._canvas || (layer as any).canvas;
                console.log('[VelocityLayer] Layer internal canvas:', !!velocityCanvas);
              }
            } catch (err) {
              console.log('[VelocityLayer] Could not verify canvas:', err);
            }
          }, 500);
        } catch (addError) {
          console.error('[VelocityLayer] Error adding layer to map:', addError);
          throw addError;
        }
      } else {
        console.log('[VelocityLayer] Layer created but not added to map (visible=false)');
      }
    } catch (error) {
      console.error('[VelocityLayer] Error creating velocity layer:', error);
      console.error('[VelocityLayer] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
      });
      // Don't re-throw - let the error boundary handle it gracefully
      return;
    }

    // Cleanup function - must properly stop and remove the layer
    return () => {
      console.log('[VelocityLayer] React cleanup running...');

      // Set cleanup flag (may already be true if onRemove was called first)
      // This ensures all operations are muted regardless of cleanup order
      isCleaningUpRef.current = true;

      if (velocityLayerRef.current) {
        try {
          const layerToRemove = velocityLayerRef.current;

          // STEP 1: Remove from map FIRST to prevent new events from firing
          if (map && map.hasLayer(layerToRemove)) {
            try {
              map.removeLayer(layerToRemove);
              console.log('[VelocityLayer] Layer removed from map');
            } catch (error) {
              console.error('[VelocityLayer] Error removing layer from map:', error);
            }
          }

          // STEP 2: Cancel any pending animation frames
          if ((layerToRemove as any)._animationFrame) {
            try {
              cancelAnimationFrame((layerToRemove as any)._animationFrame);
              (layerToRemove as any)._animationFrame = null;
            } catch (error) {
              // Silently ignore
            }
          }

          // STEP 3: Stop the animation to prevent further draw calls
          if (typeof (layerToRemove as any).stop === 'function') {
            try {
              (layerToRemove as any).stop();
            } catch (error) {
              // Silently ignore
            }
          }

          // STEP 4: Clear the windy/velocity instance
          if ((layerToRemove as any)._windy) {
            try {
              if (typeof (layerToRemove as any)._windy.stop === 'function') {
                (layerToRemove as any)._windy.stop();
              }
              // Cancel windy's animation frame too
              if ((layerToRemove as any)._windy._animationFrame) {
                cancelAnimationFrame((layerToRemove as any)._windy._animationFrame);
              }
              (layerToRemove as any)._windy = null;
            } catch (error) {
              // Silently ignore
            }
          }

          // STEP 4: Remove canvas from DOM
          if ((layerToRemove as any)._canvas) {
            try {
              const canvas = (layerToRemove as any)._canvas;
              if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
              }
              (layerToRemove as any)._canvas = null;
              console.log('[VelocityLayer] Canvas removed');
            } catch (error) {
              console.error('[VelocityLayer] Error removing canvas:', error);
            }
          }

          // STEP 5: Clear internal map reference to prevent future access attempts
          if ((layerToRemove as any)._map) {
            (layerToRemove as any)._map = null;
            console.log('[VelocityLayer] Internal map reference cleared');
          }
        } catch (error) {
          console.error('[VelocityLayer] Error during cleanup:', error);
        }

        // Clear the ref
        velocityLayerRef.current = null;
      }
    };
  }, [
    map,
    data,
    type,
    maxVelocity,
    minVelocity,
    velocityScale,
    particleMultiplier,
    opacity,
    colorScale,
    frameRate,
    lineWidth,
  ]);

  // Handle visibility changes
  useEffect(() => {
    // Skip if cleaning up or no layer/map
    if (isCleaningUpRef.current || !velocityLayerRef.current || !map) {
      console.log('[VelocityLayer] Visibility effect: skipping', {
        cleaningUp: isCleaningUpRef.current,
        hasLayer: !!velocityLayerRef.current,
        hasMap: !!map,
      });
      return;
    }

    console.log('[VelocityLayer] Visibility effect triggered:', { visible });

    try {
      if (visible) {
        if (!map.hasLayer(velocityLayerRef.current)) {
          console.log('[VelocityLayer] Adding layer to map');
          velocityLayerRef.current.addTo(map);
          console.log('[VelocityLayer] Layer added successfully');
        } else {
          console.log('[VelocityLayer] Layer already on map');
        }
      } else {
        if (map.hasLayer(velocityLayerRef.current)) {
          console.log('[VelocityLayer] Removing layer from map');
          map.removeLayer(velocityLayerRef.current);
          console.log('[VelocityLayer] Layer removed successfully');
        } else {
          console.log('[VelocityLayer] Layer not on map');
        }
      }
    } catch (error) {
      console.error('Error toggling velocity layer visibility:', error);
    }
  }, [visible, map]);

  // Handle data updates
  useEffect(() => {
    // Skip if cleaning up or no layer/data
    if (isCleaningUpRef.current || !velocityLayerRef.current || !data) {
      console.log('[VelocityLayer] Data update effect: skipping', {
        cleaningUp: isCleaningUpRef.current,
        hasLayer: !!velocityLayerRef.current,
        hasData: !!data,
      });
      return;
    }

    try {
      console.log('[VelocityLayer] Updating layer data');
      velocityLayerRef.current.setData(data);
      console.log('[VelocityLayer] Layer data updated successfully');
    } catch (error) {
      console.error('Error updating velocity layer data:', error);
    }
  }, [data]);

  // This component doesn't render any DOM elements
  // It only manages the Leaflet layer
  return null;
}

export default VelocityLayer;
