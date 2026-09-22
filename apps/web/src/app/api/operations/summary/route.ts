export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { OperationalPhase } from '@prisma/client';

const ALL_PHASES: OperationalPhase[] = [
  'PREPARATION',
  'PREPOSITIONNEMENT',
  'ALERTE',
  'LUTTE',
  'EXTINCTION',
  'POST_CAMPAGNE',
];

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');
  if (!campaignId) throw new AppError(1000);

  const groups = await prisma.phaseChecklist.groupBy({
    by: ['phase', 'status'],
    where: { campaignId },
    _count: true,
  });

  const summary: Record<string, { total: number; done: number }> = {};
  for (const phase of ALL_PHASES) {
    summary[phase] = { total: 0, done: 0 };
  }

  for (const g of groups) {
    summary[g.phase].total += g._count;
    if (g.status === 'DONE') {
      summary[g.phase].done += g._count;
    }
  }

  return NextResponse.json({ summary });
});
