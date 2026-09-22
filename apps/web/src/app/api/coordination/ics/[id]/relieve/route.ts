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

  const assignment = await prisma.iCSAssignment.findUnique({ where: { id } });
  if (!assignment) throw new AppError(1003);
  if (assignment.relievedAt) throw new AppError(3000);

  const updated = await prisma.iCSAssignment.update({
    where: { id },
    data: { relievedAt: new Date() },
  });

  await prisma.communicationLog.create({
    data: {
      incidentId: assignment.incidentId,
      category: 'ORDER_GIVEN',
      message: `${assignment.assigneeName} relieved from ${assignment.role.replace(/_/g, ' ')}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ assignment: updated });
});
