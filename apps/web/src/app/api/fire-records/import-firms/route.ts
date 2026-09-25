export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validation/parse';

const ImportBody = z.object({
  detections: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        acq_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        acq_time: z.string().regex(/^\d{3,4}$/),
        confidence: z.union([z.string().max(16), z.number()]),
        frp: z.number().min(0).default(0),
        satellite: z.string().max(16).optional(),
      })
    )
    .min(1)
    .max(500),
});

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const { detections } = await parseJsonBody(request, ImportBody);

  const results: { incidentId: string; recordId: string }[] = [];

  try {
    for (const det of detections) {

      // Create an incident for each detection
      const incident = await prisma.incident.create({
        data: {
          location: {
            type: 'Point',
            coordinates: [det.longitude, det.latitude],
          } as unknown as Prisma.InputJsonValue,
          cause: 'UNKNOWN',
          severity: 1,
          status: 'VIGILANCE',
          description: `FIRMS import — ${det.satellite || 'SAT'} ${det.acq_date} ${det.acq_time} FRP:${det.frp ?? 0}`,
        },
      });

      const alertReceivedAt = det.acq_date && det.acq_time
        ? new Date(`${det.acq_date}T${det.acq_time.padStart(4, '0').slice(0, 2)}:${det.acq_time.padStart(4, '0').slice(2)}:00Z`)
        : new Date();

      const auditEntry = createAuditEntry(
        currentUser.userId,
        currentUser.cin,
        'IMPORT_FIRMS'
      );

      const record = await prisma.fireEventRecord.create({
        data: {
          incidentId: incident.id,
          alertSource: 'FIRMS_SATELLITE',
          alertReceivedAt,
          recordStatus: 'DRAFT',
          lockedSections: [],
          locationDetail: {
            coordinates: [det.longitude, det.latitude],
          } as unknown as Prisma.InputJsonValue,
          auditTrail: [JSON.parse(JSON.stringify(auditEntry)) as Prisma.InputJsonValue],
        },
      });

      results.push({ incidentId: incident.id, recordId: record.id });
    }
  } catch (err) {
    throw new AppError(8009, { cause: err });
  }

  return NextResponse.json({ imported: results.length, records: results }, { status: 201 });
});
