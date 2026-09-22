/**
 * Route Caching Layer - MVP Phase
 * Caches routing responses to reduce GraphHopper API load
 * Uses Redis with in-memory fallback
 */

import { logger } from '@/lib/observability/logger';
import { cacheJSON, getCachedJSON, deleteCached } from '@/lib/cache/redis';
import type { Coordinates, RouteResponse, RoutingProfile, IsochroneResponse } from './types';

// Cache TTL: 1 hour (routes don't change frequently)
const ROUTE_CACHE_TTL_SECONDS = 60 * 60;

// Stats tracking
let cacheHits = 0;
let cacheMisses = 0;
let cacheErrors = 0;

/**
 * Generate cache key from route parameters
 * Format: "route:{lon},{lat}:{lon},{lat}:{profile}"
 */
export function getRouteCacheKey(
  origin: Coordinates,
  destination: Coordinates,
  profile: RoutingProfile
): string {
  const originStr = `${origin[0].toFixed(4)},${origin[1].toFixed(4)}`;
  const destStr = `${destination[0].toFixed(4)},${destination[1].toFixed(4)}`;
  return `route:${originStr}:${destStr}:${profile}`;
}

/**
 * Get cached route response
 */
export async function getCachedRoute(
  origin: Coordinates,
  destination: Coordinates,
  profile: RoutingProfile
): Promise<RouteResponse | null> {
  const key = getRouteCacheKey(origin, destination, profile);

  try {
    const cached = await getCachedJSON<RouteResponse>(key);

    if (cached) {
      cacheHits++;

      // Calculate cache age
      const cachedAt = new Date(cached.metadata.computed_at).getTime();
      const ageSeconds = Math.floor((Date.now() - cachedAt) / 1000);

      logger.info({
        event: 'route_cache_hit',
        meta: {
          origin,
          destination,
          profile,
          ageSeconds,
          provider: cached.metadata.provider,
        },
      });

      // Update metadata to reflect cached status
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cached: true,
          cache_age_seconds: ageSeconds,
        },
      };
    }

    cacheMisses++;
    logger.info({
      event: 'route_cache_miss',
      meta: { origin, destination, profile },
    });

    return null;
  } catch (error) {
    cacheErrors++;
    logger.error({
      event: 'route_cache_get_error',
      meta: { origin, destination, profile },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    return null;
  }
}

/**
 * Store route response in cache
 */
export async function setCachedRoute(
  origin: Coordinates,
  destination: Coordinates,
  profile: RoutingProfile,
  response: RouteResponse
): Promise<void> {
  const key = getRouteCacheKey(origin, destination, profile);

  try {
    await cacheJSON(key, response, ROUTE_CACHE_TTL_SECONDS);

    logger.info({
      event: 'route_cached',
      meta: {
        origin,
        destination,
        profile,
        ttlSeconds: ROUTE_CACHE_TTL_SECONDS,
        provider: response.metadata.provider,
        distance_km: response.primary.distance_km,
        duration_min: response.primary.duration_min,
      },
    });
  } catch (error) {
    cacheErrors++;
    logger.error({
      event: 'route_cache_set_error',
      meta: { origin, destination, profile },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    // Don't throw - cache failure shouldn't break routing
  }
}

/**
 * Invalidate cached route
 */
export async function invalidateRoute(
  origin: Coordinates,
  destination: Coordinates,
  profile: RoutingProfile
): Promise<void> {
  const key = getRouteCacheKey(origin, destination, profile);

  try {
    await deleteCached(key);
    logger.info({
      event: 'route_cache_invalidated',
      meta: { origin, destination, profile },
    });
  } catch (error) {
    logger.error({
      event: 'route_cache_invalidate_error',
      meta: { origin, destination, profile },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Get cache statistics
 */
export function getRouteCacheStats(): {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  totalRequests: number;
} {
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

  return {
    hits: cacheHits,
    misses: cacheMisses,
    errors: cacheErrors,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimals
    totalRequests,
  };
}

/**
 * Reset cache statistics (useful for testing)
 */
export function resetRouteCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
  cacheErrors = 0;
  logger.info({ event: 'route_cache_stats_reset' });
}

/**
 * Get cached isochrone response
 */
export async function getCachedIsochrone(
  key: string
): Promise<IsochroneResponse | null> {
  try {
    const cached = await getCachedJSON<IsochroneResponse>(key);

    if (cached) {
      logger.info({
        event: 'isochrone_cache_hit',
        meta: { key },
      });
      return cached;
    }

    logger.info({
      event: 'isochrone_cache_miss',
      meta: { key },
    });
    return null;
  } catch (error) {
    logger.error({
      event: 'isochrone_cache_get_error',
      meta: { key },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    return null;
  }
}

/**
 * Store isochrone response in cache
 */
export async function setCachedIsochrone(
  key: string,
  value: IsochroneResponse,
  ttl: number
): Promise<void> {
  try {
    await cacheJSON(key, value, ttl);

    logger.info({
      event: 'isochrone_cached',
      meta: {
        key,
        ttlSeconds: ttl,
        featureCount: value.features.length,
      },
    });
  } catch (error) {
    logger.error({
      event: 'isochrone_cache_set_error',
      meta: { key },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    // Don't throw - cache failure shouldn't break isochrone generation
  }
}
