export const dynamic = 'force-dynamic';

/**
 * Dispatch Assignment API
 * POST: Assign team(s) and/or vehicle(s) to incident with route calculation
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOfficial } from '@/lib/security/guards';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { audit } from '@/lib/audit/log';
import { notifyEvent } from '@/lib/notifications/events';
import { releaseTeams } from '@/lib/dispatch/claims';
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
  const user = await requireOfficial(request);
  await enforceRateLimit('mutation', request, user.userId);

  let body: { incidentId?: unknown; teamIds?: unknown; vehicleIds?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }
  const { incidentId } = body as { incidentId: string };
  const teamIds = Array.isArray(body.teamIds) ? [...new Set(body.teamIds.filter((v): v is string => typeof v === 'string'))] : [];
  const vehicleIds = Array.isArray(body.vehicleIds) ? [...new Set(body.vehicleIds.filter((v): v is string => typeof v === 'string'))] : [];

  // Validate request
  const fields = [];

  if (!incidentId || typeof incidentId !== 'string') {
    fields.push({
      field: 'incidentId',
      code: 'required',
      message: 'Incident ID is required',
    });
  }

  const hasTeams = teamIds.length > 0;
  const hasVehicles = vehicleIds.length > 0;

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

  // Validate, then claim-and-assign teams
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
      // All-or-nothing across teams and vehicles for one request.
      if (teamAssignments.length) {
        await prisma.dispatch.deleteMany({ where: { id: { in: teamAssignments.map((a) => a.dispatchId) } } });
        await releaseTeams(teamAssignments.map((a) => a.teamId), incidentId);
      }
      if (error instanceof AppError && (error.code === 7001 || error.code === 6003)) {
        await audit({ action: 'dispatch.assign_conflict', actor: user, targetType: 'incident', targetId: incidentId, outcome: 'DENIED', meta: error.meta, request });
      }
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

  await audit({
    action: 'dispatch.assign',
    actor: user,
    targetType: 'incident',
    targetId: incidentId,
    meta: {
      teams: teamAssignments.map((a) => a.teamId),
      vehicles: vehicleAssignments.map((a) => a.vehicleId),
      dispatchIds: [...teamAssignments, ...vehicleAssignments].map((a) => a.dispatchId),
    },
    request,
  });
  const units = [...teamAssignments.map((a) => a.teamName), ...vehicleAssignments.map((a) => a.callSign)];
  const firstDispatch = teamAssignments[0]?.dispatchId ?? vehicleAssignments[0]?.dispatchId;
  if (firstDispatch) {
    const etas = [...teamAssignments, ...vehicleAssignments].map((a) => a.duration_min);
    void notifyEvent({
      type: 'dispatch.assigned',
      dispatchId: firstDispatch,
      incidentId,
      unitLabel: units.join(', '),
      etaMinutes: etas.length ? Math.round(Math.min(...etas)) : null,
    }).catch(() => undefined);
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
