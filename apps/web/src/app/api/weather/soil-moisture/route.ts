export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * Soil moisture grid for Ifrane Province via Open-Meteo.
 * Returns GeoJSON FeatureCollection with circle points carrying
 * surface / root / deep moisture values (m³/m³).
 * Grid: 9×9 = 81 points at ~0.1° spacing over Ifrane Province.
 * Cache: 5 minutes stale-while-revalidate.  No API key needed.
 */

const IFRANE_BBOX = {
  latMin: 33.0,
  latMax: 33.8,
  lonMin: -5.6,
  lonMax: -4.8,
};

const GRID_SIZE = 9;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: { geojson: object; timestamp: number } | null = null;

function generateGrid(): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  const lons: number[] = [];
  const latStep = (IFRANE_BBOX.latMax - IFRANE_BBOX.latMin) / (GRID_SIZE - 1);
  const lonStep = (IFRANE_BBOX.lonMax - IFRANE_BBOX.lonMin) / (GRID_SIZE - 1);

  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      lats.push(+(IFRANE_BBOX.latMin + i * latStep).toFixed(2));
      lons.push(+(IFRANE_BBOX.lonMin + j * lonStep).toFixed(2));
    }
  }
  return { lats, lons };
}

interface HourlyData {
  time: string[];
  soil_moisture_0_to_1cm?: (number | null)[];
  soil_moisture_1_to_3cm?: (number | null)[];
  soil_moisture_3_to_9cm?: (number | null)[];
  soil_moisture_9_to_27cm?: (number | null)[];
  soil_moisture_27_to_81cm?: (number | null)[];
}

interface LocationResult {
  latitude: number;
  longitude: number;
  hourly: HourlyData;
}

function pickCurrentHourIndex(times: string[]): number {
  const now = Date.now();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function classifyMoisture(val: number): string {
  if (val < 0.1) return 'Dry';
  if (val < 0.2) return 'Low';
  if (val < 0.3) return 'Normal';
  return 'Wet';
}

async function fetchWithRetry(url: string): Promise<Response> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) {
    // Rate limited — retry once after 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
    return fetch(url, { signal: AbortSignal.timeout(15_000) });
  }
  return res;
}

export const GET = withApiHandler(async () => {
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json(cachedData.geojson);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return response;
  }

  const { lats, lons } = generateGrid();

  const apiUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats.join(',')}` +
    `&longitude=${lons.join(',')}` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm` +
    `&forecast_days=1` +
    `&timezone=auto`;

  let res: Response;
  try {
    res = await fetchWithRetry(apiUrl);
  } catch (error) {
    console.error('[soil-moisture] Open-Meteo fetch failed:', error);
    return NextResponse.json(
      { error: 'Soil moisture data temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[soil-moisture] Open-Meteo HTTP ${res.status}:`, body);
    return NextResponse.json(
      { error: 'Soil moisture data temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const raw: unknown = await res.json();

  // Open-Meteo multi-location returns an array
  const results: LocationResult[] = Array.isArray(raw) ? raw : [raw as LocationResult];

  const features: object[] = [];
  for (const loc of results) {
    if (!loc.hourly?.time?.length) continue;
    const idx = pickCurrentHourIndex(loc.hourly.time);

    const surface = loc.hourly.soil_moisture_0_to_1cm?.[idx];
    const root = loc.hourly.soil_moisture_9_to_27cm?.[idx];
    const deep = loc.hourly.soil_moisture_27_to_81cm?.[idx];

    // Skip points with all null values
    if (surface == null && root == null && deep == null) continue;

    const s = surface ?? 0;
    const r = root ?? 0;
    const d = deep ?? 0;

    features.push({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [loc.longitude, loc.latitude],
      },
      properties: {
        surface: s,
        root: r,
        deep: d,
        surfaceClass: classifyMoisture(s),
        rootClass: classifyMoisture(r),
        deepClass: classifyMoisture(d),
        lat: loc.latitude,
        lon: loc.longitude,
      },
    });
  }

  const geojson = { type: 'FeatureCollection' as const, features };

  cachedData = { geojson, timestamp: Date.now() };

  const response = NextResponse.json(geojson);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return response;
});
