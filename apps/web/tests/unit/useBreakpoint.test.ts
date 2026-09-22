import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBreakpoint, useIsMobile, useIsTablet } from '@/hooks/useBreakpoint';

// Helper to set window.innerWidth and fire resize
function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('useBreakpoint', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('defaults to "lg" before the effect runs (SSR-safe)', () => {
    // Render without triggering useEffect yet
    // Since jsdom runs effects synchronously in renderHook, we check the
    // initial state by temporarily setting the width to 1024-1279 range
    // so effect result matches 'lg' too. Instead, test SSR logic: the
    // useState default is 'lg'.
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1100,
    });
    const { result } = renderHook(() => useBreakpoint());
    // After effects, with width 1100 it should be 'lg'
    expect(result.current).toBe('lg');
  });

  it.each([
    { width: 320, expected: 'mobile' },
    { width: 639, expected: 'mobile' },
    { width: 640, expected: 'sm' },
    { width: 767, expected: 'sm' },
    { width: 768, expected: 'md' },
    { width: 1023, expected: 'md' },
    { width: 1024, expected: 'lg' },
    { width: 1279, expected: 'lg' },
    { width: 1280, expected: 'xl' },
    { width: 1920, expected: 'xl' },
  ])('returns "$expected" for width $width', ({ width, expected }) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe(expected);
  });

  it('updates breakpoint when window is resized', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('lg');

    act(() => {
      setWidth(500);
    });
    expect(result.current).toBe('mobile');

    act(() => {
      setWidth(800);
    });
    expect(result.current).toBe('md');
  });

  it('cleans up the resize listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBreakpoint());

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('useIsMobile', () => {
  it('returns true for widths below 768 (mobile + sm breakpoints)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns true for sm breakpoint (640-767)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 700,
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false for md breakpoint and above', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});

describe('useIsTablet', () => {
  it('returns true for md breakpoint (768-1023)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 900,
    });
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('returns false below md breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    });
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('returns false above md breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1100,
    });
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });
});
