/**
 * WebGL Context Monitor
 *
 * Monitors WebGL context for loss/restoration events and provides recovery mechanisms.
 * Handles GPU driver crashes, memory pressure, and tab backgrounding issues.
 *
 * @see docs/perf/gpu-tiers.md for failure mode documentation
 */

import { logger } from '@/lib/observability/logger';

export interface ContextMonitorHandlers {
  onContextLost: () => void;
  onContextRestored: () => void;
}

/**
 * Monitors WebGL context health and handles loss/restoration events.
 *
 * Usage:
 * ```typescript
 * const monitor = new WebGLContextMonitor(canvas, gl, {
 *   onContextLost: () => {
 *     // Pause rendering, show notification
 *   },
 *   onContextRestored: () => {
 *     // Resume rendering, clear notification
 *   },
 * });
 * ```
 */
export class WebGLContextMonitor {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private onContextLost: () => void;
  private onContextRestored: () => void;
  private lossCount = 0;
  private lastLossTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    handlers: ContextMonitorHandlers
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.onContextLost = handlers.onContextLost;
    this.onContextRestored = handlers.onContextRestored;

    this.attachListeners();
  }

  private attachListeners() {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private handleContextLost = (event: Event) => {
    // Critical: prevent default to enable restoration
    event.preventDefault();

    this.lossCount++;
    this.lastLossTime = Date.now();

    console.error('[WebGL] Context lost', {
      count: this.lossCount,
      renderer: this.getRendererInfo(),
    });

    // Log telemetry
    logger.error({
      event: 'webgl_context_lost',
      meta: {
        lossCount: this.lossCount,
        renderer: this.getRendererInfo().renderer,
        vendor: this.getRendererInfo().vendor,
        timestamp: Date.now(),
      },
    });

    // Notify application
    this.onContextLost();

    // Check for repeated losses (possible GPU instability)
    if (this.shouldDowngradeTier()) {
      this.triggerTierDowngrade();
    }
  };

  private handleContextRestored = () => {
    console.info('[WebGL] Context restored', {
      lossCount: this.lossCount,
      timeSinceLoss: Date.now() - this.lastLossTime,
    });

    // Log telemetry
    logger.info({
      event: 'webgl_context_restored',
      meta: {
        lossCount: this.lossCount,
        recoveryTime: Date.now() - this.lastLossTime,
        timestamp: Date.now(),
      },
    });

    // Notify application
    this.onContextRestored();
  };

  /**
   * Checks if the WebGL context is currently lost
   */
  public isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  /**
   * Gets GPU renderer information (vendor, GPU model)
   */
  private getRendererInfo(): { renderer: string; vendor: string } {
    try {
      const debugInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        return {
          renderer: this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string,
          vendor: this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string,
        };
      }
    } catch (error) {
      console.warn('[WebGL] Failed to get renderer info', error);
    }

    return {
      renderer: this.gl.getParameter(this.gl.RENDERER) as string,
      vendor: this.gl.getParameter(this.gl.VENDOR) as string,
    };
  }

  /**
   * Checks if tier should be downgraded due to repeated context losses
   * Rule: 3+ losses in 60 seconds = downgrade
   */
  private shouldDowngradeTier(): boolean {
    if (this.lossCount < 3) return false;

    const now = Date.now();
    const timeSinceFirstLoss = now - this.lastLossTime;

    // If 3+ losses in last 60 seconds, downgrade
    return timeSinceFirstLoss < 60_000;
  }

  /**
   * Triggers tier downgrade due to GPU instability
   */
  private triggerTierDowngrade() {
    console.warn('[WebGL] Triggering tier downgrade due to repeated context losses');

    // Dispatch event for UI to handle
    window.dispatchEvent(
      new CustomEvent('gpu:tier-downgrade', {
        detail: {
          reason: 'repeated-context-loss',
          lossCount: this.lossCount,
        },
      })
    );

    // Set fallback flag for next page load
    sessionStorage.setItem('ricer:gpu-fallback', 'true');

    // Reset loss counter
    this.lossCount = 0;
  }

  /**
   * Simulates context loss (for testing)
   * Requires WEBGL_lose_context extension
   */
  public simulateContextLoss(): boolean {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
      return true;
    }
    console.warn('[WebGL] WEBGL_lose_context extension not available');
    return false;
  }

  /**
   * Manually restores context (for testing)
   * Requires WEBGL_lose_context extension
   */
  public simulateContextRestore(): boolean {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.restoreContext();
      return true;
    }
    return false;
  }

  /**
   * Cleans up event listeners
   */
  public destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }
}

/**
 * Watchdog timer to detect rendering hangs (GPU freeze)
 *
 * Monitors rendering loop and triggers recovery if no frames rendered for 5+ seconds.
 * Useful for detecting GPU driver hangs that don't trigger context loss events.
 *
 * Usage:
 * ```typescript
 * const watchdog = new RenderingWatchdog({
 *   onHang: () => {
 *     // Display crash recovery UI
 *   },
 * });
 *
 * // In rendering loop:
 * watchdog.notifyFrameRendered();
 * ```
 */
export class RenderingWatchdog {
  private lastFrameTime = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;
  private hangThreshold = 5000; // 5 seconds
  private onHang: () => void;

  constructor({ onHang }: { onHang: () => void }) {
    this.onHang = onHang;
    this.start();
  }

  /**
   * Starts the watchdog timer
   */
  private start() {
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFrame = now - this.lastFrameTime;

      if (timeSinceLastFrame > this.hangThreshold) {
        console.error('[Watchdog] Rendering hang detected', {
          timeSinceLastFrame,
        });

        // Log telemetry
        logger.error({
          event: 'rendering_hang_detected',
          meta: {
            timeSinceLastFrame,
            timestamp: now,
          },
        });

        // Set crash flag for next page load
        sessionStorage.setItem('ricer:gpu-crash', 'true');

        // Notify application
        this.onHang();

        // Stop checking (hang detected)
        this.stop();
      }
    }, 1000); // Check every second
  }

  /**
   * Notifies watchdog that a frame was rendered
   * Call this in your rendering loop (requestAnimationFrame callback)
   */
  public notifyFrameRendered() {
    this.lastFrameTime = Date.now();

    // Dispatch event for context monitor to track
    window.dispatchEvent(new CustomEvent('map:render-frame'));
  }

  /**
   * Stops the watchdog timer
   */
  private stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Cleans up the watchdog
   */
  public destroy() {
    this.stop();
  }
}

/**
 * GPU Memory Monitor (estimate-based)
 *
 * Tracks estimated GPU memory usage and emits warnings when approaching limits.
 * Uses heuristics since WebGL provides no direct memory usage API.
 *
 * Usage:
 * ```typescript
 * const monitor = new GPUMemoryMonitor(capabilities);
 * monitor.trackLayerAddition({ type: 'IconLayer', dataCount: 5000 });
 * ```
 */
export class GPUMemoryMonitor {
  private estimatedVRAM: number;
  private estimatedUsage = 0;
  private warningThreshold = 0.8; // 80%
  private warningCount = 0;
  private lastWarningTime = 0;

  constructor(estimatedVRAM: number) {
    this.estimatedVRAM = estimatedVRAM;
  }

  /**
   * Estimates memory usage for a layer
   */
  private estimateLayerMemory(layer: { type: string; dataCount: number }): number {
    // Rough estimates in MB
    switch (layer.type) {
      case 'IconLayer':
        // Position (12B) + texture coords (8B) + color (4B) + padding = ~32B per instance
        // Plus texture atlas overhead (~2MB)
        return 2 + (layer.dataCount * 32) / 1024 / 1024;

      case 'PathLayer':
        // Position (12B) + normal (12B) + color (4B) + miter (4B) = ~32B per vertex
        // Assume 2 vertices per segment
        return (layer.dataCount * 2 * 32) / 1024 / 1024;

      case 'HeatmapLayer':
        // Texture memory (2048x2048 RGBA = 16MB)
        return 16;

      default:
        return 1; // Conservative estimate
    }
  }

  /**
   * Tracks layer addition
   */
  public trackLayerAddition(layer: { type: string; dataCount: number }) {
    const layerMemory = this.estimateLayerMemory(layer);
    this.estimatedUsage += layerMemory;
    this.checkMemoryPressure();
  }

  /**
   * Tracks layer removal
   */
  public trackLayerRemoval(layer: { type: string; dataCount: number }) {
    const layerMemory = this.estimateLayerMemory(layer);
    this.estimatedUsage = Math.max(0, this.estimatedUsage - layerMemory);
  }

  /**
   * Checks for memory pressure and emits warnings
   */
  private checkMemoryPressure() {
    const usage = this.estimatedUsage / this.estimatedVRAM;

    if (usage > this.warningThreshold) {
      const now = Date.now();
      this.warningCount++;
      this.lastWarningTime = now;

      console.warn('[GPU Memory] Pressure detected', {
        usage: this.estimatedUsage.toFixed(1),
        max: this.estimatedVRAM,
        percentage: (usage * 100).toFixed(1) + '%',
      });

      // Log telemetry
      logger.warn({
        event: 'gpu_memory_pressure',
        meta: {
          usage: this.estimatedUsage,
          max: this.estimatedVRAM,
          percentage: usage,
          timestamp: now,
        },
      });

      // Dispatch warning event
      window.dispatchEvent(
        new CustomEvent('gpu:memory-warning', {
          detail: {
            usage: this.estimatedUsage,
            max: this.estimatedVRAM,
            percentage: usage,
          },
        })
      );

      // Check for repeated warnings (trigger downgrade)
      if (this.shouldDowngradeTier()) {
        this.triggerTierDowngrade();
      }
    }
  }

  /**
   * Checks if tier should be downgraded due to memory pressure
   * Rule: 3+ warnings in 60 seconds = downgrade
   */
  private shouldDowngradeTier(): boolean {
    if (this.warningCount < 3) return false;

    const now = Date.now();
    const timeSinceFirstWarning = now - this.lastWarningTime;

    return timeSinceFirstWarning < 60_000;
  }

  /**
   * Triggers tier downgrade due to memory pressure
   */
  private triggerTierDowngrade() {
    console.warn('[GPU Memory] Triggering tier downgrade due to memory pressure');

    window.dispatchEvent(
      new CustomEvent('gpu:tier-downgrade', {
        detail: {
          reason: 'memory-pressure',
          warningCount: this.warningCount,
        },
      })
    );

    // Reset warning counter
    this.warningCount = 0;
  }

  /**
   * Gets current memory usage statistics
   */
  public getStats(): {
    usage: number;
    max: number;
    percentage: number;
  } {
    return {
      usage: this.estimatedUsage,
      max: this.estimatedVRAM,
      percentage: this.estimatedUsage / this.estimatedVRAM,
    };
  }
}
