import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/errors/withApiHandler', () => ({
  withApiHandler: (fn: (request: Request, context?: unknown) => unknown) => fn,
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** Builds a valid multi-coordinate Open-Meteo hourly response for `count` points. */
function buildGridBatchResponse(lats: number[], lngs: number[]) {
  const now = Date.now();
  const time: string[] = [];
  for (let i = 23; i >= 0; i--) {
    time.push(new Date(now - i * 3_600_000).toISOString().slice(0, 16));
  }
  return lats.map((lat, i) => ({
    latitude: lat,
    longitude: lngs[i],
    hourly: {
      time,
      temperature_2m: time.map(() => 25),
      relative_humidity_2m: time.map(() => 30),
      wind_speed_10m: time.map(() => 15),
      precipitation: time.map(() => 0),
      shortwave_radiation: time.map(() => 200),
    },
  }));
}

describe('/api/risk/grid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.mock('@/lib/errors/withApiHandler', () => ({
      withApiHandler: (fn: (request: Request, context?: unknown) => unknown) => fn,
    }));
    vi.mock('@/lib/observability/logger', () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        const u = new URL(url);
        const lats = (u.searchParams.get('latitude') ?? '').split(',').map(Number);
        const lngs = (u.searchParams.get('longitude') ?? '').split(',').map(Number);
        return { ok: true, json: () => Promise.resolve(buildGridBatchResponse(lats, lngs)) };
      })
    );
  });

  it('returns a GeoJSON FeatureCollection covering the Ifrane Province bbox with score and level per cell', async () => {
    const { GET } = await import('@/app/api/risk/grid/route');
    const response = await GET(new Request('http://localhost/api/risk/grid'));

    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=1800, stale-while-revalidate=300');

    const body = await response.json();
    expect(body.type).toBe('FeatureCollection');
    expect(Array.isArray(body.features)).toBe(true);
    expect(body.features.length).toBeGreaterThan(100);

    const feature = body.features[0];
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Point');
    expect(typeof feature.properties.score).toBe('number');
    expect(['low', 'moderate', 'high', 'very_high']).toContain(feature.properties.level);
    expect(feature.properties.score).toBeGreaterThanOrEqual(0);
    expect(feature.properties.score).toBeLessThanOrEqual(1);

    for (const f of body.features) {
      expect(f.geometry.coordinates[0]).toBeGreaterThanOrEqual(-5.6);
      expect(f.geometry.coordinates[0]).toBeLessThanOrEqual(-4.6);
      expect(f.geometry.coordinates[1]).toBeGreaterThanOrEqual(33.1);
      expect(f.geometry.coordinates[1]).toBeLessThanOrEqual(33.8);
    }
  }, 20_000);

  it('batches the weather fetch instead of one request per cell', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const u = new URL(url);
      const lats = (u.searchParams.get('latitude') ?? '').split(',').map(Number);
      const lngs = (u.searchParams.get('longitude') ?? '').split(',').map(Number);
      return { ok: true, json: () => Promise.resolve(buildGridBatchResponse(lats, lngs)) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('@/app/api/risk/grid/route');
    const response = await GET(new Request('http://localhost/api/risk/grid'));
    const body = await response.json();

    // Far fewer fetch calls than grid cells — batched, not one-per-point.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBeLessThan(body.features.length / 10);
  }, 20_000);

  it('omits cells when the weather batch fails, rather than fabricating a score', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { GET } = await import('@/app/api/risk/grid/route');
    const response = await GET(new Request('http://localhost/api/risk/grid'));
    const body = await response.json();

    expect(body.type).toBe('FeatureCollection');
    expect(body.features).toHaveLength(0);
  }, 20_000);
});
