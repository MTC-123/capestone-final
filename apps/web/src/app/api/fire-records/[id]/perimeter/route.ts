export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { isGeoJSONPolygon } from '@/lib/validation/geojson';
import { computePolygonStats } from '@/lib/fire-records/polygonStats';
import { createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';

export const PUT = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const record = await prisma.fireEventRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(8000);

  if (record.recordStatus === 'LOCKED') throw new AppError(8005);
  if (record.lockedSections.includes('location')) throw new AppError(8002);

  const body = await request.json();
  const { polygon } = body;

  if (!isGeoJSONPolygon(polygon)) throw new AppError(8003);

  const stats = computePolygonStats(polygon);

  const auditEntry = createAuditEntry(
    currentUser.userId,
    currentUser.cin,
    'UPDATE_PERIMETER',
    'location'
  );

  const currentTrail = (record.auditTrail as Prisma.JsonValue[]) || [];
  const newTrail = [...currentTrail, JSON.parse(JSON.stringify(auditEntry))];

  const updated = await prisma.fireEventRecord.update({
    where: { id },
    data: {
      burnPerimeter: JSON.parse(JSON.stringify(polygon)) as Prisma.InputJsonValue,
      burnAreaHa: stats.burnAreaHa,
      burnCentroid: stats.centroid as unknown as Prisma.InputJsonValue,
      burnBoundingBox: stats.boundingBox as unknown as Prisma.InputJsonValue,
      auditTrail: newTrail,
    },
  });

  return NextResponse.json({ record: updated });
});
