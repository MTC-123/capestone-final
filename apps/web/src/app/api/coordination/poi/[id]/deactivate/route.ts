export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const POST = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const { id } = params;

  const activation = await prisma.pOIActivation.findUnique({ where: { id } });
  if (!activation) throw new AppError(9001);
  if (activation.deactivatedAt) throw new AppError(3000);

  const updated = await prisma.pOIActivation.update({
    where: { id },
    data: { deactivatedAt: new Date() },
  });

  // Auto-create comm log entry
  await prisma.communicationLog.create({
    data: {
      incidentId: activation.incidentId,
      category: 'DE_ESCALATION',
      message: `POI ${activation.level.replace('_', ' ')} deactivated for incident`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ activation: updated });
});
