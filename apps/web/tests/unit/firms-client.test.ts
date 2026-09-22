import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { fetchFirmsWithFallback, FIRMS_ENDPOINTS } from '@/lib/firms/client';

vi.mock('@/lib/observability/logger');

const { mockGetCircuitBreaker } = vi.hoisted(() => ({
  mockGetCircuitBreaker: vi.fn(),
}));

vi.mock('@/lib/platform/circuitBreaker', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

function makeBreaker(overrides: Partial<{
  canRequest: boolean;
  onSuccess: Mock;
  onFailure: Mock;
}> = {}) {
  return {
    canRequest: vi.fn().mockReturnValue(overrides.canRequest ?? true),
    onSuccess: overrides.onSuccess ?? vi.fn(),
    onFailure: overrides.onFailure ?? vi.fn(),
  };
}

const DEFAULT_OPTIONS = {
  apiKey: 'a'.repeat(32),
  source: 'VIIRS_NOAA20_NRT',
  bbox: '33.3,-5.3,33.7,-4.9',
  dayRange: 1,
  timeoutMs: 10000,
};

const CSV_RESPONSE = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D';

function csvFetchResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/csv' }),
    text: () => Promise.resolve(CSV_RESPONSE),
  };
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'text/plain' }),
    text: () => Promise.resolve(`Error ${status}`),
  };
}

function htmlResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/html' }),
    text: () => Promise.resolve('<html>Login required</html>'),
  };
}

describe('fetchFirmsWithFallback', () => {
  let primaryBreaker: ReturnType<typeof makeBreaker>;
  let fallbackBreaker: ReturnType<typeof makeBreaker>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    primaryBreaker = makeBreaker();
    fallbackBreaker = makeBreaker();

    mockGetCircuitBreaker.mockImplementation((id: string) => {
      if (id === 'nasa-firms-primary') return primaryBreaker;
      if (id === 'nasa-firms-fallback') return fallbackBreaker;
      return makeBreaker();
    });
  });

  it('succeeds on primary first try — never calls fallback', async () => {
    global.fetch = vi.fn().mockResolvedValue(csvFetchResponse());

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-primary');
    expect(result.attemptsMade).toBe(1);
    expect(result.csvText).toContain('latitude');
    expect(primaryBreaker.onSuccess).toHaveBeenCalledTimes(1);

    // Should only have been called once (primary), not for fallback
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (global.fetch as Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('firms.modaps.eosdis.nasa.gov');
    expect(calledUrl).not.toContain('firms2.modaps.eosdis.nasa.gov');
  });

  it('primary 502, retry succeeds — no fallback needed', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(csvFetchResponse());

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-primary');
    expect(result.attemptsMade).toBe(2);
    expect(primaryBreaker.onSuccess).toHaveBeenCalledTimes(1);
    expect(primaryBreaker.onFailure).not.toHaveBeenCalled();
  });

  it('primary 502 twice, fallback succeeds — falls through correctly', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse(502)) // primary attempt 1
      .mockResolvedValueOnce(errorResponse(502)) // primary attempt 2
      .mockResolvedValueOnce(csvFetchResponse()); // fallback attempt 1

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-fallback');
    expect(result.attemptsMade).toBe(3);
    expect(primaryBreaker.onFailure).toHaveBeenCalledTimes(1);
    expect(fallbackBreaker.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('primary circuit breaker open — skips to fallback', async () => {
    primaryBreaker.canRequest.mockReturnValue(false);
    global.fetch = vi.fn().mockResolvedValue(csvFetchResponse());

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-fallback');
    expect(result.attemptsMade).toBe(1);

    // Primary fetch was never called
    const calledUrl = (global.fetch as Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('firms2.modaps.eosdis.nasa.gov');
  });

  it('both endpoints 502 — throws AppError(4000)', async () => {
    global.fetch = vi.fn().mockResolvedValue(errorResponse(502));

    await expect(fetchFirmsWithFallback(DEFAULT_OPTIONS)).rejects.toThrow(
      expect.objectContaining({ name: 'AppError', code: 4000 })
    );

    // 4 calls total: 2 per endpoint
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(primaryBreaker.onFailure).toHaveBeenCalledTimes(1);
    expect(fallbackBreaker.onFailure).toHaveBeenCalledTimes(1);
  });

  it('primary timeout, retry succeeds', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');

    global.fetch = vi.fn()
      .mockRejectedValueOnce(abortError) // primary attempt 1 timeout
      .mockResolvedValueOnce(csvFetchResponse()); // primary attempt 2 success

    const result = await fetchFirmsWithFallback({
      ...DEFAULT_OPTIONS,
      timeoutMs: 50, // short timeout for test
    });

    expect(result.endpointUsed).toBe('nasa-firms-primary');
    expect(result.attemptsMade).toBe(2);
    expect(primaryBreaker.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('primary HTML auth failure — no retry, falls through to fallback', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(htmlResponse()) // primary: HTML auth failure
      .mockResolvedValueOnce(csvFetchResponse()); // fallback: success

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-fallback');
    // Only 2 calls: 1 to primary (HTML, no retry), 1 to fallback
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(primaryBreaker.onFailure).toHaveBeenCalledTimes(1);
    expect(fallbackBreaker.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('both circuit breakers open — throws immediately', async () => {
    primaryBreaker.canRequest.mockReturnValue(false);
    fallbackBreaker.canRequest.mockReturnValue(false);
    global.fetch = vi.fn();

    await expect(fetchFirmsWithFallback(DEFAULT_OPTIONS)).rejects.toThrow(
      expect.objectContaining({ name: 'AppError', code: 4000 })
    );

    // No fetch calls at all
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('primary 503, fallback 504 twice — throws with all failures', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse(503)) // primary attempt 1
      .mockResolvedValueOnce(errorResponse(503)) // primary attempt 2
      .mockResolvedValueOnce(errorResponse(504)) // fallback attempt 1
      .mockResolvedValueOnce(errorResponse(504)); // fallback attempt 2

    const error = await fetchFirmsWithFallback(DEFAULT_OPTIONS).catch((e) => e);

    expect(error.name).toBe('AppError');
    expect(error.code).toBe(4000);
    expect(error.meta?.failures).toHaveLength(2);
    expect(error.meta?.totalAttempts).toBe(4);
  });

  it('returns duration and attempt count in result', async () => {
    global.fetch = vi.fn().mockResolvedValue(csvFetchResponse());

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.attemptsMade).toBe(1);
    expect(result.endpointUsed).toBe('nasa-firms-primary');
  });

  it('non-transient HTTP error (400) — no retry, falls through', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(errorResponse(400)) // primary: 400, no retry
      .mockResolvedValueOnce(csvFetchResponse()); // fallback: success

    const result = await fetchFirmsWithFallback(DEFAULT_OPTIONS);

    expect(result.endpointUsed).toBe('nasa-firms-fallback');
    // 400 is not transient, so only 1 attempt on primary
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(primaryBreaker.onFailure).toHaveBeenCalledTimes(1);
  });
});
