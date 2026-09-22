export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [records, totalCount] = await Promise.all([
    prisma.fireEventRecord.findMany({
      where: { createdAt: { gte: yearStart } },
      select: {
        burnAreaHa: true,
        locationDetail: true,
        responseDetail: true,
        firstResponseAt: true,
        alertReceivedAt: true,
      },
    }),
    prisma.fireEventRecord.count({
      where: { createdAt: { gte: yearStart } },
    }),
  ]);

  // Total hectares
  const totalHectaresBurned = records.reduce(
    (sum, r) => sum + (r.burnAreaHa ?? 0),
    0
  );

  // Average response time
  const responseTimes: number[] = [];
  for (const r of records) {
    const detail = r.responseDetail as Record<string, unknown> | null;
    if (detail?.responseTimeMinutes && typeof detail.responseTimeMinutes === 'number') {
      responseTimes.push(detail.responseTimeMinutes);
    } else if (r.firstResponseAt && r.alertReceivedAt) {
      const diff = (new Date(r.firstResponseAt).getTime() - new Date(r.alertReceivedAt).getTime()) / 60000;
      if (diff > 0) responseTimes.push(diff);
    }
  }
  const avgResponseTimeMinutes = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;

  // Most affected commune
  const communeCounts: Record<string, number> = {};
  for (const r of records) {
    const loc = r.locationDetail as Record<string, unknown> | null;
    const commune = loc?.commune;
    if (typeof commune === 'string' && commune) {
      communeCounts[commune] = (communeCounts[commune] || 0) + 1;
    }
  }
  const mostAffectedCommune = Object.entries(communeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    totalFiresThisYear: totalCount,
    totalHectaresBurned: Math.round(totalHectaresBurned * 100) / 100,
    avgResponseTimeMinutes,
    mostAffectedCommune,
  });
});
