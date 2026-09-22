export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/** In-memory cache: 24-hour TTL */
let cachedData: { date: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const GIBS_TILE_URL = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${date}/GoogleMapsCompatible_Level9/4/4/6.png`;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const GET = withApiHandler(async () => {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json({ date: cachedData.date });
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return response;
  }

  const today = new Date();
  let foundDate: string | null = null;

  // Probe backwards from today in 8-day steps (MODIS NDVI 8-day composites)
  for (let attempt = 0; attempt < 4; attempt++) {
    const probeDate = new Date(today);
    probeDate.setDate(probeDate.getDate() - attempt * 8);
    const dateStr = formatDate(probeDate);

    try {
      const res = await fetch(GIBS_TILE_URL(dateStr), { method: 'HEAD' });
      if (res.ok) {
        foundDate = dateStr;
        break;
      }
    } catch {
      // Network error — try next date
    }
  }

  // Fallback: 16 days ago if all probes fail
  if (!foundDate) {
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() - 16);
    foundDate = formatDate(fallback);
  }

  cachedData = { date: foundDate, timestamp: Date.now() };

  const response = NextResponse.json({ date: foundDate });
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  return response;
});
