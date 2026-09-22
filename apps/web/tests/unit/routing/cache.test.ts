import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getCachedRoute,
  setCachedRoute,
  invalidateRoute,
  getRouteCacheKey,
  getRouteCacheStats,
  resetRouteCacheStats,
} from '@/lib/routing/cache';
import type { Coordinates, RouteResponse } from '@/lib/routing/types';

// Use a fresh in-process store per test to ensure isolation
let mockStore = new Map<string, string>();

vi.mock('@/lib/cache/redis', () => ({
  cacheJSON: vi.fn(async (key: string, value: unknown) => {
    mockStore.set(key, JSON.stringify(value));
  }),
  getCachedJSON: vi.fn(async (key: string) => {
    const v = mockStore.get(key);
    return v ? JSON.parse(v) : null;
  }),
  deleteCached: vi.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Route Cache', () => {
  beforeEach(() => {
    mockStore.clear();
    resetRouteCacheStats();
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys', () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const key1 = getRouteCacheKey(origin, destination, 'fire_truck');
      const key2 = getRouteCacheKey(origin, destination, 'fire_truck');

      expect(key1).toBe(key2);
      expect(key1).toContain('route:');
      expect(key1).toContain('fire_truck');
    });

    it('should generate different keys for different origins', () => {
      const origin1: Coordinates = [-5.1056, 33.5275];
      const origin2: Coordinates = [-5.1000, 33.5300];
      const destination: Coordinates = [-5.0800, 33.5500];

      const key1 = getRouteCacheKey(origin1, destination, 'car');
      const key2 = getRouteCacheKey(origin2, destination, 'car');

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different profiles', () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const key1 = getRouteCacheKey(origin, destination, 'fire_truck');
      const key2 = getRouteCacheKey(origin, destination, 'car');

      expect(key1).not.toBe(key2);
    });

    it('should round coordinates to 4 decimals', () => {
      // Both origins are within the same 4-decimal tile: -5.1056, 33.5275
      const origin1: Coordinates = [-5.10561234, 33.52751234];
      const origin2: Coordinates = [-5.10564999, 33.52754999];
      const destination: Coordinates = [-5.0800, 33.5500];

      const key1 = getRouteCacheKey(origin1, destination, 'car');
      const key2 = getRouteCacheKey(origin2, destination, 'car');

      // Should be the same after rounding to 4 decimals
      expect(key1).toBe(key2);
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve cached routes', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      await setCachedRoute(origin, destination, 'fire_truck', mockRoute);
      const cached = await getCachedRoute(origin, destination, 'fire_truck');

      expect(cached).not.toBeNull();
      expect(cached?.primary.distance_km).toBe(12.5);
      expect(cached?.metadata.cached).toBe(true);
      expect(cached?.metadata.cache_age_seconds).toBeGreaterThanOrEqual(0);
    });

    it('should return null for cache miss', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const cached = await getCachedRoute(origin, destination, 'car');

      expect(cached).toBeNull();
    });

    it('should handle different routes for different parameters', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const dest1: Coordinates = [-5.0800, 33.5500];
      const dest2: Coordinates = [-5.0700, 33.5600];

      const mockRoute1: RouteResponse = {
        primary: {
          coordinates: [origin, dest1],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      const mockRoute2: RouteResponse = {
        primary: {
          coordinates: [origin, dest2],
          distance_km: 15.0,
          duration_min: 22,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      await setCachedRoute(origin, dest1, 'fire_truck', mockRoute1);
      await setCachedRoute(origin, dest2, 'fire_truck', mockRoute2);

      const cached1 = await getCachedRoute(origin, dest1, 'fire_truck');
      const cached2 = await getCachedRoute(origin, dest2, 'fire_truck');

      expect(cached1?.primary.distance_km).toBe(12.5);
      expect(cached2?.primary.distance_km).toBe(15.0);
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      await setCachedRoute(origin, destination, 'car', mockRoute);
      await getCachedRoute(origin, destination, 'car');
      await getCachedRoute(origin, destination, 'car');

      const stats = getRouteCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });

    it('should track cache misses', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      await getCachedRoute(origin, destination, 'car');
      await getCachedRoute(origin, destination, 'fire_truck');

      const stats = getRouteCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate hit rate correctly', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      // 1 miss
      await getCachedRoute(origin, destination, 'car');
      // Set cache
      await setCachedRoute(origin, destination, 'car', mockRoute);
      // 3 hits
      await getCachedRoute(origin, destination, 'car');
      await getCachedRoute(origin, destination, 'car');
      await getCachedRoute(origin, destination, 'car');

      const stats = getRouteCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(4);
      expect(stats.hitRate).toBe(0.75); // 3/4
    });

    it('should reset statistics', () => {
      resetRouteCacheStats();
      const stats = getRouteCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('cache metadata', () => {
    it('should add cache metadata to cached responses', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      await setCachedRoute(origin, destination, 'car', mockRoute);

      // Wait a tick to ensure the cache retrieval path is exercised
      await new Promise((resolve) => setTimeout(resolve, 1));

      const cached = await getCachedRoute(origin, destination, 'car');

      expect(cached?.metadata.cached).toBe(true);
      expect(cached?.metadata.cache_age_seconds).toBeGreaterThanOrEqual(0);
      expect(cached?.metadata.provider).toBe('graphhopper');
    });
  });

  describe('cache invalidation', () => {
    it('should remove a cached route after invalidation', async () => {
      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 12.5,
          duration_min: 18,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      // Populate cache, verify it exists
      await setCachedRoute(origin, destination, 'fire_truck', mockRoute);
      const before = await getCachedRoute(origin, destination, 'fire_truck');
      expect(before).not.toBeNull();

      // Invalidate and verify it is gone
      await invalidateRoute(origin, destination, 'fire_truck');
      const after = await getCachedRoute(origin, destination, 'fire_truck');
      expect(after).toBeNull();
    });

    it('should not throw when invalidating a non-existent key', async () => {
      const origin: Coordinates = [-5.9999, 33.9999];
      const destination: Coordinates = [-5.0001, 33.0001];

      // Should complete without throwing
      await expect(
        invalidateRoute(origin, destination, 'car')
      ).resolves.toBeUndefined();
    });
  });

  describe('graceful error degradation', () => {
    it('should return null on getCachedRoute when Redis throws', async () => {
      const { getCachedJSON } = await import('@/lib/cache/redis');
      const mockedGetCachedJSON = vi.mocked(getCachedJSON);

      // Force the underlying cache to throw
      mockedGetCachedJSON.mockRejectedValueOnce(new Error('Redis connection lost'));

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const result = await getCachedRoute(origin, destination, 'fire_truck');

      // Must degrade gracefully: return null, not throw
      expect(result).toBeNull();

      // The error counter should have incremented
      const stats = getRouteCacheStats();
      expect(stats.errors).toBe(1);
    });

    it('should not throw on setCachedRoute when Redis throws', async () => {
      const { cacheJSON } = await import('@/lib/cache/redis');
      const mockedCacheJSON = vi.mocked(cacheJSON);

      mockedCacheJSON.mockRejectedValueOnce(new Error('Redis write failure'));

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const mockRoute: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: 10,
          duration_min: 14,
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper',
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      // Must not throw; cache failure should be swallowed
      await expect(
        setCachedRoute(origin, destination, 'fire_truck', mockRoute)
      ).resolves.toBeUndefined();

      // The error counter should have incremented
      const stats = getRouteCacheStats();
      expect(stats.errors).toBe(1);
    });
  });
});
