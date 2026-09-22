import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { fetchEffisDetections } from '@/lib/effis/client';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { mockGetCircuitBreaker } = vi.hoisted(() => ({
  mockGetCircuitBreaker: vi.fn(),
}));

vi.mock('@/lib/platform/circuitBreaker', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

function makeBreaker(overrides: Partial<{ canRequest: boolean }> = {}) {
  return {
    canRequest: vi.fn().mockReturnValue(overrides.canRequest ?? true),
    onSuccess: vi.fn(),
    onFailure: vi.fn(),
    reset: vi.fn(),
  };
}

describe('fetchEffisDetections', () => {
  let breaker: ReturnType<typeof makeBreaker>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    breaker = makeBreaker();
    mockGetCircuitBreaker.mockReturnValue(breaker);
  });

  it('should fetch and return GeoJSON on success', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(geojson),
    });

    const result = await fetchEffisDetections();

    expect(result.geojson).toEqual(geojson);
    expect(result.attemptsMade).toBe(1);
    expect(breaker.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should build correct WFS URL', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(geojson),
    });

    await fetchEffisDetections();

    const calledUrl = (global.fetch as Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('maps.effis.emergency.copernicus.eu');
    expect(calledUrl).toContain('service=WFS');
    expect(calledUrl).toContain('outputFormat=application%2Fjson');
  });

  it('should throw AppError(4003) when circuit breaker is open', async () => {
    breaker.canRequest.mockReturnValue(false);
    global.fetch = vi.fn();

    await expect(fetchEffisDetections()).rejects.toThrow(
      expect.objectContaining({ code: 4003 })
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should retry on transient 502 error', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: () => Promise.resolve('Bad Gateway') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(geojson) });

    const result = await fetchEffisDetections();

    expect(result.attemptsMade).toBe(2);
    expect(breaker.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('should throw AppError(4003) after exhausting retries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway'),
    });

    await expect(fetchEffisDetections()).rejects.toThrow(
      expect.objectContaining({ code: 4003 })
    );

    expect(breaker.onFailure).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout errors', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(fetchEffisDetections({ timeoutMs: 50 })).rejects.toThrow(
      expect.objectContaining({ code: 4003 })
    );
  });

  it('should accept custom bbox parameter', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(geojson),
    });

    await fetchEffisDetections({ bbox: '30,-8,36,-2,EPSG:4326' });

    const calledUrl = (global.fetch as Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('30%2C-8%2C36%2C-2%2CEPSG%3A4326');
  });
});
