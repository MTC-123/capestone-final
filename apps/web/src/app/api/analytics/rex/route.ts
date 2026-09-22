export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { labelOperation } from '@/lib/errors/context';
import { getCachedJSON, cacheJSON } from '@/lib/cache/redis';

const CACHE_TTL_SECONDS = 5 * 60;

interface RexRecord {
  meansEngaged: {
    vehicleCount?: number;
    aircraftCount?: number;
    personnelCount?: number;
    waterVolumeLiters?: number;
    retardantVolumeLiters?: number;
  } | null;
  economicLoss: {
    forestAreaHa?: number;
    infrastructureDamage?: number;
    agricultureDamage?: number;
    totalEstimate?: number;
  } | null;
  burnAreaHa: number | null;
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

  const cacheKey = `analytics:rex:${fromDate.toISOString().slice(0, 10)}:${toDate.toISOString().slice(0, 10)}`;
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
            meansEngaged: 1,
            economicLoss: 1,
            burnAreaHa: 1,
          },
        },
      ],
    }),
    'analytics:rex_records'
  ) as unknown as RexRecord[];

  let totalVehicles = 0;
  let totalAircraft = 0;
  let totalPersonnel = 0;
  let totalWater = 0;
  let totalRetardant = 0;
  let forestLoss = 0;
  let infraLoss = 0;
  let agriLoss = 0;
  let totalLoss = 0;
  let totalBurnArea = 0;
  let maxBurnArea = 0;
  let burnAreaCount = 0;

  for (const rec of records) {
    if (rec.meansEngaged) {
      totalVehicles += rec.meansEngaged.vehicleCount ?? 0;
      totalAircraft += rec.meansEngaged.aircraftCount ?? 0;
      totalPersonnel += rec.meansEngaged.personnelCount ?? 0;
      totalWater += rec.meansEngaged.waterVolumeLiters ?? 0;
      totalRetardant += rec.meansEngaged.retardantVolumeLiters ?? 0;
    }
    if (rec.economicLoss) {
      forestLoss += rec.economicLoss.forestAreaHa ?? 0;
      infraLoss += rec.economicLoss.infrastructureDamage ?? 0;
      agriLoss += rec.economicLoss.agricultureDamage ?? 0;
      totalLoss += rec.economicLoss.totalEstimate ?? 0;
    }
    if (rec.burnAreaHa != null && rec.burnAreaHa > 0) {
      totalBurnArea += rec.burnAreaHa;
      if (rec.burnAreaHa > maxBurnArea) maxBurnArea = rec.burnAreaHa;
      burnAreaCount++;
    }
  }

  const responseData = {
    totalVehicles,
    totalAircraft,
    totalPersonnel,
    totalWaterLiters: totalWater,
    totalRetardantLiters: totalRetardant,
    economicLoss: {
      forest: forestLoss,
      infrastructure: infraLoss,
      agriculture: agriLoss,
      total: totalLoss,
    },
    burnAreaStats: {
      avg: burnAreaCount > 0 ? totalBurnArea / burnAreaCount : 0,
      max: maxBurnArea,
      total: totalBurnArea,
    },
    recordCount: records.length,
  };

  await cacheJSON(cacheKey, responseData, CACHE_TTL_SECONDS);
  return NextResponse.json(responseData);
});
