import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TomTomClient } from '@/lib/routing/tomtom';
import { routing, configuredRoutingProviders } from '@/lib/routing';
import { RoutingError, RoutingErrorCode } from '@/lib/routing/types';

const STATION: [number, number] = [-5.1056, 33.5275];
const FIRE: [number, number] = [-5.08, 33.55];

const routeBody = {
  routes: [
    {
      summary: { lengthInMeters: 5447, travelTimeInSeconds: 860, trafficDelayInSeconds: 0 },
      legs: [{ points: [{ latitude: 33.5275, longitude: -5.1056 }, { latitude: 33.55, longitude: -5.08 }] }],
      guidance: {
        instructions: [
          { message: 'Partez vers le nord', routeOffsetInMeters: 0, travelTimeInSeconds: 0 },
          { message: 'Vous êtes arrivé', routeOffsetInMeters: 5447, travelTimeInSeconds: 860 },
        ],
      },
    },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('TomTomClient', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps a TomTom route to the shared route shape, lng/lat order', async () => {
    fetchMock.mockResolvedValueOnce(json(routeBody));
    const result = await new TomTomClient('k').getRoute({ origin: STATION, destination: FIRE, profile: 'car' });
    expect(result.primary.distance_km).toBe(5.45);
    expect(result.primary.duration_min).toBe(14.3);
    expect(result.primary.coordinates[0]).toEqual(STATION);
    expect(result.primary.instructions?.[0]).toMatchObject({ text: 'Partez vers le nord', distance: 5447, time: 860_000 });
    expect(result.metadata.provider).toBe('tomtom');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toContain('/calculateRoute/33.5275,-5.1056:33.55,-5.08/json');
    expect(url.searchParams.get('traffic')).toBe('true');
  });

  it('routes fire engines as trucks and retries as a car when no truck route exists', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"NO_ROUTE_FOUND"}', { status: 400 }))
      .mockResolvedValueOnce(json(routeBody));
    const result = await new TomTomClient('k').getRoute({ origin: STATION, destination: FIRE, profile: 'fire_truck' });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('travelMode')).toBe('truck');
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('vehicleWeight')).toBe('12000');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('travelMode')).toBe('car');
    expect(result.primary.distance_km).toBe(5.45);
  });

  it('returns one closed polygon per time budget for reachable ranges', async () => {
    const boundary = [
      { latitude: 33.6, longitude: -5.1 },
      { latitude: 33.5, longitude: -5.0 },
      { latitude: 33.45, longitude: -5.2 },
    ];
    fetchMock.mockImplementation(async () => json({ reachableRange: { boundary } }));
    const result = await new TomTomClient('k').getIsochrone({ origin: STATION, profile: 'car', times: [10, 20] });
    expect(result.features).toHaveLength(2);
    const ring = result.features[1].geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(result.features[1].properties).toEqual({ time_minutes: 20, bucket: 1 });
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('timeBudgetInSec')).toBe('1200');
  });

  it('retries once on a server error, then reports the service as unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    await expect(new TomTomClient('k').getRoute({ origin: STATION, destination: FIRE, profile: 'car' })).rejects.toMatchObject({
      code: RoutingErrorCode.SERVICE_UNAVAILABLE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the daily quota as a rate-limit error without retrying', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(new TomTomClient('k').getRoute({ origin: STATION, destination: FIRE, profile: 'car' })).rejects.toMatchObject({
      code: RoutingErrorCode.RATE_LIMIT_EXCEEDED,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('routing failover', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('prefers TomTom, then GraphHopper', () => {
    vi.stubEnv('TOMTOM_API_KEY', 'k');
    vi.stubEnv('GRAPHHOPPER_API_KEY', 'g');
    expect(configuredRoutingProviders()).toEqual(['tomtom', 'graphhopper']);
  });

  it('throws SERVICE_UNAVAILABLE when nothing is configured, so callers use an estimate', async () => {
    vi.stubEnv('TOMTOM_API_KEY', '');
    vi.stubEnv('GRAPHHOPPER_API_KEY', '');
    vi.stubEnv('GRAPHHOPPER_URL', '');
    const error = await routing.getRoute({ origin: STATION, destination: FIRE, profile: 'car' }).catch((e) => e);
    expect(error).toBeInstanceOf(RoutingError);
    expect(error.code).toBe(RoutingErrorCode.SERVICE_UNAVAILABLE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls through to GraphHopper when TomTom is down', async () => {
    vi.stubEnv('TOMTOM_API_KEY', 'k');
    vi.stubEnv('GRAPHHOPPER_API_KEY', 'g');
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('api.tomtom.com')) return new Response('down', { status: 503 });
      return json({
        paths: [{ distance: 6000, time: 900_000, points: { type: 'LineString', coordinates: [STATION, FIRE] } }],
      });
    });
    const result = await routing.getRoute({ origin: STATION, destination: FIRE, profile: 'car' });
    expect(result.metadata.provider).toBe('graphhopper');
    expect(result.primary.distance_km).toBeCloseTo(6, 1);
  });
});
