export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';

export const POST = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const record = await prisma.fireEventRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(8000);

  if (record.recordStatus !== 'DRAFT') {
    throw new AppError(8011);
  }

  const auditEntry = createAuditEntry(
    currentUser.userId,
    currentUser.cin,
    'VERIFY'
  );

  const currentTrail = (record.auditTrail as Prisma.JsonValue[]) || [];

  const updated = await prisma.fireEventRecord.update({
    where: { id },
    data: {
      recordStatus: 'VERIFIED',
      auditTrail: [...currentTrail, JSON.parse(JSON.stringify(auditEntry))],
    },
  });

  return NextResponse.json({ record: updated });
});
