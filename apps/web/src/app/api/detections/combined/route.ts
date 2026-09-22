export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { getCachedFirmsDetections, setCachedFirmsDetections, clearFirmsCache } from '@/lib/firms/cache';
import { getCachedEffisDetections, setCachedEffisDetections } from '@/lib/effis/cache';
import { transformFirmsToGeoJSON, isFirmsCSVResponse, getFirmsStats } from '@/lib/firms/transform';
import { fetchFirmsWithFallback, FIRMS_ENDPOINTS } from '@/lib/firms/client';
import { fetchEffisDetections, MIDDLE_ATLAS_BBOX } from '@/lib/effis/client';
import { transformEffisToGeoJSON } from '@/lib/effis/transform';
import { combineDetections } from '@/lib/detections/combiner';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/observability/logger';
import { createFirmsRateLimiter } from '@/lib/ratelimit/slidingWindow';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

const IFRANE_BBOX = {
  minLat: 33.3,
  maxLat: 33.7,
  minLon: -5.3,
  maxLon: -4.9,
};

const FIRMS_CONFIG = {
  source: 'VIIRS_NOAA20_NRT',
  dayRange: 1,
  timeout: 10000,
} as const;

function validateFirmsApiKey(key: string): { valid: boolean; error?: string } {
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    return { valid: false, error: 'Invalid FIRMS MAP_KEY format' };
  }
  return { valid: true };
}

export const GET = withApiHandler(async (request: Request) => {
  // 1. Authentication & Authorization
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (!user.scopes.includes('map:read')) throw new AppError(2001);

  // 1b. Reset circuit breakers if requested
  const url = new URL(request.url);
  const resetRequested = url.searchParams.get('reset') === 'true';
  if (resetRequested) {
    for (const ep of FIRMS_ENDPOINTS) {
      getCircuitBreaker(ep.id).reset();
    }
    getCircuitBreaker('effis-wfs').reset();
    clearFirmsCache();
    logger.info({ event: 'combined_circuit_breaker_reset', meta: { userId: user.userId } });
  }

  // 2. Rate Limiting
  const isOfficial = user.role === 'OFFICIAL';
  const rateLimiter = createFirmsRateLimiter(isOfficial);
  const rateLimit = await rateLimiter.checkLimit(user.userId);

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: {
          code: 1002,
          name: 'RATE_LIMITED',
          userMessage: 'Too many requests. Please wait before trying again.',
        },
      },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(rateLimit.retryAfter || 60));
    return response;
  }

  const headers = new Headers();
  headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));

  // 3. Fetch FIRMS + EFFIS in parallel
  const firmsBbox = `${IFRANE_BBOX.minLon},${IFRANE_BBOX.minLat},${IFRANE_BBOX.maxLon},${IFRANE_BBOX.maxLat}`;
  const effisBbox = MIDDLE_ATLAS_BBOX;

  // Check caches first
  const firmsCached = await getCachedFirmsDetections(firmsBbox, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange);
  const effisCached = await getCachedEffisDetections(effisBbox);

  let firmsData: GeoFeatureCollection<GeoFirmsDetectionProps> | null = firmsCached?.data ?? null;
  let effisData: GeoFeatureCollection<GeoFirmsDetectionProps> | null = effisCached?.data ?? null;
  let detectionSource = 'cache';
  const bothCached = firmsData && effisData;

  if (bothCached) {
    const combined = combineDetections(firmsData!, effisData!);
    const stats = getFirmsStats(combined);
    const response = NextResponse.json(combined);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Detection-Source', 'firms+effis');
    response.headers.set('X-Detection-Count', String(combined.features.length));
    response.headers.set('X-High-Confidence-Count', String(stats.highConfidence));
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  // Fetch missing data in parallel
  const fetchPromises: [
    Promise<GeoFeatureCollection<GeoFirmsDetectionProps> | null>,
    Promise<GeoFeatureCollection<GeoFirmsDetectionProps> | null>,
  ] = [
    // FIRMS fetch
    firmsData
      ? Promise.resolve(firmsData)
      : (async () => {
          const apiKey = process.env.FIRMS_MAP_KEY;
          if (!apiKey) return null;
          const validation = validateFirmsApiKey(apiKey);
          if (!validation.valid) return null;

          try {
            const result = await fetchFirmsWithFallback({
              apiKey,
              source: FIRMS_CONFIG.source,
              bbox: firmsBbox,
              dayRange: FIRMS_CONFIG.dayRange,
              timeoutMs: FIRMS_CONFIG.timeout,
            });
            if (!isFirmsCSVResponse(result.csvText)) return null;
            const geoJSON = transformFirmsToGeoJSON(result.csvText);
            // Tag FIRMS features with source
            geoJSON.features = geoJSON.features.map((f) => ({
              ...f,
              properties: { ...f.properties, source: 'FIRMS' as const },
            }));
            await setCachedFirmsDetections(firmsBbox, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange, geoJSON);
            return geoJSON;
          } catch (error) {
            logger.warn({ event: 'combined_firms_fetch_failed', meta: { error: (error as Error)?.message } });
            return null;
          }
        })(),

    // EFFIS fetch
    effisData
      ? Promise.resolve(effisData)
      : (async () => {
          try {
            const result = await fetchEffisDetections({ bbox: effisBbox });
            const geoJSON = transformEffisToGeoJSON(result.geojson);
            await setCachedEffisDetections(effisBbox, geoJSON);
            return geoJSON;
          } catch (error) {
            logger.warn({ event: 'combined_effis_fetch_failed', meta: { error: (error as Error)?.message } });
            return null;
          }
        })(),
  ];

  const [firmsResult, effisResult] = await Promise.allSettled(fetchPromises);

  firmsData = firmsResult.status === 'fulfilled' ? firmsResult.value : null;
  effisData = effisResult.status === 'fulfilled' ? effisResult.value : null;

  // 4. Determine source and combine
  let responseData: GeoFeatureCollection<GeoFirmsDetectionProps>;

  if (firmsData && effisData) {
    responseData = combineDetections(firmsData, effisData);
    detectionSource = 'firms+effis';
  } else if (firmsData) {
    responseData = firmsData;
    detectionSource = 'firms';
  } else if (effisData) {
    responseData = effisData;
    detectionSource = 'effis';
  } else {
    // Both failed — try returning any available cached data
    const fallbackFirms = await getCachedFirmsDetections(firmsBbox, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange);
    const fallbackEffis = await getCachedEffisDetections(effisBbox);

    if (fallbackFirms || fallbackEffis) {
      if (fallbackFirms && fallbackEffis) {
        responseData = combineDetections(fallbackFirms.data, fallbackEffis.data);
        detectionSource = 'cache';
      } else {
        responseData = (fallbackFirms?.data ?? fallbackEffis?.data)!;
        detectionSource = 'cache';
      }
    } else {
      throw new AppError(4000, {
        message: 'All detection sources failed and no cached data available',
      });
    }
  }

  const stats = getFirmsStats(responseData);

  logger.info({
    event: 'combined_detections_success',
    meta: {
      source: detectionSource,
      totalDetections: responseData.features.length,
      highConfidence: stats.highConfidence,
    },
  });

  const apiResponse = NextResponse.json(responseData);
  apiResponse.headers.set('X-Cache', 'MISS');
  apiResponse.headers.set('X-Detection-Source', detectionSource);
  apiResponse.headers.set('X-Detection-Count', String(responseData.features.length));
  apiResponse.headers.set('X-High-Confidence-Count', String(stats.highConfidence));
  apiResponse.headers.set('X-Recent-Count', String(stats.recentCount));
  apiResponse.headers.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
  headers.forEach((value, key) => apiResponse.headers.set(key, value));

  return apiResponse;
});
