export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { labelOperation } from '@/lib/errors/context';
import { getCachedJSON, cacheJSON } from '@/lib/cache/redis';

const CACHE_TTL_SECONDS = 5 * 60;

interface TimelineRecord {
  _id: string;
  alertReceivedAt: string | null;
  verifiedAt: string | null;
  firstResponseAt: string | null;
  onSceneAt: string | null;
  containedAt: string | null;
  extinguishedAt: string | null;
  burnAreaHa: number | null;
  alertSource: string;
}

function diffMinutes(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return diff > 0 ? diff / 60000 : null;
}

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const now = new Date();
  const fromDate = fromParam ? new Date(fromParam) : (() => { const d = new Date(now); d.setDate(d.getDate() - 30); return d; })();
  const toDate = toParam ? new Date(toParam) : now;

  const cacheKey = `analytics:response:${fromDate.toISOString().slice(0, 10)}:${toDate.toISOString().slice(0, 10)}`;
  const cached = await getCachedJSON<Record<string, unknown>>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const records = await labelOperation(
    prisma.fireEventRecord.aggregateRaw({
      pipeline: [
        {
          $match: {
            createdAt: {
              $gte: { $date: fromDate.toISOString() },
              $lte: { $date: toDate.toISOString() },
            },
          },
        },
        {
          $project: {
            alertReceivedAt: 1,
            verifiedAt: 1,
            firstResponseAt: 1,
            onSceneAt: 1,
            containedAt: 1,
            extinguishedAt: 1,
            burnAreaHa: 1,
            alertSource: 1,
          },
        },
      ],
    }),
    'analytics:response_records'
  ) as unknown as TimelineRecord[];

  // Compute phase averages
  const phaseSums: Record<string, { total: number; count: number }> = {
    alertToVerified: { total: 0, count: 0 },
    verifiedToFirstResponse: { total: 0, count: 0 },
    firstResponseToContained: { total: 0, count: 0 },
    containedToExtinguished: { total: 0, count: 0 },
  };

  const responseRecords: { id: string; burnAreaHa: number | null; totalMinutes: number; alertSource: string }[] = [];

  for (const rec of records) {
    const phases = [
      { key: 'alertToVerified', a: rec.alertReceivedAt, b: rec.verifiedAt },
      { key: 'verifiedToFirstResponse', a: rec.verifiedAt, b: rec.firstResponseAt },
      { key: 'firstResponseToContained', a: rec.firstResponseAt, b: rec.containedAt },
      { key: 'containedToExtinguished', a: rec.containedAt, b: rec.extinguishedAt },
    ];

    let totalMinutes = 0;
    for (const phase of phases) {
      const mins = diffMinutes(phase.a, phase.b);
      if (mins != null) {
        phaseSums[phase.key].total += mins;
        phaseSums[phase.key].count += 1;
        totalMinutes += mins;
      }
    }

    if (totalMinutes > 0) {
      responseRecords.push({
        id: rec._id,
        burnAreaHa: rec.burnAreaHa,
        totalMinutes,
        alertSource: rec.alertSource,
      });
    }
  }

  const phaseNames: Record<string, string> = {
    alertToVerified: 'avgAlertToVerified',
    verifiedToFirstResponse: 'avgVerifiedToResponse',
    firstResponseToContained: 'avgResponseToContained',
    containedToExtinguished: 'extinguishPhase',
  };

  const phases = Object.entries(phaseSums)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({
      name: phaseNames[key],
      avgMinutes: v.total / v.count,
    }));

  const avgTotal = responseRecords.length > 0
    ? responseRecords.reduce((s, r) => s + r.totalMinutes, 0) / responseRecords.length
    : 0;

  const responseData = {
    phases,
    avgTotalMinutes: avgTotal,
    records: responseRecords,
  };

  await cacheJSON(cacheKey, responseData, CACHE_TTL_SECONDS);
  return NextResponse.json(responseData);
});
