export const dynamic = 'force-dynamic';

/**
 * Dispatch Team by ID API - MVP Phase
 * PATCH: Update team status or assignment
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';
import { withRetry } from '@/lib/database/withRetry';
import type { TeamStatus } from '@prisma/client';

/**
 * PATCH /api/dispatch/teams/:id
 * Update team status or assignment
 */
export const PATCH = withApiHandler(async (request: Request, context?: { params?: Record<string, string> }) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Only OFFICIAL can update teams
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  const teamId = context?.params?.id;
  if (!teamId) throw new AppError(1000);
  const body = await request.json();
  const { status, assignedTo, location } = body;

  // Validate status if provided
  const fields = [];
  if (
    status &&
    !['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'UNAVAILABLE'].includes(status)
  ) {
    fields.push({
      field: 'status',
      code: 'invalid',
      message:
        'Status must be AVAILABLE, EN_ROUTE, ON_SCENE, RETURNING, or UNAVAILABLE',
    });
  }

  if (fields.length) {
    throw new AppError(1001, { fields });
  }

  // Check team exists
  const existingTeam = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!existingTeam) {
    throw new AppError(6009); // DISPATCH_TEAM_NOT_FOUND
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status as TeamStatus;
  if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
  if (location !== undefined) updateData.location = location;

  // Update team
  const team = await withRetry(
    () =>
      prisma.team.update({
        where: { id: teamId },
        data: updateData,
      }),
    'dispatch:teams:update'
  );

  logger.info({
    event: 'team_updated',
    meta: {
      userId: user.userId,
      teamId: team.id,
      teamName: team.name,
      oldStatus: existingTeam.status,
      newStatus: team.status,
      assignedTo: team.assignedTo,
    },
  });

  return NextResponse.json({
    id: team.id,
    name: team.name,
    type: team.type,
    status: team.status,
    location: team.location,
    assignedTo: team.assignedTo,
    capacity: team.capacity,
    equipment: team.equipment,
    updatedAt: team.updatedAt.toISOString(),
  });
});
