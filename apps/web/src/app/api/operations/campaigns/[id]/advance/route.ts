export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { OperationalPhase } from '@prisma/client';

const PHASE_ORDER: OperationalPhase[] = [
  'PREPARATION',
  'PREPOSITIONNEMENT',
  'ALERTE',
  'LUTTE',
  'EXTINCTION',
  'POST_CAMPAGNE',
];

export const POST = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw new AppError(10000);

  const currentIndex = PHASE_ORDER.indexOf(existing.activePhase);
  if (currentIndex >= PHASE_ORDER.length - 1) {
    throw new AppError(10002);
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1];
  const campaign = await prisma.campaign.update({
    where: { id },
    data: { activePhase: nextPhase, status: 'ACTIVE' },
  });

  return NextResponse.json({ campaign });
});
