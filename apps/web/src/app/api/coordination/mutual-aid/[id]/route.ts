export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['APPROVED', 'DENIED'],
  APPROVED: ['EN_ROUTE'],
  EN_ROUTE: ['ON_SCENE'],
  ON_SCENE: ['COMPLETED'],
};

export const PATCH = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const { id } = params;
  const body = await request.json();

  const existing = await prisma.mutualAidRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(1003);

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed || !allowed.includes(body.status)) throw new AppError(9004);

  const updated = await prisma.mutualAidRequest.update({
    where: { id },
    data: {
      status: body.status,
      respondedAt: new Date(),
      respondedBy: user.cin,
      ...(body.responseNotes && { responseNotes: body.responseNotes }),
    },
  });

  await prisma.communicationLog.create({
    data: {
      incidentId: existing.incidentId,
      category: 'MUTUAL_AID',
      message: `Mutual aid request ${existing.targetProvince}: ${existing.status} → ${body.status}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ request: updated });
});
