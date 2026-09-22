import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Track addToast calls
const mockAddToast = vi.fn();
const mockReplace = vi.fn();
const mockLogout = vi.fn();

vi.mock('@/store/useToastStore', () => ({
  useToastStore: (selector: (s: any) => any) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ logout: mockLogout }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
}));

// We need to control fetch globally
const originalFetch = globalThis.fetch;

function makeResponse(ok: boolean, status = ok ? 200 : 403): Response {
  return new Response(null, { status, statusText: ok ? 'OK' : 'Forbidden' });
}

describe('useAuthRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAddToast.mockClear();
    mockReplace.mockClear();
    mockLogout.mockClear();
    globalThis.fetch = vi.fn(() => Promise.resolve(makeResponse(true)));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('fires a warning toast at 10 minutes', async () => {
    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    // Advance to just before 10 minutes
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
    expect(mockAddToast).not.toHaveBeenCalled();

    // Advance to exactly 10 minutes
    await vi.advanceTimersByTimeAsync(1);
    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith('sessionExpiringWarning', 'warning');
  });

  it('calls refresh endpoint at 12 minutes', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeResponse(true)));
    globalThis.fetch = fetchMock;

    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    // Advance to 12 minutes
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/token', { method: 'POST' });
  });

  it('reschedules timers on successful refresh', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeResponse(true)));
    globalThis.fetch = fetchMock;

    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    // First cycle: advance to 12 min to trigger refresh
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After successful refresh, timers are rescheduled.
    // Advance another 10 min for the new warning toast
    mockAddToast.mockClear();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(mockAddToast).toHaveBeenCalledWith('sessionExpiringWarning', 'warning');
  });

  it('redirects to /signin when refresh returns a non-ok response', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(makeResponse(false)));

    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    // Advance to 12 minutes to trigger the refresh
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);

    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/signin');
  });

  it('redirects to /signin when refresh throws a network error', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    // Advance to 12 minutes
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);

    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/signin');
  });

  it('clears timers on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    const { unmount } = renderHook(() => useAuthRefresh());

    unmount();

    // clearTimeout should be called for both the warning and refresh timers
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
