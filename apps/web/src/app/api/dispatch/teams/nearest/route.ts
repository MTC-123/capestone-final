export const dynamic = 'force-dynamic';

/**
 * Nearest Teams API - Geospatial Query
 * POST: Find nearest available teams to a location
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';
import { getNearestTeams } from '@/lib/dispatch/geospatial';
import type { Coordinates } from '@/lib/routing/types';

type TeamStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'UNAVAILABLE';

/**
 * POST /api/dispatch/teams/nearest
 * Find nearest teams to a location using MongoDB $geoNear (with Haversine fallback)
 * Body: { location: [lon, lat], maxDistance?: number, limit?: number, status?: TeamStatus }
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can use team queries
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const body = await request.json();
  const {
    location,
    maxDistance = 50000, // Default: 50km
    limit = 10,
    status = 'AVAILABLE',
  } = body;

  // Validate request
  const fields = [];

  if (!location || !Array.isArray(location) || location.length !== 2) {
    fields.push({
      field: 'location',
      code: 'invalid',
      message: 'Location must be [longitude, latitude]',
    });
  }

  if (typeof maxDistance !== 'number' || maxDistance <= 0) {
    fields.push({
      field: 'maxDistance',
      code: 'invalid',
      message: 'maxDistance must be a positive number (meters)',
    });
  }

  if (typeof limit !== 'number' || limit <= 0 || limit > 100) {
    fields.push({
      field: 'limit',
      code: 'invalid',
      message: 'limit must be between 1 and 100',
    });
  }

  const validStatuses: TeamStatus[] = ['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'UNAVAILABLE'];
  if (!validStatuses.includes(status)) {
    fields.push({
      field: 'status',
      code: 'invalid',
      message: `status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  const locationCoords = location as Coordinates;

  // Query nearest teams
  const startTime = Date.now();
  let teams;

  try {
    teams = await getNearestTeams({
      location: locationCoords,
      maxDistance,
      limit,
      status,
    });
  } catch (error: unknown) {
    logger.error({
      event: 'nearest_teams_error',
      meta: {
        userId: user.userId,
        location: locationCoords,
        maxDistance,
        limit,
        status,
      },
      error: {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    throw new AppError(6006); // DISPATCH_ROUTING_SERVICE_UNAVAILABLE
  }

  const duration = Date.now() - startTime;

  logger.info({
    event: 'nearest_teams_found',
    meta: {
      userId: user.userId,
      location: locationCoords,
      maxDistance,
      limit,
      status,
      teamsFound: teams.length,
      durationMs: duration,
    },
  });

  // Transform to GeoJSON FeatureCollection
  const geoJson = {
    type: 'FeatureCollection',
    features: teams.map((team) => ({
      type: 'Feature',
      geometry: team.location,
      properties: {
        id: team.id,
        name: team.name,
        type: team.type,
        status: team.status,
        capacity: team.capacity,
        equipment: team.equipment,
        distance: Math.round(team.distance || 0), // Distance in meters
      },
    })),
  };

  const response = NextResponse.json(geoJson);
  response.headers.set('Cache-Control', 'private, no-cache'); // Don't cache team locations

  return response;
});
