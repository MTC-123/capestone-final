export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const incidentId = url.searchParams.get('incidentId') || undefined;
  const status = url.searchParams.get('status') || undefined;

  const where: Record<string, unknown> = {};
  if (incidentId) where.incidentId = incidentId;
  if (status) where.status = status;

  const workflows = await prisma.pMAWorkflow.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ workflows });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  if (!body.incidentId) throw new AppError(1001);

  const workflow = await prisma.pMAWorkflow.create({
    data: {
      incidentId: body.incidentId,
      currentStep: 'DETECTION',
      steps: [
        { step: 'DETECTION', timestamp: new Date().toISOString(), actor: user.cin, notes: body.notes || undefined },
      ],
      requestedBy: user.cin,
      status: 'IN_PROGRESS',
    },
  });

  await prisma.communicationLog.create({
    data: {
      incidentId: body.incidentId,
      category: 'AVIATION_REQUEST',
      message: `PMA Aviation mobilization workflow initiated at DETECTION step`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ workflow }, { status: 201 });
});
