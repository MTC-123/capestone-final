export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/** In-memory cache: 6-hour TTL */
let cachedData: { payload: PrecipitationData; timestamp: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Ifrane monthly normal: ~30mm/month average */
const IFRANE_MONTHLY_NORMAL_MM = 30;

interface PrecipitationData {
  dates: string[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  cumulative: number[];
  stats: {
    rainfall30d: number;
    daysSinceRain: number;
    deficitPercent: number;
    totalPrecipitation90d: number;
  };
}

interface OpenMeteoArchiveResponse {
  daily?: {
    time?: string[];
    precipitation_sum?: number[];
    rain_sum?: number[];
    snowfall_sum?: number[];
  };
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isValidResponse(data: unknown): data is OpenMeteoArchiveResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const daily = d.daily as Record<string, unknown> | undefined;
  if (!daily || typeof daily !== 'object') return false;
  return (
    Array.isArray(daily.time) &&
    Array.isArray(daily.precipitation_sum) &&
    Array.isArray(daily.rain_sum) &&
    Array.isArray(daily.snowfall_sum)
  );
}

export const GET = withApiHandler(async () => {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json(cachedData.payload);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=1800');
    return response;
  }

  const today = new Date();
  const endDate = formatDate(today);
  const startDateObj = new Date(today);
  startDateObj.setDate(startDateObj.getDate() - 90);
  const startDate = formatDate(startDateObj);

  const apiUrl =
    `https://archive-api.open-meteo.com/v1/archive?latitude=33.5275&longitude=-5.1056` +
    `&daily=precipitation_sum,rain_sum,snowfall_sum&timezone=auto` +
    `&start_date=${startDate}&end_date=${endDate}`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Open-Meteo archive returned HTTP ${res.status}`);
  }

  const data: unknown = await res.json();

  if (!isValidResponse(data)) {
    throw new Error('Invalid Open-Meteo archive response structure');
  }

  const daily = data.daily!;
  const dates = daily.time!;
  const precipitation = daily.precipitation_sum!.map((v) => v ?? 0);
  const rain = daily.rain_sum!.map((v) => v ?? 0);
  const snowfall = daily.snowfall_sum!.map((v) => v ?? 0);

  // Build cumulative running total
  const cumulative: number[] = [];
  let runningTotal = 0;
  for (const val of precipitation) {
    runningTotal += val;
    cumulative.push(+runningTotal.toFixed(2));
  }

  // Last 30 days rainfall
  const last30 = precipitation.slice(-30);
  const rainfall30d = +last30.reduce((sum, v) => sum + v, 0).toFixed(2);

  // Days since rain: count backwards from today to last day with precipitation > 0.1mm
  let daysSinceRain = 0;
  for (let i = precipitation.length - 1; i >= 0; i--) {
    if (precipitation[i] > 0.1) break;
    daysSinceRain++;
  }

  // Deficit percent: compare rainfall30d against Ifrane monthly normal (~30mm/month)
  const deficitPercent = Math.round(
    Math.max(0, (1 - rainfall30d / IFRANE_MONTHLY_NORMAL_MM) * 100)
  );

  // Total precipitation over the 90-day window
  const totalPrecipitation90d = +precipitation
    .reduce((sum, v) => sum + v, 0)
    .toFixed(2);

  const payload: PrecipitationData = {
    dates,
    precipitation,
    rain,
    snowfall,
    cumulative,
    stats: {
      rainfall30d,
      daysSinceRain,
      deficitPercent,
      totalPrecipitation90d,
    },
  };

  cachedData = { payload, timestamp: Date.now() };

  const response = NextResponse.json(payload);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=1800');
  return response;
});
