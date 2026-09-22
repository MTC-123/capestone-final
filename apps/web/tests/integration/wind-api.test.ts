import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock withApiHandler to just call the handler directly
vi.mock('@/lib/errors/withApiHandler', () => ({
  withApiHandler: (fn: Function) => fn,
}));

const mockRequest = new Request('http://localhost/api/weather/wind');

describe('Wind API route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.mock('@/lib/errors/withApiHandler', () => ({
      withApiHandler: (fn: Function) => fn,
    }));
  });

  it('returns GeoJSON with 25 features on success', async () => {
    // Open-Meteo multi-coordinate API returns an array of point objects
    const points = Array.from({ length: 25 }, (_, i) => ({
      latitude: 33.0 + Math.floor(i / 5) * 0.25,
      longitude: -5.5 + (i % 5) * 0.25,
      current: {
        wind_speed_10m: 12.5,
        wind_direction_10m: 180,
        wind_gusts_10m: 25.0,
      },
    }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(points),
    }));

    const { GET } = await import('@/app/api/weather/wind/route');
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(25);
    expect(data.features[0].geometry.type).toBe('Point');
    expect(data.features[0].properties).toHaveProperty('speed');
    expect(data.features[0].properties).toHaveProperty('direction');
    expect(data.features[0].properties).toHaveProperty('gusts');
  });

  it('throws on non-ok response from Open-Meteo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    vi.resetModules();
    vi.mock('@/lib/errors/withApiHandler', () => ({
      withApiHandler: (fn: Function) => fn,
    }));
    const { GET } = await import('@/app/api/weather/wind/route');

    await expect(GET(mockRequest)).rejects.toThrow('HTTP 503');
  });

  it('throws on invalid response structure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: true }),
    }));

    vi.resetModules();
    vi.mock('@/lib/errors/withApiHandler', () => ({
      withApiHandler: (fn: Function) => fn,
    }));
    const { GET } = await import('@/app/api/weather/wind/route');

    await expect(GET(mockRequest)).rejects.toThrow('Invalid');
  });
});
