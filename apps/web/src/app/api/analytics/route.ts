export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { labelOperation } from '@/lib/errors/context';
import { getCachedJSON, cacheJSON } from '@/lib/cache/redis';

const CACHE_TTL_SECONDS = 5 * 60;

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  // Default to 14 days if no params
  const now = new Date();
  const fromDate = fromParam ? new Date(fromParam) : (() => { const d = new Date(now); d.setDate(d.getDate() - 14); return d; })();
  const toDate = toParam ? new Date(toParam) : now;

  const cacheKey = `analytics:incidents:${fromDate.toISOString().slice(0, 10)}:${toDate.toISOString().slice(0, 10)}`;
  const cachedData = await getCachedJSON<Record<string, unknown>>(cacheKey);
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  // Query Incident table with $facet for all aggregations
  const result = await labelOperation(
    prisma.incident.aggregateRaw({
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
          $facet: {
            byDate: [
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            byCause: [
              {
                $group: {
                  _id: { $ifNull: ['$cause', 'UNKNOWN'] },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],
            byHour: [
              {
                $group: {
                  _id: { $hour: '$createdAt' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            bySeverity: [
              {
                $group: {
                  _id: '$severity',
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            byStatus: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                },
              },
            ],
            totalCount: [
              { $count: 'total' },
            ],
          },
        },
      ],
    }),
    'analytics:enhanced_aggregation'
  );

  const facet = Array.isArray(result) && result.length > 0 ? result[0] : null;
  const byDateRaw = (facet?.byDate ?? []) as { _id: string; count: number }[];
  const byCauseRaw = (facet?.byCause ?? []) as { _id: string; count: number }[];
  const byHourRaw = (facet?.byHour ?? []) as { _id: number; count: number }[];
  const bySeverityRaw = (facet?.bySeverity ?? []) as { _id: number; count: number }[];
  const byStatusRaw = (facet?.byStatus ?? []) as { _id: string; count: number }[];
  const totalCount = (facet?.totalCount?.[0] as { total?: number })?.total ?? 0;

  // Build timeline (fill gaps with 0)
  const reportsByDate: Record<string, number> = {};
  for (const item of byDateRaw) reportsByDate[item._id] = item.count;

  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (86400000));
  const timeline: { date: string; count: number }[] = [];
  for (let i = 0; i < Math.min(daysDiff, 365); i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    timeline.push({ date: key, count: reportsByDate[key] ?? 0 });
  }
  // For ranges > 365d, just use the raw data
  if (daysDiff > 365) {
    timeline.length = 0;
    for (const item of byDateRaw) {
      timeline.push({ date: item._id, count: item.count });
    }
  }

  const causes = byCauseRaw.map((c) => ({ cause: c._id, count: c.count }));

  // Fill hourly 0-23
  const hourMap = new Map(byHourRaw.map((h) => [h._id, h.count]));
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap.get(i) ?? 0 }));

  const severity = bySeverityRaw.map((s) => ({ level: s._id, count: s.count }));
  const statusBreakdown = byStatusRaw.map((s) => ({ status: s._id, count: s.count }));

  const daysWithFires = byDateRaw.length;
  const dailyAverage = daysWithFires > 0 ? (totalCount / daysWithFires).toFixed(1) : '0';

  // Peak hour
  const peakHourEntry = byHourRaw.reduce((best, cur) => (cur.count > (best?.count ?? 0) ? cur : best), byHourRaw[0]);
  const peakHour = peakHourEntry?._id ?? -1;

  // Most common cause
  const mostCommonCause = byCauseRaw[0]?._id ?? 'UNKNOWN';

  // Avg severity
  const totalSeverity = bySeverityRaw.reduce((sum, s) => sum + s._id * s.count, 0);
  const avgSeverity = totalCount > 0 ? (totalSeverity / totalCount).toFixed(1) : '0';

  const responseData = {
    timeline,
    causes,
    hourly,
    severity,
    statusBreakdown,
    stats: {
      totalIncidents: totalCount,
      daysWithFires,
      dailyAverage,
      peakHour,
      mostCommonCause,
      avgSeverity,
    },
    dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
  };

  await cacheJSON(cacheKey, responseData, CACHE_TTL_SECONDS);
  return NextResponse.json(responseData);
});
