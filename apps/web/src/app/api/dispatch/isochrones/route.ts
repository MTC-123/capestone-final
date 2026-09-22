export const dynamic = 'force-dynamic';

/**
 * Dispatch Isochrones API - Production Phase
 * POST: Calculate reachability polygons from origin point
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import { getCachedIsochrone, setCachedIsochrone } from '@/lib/routing/cache';
import type { Coordinates, RoutingProfile } from '@/lib/routing/types';

/**
 * POST /api/dispatch/isochrones
 * Calculate isochrones with caching
 * Body: { origin: [lon, lat], profile: 'fire_truck' | 'car' | 'foot', times?: [5, 10, 15, 30] }
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can use isochrones
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const body = await request.json();
  const { origin, profile = 'fire_truck', times = [5, 10, 15, 30] } = body;

  // Validate request
  const fields = [];

  if (!origin || !Array.isArray(origin) || origin.length !== 2) {
    fields.push({
      field: 'origin',
      code: 'invalid',
      message: 'Origin must be [longitude, latitude]',
    });
  }

  if (!['fire_truck', 'car', 'foot'].includes(profile)) {
    fields.push({
      field: 'profile',
      code: 'invalid',
      message: 'Profile must be fire_truck, car, or foot',
    });
  }

  if (!Array.isArray(times) || times.length === 0 || !times.every((t) => Number.isInteger(t) && t > 0)) {
    fields.push({
      field: 'times',
      code: 'invalid',
      message: 'Times must be an array of positive integers',
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  const originCoords = origin as Coordinates;
  const routingProfile = profile as RoutingProfile;

  // Generate cache key
  const cacheKey = `isochrone:${originCoords.join(',')}:${routingProfile}:${times.join('-')}`;

  // Check cache first
  const cached = await getCachedIsochrone(cacheKey);
  if (cached) {
    logger.info({
      event: 'isochrone_served_from_cache',
      meta: {
        userId: user.userId,
        origin: originCoords,
        profile: routingProfile,
        times,
      },
    });

    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=3600');
    return response;
  }

  // Cache miss - call GraphHopper
  const startTime = Date.now();
  let isochroneResponse;

  try {
    const graphhopper = new GraphHopperClient();
    isochroneResponse = await graphhopper.getIsochrone({
      origin: originCoords,
      profile: routingProfile,
      times,
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; stack?: string; code?: string };
    logger.error({
      event: 'isochrone_error',
      meta: {
        userId: user.userId,
        origin: originCoords,
        profile: routingProfile,
        times,
      },
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    // Map routing errors to AppError codes
    if (err.code === 'ROUTING_TIMEOUT') {
      throw new AppError(6000); // DISPATCH_ROUTING_TIMEOUT
    } else if (err.code === 'INVALID_COORDINATES') {
      throw new AppError(6002); // DISPATCH_INVALID_COORDINATES
    } else if (err.code === 'SERVICE_UNAVAILABLE') {
      throw new AppError(6006); // DISPATCH_ROUTING_SERVICE_UNAVAILABLE
    } else {
      throw new AppError(6006); // DISPATCH_ROUTING_SERVICE_UNAVAILABLE (generic)
    }
  }

  const duration = Date.now() - startTime;

  // Cache the response for 1 hour
  await setCachedIsochrone(cacheKey, isochroneResponse, 3600);

  logger.info({
    event: 'isochrone_generated',
    meta: {
      userId: user.userId,
      origin: originCoords,
      profile: routingProfile,
      times,
      featureCount: isochroneResponse.features.length,
      durationMs: duration,
    },
  });

  const response = NextResponse.json(isochroneResponse);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'public, s-maxage=3600');

  return response;
});
