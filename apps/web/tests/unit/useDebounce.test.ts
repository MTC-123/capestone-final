import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useThrottle, useDebouncedCallback } from '@/hooks/useDebounce';

// ── useDebounce ───────────────────────────────────────────────────────────────

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update the value before the delay elapses', () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });

    act(() => {
      rerender({ val: 'b' });
    });

    // Advance less than the delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('a');
  });

  it('updates the value after the delay elapses', () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });

    act(() => {
      rerender({ val: 'b' });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes — only the final value is applied', () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });

    act(() => {
      rerender({ val: 'b' });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      rerender({ val: 'c' });
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      rerender({ val: 'd' });
    });

    // Only 100ms since last change — not yet debounced
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a'); // still original

    // Now the full 300ms from the last rerender has passed
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('d');
  });
});

// ── useThrottle ───────────────────────────────────────────────────────────────

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes the callback immediately on the first call', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottle(fn, 500));

    // The hook captures Date.now() at render time as lastRan.
    // Advance past the delay so the first invocation sees timeSinceLastRan >= delay.
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current('first');
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('defers subsequent calls within the throttle window', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottle(fn, 500));

    // Advance past initial delay so the first call fires immediately
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current('first');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Call again immediately — within window (lastRan just updated)
    act(() => {
      result.current('second');
    });
    expect(fn).toHaveBeenCalledTimes(1); // not yet

    // Advance past the window so the scheduled timeout fires
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });

  it('executes immediately again after the window passes', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottle(fn, 500));

    // Advance past initial delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current('first');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for window to fully pass after the first call
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current('after-window');
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('after-window');
  });
});

// ── useDebouncedCallback ──────────────────────────────────────────────────────

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire the callback until the delay passes', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 400));

    act(() => {
      result.current('arg');
    });

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('arg');
  });

  it('resets the timer on rapid invocations — only the last call fires', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));

    act(() => {
      result.current('a');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current('b');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current('c');
    });

    // 200ms elapsed from 'c' — not yet
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).not.toHaveBeenCalled();

    // 300ms from 'c'
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancels the pending timeout on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 300));

    act(() => {
      result.current('will-be-cancelled');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fn).not.toHaveBeenCalled();
  });
});
