import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));

vi.mock('@/lib/errors/withApiHandler', () => ({
  withApiHandler: (fn: (request: Request, context?: unknown) => unknown) => fn,
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const AUTHED_USER = { tokenUse: 'access', userId: 'user-1', cin: 'CIV001', role: 'CIVILIAN', scopes: [] };

/** 48 hourly readings so every 24h window has data, regardless of "now". */
function buildHourlyPayload() {
  const now = Date.now();
  const time: string[] = [];
  const filled = () => [] as number[];
  const temperature_2m: number[] = [];
  const relative_humidity_2m: number[] = [];
  const wind_speed_10m: number[] = [];
  const precipitation: number[] = [];
  const shortwave_radiation: number[] = [];
  for (let i = 47; i >= 0; i--) {
    time.push(new Date(now - i * 3_600_000).toISOString().slice(0, 16));
    temperature_2m.push(25);
    relative_humidity_2m.push(30);
    wind_speed_10m.push(15);
    precipitation.push(0);
    shortwave_radiation.push(200);
  }
  void filled;
  return { hourly: { time, temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation, shortwave_radiation } };
}

describe('/api/risk/predict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getCurrentUser.mockResolvedValue(AUTHED_USER);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(buildHourlyPayload()) }));
  });

  it('GET requires authentication', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const { GET } = await import('@/app/api/risk/predict/route');
    const request = new Request('http://localhost/api/risk/predict?lat=33.5&lng=-5.1');
    await expect(GET(request)).rejects.toThrow();
  });

  it('GET validates lat/lng are present and numeric', async () => {
    const { GET } = await import('@/app/api/risk/predict/route');
    const missing = new Request('http://localhost/api/risk/predict?lat=33.5');
    await expect(GET(missing)).rejects.toThrow();

    const notNumeric = new Request('http://localhost/api/risk/predict?lat=abc&lng=-5.1');
    await expect(GET(notNumeric)).rejects.toThrow();
  });

  it('GET rejects out-of-range coordinates', async () => {
    const { GET } = await import('@/app/api/risk/predict/route');
    const request = new Request('http://localhost/api/risk/predict?lat=999&lng=-5.1');
    await expect(GET(request)).rejects.toThrow();
  });

  it('GET returns a risk assessment with cache headers for a valid point', async () => {
    const { GET } = await import('@/app/api/risk/predict/route');
    const request = new Request('http://localhost/api/risk/predict?lat=33.5&lng=-5.1');
    const response = await GET(request);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    const body = await response.json();
    expect(['ok', 'unavailable']).toContain(body.status);
    expect(body.modelId).toBe('ricer-wildfire-xgb');
  });

  it('POST accepts a batch of up to 50 points', async () => {
    const { POST } = await import('@/app/api/risk/predict/route');
    const points = Array.from({ length: 5 }, (_, i) => ({ lat: 33.5 + i * 0.01, lng: -5.1 }));
    const request = new Request('http://localhost/api/risk/predict', {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(body.results).toHaveLength(5);
  });

  it('POST rejects a batch larger than 50 points', async () => {
    const { POST } = await import('@/app/api/risk/predict/route');
    const points = Array.from({ length: 51 }, (_, i) => ({ lat: 33.5, lng: -5.1 + i * 0.001 }));
    const request = new Request('http://localhost/api/risk/predict', {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
    await expect(POST(request)).rejects.toThrow();
  });

  it('POST rejects an empty batch', async () => {
    const { POST } = await import('@/app/api/risk/predict/route');
    const request = new Request('http://localhost/api/risk/predict', {
      method: 'POST',
      body: JSON.stringify({ points: [] }),
    });
    await expect(POST(request)).rejects.toThrow();
  });

  it('POST rejects malformed JSON', async () => {
    const { POST } = await import('@/app/api/risk/predict/route');
    const request = new Request('http://localhost/api/risk/predict', {
      method: 'POST',
      body: '{not json',
    });
    await expect(POST(request)).rejects.toThrow();
  });
});
