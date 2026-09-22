/**
 * Combined detections API route integration tests
 * Tests: /api/detections/combined (GET)
 *
 * Covers auth, caching, parallel fetch, circuit breaker reset,
 * rate limiting, graceful degradation, and response headers.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/detections/combined/route';
import { getCurrentUser } from '@/lib/auth';
import type { Scope } from '@/lib/auth';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

vi.mock('@/lib/auth');
vi.mock('@/lib/firms/cache');
vi.mock('@/lib/effis/cache');
vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Hoisted mocks for rate limiter and circuit breaker
const { mockCheckLimit, mockGetCircuitBreaker, mockClearFirmsCache } = vi.hoisted(() => ({
  mockCheckLimit: vi.fn(),
  mockGetCircuitBreaker: vi.fn(),
  mockClearFirmsCache: vi.fn(),
}));

vi.mock('@/lib/ratelimit/slidingWindow', () => ({
  createFirmsRateLimiter: () => ({ checkLimit: mockCheckLimit }),
}));

const mockBreakerReset = vi.fn();

vi.mock('@/lib/platform/circuitBreaker', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

// Mock FIRMS client module — fetchFirmsWithFallback + FIRMS_ENDPOINTS
const { mockFetchFirmsWithFallback } = vi.hoisted(() => ({
  mockFetchFirmsWithFallback: vi.fn(),
}));

vi.mock('@/lib/firms/client', () => ({
  fetchFirmsWithFallback: mockFetchFirmsWithFallback,
  FIRMS_ENDPOINTS: [
    { id: 'nasa-firms-primary', baseUrl: 'https://firms2.modaps.eosdis.nasa.gov/api/area/csv', label: 'FIRMS2' },
    { id: 'nasa-firms-fallback', baseUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv', label: 'FIRMS' },
  ],
}));

// Mock EFFIS client
const { mockFetchEffisDetections } = vi.hoisted(() => ({
  mockFetchEffisDetections: vi.fn(),
}));

vi.mock('@/lib/effis/client', () => ({
  fetchEffisDetections: mockFetchEffisDetections,
  MIDDLE_ATLAS_BBOX: '32.5,-6.0,34.0,-4.5,EPSG:4326',
}));

// Mock transform modules
vi.mock('@/lib/firms/transform', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/firms/transform')>();
  return { ...real };
});

vi.mock('@/lib/effis/transform', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/effis/transform')>();
  return { ...real };
});

// ── Helpers ──

const OFFICIAL_USER = {
  tokenUse: 'access' as const,
  userId: 'official-1',
  cin: 'OFF1',
  role: 'OFFICIAL' as const,
  scopes: ['map:read', 'map:write'] as Scope[],
};

const CIVILIAN_USER = {
  tokenUse: 'access' as const,
  userId: 'civilian-1',
  cin: 'CIV1',
  role: 'CIVILIAN' as const,
  scopes: ['map:read'] as Scope[],
};

const NO_SCOPE_USER = {
  tokenUse: 'access' as const,
  userId: 'noscope-1',
  cin: 'NS1',
  role: 'CIVILIAN' as const,
  scopes: [] as Scope[],
};

function makeRequest(url = 'http://localhost/api/detections/combined') {
  return new Request(url);
}

function makeFeature(
  lat: number,
  lon: number,
  frp: number,
  confidence: 'high' | 'nominal' | 'low' = 'high',
  isRecent = true
): GeoFeatureCollection<GeoFirmsDetectionProps>['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id: `test:${lat},${lon}`,
      brightness: 350,
      frp,
      confidence,
      satellite: 'N',
      instrument: 'VIIRS',
      acqDateTime: '2024-02-09 13:45',
      daynight: 'D',
      isRecent,
    },
  };
}

function makeCollection(
  features: GeoFeatureCollection<GeoFirmsDetectionProps>['features']
): GeoFeatureCollection<GeoFirmsDetectionProps> {
  return { type: 'FeatureCollection', features };
}

const EMPTY_COLLECTION = makeCollection([]);

const FIRMS_COLLECTION = makeCollection([
  makeFeature(33.5, -5.1, 45, 'high', true),
  makeFeature(33.6, -5.2, 30, 'nominal', false),
]);

const EFFIS_COLLECTION = makeCollection([
  makeFeature(33.7, -5.3, 55, 'high', true),
]);

// ── Setup ──

describe('Combined Detections API', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.FIRMS_MAP_KEY = 'a'.repeat(32);

    // Defaults: rate limiter allows, circuit breaker closed
    mockCheckLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    mockGetCircuitBreaker.mockReturnValue({
      canRequest: vi.fn().mockReturnValue(true),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
      reset: mockBreakerReset,
    });

    // Default: cache miss for both FIRMS + EFFIS
    const { getCachedFirmsDetections, setCachedFirmsDetections, clearFirmsCache } =
      await import('@/lib/firms/cache');
    vi.mocked(getCachedFirmsDetections).mockResolvedValue(null);
    vi.mocked(setCachedFirmsDetections).mockResolvedValue(undefined);
    vi.mocked(clearFirmsCache).mockImplementation(mockClearFirmsCache);

    const { getCachedEffisDetections, setCachedEffisDetections } =
      await import('@/lib/effis/cache');
    vi.mocked(getCachedEffisDetections).mockResolvedValue(null);
    vi.mocked(setCachedEffisDetections).mockResolvedValue(undefined);

    // Default: upstream fetches fail (tests that need success override)
    mockFetchFirmsWithFallback.mockRejectedValue(new Error('FIRMS fetch not configured'));
    mockFetchEffisDetections.mockRejectedValue(new Error('EFFIS fetch not configured'));
  });

  // ── Authentication ──

  describe('Authentication & Authorization', () => {
    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET(makeRequest());
      expect(response.status).toBe(401);
    });

    it('returns 403 for user without map:read scope', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(NO_SCOPE_USER);

      const response = await GET(makeRequest());
      expect(response.status).toBe(403);
    });

    it('succeeds for authenticated user with map:read scope', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);

      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: FIRMS_COLLECTION, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EFFIS_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest());
      expect(response.status).toBe(200);
    });
  });

  // ── Cache behavior ──

  describe('Cache Behavior', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);
    });

    it('returns X-Cache: HIT and X-Detection-Source: firms+effis when both cached', async () => {
      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: FIRMS_COLLECTION, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EFFIS_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('HIT');
      expect(response.headers.get('X-Detection-Source')).toBe('firms+effis');
    });

    it('returns combined detection count in X-Detection-Count', async () => {
      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: FIRMS_COLLECTION, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EFFIS_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest());
      // 2 FIRMS + 1 EFFIS = 3 (no dedup, different locations)
      expect(response.headers.get('X-Detection-Count')).toBe('3');
    });

    it('fetches from upstream on cache miss', async () => {
      const firmsCSV = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D';

      mockFetchFirmsWithFallback.mockResolvedValue({
        csvText: firmsCSV,
        endpointUsed: 'nasa-firms-primary',
        durationMs: 500,
        attemptsMade: 1,
      });

      const effisGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
            properties: { brightness: 340, frp: 40, confidence: 'high', acq_date: '2024-02-09', acq_time: '1430', daynight: 'D' },
          },
        ],
      };

      mockFetchEffisDetections.mockResolvedValue({
        geojson: effisGeoJSON,
        durationMs: 800,
        attemptsMade: 1,
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('X-Detection-Source')).toBe('firms+effis');
      expect(mockFetchFirmsWithFallback).toHaveBeenCalled();
      expect(mockFetchEffisDetections).toHaveBeenCalled();
    });
  });

  // ── Parallel fetch & graceful degradation ──

  describe('Parallel Fetch & Graceful Degradation', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);
    });

    it('returns FIRMS-only data when EFFIS fails', async () => {
      const firmsCSV = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D';

      mockFetchFirmsWithFallback.mockResolvedValue({
        csvText: firmsCSV,
        endpointUsed: 'nasa-firms-primary',
        durationMs: 500,
        attemptsMade: 1,
      });
      mockFetchEffisDetections.mockRejectedValue(new Error('EFFIS WFS timeout'));

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Detection-Source')).toBe('firms');
    });

    it('returns EFFIS-only data when FIRMS fails', async () => {
      delete process.env.FIRMS_MAP_KEY; // No API key → FIRMS returns null

      const effisGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
            properties: { brightness: 340, frp: 40, confidence: 'high', acq_date: '2024-02-09', acq_time: '1430', daynight: 'D' },
          },
        ],
      };

      mockFetchEffisDetections.mockResolvedValue({
        geojson: effisGeoJSON,
        durationMs: 800,
        attemptsMade: 1,
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Detection-Source')).toBe('effis');
    });

    it('falls back to stale cache when both upstream sources fail', async () => {
      // First call: cache miss, both upstreams fail
      // Second cache lookup (fallback): returns stale data
      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');

      // Primary cache miss, then fallback cache hit
      vi.mocked(getCachedFirmsDetections)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ data: FIRMS_COLLECTION, cachedAt: Date.now() - 3600000 });
      vi.mocked(getCachedEffisDetections)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockFetchFirmsWithFallback.mockRejectedValue(new Error('Network error'));
      mockFetchEffisDetections.mockRejectedValue(new Error('Timeout'));

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Detection-Source')).toBe('cache');
    });

    it('returns 502 when both fail and no cached data', async () => {
      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');

      vi.mocked(getCachedFirmsDetections).mockResolvedValue(null);
      vi.mocked(getCachedEffisDetections).mockResolvedValue(null);

      mockFetchFirmsWithFallback.mockRejectedValue(new Error('All endpoints down'));
      mockFetchEffisDetections.mockRejectedValue(new Error('EFFIS down'));

      const response = await GET(makeRequest());

      expect(response.status).toBe(502);
    });
  });

  // ── Circuit breaker reset ──

  describe('Circuit Breaker Reset', () => {
    it('resets all circuit breakers and clears cache on ?reset=true', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);

      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: FIRMS_COLLECTION, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EFFIS_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest('http://localhost/api/detections/combined?reset=true'));

      expect(response.status).toBe(200);
      // Circuit breakers for both FIRMS endpoints + EFFIS should be reset
      // getCircuitBreaker is called for each endpoint ID
      expect(mockBreakerReset).toHaveBeenCalled();
      expect(mockClearFirmsCache).toHaveBeenCalled();
    });
  });

  // ── Rate Limiting ──

  describe('Rate Limiting', () => {
    it('returns 429 with Retry-After when rate limited', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);

      mockCheckLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        retryAfter: 60,
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');

      const body = await response.json();
      expect(body.error.code).toBe(1002);
      expect(body.error.name).toBe('RATE_LIMITED');
    });

    it('includes X-RateLimit-Remaining on successful request', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);
      mockCheckLimit.mockResolvedValue({ allowed: true, remaining: 7, resetAt: Date.now() + 60_000 });

      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: FIRMS_COLLECTION, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EFFIS_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('7');
    });
  });

  // ── Response Headers ──

  describe('Response Headers', () => {
    beforeEach(async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);
    });

    it('includes detection stats headers on cache miss', async () => {
      const firmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D`;

      mockFetchFirmsWithFallback.mockResolvedValue({
        csvText: firmsCSV,
        endpointUsed: 'nasa-firms-primary',
        durationMs: 500,
        attemptsMade: 1,
      });
      mockFetchEffisDetections.mockRejectedValue(new Error('EFFIS down'));

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Detection-Count')).toBeTruthy();
      expect(response.headers.get('X-High-Confidence-Count')).toBeTruthy();
      expect(response.headers.get('X-Recent-Count')).toBeTruthy();
      expect(response.headers.get('Cache-Control')).toContain('s-maxage=900');
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=300');
    });

    it('includes X-High-Confidence-Count from stats', async () => {
      const highConfCollection = makeCollection([
        makeFeature(33.5, -5.1, 45, 'high'),
        makeFeature(33.6, -5.2, 30, 'high'),
        makeFeature(33.7, -5.3, 55, 'nominal'),
      ]);

      const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
      const { getCachedEffisDetections } = await import('@/lib/effis/cache');
      vi.mocked(getCachedFirmsDetections).mockResolvedValue({ data: highConfCollection, cachedAt: Date.now() });
      vi.mocked(getCachedEffisDetections).mockResolvedValue({ data: EMPTY_COLLECTION, cachedAt: Date.now() });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-High-Confidence-Count')).toBe('2');
    });
  });

  // ── FIRMS API key validation ──

  describe('FIRMS API Key Handling', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);
    });

    it('skips FIRMS fetch when FIRMS_MAP_KEY is missing', async () => {
      delete process.env.FIRMS_MAP_KEY;

      // EFFIS succeeds so we don't get 502
      const effisGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
            properties: { brightness: 340, frp: 40, confidence: 'high', acq_date: '2024-02-09', acq_time: '1430', daynight: 'D' },
          },
        ],
      };

      mockFetchEffisDetections.mockResolvedValue({
        geojson: effisGeoJSON,
        durationMs: 800,
        attemptsMade: 1,
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(mockFetchFirmsWithFallback).not.toHaveBeenCalled();
    });

    it('skips FIRMS fetch when FIRMS_MAP_KEY has invalid format', async () => {
      process.env.FIRMS_MAP_KEY = 'not-a-valid-hex-key';

      const effisGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
            properties: { brightness: 340, frp: 40, confidence: 'high', acq_date: '2024-02-09', acq_time: '1430', daynight: 'D' },
          },
        ],
      };

      mockFetchEffisDetections.mockResolvedValue({
        geojson: effisGeoJSON,
        durationMs: 800,
        attemptsMade: 1,
      });

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(mockFetchFirmsWithFallback).not.toHaveBeenCalled();
    });
  });
});
