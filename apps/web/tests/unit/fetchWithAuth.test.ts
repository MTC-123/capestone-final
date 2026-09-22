import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to re-import a fresh module for each test to reset the internal
// `refreshPromise` singleton.  vi.resetModules() + dynamic import achieves this.

const originalFetch = globalThis.fetch;

function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function makeResponse(status: number, body = ''): Response {
  return new Response(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
}

beforeEach(() => {
  vi.resetModules();
  // Provide a default stub so accidental calls don't throw
  globalThis.fetch = vi.fn(() => Promise.resolve(makeResponse(200)));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchWithAuth', () => {
  it('passes through a successful response without attempting refresh', async () => {
    mockFetch(() => Promise.resolve(makeResponse(200, 'ok')));

    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');
    const res = await fetchWithAuth('/api/data');

    expect(res.status).toBe(200);
    // Only one call: the original request. No refresh call.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/data', undefined);
  });

  it('passes through non-401 error responses without refresh', async () => {
    mockFetch(() => Promise.resolve(makeResponse(500)));

    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');
    const res = await fetchWithAuth('/api/data');

    expect(res.status).toBe(500);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token on 401 then retries the original request', async () => {
    let callCount = 0;
    mockFetch((url: string) => {
      callCount++;
      if (callCount === 1) {
        // Original request returns 401
        return Promise.resolve(makeResponse(401));
      }
      if (url === '/api/auth/token') {
        // Refresh succeeds
        return Promise.resolve(makeResponse(200));
      }
      // Retry of the original request succeeds
      return Promise.resolve(makeResponse(200, 'retried'));
    });

    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');
    const res = await fetchWithAuth('/api/data');

    // 3 calls: original 401 -> refresh -> retry
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
  });

  it('returns the 401 response when refresh fails', async () => {
    let callCount = 0;
    mockFetch((url: string) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeResponse(401));
      }
      // Refresh endpoint returns failure
      if (url === '/api/auth/token') {
        return Promise.resolve(makeResponse(403));
      }
      return Promise.resolve(makeResponse(200));
    });

    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');
    const res = await fetchWithAuth('/api/data');

    // fetchWithAuth does NOT redirect — it returns the 401 for callers to handle
    expect(res.status).toBe(401);
    // 2 calls: original 401 -> refresh (failed) -> no retry
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent refresh attempts', async () => {
    let refreshCallCount = 0;
    let originalCallCount = 0;

    mockFetch((url: string) => {
      if (url === '/api/auth/token') {
        refreshCallCount++;
        // Delay slightly to simulate async
        return new Promise<Response>((resolve) =>
          setTimeout(() => resolve(makeResponse(200)), 10)
        );
      }
      originalCallCount++;
      if (originalCallCount <= 2) {
        // First two calls (original requests) return 401
        return Promise.resolve(makeResponse(401));
      }
      // Retries succeed
      return Promise.resolve(makeResponse(200, 'retried'));
    });

    const { fetchWithAuth } = await import('@/lib/api/fetchWithAuth');

    // Fire two requests concurrently that both get 401
    const [res1, res2] = await Promise.all([
      fetchWithAuth('/api/data1'),
      fetchWithAuth('/api/data2'),
    ]);

    // Only ONE refresh call should have been made despite two concurrent 401s
    expect(refreshCallCount).toBe(1);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
