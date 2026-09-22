/**
 * WebGL Context Monitor Tests
 * Tests context lost/restored events, tier downgrade, watchdog, and memory monitor
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing the module
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  WebGLContextMonitor,
  RenderingWatchdog,
  GPUMemoryMonitor,
} from '@/lib/gpu/contextMonitor';

// Helper to create a mock canvas and GL context
function createMockCanvasAndGL() {
  const listeners: Record<string, EventListener[]> = {};
  const canvas = {
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    dispatchEvent: vi.fn(),
  } as unknown as HTMLCanvasElement;

  const gl = {
    isContextLost: vi.fn(() => false),
    getExtension: vi.fn((name: string) => {
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_RENDERER_WEBGL: 0x9246,
          UNMASKED_VENDOR_WEBGL: 0x9245,
        };
      }
      if (name === 'WEBGL_lose_context') {
        return { loseContext: vi.fn(), restoreContext: vi.fn() };
      }
      return null;
    }),
    getParameter: vi.fn((param: number) => {
      if (param === 0x9246) return 'NVIDIA GeForce GTX 1080';
      if (param === 0x9245) return 'NVIDIA Corporation';
      return 'Unknown';
    }),
    RENDERER: 0x1f01,
    VENDOR: 0x1f00,
  } as unknown as WebGL2RenderingContext;

  // Helper to trigger events
  const triggerEvent = (eventName: string, event?: Event) => {
    const evt = event || new Event(eventName);
    if (listeners[eventName]) {
      for (const handler of listeners[eventName]) {
        handler(evt);
      }
    }
  };

  return { canvas, gl, listeners, triggerEvent };
}

describe('WebGLContextMonitor', () => {
  let mockCanvas: ReturnType<typeof createMockCanvasAndGL>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCanvas = createMockCanvasAndGL();
    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    // Mock window.dispatchEvent
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should attach context lost and restored listeners', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
      'webglcontextlost',
      expect.any(Function),
      false
    );
    expect(mockCanvas.canvas.addEventListener).toHaveBeenCalledWith(
      'webglcontextrestored',
      expect.any(Function),
      false
    );
  });

  it('should call onContextLost when context is lost', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    const event = new Event('webglcontextlost');
    event.preventDefault = vi.fn();
    mockCanvas.triggerEvent('webglcontextlost', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onContextLost).toHaveBeenCalledTimes(1);
  });

  it('should call onContextRestored when context is restored', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    mockCanvas.triggerEvent('webglcontextrestored');

    expect(onContextRestored).toHaveBeenCalledTimes(1);
  });

  it('should track loss count', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    const monitor = new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    // Trigger two losses
    const event1 = new Event('webglcontextlost');
    event1.preventDefault = vi.fn();
    mockCanvas.triggerEvent('webglcontextlost', event1);

    const event2 = new Event('webglcontextlost');
    event2.preventDefault = vi.fn();
    mockCanvas.triggerEvent('webglcontextlost', event2);

    expect(onContextLost).toHaveBeenCalledTimes(2);
    expect(monitor.isContextLost()).toBe(false); // Mock returns false
  });

  it('should trigger tier downgrade after 3 losses in 60s', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    // Trigger 3 rapid losses
    for (let i = 0; i < 3; i++) {
      const event = new Event('webglcontextlost');
      event.preventDefault = vi.fn();
      mockCanvas.triggerEvent('webglcontextlost', event);
    }

    // Should have dispatched a tier-downgrade event
    const calls = vi.mocked(window.dispatchEvent).mock.calls;
    const downgradeCall = calls.find(([evt]) => evt.type === 'gpu:tier-downgrade');
    expect(downgradeCall).toBeDefined();

    // Should set fallback flag
    expect(sessionStorage.setItem).toHaveBeenCalledWith('ricer:gpu-fallback', 'true');
  });

  it('should clean up listeners on destroy', () => {
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();

    const monitor = new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost,
      onContextRestored,
    });

    monitor.destroy();

    expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
      'webglcontextlost',
      expect.any(Function)
    );
    expect(mockCanvas.canvas.removeEventListener).toHaveBeenCalledWith(
      'webglcontextrestored',
      expect.any(Function)
    );
  });

  it('should simulate context loss via WEBGL_lose_context extension', () => {
    const monitor = new WebGLContextMonitor(mockCanvas.canvas, mockCanvas.gl, {
      onContextLost: vi.fn(),
      onContextRestored: vi.fn(),
    });

    const result = monitor.simulateContextLoss();
    expect(result).toBe(true);
  });
});

describe('RenderingWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should detect rendering hang after 5 seconds without frame', () => {
    const onHang = vi.fn();
    new RenderingWatchdog({ onHang });

    // Advance time past hang threshold (5 seconds) + check interval (1 second)
    vi.advanceTimersByTime(6000);

    expect(onHang).toHaveBeenCalledTimes(1);
    expect(sessionStorage.setItem).toHaveBeenCalledWith('ricer:gpu-crash', 'true');
  });

  it('should not trigger hang when frames are rendered', () => {
    const onHang = vi.fn();
    const watchdog = new RenderingWatchdog({ onHang });

    // Render frames every second
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
      watchdog.notifyFrameRendered();
    }

    expect(onHang).not.toHaveBeenCalled();
  });

  it('should stop checking after hang detected', () => {
    const onHang = vi.fn();
    new RenderingWatchdog({ onHang });

    // Trigger hang
    vi.advanceTimersByTime(6000);
    expect(onHang).toHaveBeenCalledTimes(1);

    // Advance more time - should not call again
    vi.advanceTimersByTime(10000);
    expect(onHang).toHaveBeenCalledTimes(1);
  });

  it('should clean up on destroy', () => {
    const onHang = vi.fn();
    const watchdog = new RenderingWatchdog({ onHang });

    watchdog.destroy();

    // Advance time past threshold - should not trigger
    vi.advanceTimersByTime(10000);
    expect(onHang).not.toHaveBeenCalled();
  });
});

describe('GPUMemoryMonitor', () => {
  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should estimate layer memory usage', () => {
    const monitor = new GPUMemoryMonitor(1024); // 1GB VRAM

    // Add an icon layer
    monitor.trackLayerAddition({ type: 'IconLayer', dataCount: 1000 });

    const stats = monitor.getStats();
    expect(stats.usage).toBeGreaterThan(0);
    expect(stats.max).toBe(1024);
    expect(stats.percentage).toBeGreaterThan(0);
  });

  it('should track layer removal', () => {
    const monitor = new GPUMemoryMonitor(1024);

    monitor.trackLayerAddition({ type: 'IconLayer', dataCount: 5000 });
    const afterAdd = monitor.getStats().usage;

    monitor.trackLayerRemoval({ type: 'IconLayer', dataCount: 5000 });
    const afterRemove = monitor.getStats().usage;

    expect(afterRemove).toBeLessThan(afterAdd);
  });

  it('should emit memory warning when threshold exceeded', () => {
    const monitor = new GPUMemoryMonitor(15); // Very small VRAM (15MB)

    // Add a heatmap layer (16MB) → 16/15 = 1.067 > 0.8 threshold
    monitor.trackLayerAddition({ type: 'HeatmapLayer', dataCount: 1 });

    const calls = vi.mocked(window.dispatchEvent).mock.calls;
    const warningCall = calls.find(([evt]) => evt.type === 'gpu:memory-warning');
    expect(warningCall).toBeDefined();
  });

  it('should trigger tier downgrade after 3 memory pressure warnings', () => {
    const monitor = new GPUMemoryMonitor(15); // Very small VRAM (15MB)

    // Trigger 3 warnings rapidly — each 16MB HeatmapLayer exceeds 80% of 15MB
    for (let i = 0; i < 3; i++) {
      monitor.trackLayerAddition({ type: 'HeatmapLayer', dataCount: 1 });
    }

    // Should trigger downgrade
    const calls = vi.mocked(window.dispatchEvent).mock.calls;
    const downgradeCall = calls.find(([evt]) => evt.type === 'gpu:tier-downgrade');
    expect(downgradeCall).toBeDefined();
  });

  it('should not go below zero usage on removal', () => {
    const monitor = new GPUMemoryMonitor(1024);

    // Remove without adding first
    monitor.trackLayerRemoval({ type: 'IconLayer', dataCount: 5000 });

    const stats = monitor.getStats();
    expect(stats.usage).toBe(0);
  });
});
