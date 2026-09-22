import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock global fetch for the environment grid loader
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the fire-spread model
vi.mock('@/lib/fire-spread/model', () => ({
  calculateSpread: vi.fn(() => ({
    direction: 45,
    relativeRate: 0.6,
    riskLevel: 'moderate',
  })),
  computeEndpoint: vi.fn((lon: number, lat: number) => [lon + 0.01, lat + 0.01]),
}));

// Mock interpolation functions
vi.mock('@/lib/fire-spread/interpolate', () => ({
  nearestGridValue: vi.fn(() => 5),
  interpolateWind: vi.fn(() => ({ speed: 15, direction: 90 })),
  nearestSoilMoisture: vi.fn(() => 0.3),
}));

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
});

// Helper types matching the GeoFeatureCollection pattern
function emptyFC() {
  return { type: 'FeatureCollection' as const, features: [] };
}

function firmsFC(detections: Array<{ lon: number; lat: number; id: string; isRecent: boolean }>) {
  return {
    type: 'FeatureCollection' as const,
    features: detections.map((d) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [d.lon, d.lat] },
      properties: { id: d.id, isRecent: d.isRecent },
    })),
  };
}

function incidentsFC(incidents: Array<{ lon: number; lat: number; id: string; status: string }>) {
  return {
    type: 'FeatureCollection' as const,
    features: incidents.map((i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [i.lon, i.lat] },
      properties: { id: i.id, status: i.status },
    })),
  };
}

function windFC(points: Array<{ lon: number; lat: number; speed: number; direction: number }>) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: { speed: p.speed, direction: p.direction },
    })),
  };
}

function mockEnvGrid() {
  return {
    features: [{ geometry: { coordinates: [0, 0] }, properties: { slope: 5, aspect: 0, fuel: 30 } }],
    bbox: { lonMin: -6, latMin: 33, lonMax: -4, latMax: 34, cols: 10, rows: 10 },
    gridStep: 0.01,
  };
}

async function importHook() {
  const mod = await import('@/hooks/useFireSpreadVectors');
  return mod.useFireSpreadVectors;
}

describe('useFireSpreadVectors', () => {
  it('returns idle status when isActive is false', async () => {
    const useFireSpreadVectors = await importHook();
    const { result } = renderHook(() =>
      useFireSpreadVectors(
        emptyFC() as any,
        emptyFC() as any,
        emptyFC() as any,
        null,
        false,
      ),
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.vectors).toBeNull();
  });

  it('returns loading status while environment grid is being fetched', async () => {
    // Make fetch hang (never resolves)
    mockFetch.mockReturnValue(new Promise(() => {}));

    const useFireSpreadVectors = await importHook();
    const { result } = renderHook(() =>
      useFireSpreadVectors(
        firmsFC([{ lon: -5.1, lat: 33.5, id: 'f1', isRecent: true }]) as any,
        emptyFC() as any,
        windFC([{ lon: -5.1, lat: 33.5, speed: 10, direction: 90 }]) as any,
        null,
        true,
      ),
    );

    // Should be loading since env grid hasn't loaded
    expect(result.current.status).toBe('loading');
  });

  it('returns no-fires when active but no fire sources', async () => {
    // Pre-populate env grid by resolving fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEnvGrid()),
    });

    const useFireSpreadVectors = await importHook();
    const { result } = renderHook(() =>
      useFireSpreadVectors(
        emptyFC() as any,
        emptyFC() as any,
        windFC([{ lon: -5.1, lat: 33.5, speed: 10, direction: 90 }]) as any,
        null,
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('no-fires');
    });
  });

  it('produces vectors from FIRMS detections (isRecent=true)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEnvGrid()),
    });

    const useFireSpreadVectors = await importHook();
    const firms = firmsFC([
      { lon: -5.1, lat: 33.5, id: 'f1', isRecent: true },
      { lon: -5.2, lat: 33.6, id: 'f2', isRecent: false }, // not recent, should be excluded
    ]);
    const wind = windFC([{ lon: -5.1, lat: 33.5, speed: 15, direction: 90 }]);

    const { result } = renderHook(() =>
      useFireSpreadVectors(
        firms as any,
        emptyFC() as any,
        wind as any,
        null,
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('has-vectors');
    });

    // Should have 2 features: 1 LineString + 1 Point (arrowhead) for the one recent detection
    expect(result.current.vectors).not.toBeNull();
    expect(result.current.vectors!.features.length).toBe(2);

    const line = result.current.vectors!.features.find((f) => f.geometry.type === 'LineString');
    const tip = result.current.vectors!.features.find(
      (f) => f.geometry.type === 'Point' && f.properties?.isTip,
    );
    expect(line).toBeDefined();
    expect(tip).toBeDefined();
    expect(line!.properties!.fireId).toBe('f1');
    expect(line!.properties!.fireType).toBe('firms');
  });

  it('produces vectors from incidents with INTERVENTION or ALERTE status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEnvGrid()),
    });

    const useFireSpreadVectors = await importHook();
    const incidents = incidentsFC([
      { lon: -5.1, lat: 33.5, id: 'inc1', status: 'INTERVENTION' },
      { lon: -5.2, lat: 33.6, id: 'inc2', status: 'ALERTE' },
      { lon: -5.3, lat: 33.7, id: 'inc3', status: 'RESOLVED' }, // excluded
    ]);
    const wind = windFC([{ lon: -5.1, lat: 33.5, speed: 10, direction: 0 }]);

    const { result } = renderHook(() =>
      useFireSpreadVectors(
        emptyFC() as any,
        incidents as any,
        wind as any,
        null,
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('has-vectors');
    });

    // 2 active incidents => 2 * 2 = 4 features (line + tip each)
    expect(result.current.vectors!.features.length).toBe(4);

    const fireTypes = result.current.vectors!.features.map((f) => f.properties!.fireType);
    expect(fireTypes.every((t) => t === 'incident')).toBe(true);
  });

  it('includes simulation point as a fire source', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEnvGrid()),
    });

    const useFireSpreadVectors = await importHook();
    const wind = windFC([{ lon: -5.1, lat: 33.5, speed: 10, direction: 0 }]);

    const { result } = renderHook(() =>
      useFireSpreadVectors(
        emptyFC() as any,
        emptyFC() as any,
        wind as any,
        null,
        true,
        { lon: -5.15, lat: 33.55 },
      ),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('has-vectors');
    });

    const simFeatures = result.current.vectors!.features.filter(
      (f) => f.properties!.fireType === 'simulation',
    );
    expect(simFeatures.length).toBe(2); // line + tip
    expect(simFeatures[0].properties!.fireId).toBe('simulation');
  });

  it('assigns correct properties to vector features', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEnvGrid()),
    });

    const useFireSpreadVectors = await importHook();
    const firms = firmsFC([{ lon: -5.1, lat: 33.5, id: 'f1', isRecent: true }]);
    const wind = windFC([{ lon: -5.1, lat: 33.5, speed: 10, direction: 0 }]);

    const { result } = renderHook(() =>
      useFireSpreadVectors(
        firms as any,
        emptyFC() as any,
        wind as any,
        null,
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.vectors).not.toBeNull();
    });

    const line = result.current.vectors!.features.find((f) => f.geometry.type === 'LineString');
    expect(line!.properties).toMatchObject({
      direction: 45,
      relativeRate: 0.6,
      riskLevel: 'moderate',
      fireId: 'f1',
      fireType: 'firms',
    });
  });
});
