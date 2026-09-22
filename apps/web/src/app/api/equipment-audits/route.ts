export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Prisma } from '@prisma/client';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const fireRecordId = url.searchParams.get('fireRecordId');

  const where: Prisma.EquipmentAuditWhereInput = {};
  if (fireRecordId) where.fireRecordId = fireRecordId;

  const audits = await prisma.equipmentAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: audits });
});

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const {
    fireRecordId,
    auditType,
    vpiMatricule,
    dpeflcd,
    ccdrf,
    secteur,
    foret,
    canton,
    lieudit,
    items,
    signedBy,
    signedByRole,
    donateur,
    recepteur,
    status,
  } = body;

  if (!fireRecordId || typeof fireRecordId !== 'string') {
    throw new AppError(1000, { message: 'fireRecordId is required' });
  }
  if (!auditType || !['general', 'vpi'].includes(auditType)) {
    throw new AppError(1001, {
      fields: [{ field: 'auditType', code: 'invalid', message: 'auditType must be "general" or "vpi"' }],
    });
  }
  if (!Array.isArray(items)) {
    throw new AppError(1001, {
      fields: [{ field: 'items', code: 'invalid', message: 'items must be an array' }],
    });
  }

  // Verify fire record exists
  const record = await prisma.fireEventRecord.findUnique({ where: { id: fireRecordId } });
  if (!record) throw new AppError(8000);

  const audit = await prisma.equipmentAudit.create({
    data: {
      fireRecordId,
      auditType,
      vpiMatricule: vpiMatricule || undefined,
      dpeflcd: dpeflcd || undefined,
      ccdrf: ccdrf || undefined,
      secteur: secteur || undefined,
      foret: foret || undefined,
      canton: canton || undefined,
      lieudit: lieudit || undefined,
      items: items as Prisma.InputJsonValue,
      signedBy: signedBy || undefined,
      signedByRole: signedByRole || undefined,
      donateur: donateur || undefined,
      recepteur: recepteur || undefined,
      status: status || 'draft',
    },
  });

  return NextResponse.json(audit, { status: 201 });
});
