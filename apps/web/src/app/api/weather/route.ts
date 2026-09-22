export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { IFRANE_COORDINATES } from '@/config/constants';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { getCachedWeather, setCachedWeather } from '@/lib/weather/cache';
import { captureExternalApiError, type ExternalApiContext } from '@/lib/errors/context';

type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    time: string;
  };
};

function isOpenMeteoResponse(value: unknown): value is OpenMeteoResponse {
  if (!value || typeof value !== 'object') return false;
  const current = (value as { current?: unknown }).current;
  if (!current || typeof current !== 'object') return false;
  const c = current as Record<string, unknown>;
  return (
    typeof c.temperature_2m === 'number' &&
    typeof c.wind_speed_10m === 'number' &&
    typeof c.wind_direction_10m === 'number' &&
    typeof c.time === 'string'
  );
}

export const GET = withApiHandler(async () => {
  const { lat, lng } = IFRANE_COORDINATES;
  const breaker = getCircuitBreaker('open-meteo');

  // Try cache first
  const cached = await getCachedWeather(lat, lng);
  if (cached) {
    const response = NextResponse.json(cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return response;
  }

  // Check circuit breaker
  if (!breaker.canRequest()) {
    throw new AppError(4002, {
      meta: { reason: 'circuit_breaker_open' },
      message: 'Weather service temporarily unavailable'
    });
  }

  // Fetch from API
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=Africa/Casablanca`;
  const apiContext: ExternalApiContext = {
    provider: 'open-meteo',
    url: apiUrl,
    method: 'GET',
    startedAt: performance.now(),
  };

  try {
    const response = await fetch(apiUrl);
    apiContext.responseStatus = response.status;
    apiContext.responseHeaders = Object.fromEntries(response.headers.entries());
    apiContext.durationMs = performance.now() - apiContext.startedAt;

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      apiContext.responseBodyPreview = bodyText.slice(0, 500);
      breaker.onFailure();
      throw captureExternalApiError(apiContext, new Error(`HTTP ${response.status}`));
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      const bodyText = await response.text().catch(() => '');
      apiContext.responseBodyPreview = bodyText.slice(0, 500);
      breaker.onFailure();
      throw captureExternalApiError(apiContext, error);
    }

    if (!isOpenMeteoResponse(data)) {
      apiContext.responseBodyPreview = JSON.stringify(data).slice(0, 500);
      breaker.onFailure();
      throw captureExternalApiError(
        apiContext,
        new Error('Invalid API response structure')
      );
    }

    const weatherData = {
      temperature: data.current.temperature_2m,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      timestamp: data.current.time,
    };

    // Cache successful response
    await setCachedWeather(lat, lng, weatherData);
    breaker.onSuccess();

    const apiResponse = NextResponse.json(weatherData);
    apiResponse.headers.set('X-Cache', 'MISS');
    apiResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return apiResponse;
  } catch (error) {
    breaker.onFailure();
    if (error instanceof AppError) throw error;
    throw captureExternalApiError(apiContext, error);
  }
});
