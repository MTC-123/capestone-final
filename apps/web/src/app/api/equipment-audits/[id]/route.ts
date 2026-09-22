export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Prisma } from '@prisma/client';

export const GET = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const audit = await prisma.equipmentAudit.findUnique({ where: { id } });
  if (!audit) throw new AppError(1000, { message: 'Equipment audit not found' });

  return NextResponse.json(audit);
});

export const PATCH = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const existing = await prisma.equipmentAudit.findUnique({ where: { id } });
  if (!existing) throw new AppError(1000, { message: 'Equipment audit not found' });

  const body = await request.json();
  const allowedFields = [
    'auditType', 'vpiMatricule', 'dpeflcd', 'ccdrf', 'secteur', 'foret',
    'canton', 'lieudit', 'items', 'signedBy', 'signedByRole', 'donateur',
    'recepteur', 'status',
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = field === 'items'
        ? (body[field] as Prisma.InputJsonValue)
        : body[field];
    }
  }

  if (data.auditType && !['general', 'vpi'].includes(data.auditType as string)) {
    throw new AppError(1001, {
      fields: [{ field: 'auditType', code: 'invalid', message: 'auditType must be "general" or "vpi"' }],
    });
  }

  const updated = await prisma.equipmentAudit.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
});
