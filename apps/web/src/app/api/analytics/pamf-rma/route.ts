export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

/** In-memory cache: 30-minute TTL */
let cachedData: { payload: PamfRmaResponse; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CommuneStats {
  name: string;
  /** Raw fire count for this commune */
  fireCount: number;
  /** Total burned area in hectares for this commune */
  burnedAreaHa: number;
  /** PAMF: fires per year (raw, not area-normalized — client divides by areaKm²) */
  pamf: number;
  /** RMA: burned hectares per year (raw — client divides by forestedAreaHa) */
  rma: number;
}

interface PamfRmaResponse {
  communes: CommuneStats[];
  hasData: boolean;
  /** Number of years covered by the data (for display purposes) */
  yearSpan: number;
}

interface LocationDetail {
  commune?: string;
  [key: string]: unknown;
}

export const GET = withApiHandler(async (request) => {
  // Auth check
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (!user.scopes.includes('analytics:read')) throw new AppError(2001);

  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json(cachedData.payload);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'private, s-maxage=1800, stale-while-revalidate=300');
    return response;
  }

  // Fetch all fire event records with relevant fields
  const records = await prisma.fireEventRecord.findMany({
    select: {
      locationDetail: true,
      burnAreaHa: true,
      alertReceivedAt: true,
    },
  });

  if (records.length === 0) {
    const payload: PamfRmaResponse = { communes: [], hasData: false, yearSpan: 1 };
    cachedData = { payload, timestamp: Date.now() };
    return NextResponse.json(payload);
  }

  // Determine year span from min/max alertReceivedAt
  const alertDates = records
    .map((r) => r.alertReceivedAt)
    .filter((d): d is Date => d !== null && d !== undefined);

  let yearSpan = 1;
  if (alertDates.length >= 2) {
    const minDate = new Date(
      Math.min(...alertDates.map((d) => d.getTime()))
    );
    const maxDate = new Date(
      Math.max(...alertDates.map((d) => d.getTime()))
    );
    const diffYears =
      (maxDate.getTime() - minDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    yearSpan = Math.max(1, diffYears);
  }

  // Aggregate by commune
  const communeMap = new Map<string, { fires: number; burnedArea: number }>();

  for (const record of records) {
    const location = record.locationDetail as LocationDetail | null;
    const commune = location?.commune ?? 'Unknown';
    const burnArea = record.burnAreaHa ?? 0;

    const existing = communeMap.get(commune);
    if (existing) {
      existing.fires += 1;
      existing.burnedArea += burnArea;
    } else {
      communeMap.set(commune, { fires: 1, burnedArea: burnArea });
    }
  }

  // Compute per-year values (client will normalize by area using GeoJSON properties)
  const communes: CommuneStats[] = Array.from(communeMap.entries())
    .map(([name, data]) => ({
      name,
      fireCount: data.fires,
      burnedAreaHa: +data.burnedArea.toFixed(2),
      pamf: +(data.fires / yearSpan).toFixed(4),
      rma: +(data.burnedArea / yearSpan).toFixed(4),
    }))
    .sort((a, b) => b.pamf - a.pamf);

  const payload: PamfRmaResponse = { communes, hasData: true, yearSpan: +yearSpan.toFixed(2) };

  cachedData = { payload, timestamp: Date.now() };

  const response = NextResponse.json(payload);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'private, s-maxage=1800, stale-while-revalidate=300');
  return response;
});
