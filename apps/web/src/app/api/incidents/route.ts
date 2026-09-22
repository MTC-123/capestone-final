export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { formatValueForError } from '@/lib/errors/context';
import { DEFAULT_LIMITS } from '@/types/pagination';
import type { CursorPaginationResponse } from '@/types/pagination';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMITS.INCIDENTS || 100)),
    100
  );
  const cursor = url.searchParams.get('cursor') || undefined;

  // Fetch one extra to determine if there are more results
  const incidents = await prisma.incident.findMany({
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
    take: limit + 1,
    orderBy: { createdAt: 'desc' },
  });

  // Get total count
  const total = await prisma.incident.count();

  // Determine if there are more results
  const hasMore = incidents.length > limit;
  const data = hasMore ? incidents.slice(0, limit) : incidents;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  const response: CursorPaginationResponse<typeof data[number]> = {
    data,
    pagination: {
      cursor: nextCursor,
      hasMore,
      total,
    },
  };

  return NextResponse.json(response);
});

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const { reportId, latitude, longitude, cause, severity, status, description } = body;

  // Validate coordinates
  const fields = [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    fields.push({
      field: 'location',
      code: 'invalid',
      message: `Invalid coordinates: latitude=${formatValueForError(latitude)}, longitude=${formatValueForError(longitude)}`,
    });
  }

  // Validate severity range
  if (!severity || severity < 1 || severity > 5) {
    fields.push({
      field: 'severity',
      code: 'invalid',
      message: `Severity must be between 1 and 5, got: ${formatValueForError(severity)}`,
    });
  }

  if (fields.length) {
    throw new AppError(1001, {
      fields,
      meta: {
        invalidValues: {
          latitude,
          longitude,
          severity,
        },
      },
    });
  }

  // If reportId provided, check it doesn't already have an incident
  if (reportId) {
    const existingReport = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, incidentId: true }
    });

    if (!existingReport) {
      throw new AppError(1003, { message: 'Report not found' });
    }

    if (existingReport.incidentId) {
      throw new AppError(1001, { message: 'Report already has an incident', fields: [{ field: 'reportId', code: 'conflict' }] });
    }
  }

  // Create incident and update report in transaction
  const result = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        cause: cause || 'UNKNOWN',
        severity,
        status: status || 'VIGILANCE',
        description: description || null,
        reportId: reportId || null
      }
    });

    // Update report if reportId provided
    if (reportId) {
      await tx.report.update({
        where: { id: reportId },
        data: {
          incidentId: incident.id,
          status: 'IN_PROGRESS'
        }
      });
    }

    return incident;
  });

  const response = NextResponse.json({ incident: result });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
