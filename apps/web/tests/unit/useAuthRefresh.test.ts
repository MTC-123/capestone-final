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

  it('renews the session silently every 12 minutes without toasts', async () => {
    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/token', { method: 'POST' });
    expect(mockAddToast).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('signs out and returns to /signin (with next) when renewal fails', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(makeResponse(false, 401)));
    const { useAuthRefresh } = await import('@/hooks/useAuthRefresh');
    renderHook(() => useAuthRefresh());

    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/signin\?next=/));
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    let resolve: (r: Response) => void = () => undefined;
    globalThis.fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    const { refreshSession } = await import('@/lib/api/fetchWithAuth');
    const a = refreshSession();
    const b = refreshSession();
    resolve(makeResponse(true));
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
