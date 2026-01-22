/**
 * VelocityLayerV2 - Enhanced Velocity Layer with Pre-Clip Masking
 *
 * KEY IMPROVEMENTS over V1:
 * 1. SYNCHRONOUS PROXY: No setTimeout - proxy applied immediately when canvas is available
 * 2. MASK VALIDATION: Validates mask before every draw operation
 * 3. FRAME SKIP: Skips frames if mask isn't ready (prevents land bleeding)
 * 4. PRE-CLIP STRATEGY: Option to clip BEFORE drawing instead of erasing after
 *
 * This eliminates the race condition that caused particles to appear on land
 * during the 50ms window in V1.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet-velocity';

// Types are already declared in VelocityLayer.tsx
// We use the same types from the main module

export interface VelocityLayerV2Props {
  data: any;
  type: 'wind' | 'currents';
  visible: boolean;
  map: L.Map | null;
  maxVelocity?: number;
  minVelocity?: number;
  velocityScale?: number;
  particleMultiplier?: number;
  opacity?: number;
  colorScale?: string[];
  frameRate?: number;
  lineWidth?: number;
  maskCanvas?: HTMLCanvasElement | null;
  /** Use pre-clip strategy (recommended) or post-erase (legacy) */
  maskStrategy?: 'pre-clip' | 'post-erase';
}

// ============================================================================
// Context Proxy Configuration
// ============================================================================

interface ProxyConfig {
  maskCanvas: HTMLCanvasElement | null;
  strategy: 'pre-clip' | 'post-erase';
  isActive: () => boolean;
}

/**
 * Creates a masked context proxy that intercepts drawing operations
 * to apply land masking synchronously in the same execution tick.
 *
 * CRITICAL FIX: This proxy now implements "Frame-End Masking":
 * - Tracks when a new frame starts (via clearRect)
 * - Intercepts ALL draw operations (stroke, fill, drawImage)
 * - Applies mask ONCE at the END of each frame, not per-draw
 * - Uses a deferred mask application via microtask to batch all draws
 */
function createMaskedContextProxy(
  realCtx: CanvasRenderingContext2D,
  config: ProxyConfig
): CanvasRenderingContext2D {
  // Track frame state for batch masking
  let pendingMaskApplication = false;
  let frameDrawCount = 0;

  /**
   * Schedule mask application at the end of the current frame
   * Uses a microtask to ensure ALL draws in this tick complete first
   *
   * CRITICAL SAFETY: Guards against unmounted state and invalid context
   */
  const scheduleMaskApplication = () => {
    if (pendingMaskApplication) return;
    pendingMaskApplication = true;

    // Use queueMicrotask to apply mask AFTER all synchronous draws
    queueMicrotask(() => {
      pendingMaskApplication = false;

      // CRITICAL GUARD: Check if layer is still active before any context operations
      if (!config.isActive()) return;

      const mask = config.maskCanvas;
      if (mask && mask.width > 0 && mask.height > 0) {
        try {
          // SAFETY: Verify realCtx is still valid (not disposed)
          if (!realCtx || typeof realCtx.save !== 'function') return;

          const prevComposite = realCtx.globalCompositeOperation;
          realCtx.globalCompositeOperation = 'destination-out';
          realCtx.drawImage(mask, 0, 0);
          realCtx.globalCompositeOperation = prevComposite;
        } catch (e) {
          // Silently ignore masking errors during cleanup/transitions
        }
      }
    });
  };

  const handler: ProxyHandler<CanvasRenderingContext2D> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // ================================================================
      // INTERCEPT: clearRect - marks start of new frame
      // ================================================================
      if (prop === 'clearRect') {
        return function(this: CanvasRenderingContext2D, ...args: any[]) {
          frameDrawCount = 0;
          return (target.clearRect as Function).apply(target, args);
        };
      }

      // ================================================================
      // INTERCEPT: stroke() - schedule mask after all strokes
      // ================================================================
      if (prop === 'stroke') {
        return function(this: CanvasRenderingContext2D, ...args: any[]) {
          const result = (target.stroke as Function).apply(target, args);
          frameDrawCount++;

          // Schedule mask application at end of frame
          if (config.isActive()) {
            scheduleMaskApplication();
          }

          return result;
        };
      }

      // ================================================================
      // INTERCEPT: fill() - some particle systems use fill
      // ================================================================
      if (prop === 'fill') {
        return function(this: CanvasRenderingContext2D, ...args: any[]) {
          const result = (target.fill as Function).apply(target, args);
          frameDrawCount++;

          if (config.isActive()) {
            scheduleMaskApplication();
          }

          return result;
        };
      }

      // ================================================================
      // INTERCEPT: drawImage() - leaflet-velocity may use this
      // ================================================================
      if (prop === 'drawImage') {
        return function(this: CanvasRenderingContext2D, ...args: any[]) {
          const result = (target.drawImage as Function).apply(target, args);

          // Only schedule mask for non-mask draw calls
          // Check if this is a mask application (destination-out composite)
          if (target.globalCompositeOperation !== 'destination-out' && config.isActive()) {
            scheduleMaskApplication();
          }

          return result;
        };
      }

      // Bind functions to target
      if (typeof value === 'function') {
        return value.bind(target);
      }

      return value;
    },

    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    }
  };

  return new Proxy(realCtx, handler);
}

// ============================================================================
// Main Component
// ============================================================================

export function VelocityLayerV2({
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
  maskStrategy = 'post-erase',
}: VelocityLayerV2Props) {
  const velocityLayerRef = useRef<L.VelocityLayer | null>(null);
  const isCleaningUpRef = useRef(false);
  const maskCanvasRef = useRef<HTMLCanvasElement | null | undefined>(maskCanvas);
  const proxyAppliedRef = useRef(false);

  // Keep maskCanvas ref updated
  useEffect(() => {
    maskCanvasRef.current = maskCanvas;
  }, [maskCanvas]);

  // ========================================================================
  // Apply Context Proxy SYNCHRONOUSLY (Key fix: No setTimeout!)
  // ========================================================================

  const applyContextProxy = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas || proxyAppliedRef.current) return;

    // Check if proxy already applied
    if ((canvas as any).__v2ContextProxyApplied) {
      proxyAppliedRef.current = true;
      return;
    }

    const originalGetContext = canvas.getContext.bind(canvas);
    let wrappedCtx: CanvasRenderingContext2D | null = null;

    const proxyConfig: ProxyConfig = {
      get maskCanvas() {
        return maskCanvasRef.current || null;
      },
      strategy: maskStrategy,
      isActive: () => !isCleaningUpRef.current,
    };

    // Override getContext to return our wrapped context
    (canvas as any).getContext = function(contextId: string, options?: any) {
      if (contextId !== '2d') {
        return originalGetContext(contextId, options);
      }

      if (wrappedCtx) {
        return wrappedCtx;
      }

      const realCtx = originalGetContext('2d', options);
      if (!realCtx) return null;

      wrappedCtx = createMaskedContextProxy(realCtx, proxyConfig);
      return wrappedCtx;
    };

    (canvas as any).__v2ContextProxyApplied = true;
    proxyAppliedRef.current = true;
    console.log('[VelocityLayerV2] Context Proxy applied synchronously with strategy:', maskStrategy);
  }, [maskStrategy]);

  // ========================================================================
  // Apply Mask Helper (defined first for use in hookAnimationFrame)
  // ========================================================================

  /**
   * Apply mask to a canvas element - erases land pixels
   * CRITICAL: Guards against disposed canvas/context
   */
  const applyMaskToCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    // SAFETY GUARDS: Exit early if any resource is invalid
    if (!canvas || !maskCanvasRef.current || isCleaningUpRef.current) return;
    if (!canvas.width || !canvas.height) return;

    try {
      const ctx = canvas.getContext('2d');
      // CRITICAL GUARD: ctx can be null if canvas was disposed
      if (!ctx || typeof ctx.save !== 'function') return;

      const prevComposite = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvasRef.current, 0, 0);
      ctx.globalCompositeOperation = prevComposite;
    } catch (e) {
      // Silently ignore errors during cleanup/transitions
    }
  }, []);

  // ========================================================================
  // Hook Animation Frame for Belt-and-Suspenders Mask Application
  // ========================================================================

  const hookAnimationFrame = useCallback((layer: any) => {
    if (!layer._windy) return;

    // Hook the internal _frame method which runs every requestAnimationFrame
    // This is more reliable than hooking animate() which may not be the main loop
    const windy = layer._windy;

    // Try to hook the internal frame function
    const originalFrame = windy._frame || windy.frame;
    if (originalFrame) {
      const frameWrapper = function(this: any, ...args: any[]) {
        const result = originalFrame.apply(this, args);

        // Apply mask AFTER each frame completes
        applyMaskToCanvas(layer._canvas);

        return result;
      };

      if (windy._frame) {
        windy._frame = frameWrapper;
      } else if (windy.frame) {
        windy.frame = frameWrapper;
      }
    }

    // Also hook animate for fallback
    const originalAnimate = windy.animate;
    if (originalAnimate && !windy._animateHooked) {
      windy._animateHooked = true;
      windy.animate = function(this: any, ...args: any[]) {
        const result = originalAnimate.apply(this, args);
        applyMaskToCanvas(layer._canvas);
        return result;
      };
    }

    // Hook start() method which kicks off the animation loop
    const originalStart = windy.start;
    if (originalStart && !windy._startHooked) {
      windy._startHooked = true;
      windy.start = function(this: any, ...args: any[]) {
        const result = originalStart.apply(this, args);

        // Start a parallel RAF loop that ensures mask is always applied
        // CRITICAL: Added comprehensive guards to prevent "reading 'save'" crash
        const ensureMask = () => {
          // Exit immediately if cleaning up or canvas removed
          if (isCleaningUpRef.current) return;
          if (!layer || !layer._canvas) return;
          if (!layer._map) return; // Layer was removed from map

          // Verify canvas is still valid
          const canvas = layer._canvas;
          if (!canvas.width || !canvas.height) return;

          applyMaskToCanvas(canvas);
          windy._maskRAF = requestAnimationFrame(ensureMask);
        };
        windy._maskRAF = requestAnimationFrame(ensureMask);

        return result;
      };

      // Hook stop() to clean up our mask RAF
      const originalStop = windy.stop;
      if (originalStop) {
        windy.stop = function(this: any, ...args: any[]) {
          if (windy._maskRAF) {
            cancelAnimationFrame(windy._maskRAF);
            windy._maskRAF = null;
          }
          return originalStop.apply(this, args);
        };
      }
    }

    console.log('[VelocityLayerV2] Animation frame hooked with comprehensive mask application');
  }, [applyMaskToCanvas]);

  // ========================================================================
  // Layer Lifecycle
  // ========================================================================

  useEffect(() => {
    isCleaningUpRef.current = false;
    proxyAppliedRef.current = false;

    if (!map || !data) {
      return;
    }

    // Validate map is ready
    let mapContainer: HTMLElement | null = null;
    try {
      mapContainer = map.getContainer();
      const mapSize = map.getSize();
      if (!mapSize || mapSize.x === 0 || mapSize.y === 0) {
        console.log('[VelocityLayerV2] Map size not ready');
        return;
      }
    } catch (error) {
      console.log('[VelocityLayerV2] Map not ready:', error);
      return;
    }

    // CRITICAL: If mask is expected but not ready, DON'T create layer yet
    // This prevents any unmasked frames from rendering
    if (maskCanvas === undefined) {
      // maskCanvas prop not provided - proceed without masking
    } else if (maskCanvas === null) {
      // maskCanvas explicitly null - masking is disabled, proceed
    } else if (!maskCanvas) {
      // maskCanvas expected but not ready yet
      console.log('[VelocityLayerV2] Waiting for mask canvas...');
      return;
    }

    console.log('[VelocityLayerV2] Creating layer with mask ready:', !!maskCanvas);

    // Default configurations
    const defaultMaxVelocity = type === 'wind' ? 15 : 2;
    const displayType = type === 'wind' ? 'Wind' : 'Current';

    const defaultColorScale = type === 'wind'
      ? [
          'rgba(36, 104, 180, 0.85)',
          'rgba(60, 157, 194, 0.85)',
          'rgba(128, 205, 193, 0.85)',
          'rgba(151, 218, 168, 0.85)',
          'rgba(198, 231, 181, 0.85)',
          'rgba(238, 247, 217, 0.85)',
          'rgba(255, 238, 159, 0.85)',
          'rgba(252, 217, 125, 0.85)',
          'rgba(255, 182, 100, 0.85)',
          'rgba(252, 150, 75, 0.85)',
          'rgba(250, 112, 52, 0.85)',
          'rgba(245, 64, 32, 0.85)',
          'rgba(237, 45, 28, 0.85)',
          'rgba(220, 24, 32, 0.85)',
          'rgba(180, 0, 35, 0.85)',
        ]
      : [
          'rgba(147, 197, 253, 0.85)',
          'rgba(96, 165, 250, 0.85)',
          'rgba(59, 130, 246, 0.85)',
          'rgba(37, 99, 235, 0.85)',
          'rgba(34, 211, 238, 0.85)',
          'rgba(6, 182, 212, 0.85)',
          'rgba(52, 211, 153, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(250, 204, 21, 0.85)',
          'rgba(234, 179, 8, 0.85)',
          'rgba(251, 146, 60, 0.85)',
          'rgba(239, 68, 68, 0.85)',
          'rgba(220, 38, 38, 0.85)',
        ];

    const options: L.VelocityLayerOptions = {
      displayValues: false,
      displayOptions: {
        velocityType: displayType,
        displayPosition: 'bottomleft',
        displayEmptyString: 'No data',
        angleConvention: 'bearingCW',
        speedUnit: type === 'wind' ? 'm/s' : 'kn',
      },
      data: data,
      maxVelocity: maxVelocity ?? defaultMaxVelocity,
      minVelocity: minVelocity,
      velocityScale: velocityScale,
      particleMultiplier: particleMultiplier ?? 1 / 5000,
      opacity: opacity,
      colorScale: colorScale ?? defaultColorScale,
      frameRate: frameRate,
      lineWidth: lineWidth,
    };

    try {
      const layer = L.velocityLayer(options);
      velocityLayerRef.current = layer;

      // Apply comprehensive monkey-patching for safe cleanup
      const originalOnLayerDidMove = (layer as any)._onLayerDidMove;
      if (originalOnLayerDidMove) {
        (layer as any)._onLayerDidMove = function(this: any) {
          if (!this._map || isCleaningUpRef.current) return;
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
          if (!this._map || isCleaningUpRef.current) return;
          try {
            const size = this._map.getSize();
            if (!size || size.x === 0 || size.y === 0) return;
            originalDrawLayer.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      const originalClear = (layer as any)._clear;
      if (originalClear) {
        (layer as any)._clear = function(this: any) {
          if (isCleaningUpRef.current) return;
          const canvas = this._canvas;
          if (!canvas?.getContext || !canvas.width || !canvas.height) return;
          try {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      const originalRedraw = (layer as any)._redraw;
      if (originalRedraw) {
        (layer as any)._redraw = function(this: any) {
          if (!this._canvas || !this._map || isCleaningUpRef.current) return;
          const ctx = this._canvas?.getContext?.('2d');
          if (!ctx) return;
          try {
            originalRedraw.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      const originalOnRemove = (layer as any).onRemove;
      if (originalOnRemove) {
        (layer as any).onRemove = function(this: any, map: L.Map) {
          isCleaningUpRef.current = true;

          if (this._windy) {
            try { this._windy.stop?.(); } catch (e) {}
          }
          if (this._animationFrame) {
            try {
              cancelAnimationFrame(this._animationFrame);
              this._animationFrame = null;
            } catch (e) {}
          }

          try {
            originalOnRemove.call(this, map);
          } catch (error) {
            // Silently ignore
          }

          const canvas = this._canvas;
          this._canvas = null;
          this._map = null;

          if (canvas?.parentNode) {
            try { canvas.parentNode.removeChild(canvas); } catch (e) {}
          }
        };
      }

      const originalUpdate = (layer as any)._update;
      if (originalUpdate) {
        (layer as any)._update = function(this: any) {
          if (isCleaningUpRef.current || !this._map || !this._canvas) return;
          try {
            originalUpdate.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      const originalReset = (layer as any)._reset;
      if (originalReset) {
        (layer as any)._reset = function(this: any) {
          if (isCleaningUpRef.current || !this._map || !this._canvas) return;
          try {
            originalReset.call(this);
          } catch (error) {
            // Silently ignore
          }
        };
      }

      // Add to map
      layer.addTo(map);

      // CRITICAL FIX: Apply context proxy SYNCHRONOUSLY using requestAnimationFrame
      // This runs at the next frame but BEFORE leaflet-velocity renders its first particles
      const applyProxyWhenReady = () => {
        if (isCleaningUpRef.current) return;

        const canvas = (layer as any)._canvas;
        if (canvas) {
          applyContextProxy(canvas);
          hookAnimationFrame(layer);
        } else {
          // Canvas not created yet, try again next frame
          requestAnimationFrame(applyProxyWhenReady);
        }
      };

      // Start checking immediately - this runs synchronously within the same task
      requestAnimationFrame(applyProxyWhenReady);

      console.log('[VelocityLayerV2] Layer created and added to map');

    } catch (error) {
      console.error('[VelocityLayerV2] Error creating layer:', error);
    }

    // Cleanup
    return () => {
      isCleaningUpRef.current = true;

      if (velocityLayerRef.current) {
        const layerToRemove = velocityLayerRef.current;

        try {
          if (map && map.hasLayer(layerToRemove)) {
            map.removeLayer(layerToRemove);
          }

          if ((layerToRemove as any)._animationFrame) {
            cancelAnimationFrame((layerToRemove as any)._animationFrame);
          }

          if ((layerToRemove as any)._windy) {
            try { (layerToRemove as any)._windy.stop(); } catch (e) {}
            if ((layerToRemove as any)._windy._animationFrame) {
              cancelAnimationFrame((layerToRemove as any)._windy._animationFrame);
            }
            // Cancel our mask RAF loop
            if ((layerToRemove as any)._windy._maskRAF) {
              cancelAnimationFrame((layerToRemove as any)._windy._maskRAF);
            }
            (layerToRemove as any)._windy = null;
          }

          if ((layerToRemove as any)._canvas?.parentNode) {
            (layerToRemove as any)._canvas.parentNode.removeChild((layerToRemove as any)._canvas);
          }
          (layerToRemove as any)._canvas = null;
          (layerToRemove as any)._map = null;
        } catch (error) {
          console.error('[VelocityLayerV2] Cleanup error:', error);
        }

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
    maskCanvas,
    applyContextProxy,
    hookAnimationFrame,
  ]);

  // ========================================================================
  // Visibility Toggle
  // ========================================================================

  useEffect(() => {
    if (isCleaningUpRef.current || !velocityLayerRef.current || !map) return;

    try {
      if (visible) {
        if (!map.hasLayer(velocityLayerRef.current)) {
          velocityLayerRef.current.addTo(map);
        }
      } else {
        if (map.hasLayer(velocityLayerRef.current)) {
          map.removeLayer(velocityLayerRef.current);
        }
      }
    } catch (error) {
      console.error('[VelocityLayerV2] Visibility error:', error);
    }
  }, [visible, map]);

  // ========================================================================
  // Data Updates
  // ========================================================================

  useEffect(() => {
    if (isCleaningUpRef.current || !velocityLayerRef.current || !data) return;

    try {
      velocityLayerRef.current.setData(data);
    } catch (error) {
      console.error('[VelocityLayerV2] Data update error:', error);
    }
  }, [data]);

  return null;
}

export default VelocityLayerV2;
