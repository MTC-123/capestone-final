export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { DEFAULT_LIMITS } from '@/types/pagination';
import type { CursorPaginationResponse } from '@/types/pagination';
import { isAlertSource, createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';

function buildDisplayId(record: {
  alertReceivedAt?: Date | null;
  createdAt: Date;
  locationDetail?: Prisma.JsonValue;
  burnAreaHa?: number | null;
}): string {
  const date = record.alertReceivedAt ?? record.createdAt;
  const dateStr = date.toISOString().slice(0, 10);
  const loc = record.locationDetail as Record<string, unknown> | null;
  const locName = loc?.locationName ?? loc?.commune ?? '';
  const size = record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '';
  return [dateStr, locName, size].filter(Boolean).join(' — ');
}

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMITS.FIRE_RECORDS)),
    100
  );
  const cursor = url.searchParams.get('cursor') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const alertSource = url.searchParams.get('alertSource') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const minArea = url.searchParams.get('minArea')
    ? parseFloat(url.searchParams.get('minArea')!)
    : undefined;
  const maxArea = url.searchParams.get('maxArea')
    ? parseFloat(url.searchParams.get('maxArea')!)
    : undefined;
  const search = url.searchParams.get('search') || undefined;
  const commune = url.searchParams.get('commune') || undefined;
  const cause = url.searchParams.get('cause') || undefined;
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

  const where: Record<string, unknown> = {};
  if (status) where.recordStatus = status;
  if (alertSource) where.alertSource = alertSource;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo) }),
    };
  }
  if (minArea !== undefined && !isNaN(minArea)) {
    where.burnAreaHa = { ...(where.burnAreaHa as object || {}), gte: minArea };
  }
  if (maxArea !== undefined && !isNaN(maxArea)) {
    where.burnAreaHa = { ...(where.burnAreaHa as object || {}), lte: maxArea };
  }
  if (search) {
    where.incidentId = { contains: search };
  }
  if (commune) {
    where.locationDetail = { path: ['commune'], string_contains: commune };
  }
  if (cause) {
    where.causeDetail = { path: ['category'], equals: cause };
  }

  const allowedSortFields = ['createdAt', 'burnAreaHa', 'alertReceivedAt'];
  const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const records = await prisma.fireEventRecord.findMany({
    where,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    take: limit + 1,
    orderBy: { [orderField]: sortOrder },
  });

  const total = await prisma.fireEventRecord.count({ where });

  const hasMore = records.length > limit;
  const data = hasMore ? records.slice(0, limit) : records;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  // Enrich with displayId
  const enrichedData = data.map((r) => ({
    ...r,
    displayId: buildDisplayId(r),
  }));

  const response: CursorPaginationResponse<(typeof enrichedData)[number]> = {
    data: enrichedData,
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
  const { incidentId, alertSource, locationDetail } = body;

  if (!incidentId || typeof incidentId !== 'string') {
    throw new AppError(1000, { message: 'incidentId is required' });
  }

  if (alertSource && !isAlertSource(alertSource)) {
    throw new AppError(1001, {
      fields: [{ field: 'alertSource', code: 'invalid', message: 'Invalid alert source' }],
    });
  }

  // Check incident exists
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError(8006);

  // Check no duplicate
  const existing = await prisma.fireEventRecord.findUnique({ where: { incidentId } });
  if (existing) throw new AppError(8001);

  const auditEntry = createAuditEntry(currentUser.userId, currentUser.cin, 'CREATE');

  // Auto-populate locationDetail from incident if not provided
  let resolvedLocationDetail = locationDetail || undefined;
  if (!resolvedLocationDetail && incident.location) {
    const loc = incident.location as { coordinates?: [number, number] };
    if (loc.coordinates) {
      resolvedLocationDetail = { coordinates: loc.coordinates };
    }
  }

  const record = await prisma.fireEventRecord.create({
    data: {
      incidentId,
      alertSource: alertSource || 'OTHER',
      recordStatus: 'DRAFT',
      lockedSections: [],
      auditTrail: [JSON.parse(JSON.stringify(auditEntry)) as Prisma.InputJsonValue],
      ...(resolvedLocationDetail && {
        locationDetail: resolvedLocationDetail as Prisma.InputJsonValue,
      }),
    },
  });

  return NextResponse.json(record, { status: 201 });
});
