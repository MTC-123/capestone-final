import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { assessRisk, isInsideModelDomain, levelFromScore, MODEL_DOMAIN_BBOX } from '@/lib/risk/riskService';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const AT = new Date('2026-06-15T12:00:00Z');

/** 48 hourly readings ending at `endsAt`, so a 24h window ending at AT is always available. */
function hourlyTimeSeries(endsAt: Date, hours = 48): string[] {
  const out: string[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    out.push(new Date(endsAt.getTime() - i * 3_600_000).toISOString().slice(0, 16));
  }
  return out;
}

function buildHourlyPayload(overrides: Partial<Record<string, (number | null)[]>> = {}) {
  const time = hourlyTimeSeries(AT);
  const n = time.length;
  const filled = (v: number) => Array.from({ length: n }, () => v);
  return {
    hourly: {
      time,
      temperature_2m: overrides.temperature_2m ?? filled(25),
      relative_humidity_2m: overrides.relative_humidity_2m ?? filled(30),
      wind_speed_10m: overrides.wind_speed_10m ?? filled(15),
      precipitation: overrides.precipitation ?? filled(0),
      shortwave_radiation: overrides.shortwave_radiation ?? filled(200),
    },
  };
}

const INSIDE_POINT = {
  lat: (MODEL_DOMAIN_BBOX.minLat + MODEL_DOMAIN_BBOX.maxLat) / 2,
  lng: (MODEL_DOMAIN_BBOX.minLng + MODEL_DOMAIN_BBOX.maxLng) / 2,
};
const OUTSIDE_POINT = { lat: 34.5, lng: -6.5 };

describe('isInsideModelDomain', () => {
  it('accepts a point inside the Ifrane Province bbox', () => {
    expect(isInsideModelDomain(INSIDE_POINT.lat, INSIDE_POINT.lng)).toBe(true);
  });

  it('rejects a point outside the bbox', () => {
    expect(isInsideModelDomain(OUTSIDE_POINT.lat, OUTSIDE_POINT.lng)).toBe(false);
  });
});

describe('levelFromScore', () => {
  it.each([
    [0.0, 'low'],
    [0.05, 'low'],
    [0.1, 'moderate'],
    [0.4, 'moderate'],
    [0.5, 'high'],
    [0.7, 'high'],
    [0.75, 'very_high'],
    [0.99, 'very_high'],
  ] as const)('maps score %f to level %s', (score, level) => {
    expect(levelFromScore(score)).toBe(level);
  });
});

describe('assessRisk', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns status ok with a score/level inside the model domain when weather succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(buildHourlyPayload()) })
    );

    const result = await assessRisk({ ...INSIDE_POINT, at: AT });

    expect(result.status).toBe('ok');
    expect(result.score).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.level).not.toBeNull();
    expect(result.modelId).toBe('ricer-wildfire-xgb');
    expect(result.dataTime).toBeTruthy();
    // NDVI has no live source in this integration, so it is always reported missing.
    expect(result.missing).toContain('causal_modis_ndvi_last_valid_6c');
    expect(result.fallback).toBeUndefined();
  });

  it('returns unavailable with reason outside_model_domain for a point outside Ifrane Province, with a fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(buildHourlyPayload()) })
    );

    const result = await assessRisk({ ...OUTSIDE_POINT, at: AT });

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('outside_model_domain');
    expect(result.score).toBeNull();
    expect(result.fallback?.label).toBe('heuristic');
    expect(result.fallback?.score).toBeGreaterThanOrEqual(0);
    expect(result.fallback?.score).toBeLessThanOrEqual(1);
  });

  it('returns unavailable with reason weather_unavailable and no fallback when the weather fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await assessRisk({ ...INSIDE_POINT, at: AT });

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('weather_unavailable');
    expect(result.fallback).toBeUndefined();
  });

  it('returns unavailable with reason weather_unavailable when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    );

    const result = await assessRisk({ ...INSIDE_POINT, at: AT });

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('weather_unavailable');
  });

  it('returns unavailable with reason missing_required_features when required weather values are absent, with a fallback', async () => {
    const payload = buildHourlyPayload({
      temperature_2m: hourlyTimeSeries(AT).map(() => null),
      relative_humidity_2m: hourlyTimeSeries(AT).map(() => null),
      wind_speed_10m: hourlyTimeSeries(AT).map(() => null),
      precipitation: hourlyTimeSeries(AT).map(() => null),
      shortwave_radiation: hourlyTimeSeries(AT).map(() => null),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }));

    const result = await assessRisk({ ...INSIDE_POINT, at: AT });

    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('missing_required_features');
    expect(result.missing).toEqual(
      expect.arrayContaining([
        'causal_temperature_mean_past24h_c',
        'causal_relative_humidity_mean_past24h_pct',
        'causal_wind_speed_mean_past24h_kmh',
      ])
    );
    expect(result.fallback?.label).toBe('heuristic');
  });
});
