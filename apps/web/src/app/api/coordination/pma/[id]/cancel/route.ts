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

  const workflow = await prisma.pMAWorkflow.findUnique({ where: { id } });
  if (!workflow) throw new AppError(1003);
  if (workflow.status !== 'IN_PROGRESS') throw new AppError(3000);

  const updated = await prisma.pMAWorkflow.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  await prisma.communicationLog.create({
    data: {
      incidentId: workflow.incidentId,
      category: 'AVIATION_REQUEST',
      message: `PMA workflow cancelled at step ${workflow.currentStep}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ workflow: updated });
});
