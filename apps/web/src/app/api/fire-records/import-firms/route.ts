export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';

interface FirmsImportDetection {
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: string;
  confidence: string | number;
  frp: number;
  satellite?: string;
}

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const { detections } = body;

  if (!Array.isArray(detections) || detections.length === 0) {
    throw new AppError(8009, { message: 'detections array is required and must be non-empty' });
  }

  const results: { incidentId: string; recordId: string }[] = [];

  try {
    for (const det of detections as FirmsImportDetection[]) {
      if (typeof det.latitude !== 'number' || typeof det.longitude !== 'number') {
        continue; // skip invalid entries
      }

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
        ? new Date(`${det.acq_date}T${det.acq_time.slice(0, 2)}:${det.acq_time.slice(2)}:00Z`)
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
