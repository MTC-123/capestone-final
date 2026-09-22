export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { OperationalPhase } from '@prisma/client';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  const phase = url.searchParams.get('phase') as OperationalPhase | null;

  if (!campaignId || !phase) throw new AppError(1000);

  const items = await prisma.phaseChecklist.findMany({
    where: { campaignId, phase },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ items });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const { campaignId, phase, task, responsibleUnit, deadline } = body;

  if (!campaignId || !phase || !task) throw new AppError(1000);

  // Get max sortOrder for this phase
  const maxSort = await prisma.phaseChecklist.findFirst({
    where: { campaignId, phase },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const item = await prisma.phaseChecklist.create({
    data: {
      campaignId,
      phase,
      task: String(task).trim(),
      responsibleUnit: responsibleUnit || null,
      deadline: deadline ? new Date(deadline) : null,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
});
