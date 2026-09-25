export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { notifyEvent } from '@/lib/notifications/events';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { parseJsonBody } from '@/lib/validation/parse';
import { createReportSchema } from '@/lib/validation/report';
import { audit } from '@/lib/audit/log';
import { DEFAULT_LIMITS } from '@/types/pagination';
import type { CursorPaginationResponse } from '@/types/pagination';
import { logger } from '@/lib/observability/logger';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMITS.REPORTS)),
    100
  );
  const cursor = url.searchParams.get('cursor') || undefined;
  const withoutIncident = url.searchParams.get('withoutIncident') === 'true';
  const status = url.searchParams.get('status') || undefined;
  const cause = url.searchParams.get('cause') || undefined;

  // Build query
  const where: Prisma.ReportWhereInput = {};
  if (currentUser.role !== 'OFFICIAL') {
    where.userId = currentUser.userId;
  }
  if (cursor) {
    where.id = { lt: cursor };
  }
  if (withoutIncident) {
    where.incidentId = null;
  }
  if (status) {
    const allowed = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
    if (!allowed.includes(status as (typeof allowed)[number])) {
      throw new AppError(1001, { fields: [{ field: 'status', code: 'invalid' }] });
    }
    where.status = status as (typeof allowed)[number];
  }
  if (cause) {
    where.cause = cause;
  }

  // Fetch one extra to determine if there are more results
  const reports = await prisma.report.findMany({
    where,
    take: limit + 1,
    include: {
      user: {
        select: {
          cin: true,
          phone: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get total count (cached for 1 minute in production)
  const total = await prisma.report.count({ where });

  // Determine if there are more results
  const hasMore = reports.length > limit;
  const data = hasMore ? reports.slice(0, limit) : reports;
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
  await enforceRateLimit('reportCreate', request, currentUser.userId);

  const input = await parseJsonBody(request, createReportSchema);
  const clientSubmissionId = input.clientSubmissionId ?? crypto.randomUUID();

  // Idempotency: a retried submission (offline queue, flaky network, double
  // tap) returns the report created the first time.
  const existing = await findSubmission(clientSubmissionId);
  if (existing) {
    if (existing.userId !== currentUser.userId) throw new AppError(3001);
    return NextResponse.json({ report: existing, referenceNumber: existing.referenceNumber, duplicate: true });
  }

  await assertPhotosOwned(input.images, currentUser.userId);

  let report: ReportWithUser;
  try {
    report = await prisma.report.create({
      data: {
        userId: currentUser.userId,
        clientSubmissionId,
        referenceNumber: generateReferenceNumber(),
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
        cause: input.cause,
        images: input.images,
        status: 'PENDING',
        anonymous: input.anonymous,
        contactPhone: input.contactPhone,
        characteristics: {
          ...(input.characteristics ?? {}),
          ...(input.capturedAt ? { capturedAt: input.capturedAt.toISOString() } : {}),
        } as object,
      },
      include: REPORT_USER_INCLUDE,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await findSubmission(clientSubmissionId);
      if (winner && winner.userId === currentUser.userId) {
        return NextResponse.json({ report: winner, referenceNumber: winner.referenceNumber, duplicate: true });
      }
    }
    throw error;
  }

  await audit({
    action: 'report.create',
    actor: currentUser,
    targetType: 'report',
    targetId: report.id,
    meta: { referenceNumber: report.referenceNumber, photos: input.images.length, offline: Boolean(input.capturedAt) },
    request,
  });

  try {
    await notifyEvent({ type: 'report.submitted', report });
  } catch (error) {
    logger.error({
      event: 'notification_dispatch_failed',
      meta: { reportId: report.id, nonBlocking: true },
      error: { name: (error as Error)?.name, message: (error as Error)?.message },
    });
  }

  return NextResponse.json({ report, referenceNumber: report.referenceNumber, duplicate: false }, { status: 201 });
});

const REPORT_USER_INCLUDE = {
  user: { select: { cin: true, phone: true, role: true } },
} as const;

function findSubmission(clientSubmissionId: string) {
  return prisma.report.findUnique({ where: { clientSubmissionId }, include: REPORT_USER_INCLUDE });
}

/** RPT-YYYYMMDD-XXXXXX with 24 bits of randomness; collisions surface as P2002. */
function generateReferenceNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.getRandomValues(new Uint8Array(3));
  const hexPart = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `RPT-${datePart}-${hexPart}`;
}

/** Photos must be uploads owned by the reporter, so a report cannot reference someone else's image. */
async function assertPhotosOwned(urls: string[], userId: string) {
  if (!urls.length) return;
  const ids = urls.map((u) => u.split('/').pop() as string);
  const owned = await prisma.upload.count({ where: { id: { in: ids }, ownerId: userId } });
  if (owned !== ids.length) {
    throw new AppError(1001, { fields: [{ field: 'images', code: 'invalid_photo' }] });
  }
}

type ReportWithUser = Prisma.ReportGetPayload<{
  include: {
    user: {
      select: {
        cin: true;
        phone: true;
        role: true;
      };
    };
  };
}>;
