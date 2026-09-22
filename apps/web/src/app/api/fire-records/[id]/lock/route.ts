export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { isLockableSection, createAuditEntry } from '@/lib/fire-records/validation';
import type { Prisma } from '@prisma/client';

export const POST = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const body = await request.json();
  const { section } = body;

  if (!isLockableSection(section)) {
    throw new AppError(1001, {
      fields: [{ field: 'section', code: 'invalid', message: `Invalid section: ${section}` }],
    });
  }

  const record = await prisma.fireEventRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(8000);

  if (record.recordStatus === 'LOCKED') throw new AppError(8005);

  // Idempotent: if already locked, just return success
  if (record.lockedSections.includes(section)) {
    return NextResponse.json({ record });
  }

  const auditEntry = createAuditEntry(
    currentUser.userId,
    currentUser.cin,
    'LOCK_SECTION',
    section
  );

  const currentTrail = (record.auditTrail as Prisma.JsonValue[]) || [];
  const newTrail = [...currentTrail, JSON.parse(JSON.stringify(auditEntry))];

  const updated = await prisma.fireEventRecord.update({
    where: { id },
    data: {
      lockedSections: [...record.lockedSections, section],
      auditTrail: newTrail,
    },
  });

  return NextResponse.json({ record: updated });
});
