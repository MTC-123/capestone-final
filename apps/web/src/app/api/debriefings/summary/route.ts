export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const debriefings = await prisma.debriefing.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const total = debriefings.length;

  if (total === 0) {
    return NextResponse.json({
      total: 0,
      infrastructure: { noPistes: 0, noTranchees: 0, noPointsEau: 0 },
      recentLessons: [],
    });
  }

  // Infrastructure issue percentages
  const noPistes = debriefings.filter((d) => d.pistesForestieres === false).length;
  const noTranchees = debriefings.filter((d) => d.trancheesPF === false).length;
  const noPointsEau = debriefings.filter((d) => d.pointsEau === false).length;

  // Last 5 "prochaine fois" entries
  const recentLessons = debriefings
    .filter((d) => d.prochaineFois)
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      date: d.date.toISOString().slice(0, 10),
      text: d.prochaineFois!,
    }));

  return NextResponse.json({
    total,
    infrastructure: {
      noPistes: Math.round((noPistes / total) * 100),
      noTranchees: Math.round((noTranchees / total) * 100),
      noPointsEau: Math.round((noPointsEau / total) * 100),
    },
    recentLessons,
  });
});
