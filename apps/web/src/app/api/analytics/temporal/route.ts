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

  const now = new Date();
  const fromDate = fromParam ? new Date(fromParam) : (() => { const d = new Date(now); d.setDate(d.getDate() - 30); return d; })();
  const toDate = toParam ? new Date(toParam) : now;

  const cacheKey = `analytics:temporal:${fromDate.toISOString().slice(0, 10)}:${toDate.toISOString().slice(0, 10)}`;
  const cached = await getCachedJSON<Record<string, unknown>>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000);

  // Auto-switch bucket size for large ranges
  let dateFormat = '%Y-%m-%d';
  if (daysDiff > 365) dateFormat = '%Y-%m';
  else if (daysDiff > 90) dateFormat = '%Y-W%V';

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
                  _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
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
            monthlyHeatmap: [
              {
                $group: {
                  _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
            ],
          },
        },
      ],
    }),
    'analytics:temporal_aggregation'
  );

  const facet = Array.isArray(result) && result.length > 0 ? result[0] : null;
  const byDateRaw = (facet?.byDate ?? []) as { _id: string; count: number }[];
  const byHourRaw = (facet?.byHour ?? []) as { _id: number; count: number }[];
  const heatmapRaw = (facet?.monthlyHeatmap ?? []) as { _id: { year: number; month: number }; count: number }[];

  const hourMap = new Map(byHourRaw.map((h) => [h._id, h.count]));
  const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap.get(i) ?? 0 }));

  const responseData = {
    byDate: byDateRaw.map((d) => ({ date: d._id, count: d.count })),
    byHour,
    monthlyHeatmap: heatmapRaw.map((h) => ({ year: h._id.year, month: h._id.month, count: h.count })),
  };

  await cacheJSON(cacheKey, responseData, CACHE_TTL_SECONDS);
  return NextResponse.json(responseData);
});
