export const dynamic = 'force-dynamic';

/**
 * Dispatch Route API - MVP Phase
 * POST: Calculate route between origin and destination
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import { getCachedRoute, setCachedRoute } from '@/lib/routing/cache';
import { SlidingWindowRateLimiter } from '@/lib/ratelimit/slidingWindow';
import { haversineDistance } from '@/lib/dispatch/geospatial';
import type { Coordinates, RoutingProfile } from '@/lib/routing/types';

// Rate limiter: 30 requests per minute for OFFICIAL users
const routeRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
});

/**
 * POST /api/dispatch/route
 * Calculate route with caching and rate limiting
 * Body: { origin: [lon, lat], destination: [lon, lat], profile: 'fire_truck' | 'car' | 'foot', alternatives?: number }
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can use routing
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  // Rate limiting
  const rateLimitResult = await routeRateLimiter.checkLimit(user.userId);
  if (!rateLimitResult.allowed) {
    logger.warn({
      event: 'routing_rate_limited',
      meta: {
        userId: user.userId,
        retryAfter: rateLimitResult.retryAfter,
      },
    });
    throw new AppError(1002); // CLIENT_RATE_LIMITED
  }

  const body = await request.json();
  const { origin, destination, profile = 'fire_truck', alternatives = 0 } = body;

  // Validate request
  const fields = [];

  if (!origin || !Array.isArray(origin) || origin.length !== 2) {
    fields.push({
      field: 'origin',
      code: 'invalid',
      message: 'Origin must be [longitude, latitude]',
    });
  }

  if (!destination || !Array.isArray(destination) || destination.length !== 2) {
    fields.push({
      field: 'destination',
      code: 'invalid',
      message: 'Destination must be [longitude, latitude]',
    });
  }

  if (!['fire_truck', 'car', 'foot'].includes(profile)) {
    fields.push({
      field: 'profile',
      code: 'invalid',
      message: 'Profile must be fire_truck, car, or foot',
    });
  }

  if (alternatives !== undefined && (!Number.isInteger(alternatives) || alternatives < 0 || alternatives > 3)) {
    fields.push({
      field: 'alternatives',
      code: 'invalid',
      message: 'Alternatives must be an integer between 0 and 3',
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  const originCoords = origin as Coordinates;
  const destinationCoords = destination as Coordinates;
  const routingProfile = profile as RoutingProfile;

  // Check cache first
  const cached = await getCachedRoute(originCoords, destinationCoords, routingProfile);
  if (cached) {
    logger.info({
      event: 'route_served_from_cache',
      meta: {
        userId: user.userId,
        origin: originCoords,
        destination: destinationCoords,
        profile: routingProfile,
        cacheAgeSeconds: cached.metadata.cache_age_seconds,
      },
    });

    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Age', String(cached.metadata.cache_age_seconds || 0));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    return response;
  }

  // Cache miss - call GraphHopper
  const startTime = Date.now();
  let routeResponse;

  try {
    const graphhopper = new GraphHopperClient();
    routeResponse = await graphhopper.getRoute({
      origin: originCoords,
      destination: destinationCoords,
      profile: routingProfile,
      alternatives,
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; stack?: string; code?: string };
    logger.error({
      event: 'routing_error',
      meta: {
        userId: user.userId,
        origin: originCoords,
        destination: destinationCoords,
        profile: routingProfile,
      },
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    // Haversine straight-line fallback when routing service is unavailable
    if (err.code === 'SERVICE_UNAVAILABLE' || err.code === 'ROUTING_TIMEOUT') {
      const distanceM = haversineDistance(originCoords[1], originCoords[0], destinationCoords[1], destinationCoords[0]);
      const distanceKm = distanceM / 1000;
      const durationMin = (distanceKm / 40) * 60; // ~40 km/h avg fire truck speed

      routeResponse = {
        primary: {
          coordinates: [originCoords, destinationCoords],
          distance_km: Math.round(distanceKm * 100) / 100,
          duration_min: Math.round(durationMin * 100) / 100,
          instructions: [],
        },
        alternatives: [],
        metadata: {
          provider: 'graphhopper' as const,
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      logger.warn({
        event: 'route_fallback_haversine',
        meta: {
          userId: user.userId,
          origin: originCoords,
          destination: destinationCoords,
          distance_km: routeResponse.primary.distance_km,
          duration_min: routeResponse.primary.duration_min,
          reason: err.code,
        },
      });
    } else if (err.code === 'ROUTE_NOT_FOUND') {
      throw new AppError(6001); // DISPATCH_ROUTE_NOT_FOUND
    } else if (err.code === 'INVALID_COORDINATES') {
      throw new AppError(6002); // DISPATCH_INVALID_COORDINATES
    } else {
      throw new AppError(6006); // DISPATCH_ROUTING_SERVICE_UNAVAILABLE (generic)
    }
  }

  const duration = Date.now() - startTime;

  // Cache the response
  await setCachedRoute(originCoords, destinationCoords, routingProfile, routeResponse);

  logger.info({
    event: 'route_calculated',
    meta: {
      userId: user.userId,
      origin: originCoords,
      destination: destinationCoords,
      profile: routingProfile,
      distance_km: routeResponse.primary.distance_km,
      duration_min: routeResponse.primary.duration_min,
      durationMs: duration,
      provider: routeResponse.metadata.provider,
    },
  });

  const response = NextResponse.json(routeResponse);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800'); // 1hr cache

  return response;
});
