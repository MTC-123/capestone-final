export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { IFRANE_COORDINATES } from '@/config/constants';
import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { getCachedJSON, cacheJSON } from '@/lib/cache/redis';

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

interface OpenMeteoHistoryResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    precipitation_sum: (number | null)[];
    relative_humidity_2m_mean?: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

function isValidResponse(v: unknown): v is OpenMeteoHistoryResponse {
  if (!v || typeof v !== 'object') return false;
  const daily = (v as { daily?: unknown }).daily;
  if (!daily || typeof daily !== 'object') return false;
  const d = daily as Record<string, unknown>;
  return Array.isArray(d.time) && Array.isArray(d.temperature_2m_max);
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

  // Clamp to yesterday max for historical API
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const effectiveTo = toDate > yesterday ? yesterday : toDate;

  // Minimum 2 days between from and to
  if (effectiveTo.getTime() - fromDate.getTime() < 86400000 * 2) {
    return NextResponse.json({ dates: [], temperatureMax: [], precipitation: [], humidityMean: [], windSpeedMax: [] });
  }

  const startStr = fromDate.toISOString().split('T')[0];
  const endStr = effectiveTo.toISOString().split('T')[0];

  const cacheKey = `analytics:weather-history:${startStr}:${endStr}`;
  const cached = await getCachedJSON<Record<string, unknown>>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const breaker = getCircuitBreaker('open-meteo-history');
  if (!breaker.canRequest()) {
    throw new AppError(4002, { message: 'Weather history service temporarily unavailable' });
  }

  const { lat, lng } = IFRANE_COORDINATES;
  const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max&timezone=Africa/Casablanca`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      breaker.onFailure();
      throw new AppError(4001, { message: `Weather history API error: ${res.status}` });
    }

    const data: unknown = await res.json();
    if (!isValidResponse(data)) {
      breaker.onFailure();
      throw new AppError(4001, { message: 'Invalid weather history response' });
    }

    breaker.onSuccess();

    const responseData = {
      dates: data.daily.time,
      temperatureMax: data.daily.temperature_2m_max,
      precipitation: data.daily.precipitation_sum,
      humidityMean: data.daily.relative_humidity_2m_mean ?? data.daily.time.map(() => null),
      windSpeedMax: data.daily.wind_speed_10m_max,
    };

    await cacheJSON(cacheKey, responseData, CACHE_TTL_SECONDS);
    return NextResponse.json(responseData);
  } catch (error) {
    breaker.onFailure();
    if (error instanceof AppError) throw error;
    throw new AppError(4001, { message: 'Weather history fetch failed' });
  }
});
