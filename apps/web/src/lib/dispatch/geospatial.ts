/**
 * Geospatial Queries for Dispatch System
 * Implements nearest teams lookup using MongoDB $geoNear with Haversine fallback
 */

import { logger } from '@/lib/observability/logger';

// Prisma client - will be imported from actual location
interface Team {
  id: string;
  name: string;
  type: string;
  status: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  capacity: number;
  equipment: string[];
  distance?: number; // Added by query
}

interface GetNearestTeamsOptions {
  location: [number, number]; // [lon, lat]
  maxDistance: number; // meters
  limit?: number;
  status?: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'UNAVAILABLE';
}

/**
 * Get nearest teams using MongoDB $geoNear aggregation
 * Falls back to Haversine calculation if $geoNear fails (e.g., missing index)
 */
export async function getNearestTeams(
  options: GetNearestTeamsOptions
): Promise<Team[]> {
  const { location, maxDistance, limit = 10, status = 'AVAILABLE' } = options;
  const [lon, lat] = location;

  // Import Prisma client dynamically to avoid circular dependencies
  const { prisma } = await import('@/lib/database/client');

  try {
    // Try MongoDB $geoNear (requires 2dsphere index)
    // NOTE: MongoDB will auto-create 2dsphere index on first use if not exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MongoDB raw command returns untyped result
    const result: any = await prisma.$runCommandRaw({
      aggregate: 'teams',
      pipeline: [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [lon, lat],
            },
            distanceField: 'distance',
            maxDistance,
            spherical: true,
            query: { status },
          },
        },
        { $limit: limit },
      ],
      cursor: {},
    });

    const teams = result.cursor.firstBatch as Team[];

    logger.info({
      event: 'nearest_teams_query_geonear',
      meta: {
        location,
        maxDistance,
        status,
        count: teams.length,
      },
    });

    return teams;
  } catch (error) {
    logger.warn({
      event: 'geonear_failed_using_haversine',
      meta: { location, maxDistance, status },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Fallback to Haversine
    return getNearestTeamsHaversine(options);
  }
}

/**
 * Haversine fallback for nearest teams
 * Used when $geoNear fails (e.g., missing 2dsphere index)
 */
async function getNearestTeamsHaversine(
  options: GetNearestTeamsOptions
): Promise<Team[]> {
  const { location, maxDistance, limit = 10, status = 'AVAILABLE' } = options;
  const [lon, lat] = location;

  // Import Prisma client
  const { prisma } = await import('@/lib/database/client');

  // Fetch all teams with matching status
  const allTeams = await prisma.team.findMany({
    where: { status },
  });

  // Calculate distance using Haversine formula
  const teamsWithDistance = allTeams
    .map((team) => {
      // Ensure location exists and is valid
      if (!team.location || typeof team.location !== 'object') {
        return null;
      }

      const teamLoc = team.location as unknown as { type: 'Point'; coordinates: [number, number] };
      if (
        !teamLoc.coordinates ||
        !Array.isArray(teamLoc.coordinates) ||
        teamLoc.coordinates.length !== 2
      ) {
        return null;
      }

      const [teamLon, teamLat] = teamLoc.coordinates;
      const distance = haversineDistance(lat, lon, teamLat, teamLon);

      return {
        ...team,
        location: teamLoc,
        distance,
      } as Team;
    })
    .filter((team): team is Team => team !== null && team.distance! <= maxDistance)
    .sort((a, b) => a.distance! - b.distance!)
    .slice(0, limit);

  logger.info({
    event: 'nearest_teams_query_haversine',
    meta: {
      location,
      maxDistance,
      status,
      count: teamsWithDistance.length,
    },
  });

  return teamsWithDistance;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Create 2dsphere index on Team.location
 * Should be run once during deployment or migration
 */
export async function ensureGeoIndex(): Promise<void> {
  try {
    const { prisma } = await import('@/lib/database/client');

    await prisma.$runCommandRaw({
      createIndexes: 'teams',
      indexes: [
        {
          key: { location: '2dsphere' },
          name: 'location_2dsphere',
        },
      ],
    });

    logger.info({
      event: 'geo_index_created',
      meta: { collection: 'teams', index: 'location_2dsphere' },
    });
  } catch (error) {
    // Index may already exist
    logger.warn({
      event: 'geo_index_creation_failed',
      meta: { collection: 'teams' },
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
