export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enqueueNotification } from '@/lib/notifications/queue';
import { isTwilioConfigured } from '@/lib/notifications/twilio';
import { DEFAULT_LIMITS } from '@/types/pagination';
import type { CursorPaginationResponse } from '@/types/pagination';
import { formatValueForError } from '@/lib/errors/context';
import { logger } from '@/lib/observability/logger';

// In-memory cache for officials list (5-minute TTL)
interface OfficialsCache {
  data: Array<{ phone: string }>;
  timestamp: number;
}
let officialsCache: OfficialsCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const latitudeRaw = (body as { latitude?: unknown })?.latitude;
  const longitudeRaw = (body as { longitude?: unknown })?.longitude;
  const description = typeof (body as { description?: unknown })?.description === 'string' ? (body as { description: string }).description.trim() : '';
  const cause = typeof (body as { cause?: unknown })?.cause === 'string' ? (body as { cause: string }).cause : undefined;
  const anonymous = (body as { anonymous?: unknown })?.anonymous === true;
  const contactPhone = typeof (body as { contactPhone?: unknown })?.contactPhone === 'string' ? (body as { contactPhone: string }).contactPhone.trim() || undefined : undefined;
  const characteristics = (body as { characteristics?: unknown })?.characteristics ?? undefined;
  const rawImages = Array.isArray((body as { images?: unknown })?.images) ? (body as { images: unknown[] }).images : [];

  // Validate images: max 3, each max 3MB base64
  const MAX_IMAGES = 3;
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
  const validImages: string[] = [];
  for (const img of rawImages.slice(0, MAX_IMAGES)) {
    if (typeof img !== 'string' || !img.startsWith('data:image/')) continue;
    const base64Part = img.split(',')[1] ?? '';
    const sizeBytes = Math.ceil(base64Part.length * 0.75);
    if (sizeBytes <= MAX_IMAGE_BYTES) {
      validImages.push(img);
    }
  }

  const fields = [];
  const latitude = typeof latitudeRaw === 'number' ? latitudeRaw : Number(latitudeRaw);
  const longitude = typeof longitudeRaw === 'number' ? longitudeRaw : Number(longitudeRaw);

  if (!Number.isFinite(latitude)) {
    fields.push({
      field: 'latitude',
      code: typeof latitudeRaw === 'undefined' ? 'required' : 'invalid_number',
      message: typeof latitudeRaw !== 'undefined'
        ? `Expected number, got: ${formatValueForError(latitudeRaw)}`
        : undefined,
    });
  }

  if (!Number.isFinite(longitude)) {
    fields.push({
      field: 'longitude',
      code: typeof longitudeRaw === 'undefined' ? 'required' : 'invalid_number',
      message: typeof longitudeRaw !== 'undefined'
        ? `Expected number, got: ${formatValueForError(longitudeRaw)}`
        : undefined,
    });
  }

  if (!description) {
    fields.push({ field: 'description', code: 'required' });
  }

  if (fields.length) {
    throw new AppError(1001, {
      fields,
      meta: {
        invalidValues: {
          latitude: latitudeRaw,
          longitude: longitudeRaw,
          description,
        },
      },
    });
  }

  // Generate reference number: RPT-YYYYMMDD-XXXX
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const hexPart = Math.random().toString(16).slice(2, 6).toUpperCase();
  const referenceNumber = `RPT-${datePart}-${hexPart}`;

  const report: ReportWithUser = await prisma.report.create({
    data: {
      userId: currentUser.userId,
      latitude,
      longitude,
      description,
      cause,
      images: validImages,
      status: 'PENDING',
      anonymous,
      contactPhone,
      characteristics: characteristics as object | undefined,
      referenceNumber,
    },
    include: {
      user: {
        select: {
          cin: true,
          phone: true,
          role: true,
        },
      },
    },
  });

  // Enqueue notification for background processing (non-blocking)
  if (isTwilioConfigured()) {
    try {
      await enqueueWhatsAppNotification(report);
    } catch (error) {
      logger.error({
        event: 'notification_enqueue_failed',
        meta: {
          reportId: report.id,
          nonBlocking: true,
        },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack,
        },
      });
    }
  }

  return NextResponse.json({ report, referenceNumber });
});

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

async function getOfficials(): Promise<Array<{ phone: string }>> {
  const now = Date.now();

  // Return cached data if still valid
  if (officialsCache && (now - officialsCache.timestamp) < CACHE_TTL_MS) {
    return officialsCache.data;
  }

  // Fetch fresh data
  const officials = await prisma.user.findMany({
    where: { role: 'OFFICIAL' },
    select: { phone: true },
  });

  // Update cache
  officialsCache = {
    data: officials,
    timestamp: now,
  };

  return officials;
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

async function enqueueWhatsAppNotification(report: ReportWithUser): Promise<void> {
  const testPhone = process.env.TEST_PHONE_NUMBER;

  // Get officials from cache
  const officials = await getOfficials();

  let recipients = officials
    .filter((o) => E164_REGEX.test(o.phone))
    .map((o) => `whatsapp:${o.phone}`);

  // If no officials, use test phone
  if (recipients.length === 0 && testPhone && testPhone !== '+212XXXXXXXXX') {
    recipients = [`whatsapp:${testPhone}`];
    logger.info({
      event: 'notification_using_test_number',
      meta: { testPhone },
    });
  }

  if (recipients.length === 0) {
    logger.warn({
      event: 'notification_no_recipients',
      meta: { reportId: report.id },
    });
    return;
  }

  const googleMapsLink = `https://www.google.com/maps?q=${report.latitude},${report.longitude}`;

  const message = `*ALERTE INCENDIE - RICER Ifrane*

*Localisation:*
${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}
Voir sur Google Maps: ${googleMapsLink}

*Description:*
${report.description}

*Signalé par:* ${report.user.cin}
*Date:* ${new Date(report.createdAt).toLocaleString('fr-FR')}

ID: ${report.id}

*Action requise immédiatement*`;

  // Enqueue the notification job
  await enqueueNotification(report.id, recipients, message);
  logger.info({
    event: 'notification_enqueued',
    meta: {
      reportId: report.id,
      recipientCount: recipients.length,
    },
  });
}
