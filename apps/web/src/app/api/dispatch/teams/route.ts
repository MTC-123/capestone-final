export const dynamic = 'force-dynamic';

/**
 * Dispatch Teams API - MVP Phase
 * GET: List/filter teams
 * POST: Create new team (OFFICIAL only)
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { validatePoint } from '@/lib/validation/geojson';
import { logger } from '@/lib/observability/logger';
import { withRetry } from '@/lib/database/withRetry';
import type { TeamStatus, TeamType } from '@prisma/client';

/**
 * GET /api/dispatch/teams
 * List teams with optional filtering
 * Query params: status, type
 */
export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Teams are OFFICIAL only
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') as TeamStatus | null;
  const typeFilter = url.searchParams.get('type') as TeamType | null;

  // Build Prisma where clause
  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (typeFilter) where.type = typeFilter;

  const teams = await withRetry(
    () =>
      prisma.team.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
    'dispatch:teams:fetch'
  );

  // Transform to GeoJSON FeatureCollection
  const features = teams
    .map((team) => {
      const location = validatePoint(team.location);
      if (!location) {
        logger.warn({
          event: 'invalid_team_location',
          meta: { teamId: team.id, teamName: team.name },
        });
        return null;
      }

      return {
        type: 'Feature' as const,
        geometry: location,
        properties: {
          id: team.id,
          name: team.name,
          type: team.type,
          status: team.status,
          assignedTo: team.assignedTo ?? undefined,
          capacity: team.capacity,
          equipment: team.equipment,
          createdAt: team.createdAt.toISOString(),
          updatedAt: team.updatedAt.toISOString(),
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  logger.info({
    event: 'teams_fetched',
    meta: {
      userId: user.userId,
      totalTeams: features.length,
      statusFilter: statusFilter ?? 'all',
      typeFilter: typeFilter ?? 'all',
    },
  });

  const response = NextResponse.json({
    type: 'FeatureCollection',
    features,
  });

  // Cache for 10 seconds (teams change status frequently)
  response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');

  return response;
});

/**
 * POST /api/dispatch/teams
 * Create new team (OFFICIAL only)
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can create teams
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const body = await request.json();
  const { name, type, location, capacity, equipment } = body;

  // Validate required fields
  const fields = [];

  if (!name || typeof name !== 'string') {
    fields.push({
      field: 'name',
      code: 'required',
      message: 'Team name is required',
    });
  }

  if (!type || !['GROUND_CREW', 'AERIAL_SUPPORT', 'COMMAND_UNIT', 'MEDICAL'].includes(type)) {
    fields.push({
      field: 'type',
      code: 'invalid',
      message: 'Team type must be GROUND_CREW, AERIAL_SUPPORT, COMMAND_UNIT, or MEDICAL',
    });
  }

  // Validate location (GeoJSON Point)
  if (!location) {
    fields.push({
      field: 'location',
      code: 'required',
      message: 'Team location is required',
    });
  } else {
    const validLocation = validatePoint(location);
    if (!validLocation) {
      fields.push({
        field: 'location',
        code: 'invalid',
        message: 'Location must be a valid GeoJSON Point',
      });
    }
  }

  // Validate capacity
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
    fields.push({
      field: 'capacity',
      code: 'invalid',
      message: 'Capacity must be a positive integer',
    });
  }

  // Validate equipment (array of strings)
  if (equipment !== undefined && !Array.isArray(equipment)) {
    fields.push({
      field: 'equipment',
      code: 'invalid',
      message: 'Equipment must be an array of strings',
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  // Create team
  const team = await withRetry(
    () =>
      prisma.team.create({
        data: {
          name,
          type,
          location,
          capacity: capacity ?? 5, // Default to 5
          equipment: equipment ?? [],
          status: 'AVAILABLE', // New teams start as AVAILABLE
        },
      }),
    'dispatch:teams:create'
  );

  logger.info({
    event: 'team_created',
    meta: {
      userId: user.userId,
      teamId: team.id,
      teamName: team.name,
      teamType: team.type,
    },
  });

  return NextResponse.json(
    {
      id: team.id,
      name: team.name,
      type: team.type,
      status: team.status,
      location: team.location,
      capacity: team.capacity,
      equipment: team.equipment,
      createdAt: team.createdAt.toISOString(),
    },
    { status: 201 }
  );
});
