/**
 * Dispatch Assignment Logic - MVP Phase
 * Handles team assignment to incidents with routing
 */

import { prisma } from '@/lib/prisma';
import { claimTeams, releaseTeams } from '@/lib/dispatch/claims';
import { logger } from '@/lib/observability/logger';
import { routing } from '@/lib/routing';
import { getCachedRoute, setCachedRoute } from '@/lib/routing/cache';
import { haversineDistance } from '@/lib/dispatch/geospatial';
import type { Team } from '@prisma/client';
import type { Coordinates, RouteResponse } from '@/lib/routing/types';

export interface AssignmentResult {
  dispatchId: string;
  teamId: string;
  teamName: string;
  incidentId: string;
  route: RouteResponse;
  eta: string; // ISO 8601 timestamp
  distance_km: number;
  duration_min: number;
}

/**
 * Calculate route for a team to incident location
 */
async function calculateRoute(
  teamLocation: { coordinates: Coordinates },
  incidentLocation: { coordinates: Coordinates },
  teamId: string
): Promise<RouteResponse> {
  // Extract coordinates from GeoJSON Points
  const origin = teamLocation.coordinates as Coordinates;
  const destination = incidentLocation.coordinates as Coordinates;

  // Check cache first
  const cached = await getCachedRoute(origin, destination, 'fire_truck');
  if (cached) {
    logger.info({
      event: 'dispatch_route_cache_hit',
      meta: { teamId, origin, destination },
    });
    return cached;
  }

  // Road route from the routing providers; straight-line estimate if none answers
  try {
    const route = await routing.getRoute({
      origin,
      destination,
      profile: 'fire_truck',
      alternatives: 0, // MVP: no alternatives in assignment flow
    });

    // Cache for future requests
    await setCachedRoute(origin, destination, 'fire_truck', route);
    return route;
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === 'SERVICE_UNAVAILABLE' || err.code === 'ROUTING_TIMEOUT') {
      const distanceM = haversineDistance(origin[1], origin[0], destination[1], destination[0]);
      const distanceKm = distanceM / 1000;
      const durationMin = (distanceKm / 40) * 60; // ~40 km/h avg fire truck speed

      logger.warn({
        event: 'assignment_route_fallback_haversine',
        meta: { teamId, origin, destination, distance_km: Math.round(distanceKm * 100) / 100, reason: err.code },
      });

      const fallback: RouteResponse = {
        primary: {
          coordinates: [origin, destination],
          distance_km: Math.round(distanceKm * 100) / 100,
          duration_min: Math.round(durationMin * 100) / 100,
          instructions: [],
        },
        alternatives: [],
        metadata: {
          provider: 'estimate' as const,
          cached: false,
          computed_at: new Date().toISOString(),
        },
      };

      await setCachedRoute(origin, destination, 'fire_truck', fallback);
      return fallback;
    }

    throw error;
  }
}

/**
 * Calculate ETA based on current time and route duration
 */
function calculateETA(durationMinutes: number): Date {
  const now = new Date();
  const etaMs = now.getTime() + durationMinutes * 60 * 1000;
  return new Date(etaMs);
}

/**
 * Route a team to an incident and record the dispatch. The team must
 * already be claimed (EN_ROUTE to this incident) via claimTeams; use
 * assignTeamsToIncident unless the claim is handled by the caller.
 */
export async function assignTeamToIncident(
  team: Team,
  incident: { id: string; location: unknown },
  assignedByUserId: string
): Promise<AssignmentResult> {
  // Calculate route
  const route = await calculateRoute(
    team.location as { coordinates: Coordinates },
    incident.location as { coordinates: Coordinates },
    team.id
  );
  const durationMin = route.primary.duration_min;
  const distanceKm = route.primary.distance_km;
  const eta = calculateETA(durationMin);

  // Create dispatch record
  const dispatch = await prisma.dispatch.create({
    data: {
      teamId: team.id,
      incidentId: incident.id,
      status: 'ASSIGNED',
      route: route.primary.coordinates, // Store GeoJSON LineString
      distance: distanceKm,
      duration: durationMin,
      eta,
      assignedBy: assignedByUserId,
      assignedAt: new Date(),
    },
  });

  logger.info({
    event: 'team_assigned',
    meta: {
      dispatchId: dispatch.id,
      teamId: team.id,
      teamName: team.name,
      incidentId: incident.id,
      distance_km: distanceKm,
      duration_min: durationMin,
      eta: eta.toISOString(),
      assignedBy: assignedByUserId,
    },
  });

  return {
    dispatchId: dispatch.id,
    teamId: team.id,
    teamName: team.name,
    incidentId: incident.id,
    route,
    eta: eta.toISOString(),
    distance_km: distanceKm,
    duration_min: durationMin,
  };
}

/**
 * Assign multiple teams to an incident
 */
export async function assignTeamsToIncident(
  teams: Team[],
  incident: { id: string; location: unknown },
  assignedByUserId: string
): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];
  const ids = teams.map((item) => item.id);

  // Claim every team atomically before any routing work, so a concurrent
  // request for the same team fails fast and nothing is double-booked.
  await claimTeams(ids, incident.id);

  try {
    for (const team of teams) {
      results.push(await assignTeamToIncident(team, incident, assignedByUserId));
    }
  } catch (error) {
    await prisma.dispatch.deleteMany({ where: { id: { in: results.map((r) => r.dispatchId) } } });
    await releaseTeams(ids, incident.id);
    throw error;
  }

  logger.info({
    event: 'multiple_teams_assigned',
    meta: {
      incidentId: incident.id,
      teamCount: teams.length,
      teamIds: teams.map((t) => t.id),
      assignedBy: assignedByUserId,
    },
  });

  return results;
}
