/**
 * Vehicle Dispatch Assignment Logic
 * Handles vehicle assignment to incidents with routing
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import { getCachedRoute, setCachedRoute } from '@/lib/routing/cache';
import { haversineDistance } from '@/lib/dispatch/geospatial';
import type { Vehicle } from '@prisma/client';
import type { Coordinates, RouteResponse } from '@/lib/routing/types';

export interface VehicleAssignmentResult {
  dispatchId: string;
  vehicleId: string;
  callSign: string;
  incidentId: string;
  route: RouteResponse;
  eta: string; // ISO 8601 timestamp
  distance_km: number;
  duration_min: number;
}

/**
 * Calculate route for a vehicle to incident location
 */
async function calculateRoute(
  vehicleLocation: { coordinates: Coordinates },
  incidentLocation: { coordinates: Coordinates },
  vehicleId: string
): Promise<RouteResponse> {
  const origin = vehicleLocation.coordinates as Coordinates;
  const destination = incidentLocation.coordinates as Coordinates;

  // Check cache first
  const cached = await getCachedRoute(origin, destination, 'fire_truck');
  if (cached) {
    logger.info({
      event: 'vehicle_dispatch_route_cache_hit',
      meta: { vehicleId, origin, destination },
    });
    return cached;
  }

  // Calculate route using GraphHopper, fall back to Haversine if unavailable
  try {
    const graphhopper = new GraphHopperClient();
    const route = await graphhopper.getRoute({
      origin,
      destination,
      profile: 'fire_truck',
      alternatives: 0,
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
        event: 'vehicle_dispatch_route_fallback_haversine',
        meta: { vehicleId, origin, destination, distance_km: Math.round(distanceKm * 100) / 100, reason: err.code },
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
          provider: 'graphhopper' as const,
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
 * Assign a single vehicle to an incident
 */
export async function assignVehicleToIncident(
  vehicle: Vehicle,
  incident: { id: string; location: unknown },
  assignedByUserId: string
): Promise<VehicleAssignmentResult> {
  // Use vehicle.location if available, fall back to baseLocation
  const vehicleLocation = vehicle.location ?? vehicle.baseLocation;

  // Calculate route
  const route = await calculateRoute(
    vehicleLocation as { coordinates: Coordinates },
    incident.location as { coordinates: Coordinates },
    vehicle.id
  );
  const durationMin = route.primary.duration_min;
  const distanceKm = route.primary.distance_km;
  const eta = calculateETA(durationMin);

  // Create dispatch record with vehicleId (no teamId)
  const dispatch = await prisma.dispatch.create({
    data: {
      vehicleId: vehicle.id,
      incidentId: incident.id,
      status: 'ASSIGNED',
      route: route.primary.coordinates,
      distance: distanceKm,
      duration: durationMin,
      eta,
      assignedBy: assignedByUserId,
      assignedAt: new Date(),
    },
  });

  // Update vehicle status to EN_ROUTE
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      status: 'EN_ROUTE',
      assignedTo: incident.id,
    },
  });

  logger.info({
    event: 'vehicle_assigned',
    meta: {
      dispatchId: dispatch.id,
      vehicleId: vehicle.id,
      callSign: vehicle.callSign,
      incidentId: incident.id,
      distance_km: distanceKm,
      duration_min: durationMin,
      eta: eta.toISOString(),
      assignedBy: assignedByUserId,
    },
  });

  return {
    dispatchId: dispatch.id,
    vehicleId: vehicle.id,
    callSign: vehicle.callSign,
    incidentId: incident.id,
    route,
    eta: eta.toISOString(),
    distance_km: distanceKm,
    duration_min: durationMin,
  };
}

/**
 * Assign multiple vehicles to an incident
 */
export async function assignVehiclesToIncident(
  vehicles: Vehicle[],
  incident: { id: string; location: unknown },
  assignedByUserId: string
): Promise<VehicleAssignmentResult[]> {
  const results: VehicleAssignmentResult[] = [];

  // Process vehicles sequentially to avoid race conditions
  for (const vehicle of vehicles) {
    const result = await assignVehicleToIncident(vehicle, incident, assignedByUserId);
    results.push(result);
  }

  logger.info({
    event: 'multiple_vehicles_assigned',
    meta: {
      incidentId: incident.id,
      vehicleCount: vehicles.length,
      vehicleIds: vehicles.map((v) => v.id),
      assignedBy: assignedByUserId,
    },
  });

  return results;
}
