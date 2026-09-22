export const dynamic = 'force-dynamic';

/**
 * Dispatch Assignment API
 * POST: Assign team(s) and/or vehicle(s) to incident with route calculation
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';
import {
  validateIncidentExists,
  validateTeamsExistAndAvailable,
  validateNoDuplicateAssignment,
  validateMaxTeams,
} from '@/lib/dispatch/validation';
import {
  validateVehiclesExistAndAvailable,
  validateNoDuplicateVehicleAssignment,
} from '@/lib/dispatch/vehicleValidation';
import { assignTeamsToIncident } from '@/lib/dispatch/assignment';
import { assignVehiclesToIncident } from '@/lib/dispatch/vehicleAssignment';

/**
 * POST /api/dispatch/assign
 * Assign teams and/or vehicles to incident
 * Body: { incidentId: string, teamIds?: string[], vehicleIds?: string[] }
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can assign
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const body = await request.json();
  const { incidentId, teamIds, vehicleIds } = body;

  // Validate request
  const fields = [];

  if (!incidentId || typeof incidentId !== 'string') {
    fields.push({
      field: 'incidentId',
      code: 'required',
      message: 'Incident ID is required',
    });
  }

  const hasTeams = Array.isArray(teamIds) && teamIds.length > 0;
  const hasVehicles = Array.isArray(vehicleIds) && vehicleIds.length > 0;

  if (!hasTeams && !hasVehicles) {
    fields.push({
      field: 'teamIds/vehicleIds',
      code: 'required',
      message: 'At least one team ID or vehicle ID is required',
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  // Validate incident exists
  const incident = await validateIncidentExists(incidentId);

  // Validate and assign teams
  let teamAssignments: Awaited<ReturnType<typeof assignTeamsToIncident>> = [];
  if (hasTeams) {
    validateMaxTeams(teamIds.length);
    const teams = await validateTeamsExistAndAvailable(teamIds);
    for (const teamId of teamIds) {
      await validateNoDuplicateAssignment(teamId, incidentId);
    }
    teamAssignments = await assignTeamsToIncident(teams, incident, user.userId);
  }

  // Validate and assign vehicles
  let vehicleAssignments: Awaited<ReturnType<typeof assignVehiclesToIncident>> = [];
  if (hasVehicles) {
    const vehicles = await validateVehiclesExistAndAvailable(vehicleIds);
    for (const vehicleId of vehicleIds) {
      await validateNoDuplicateVehicleAssignment(vehicleId, incidentId);
    }
    try {
      vehicleAssignments = await assignVehiclesToIncident(vehicles, incident, user.userId);
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string; stack?: string; code?: string };
      logger.error({
        event: 'vehicle_dispatch_assignment_failed',
        meta: { userId: user.userId, incidentId, vehicleIds, errorCode: err.code },
        error: { name: err.name, message: err.message, stack: err.stack },
      });

      if (err.code === 'ROUTING_TIMEOUT') throw new AppError(6000);
      else if (err.code === 'ROUTE_NOT_FOUND') throw new AppError(6001);
      else if (err.code === 'SERVICE_UNAVAILABLE') throw new AppError(6006);
      if (error instanceof AppError) throw error;
      throw new AppError(5000, { message: 'Failed to assign vehicles', meta: { originalError: err.message } });
    }
  }

  logger.info({
    event: 'dispatch_assignment_completed',
    meta: {
      userId: user.userId,
      incidentId,
      teamCount: teamAssignments.length,
      vehicleCount: vehicleAssignments.length,
    },
  });

  return NextResponse.json(
    {
      incidentId,
      assignedTeams: teamAssignments.map((a) => ({
        dispatchId: a.dispatchId,
        teamId: a.teamId,
        teamName: a.teamName,
        eta: a.eta,
        distance_km: a.distance_km,
        duration_min: a.duration_min,
        route: { type: 'LineString', coordinates: a.route.primary.coordinates },
      })),
      assignedVehicles: vehicleAssignments.map((a) => ({
        dispatchId: a.dispatchId,
        vehicleId: a.vehicleId,
        callSign: a.callSign,
        eta: a.eta,
        distance_km: a.distance_km,
        duration_min: a.duration_min,
        route: { type: 'LineString', coordinates: a.route.primary.coordinates },
      })),
      totalTeams: teamAssignments.length,
      totalVehicles: vehicleAssignments.length,
      assignedBy: user.userId,
      assignedAt: new Date().toISOString(),
    },
    { status: 201 }
  );
});
