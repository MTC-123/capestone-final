import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { POST as routePost } from '@/app/api/dispatch/route/route';
import { getCurrentUser } from '@/lib/auth';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger');

// Mock GraphHopper client
const mockRouteResponse = {
  primary: {
    coordinates: [
      [-5.1056, 33.5275],
      [-5.1000, 33.5300],
      [-5.0800, 33.5500],
    ],
    distance_km: 12.5,
    duration_min: 18,
    instructions: [],
  },
  alternatives: [],
  metadata: {
    provider: 'graphhopper',
    cached: false,
    computed_at: new Date().toISOString(),
  },
};

const mockGetRoute = vi.fn().mockResolvedValue(mockRouteResponse);

vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: mockGetRoute,
  })),
}));

// Mock cache with stats
let cacheHits = 0;
let cacheMisses = 0;

vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn().mockImplementation(() => {
    cacheMisses++;
    return Promise.resolve(null);
  }),
  setCachedRoute: vi.fn().mockResolvedValue(undefined),
  getRouteCacheStats: vi.fn().mockImplementation(() => ({
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: cacheHits / (cacheHits + cacheMisses || 1),
  })),
}));

// Mock rate limiter — vi.hoisted() ensures this is available inside the hoisted vi.mock() factory
const mockCheckLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 29,
    resetAt: Date.now() + 60000,
  })
);

vi.mock('@/lib/ratelimit/slidingWindow', () => ({
  SlidingWindowRateLimiter: vi.fn().mockImplementation(() => ({
    checkLimit: mockCheckLimit,
  })),
}));

function createRequest(body: any) {
  return new Request('http://localhost/api/dispatch/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockOfficialUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-official',
    cin: 'OFF123',
    role: 'OFFICIAL' as const,
    scopes: ['map:read'],
  });
}

function mockCivilianUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-civilian',
    cin: 'CIV123',
    role: 'CIVILIAN' as const,
    scopes: ['map:read'],
  });
}

describe('Routing API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheHits = 0;
    cacheMisses = 0;
    mockCheckLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetAt: Date.now() + 60000,
    });
    mockGetRoute.mockResolvedValue(mockRouteResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Route calculation', () => {
    it('should calculate route successfully', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1056, 33.5275],
          destination: [-5.0800, 33.5500],
          profile: 'fire_truck',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.primary).toBeDefined();
      expect(data.primary.distance_km).toBe(12.5);
      expect(data.primary.duration_min).toBe(18);
      expect(data.metadata.provider).toBe('graphhopper');
    });

    it('should support different routing profiles', async () => {
      mockOfficialUser();

      const profiles = ['fire_truck', 'car', 'foot'];

      for (const profile of profiles) {
        const response = await routePost(
          createRequest({
            origin: [-5.1, 33.5],
            destination: [-5.0, 33.6],
            profile,
          })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.primary).toBeDefined();
      }
    });

    it('should validate required fields', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          // Missing destination
          profile: 'car',
        })
      );

      expect(response.status).toBe(422);
      const error = await response.json();
      expect(error.error.code).toBe(1001); // VALIDATION_FAILED
      expect(error.error.fields).toBeDefined();
    });

    it('should validate coordinate format', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: 'invalid',
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(422);
      const error = await response.json();
      expect(error.error.code).toBe(1001);
    });

    it('should validate coordinate ranges', async () => {
      mockOfficialUser();

      // Invalid longitude
      mockGetRoute.mockRejectedValueOnce({
        code: 'INVALID_COORDINATES',
        message: 'Invalid longitude',
      });

      const response = await routePost(
        createRequest({
          origin: [200, 33.5], // Invalid longitude
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(422);
      const error = await response.json();
      expect(error.error.code).toBe(6002); // INVALID_COORDINATES
    });
  });

  describe('Caching behavior', () => {
    it('should set X-Cache header to MISS on first request', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
    });

    it('should set Cache-Control header', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('s-maxage=3600'); // 1 hour
    });
  });

  describe('Rate limiting', () => {
    it('should include rate limit headers', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('29');
    });

    it('should reject requests when rate limited', async () => {
      mockOfficialUser();
      mockCheckLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
        retryAfter: 30,
      });

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(429); // Too Many Requests
      const error = await response.json();
      expect(error.error.code).toBe(1002); // RATE_LIMITED
    });

    it('should enforce 30 requests per minute limit', async () => {
      mockOfficialUser();

      // Make 30 requests
      for (let i = 0; i < 30; i++) {
        mockCheckLimit.mockResolvedValueOnce({
          allowed: true,
          remaining: 29 - i,
          resetAt: Date.now() + 60000,
        });

        const response = await routePost(
          createRequest({
            origin: [-5.1, 33.5],
            destination: [-5.0 + i * 0.001, 33.6],
            profile: 'car',
          })
        );

        expect(response.status).toBe(200);
      }

      // 31st request should be rate limited
      mockCheckLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
        retryAfter: 30,
      });

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(429);
    });
  });

  describe('Error handling', () => {
    it('should fall back to Haversine on GraphHopper timeout', async () => {
      mockOfficialUser();
      mockGetRoute.mockRejectedValueOnce({
        code: 'ROUTING_TIMEOUT',
        message: 'Request timed out',
      });

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      // Fallback returns a 2-point straight-line route
      expect(body.primary.coordinates).toEqual([[-5.1, 33.5], [-5.0, 33.6]]);
      expect(body.primary.distance_km).toBeGreaterThan(0);
      expect(body.primary.duration_min).toBeGreaterThan(0);
    });

    it('should handle route not found', async () => {
      mockOfficialUser();
      mockGetRoute.mockRejectedValueOnce({
        code: 'ROUTE_NOT_FOUND',
        message: 'No route found',
      });

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.error.code).toBe(6001); // ROUTE_NOT_FOUND
    });

    it('should fall back to Haversine on service unavailable', async () => {
      mockOfficialUser();
      mockGetRoute.mockRejectedValueOnce({
        code: 'SERVICE_UNAVAILABLE',
        message: 'GraphHopper unavailable',
      });

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      // Fallback returns a 2-point straight-line route
      expect(body.primary.coordinates).toEqual([[-5.1, 33.5], [-5.0, 33.6]]);
      expect(body.primary.distance_km).toBeGreaterThan(0);
      expect(body.primary.duration_min).toBeGreaterThan(0);
    });
  });

  describe('Authorization', () => {
    it('should allow OFFICIAL users', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
    });

    it('should reject CIVILIAN users', async () => {
      mockCivilianUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error.code).toBe(2001); // FORBIDDEN
    });

    it('should reject unauthenticated requests', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.error.code).toBe(2000); // UNAUTHENTICATED
    });
  });

  describe('Response format', () => {
    it('should return valid GeoJSON LineString', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.primary.coordinates).toBeInstanceOf(Array);
      expect(data.primary.coordinates.length).toBeGreaterThan(0);
      expect(data.primary.coordinates[0]).toBeInstanceOf(Array);
      expect(data.primary.coordinates[0]).toHaveLength(2);
    });

    it('should include route metadata', async () => {
      mockOfficialUser();

      const response = await routePost(
        createRequest({
          origin: [-5.1, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      );

      const data = await response.json();
      expect(data.metadata).toBeDefined();
      expect(data.metadata.provider).toBe('graphhopper');
      expect(data.metadata.cached).toBeDefined();
      expect(data.metadata.computed_at).toBeDefined();
    });
  });
});
