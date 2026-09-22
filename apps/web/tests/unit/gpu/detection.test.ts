import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectGPUCapabilities,
  getTierLabel,
  getTierDescription,
} from '@/lib/gpu/detection';
import type { GPUTier } from '@/lib/gpu/detection';

/**
 * GPU Detection Unit Tests
 *
 * The global test setup (tests/setup.ts) stubs HTMLCanvasElement.getContext
 * to return null, which effectively makes all WebGL context creation fail.
 * This causes detectGPUCapabilities to fall through to Tier C by default,
 * which is what we want for most tests. Tests that need WebGL contexts
 * override getContext via vi.spyOn.
 */

describe('detectGPUCapabilities', () => {
  let originalLocationSearch: string;

  beforeEach(() => {
    vi.useFakeTimers();
    // Preserve original location.search so we can restore it
    originalLocationSearch = window.location.search;
    // Clear any overrides from previous tests
    localStorage.removeItem('ricer:gpu-tier');
    sessionStorage.removeItem('ricer:gpu-fallback');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Restore location.search
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: originalLocationSearch },
    });
    localStorage.removeItem('ricer:gpu-tier');
    sessionStorage.removeItem('ricer:gpu-fallback');
  });

  // ---- 1. Timeout fallback ----

  it('returns tier-c when detection times out', async () => {
    // Use a very short timeout (1ms) while the internal detection takes longer
    // The global setup already makes getContext return null, so the internal
    // detection will run through the full waterfall. We set timeout=1 to race it.
    const promise = detectGPUCapabilities(1);

    // Advance timers past the 1ms timeout
    await vi.advanceTimersByTimeAsync(10);

    const result = await promise;
    expect(result.tier).toBe('tier-c');
    expect(result.renderer).toBe('canvas2d');
    expect(result.contextLost).toBe(false);
  });

  // ---- 2. URL param override ----

  it('returns tier-b when URL param gpu-tier=tier-b is set', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=tier-b' },
    });

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-b');
    expect(result.renderer).toBe('webgl2');
  });

  it('returns tier-a when URL param gpu-tier=tier-a is set', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=tier-a' },
    });

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-a');
    expect(result.renderer).toBe('webgl2');
    expect(result.maxTextureSize).toBe(8192);
  });

  it('returns tier-c when URL param gpu-tier=tier-c is set', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=tier-c' },
    });

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-c');
    expect(result.renderer).toBe('canvas2d');
    expect(result.maxTextureSize).toBe(2048);
  });

  it('ignores invalid URL param gpu-tier values', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=invalid-tier' },
    });

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await promise;

    // With no valid override and getContext returning null (from setup.ts),
    // detection falls through to tier-c
    expect(result.tier).toBe('tier-c');
  });

  // ---- 3. localStorage override ----

  it('returns tier-b when localStorage ricer:gpu-tier is tier-b', async () => {
    localStorage.setItem('ricer:gpu-tier', 'tier-b');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-b');
    expect(result.renderer).toBe('webgl2');
    expect(result.maxTextureSize).toBe(4096);
  });

  it('returns tier-a when localStorage ricer:gpu-tier is tier-a', async () => {
    localStorage.setItem('ricer:gpu-tier', 'tier-a');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-a');
    expect(result.renderer).toBe('webgl2');
    expect(result.maxTextureSize).toBe(8192);
  });

  it('ignores invalid localStorage ricer:gpu-tier values', async () => {
    localStorage.setItem('ricer:gpu-tier', 'tier-z');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await promise;

    // Falls through to normal detection, which returns tier-c (no WebGL in jsdom)
    expect(result.tier).toBe('tier-c');
  });

  it('URL param takes priority over localStorage', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=tier-a' },
    });
    localStorage.setItem('ricer:gpu-tier', 'tier-c');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    // URL param (tier-a) should win over localStorage (tier-c)
    expect(result.tier).toBe('tier-a');
  });

  // ---- 4. Crash flag (sessionStorage) ----

  it('forces tier-c when sessionStorage ricer:gpu-fallback is true', async () => {
    sessionStorage.setItem('ricer:gpu-fallback', 'true');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.tier).toBe('tier-c');
    expect(result.renderer).toBe('canvas2d');
    expect(result.maxTextureSize).toBe(2048);
  });

  it('does not force tier-c when sessionStorage ricer:gpu-fallback is false', async () => {
    sessionStorage.setItem('ricer:gpu-fallback', 'false');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await promise;

    // With getContext returning null, normal detection results in tier-c anyway,
    // but via the normal WebGL-unavailable path, not the crash-flag path
    expect(result.tier).toBe('tier-c');
    expect(result.renderer).toBe('canvas2d');
  });

  it('user override takes priority over crash flag', async () => {
    // User override is checked before crash flag in the detection waterfall
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?gpu-tier=tier-a' },
    });
    sessionStorage.setItem('ricer:gpu-fallback', 'true');

    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    // User override is checked first, so tier-a wins
    expect(result.tier).toBe('tier-a');
  });

  // ---- Fallback shape ----

  it('fallback result has correct shape with empty extensions', async () => {
    const promise = detectGPUCapabilities();
    await vi.advanceTimersByTimeAsync(2500);
    const result = await promise;

    expect(result).toEqual(
      expect.objectContaining({
        tier: 'tier-c',
        renderer: 'canvas2d',
        contextLost: false,
        extensions: [],
      })
    );
    expect(result.maxTextureSize).toBeGreaterThan(0);
    expect(result.maxViewportDims).toHaveLength(2);
  });
});

// ---- 5. getTierLabel ----

describe('getTierLabel', () => {
  it('returns "High Performance" for tier-a', () => {
    expect(getTierLabel('tier-a')).toBe('High Performance');
  });

  it('returns "Standard" for tier-b', () => {
    expect(getTierLabel('tier-b')).toBe('Standard');
  });

  it('returns "Compatibility Mode" for tier-c', () => {
    expect(getTierLabel('tier-c')).toBe('Compatibility Mode');
  });

  it('returns correct labels for all tiers', () => {
    const tiers: GPUTier[] = ['tier-a', 'tier-b', 'tier-c'];
    const labels = tiers.map(getTierLabel);
    expect(labels).toEqual(['High Performance', 'Standard', 'Compatibility Mode']);
  });
});

// ---- 6. getTierDescription ----

describe('getTierDescription', () => {
  it('returns animation description for tier-a', () => {
    expect(getTierDescription('tier-a')).toBe(
      'Full features with animations and advanced rendering'
    );
  });

  it('returns standard description for tier-b', () => {
    expect(getTierDescription('tier-b')).toBe('Standard features without animations');
  });

  it('returns compatibility description for tier-c', () => {
    expect(getTierDescription('tier-c')).toBe('Simplified rendering for compatibility');
  });

  it('returns correct descriptions for all tiers', () => {
    const tiers: GPUTier[] = ['tier-a', 'tier-b', 'tier-c'];
    const descriptions = tiers.map(getTierDescription);
    expect(descriptions).toEqual([
      'Full features with animations and advanced rendering',
      'Standard features without animations',
      'Simplified rendering for compatibility',
    ]);
  });
});
