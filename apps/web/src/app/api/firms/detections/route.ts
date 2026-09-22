export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { getCircuitBreaker } from '@/lib/platform/circuitBreaker';
import { getCachedFirmsDetections, setCachedFirmsDetections, clearFirmsCache } from '@/lib/firms/cache';
import { transformFirmsToGeoJSON, isFirmsCSVResponse, getFirmsStats } from '@/lib/firms/transform';
import { fetchFirmsWithFallback, FIRMS_ENDPOINTS } from '@/lib/firms/client';
import { captureExternalApiError } from '@/lib/errors/context';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/observability/logger';
import { createFirmsRateLimiter } from '@/lib/ratelimit/slidingWindow';
import { fetchEffisDetections, MIDDLE_ATLAS_BBOX } from '@/lib/effis/client';

/**
 * Ifrane region bounding box with 10km buffer (±0.1° ≈ 11km)
 *
 * Coverage Area:
 * - Core: 33.4°N - 33.6°N, -5.2°W - -5.0°W (Ifrane city center)
 * - Buffer: 33.3°N - 33.7°N, -5.3°W - -4.9°W (±10km for early detection)
 *
 * The buffer zone extends beyond the city limits to capture fires that may
 * spread toward Ifrane, enabling proactive wildfire risk assessment.
 *
 * To expand coverage to other regions:
 * 1. Update IFRANE_BBOX coordinates below with new region's bounds
 * 2. Consider renaming constant to COVERAGE_BBOX or REGION_BBOX
 * 3. Update translation keys if region name changes (firmsDetections, etc.)
 * 4. Test with different bbox sizes - larger areas return more data:
 *    - Small region (<0.5° span): ~50-200 detections/day
 *    - Medium region (0.5-1° span): ~200-1000 detections/day
 *    - Large region (>1° span): May exceed API limits, consider splitting
 *
 * Note: FIRMS API supports multiple bbox formats:
 * - CSV format (current): "west,south,east,north" (e.g., "-5.3,33.3,-4.9,33.7")
 * - WKT format: "POLYGON((lon1 lat1, lon2 lat2, ...))"
 * - GeoJSON format: {"type":"Polygon","coordinates":[[[lon,lat],...]]}
 *
 * For multiple regions, consider:
 * - Making bbox a query parameter for dynamic region selection
 * - Creating separate API endpoints per region (/api/firms/ifrane, /api/firms/fez)
 * - Using a database table to store region configurations
 */
const IFRANE_BBOX = {
  minLat: 33.3,
  maxLat: 33.7,
  minLon: -5.3,
  maxLon: -4.9,
};

const FIRMS_CONFIG = {
  source: 'VIIRS_NOAA20_NRT', // VIIRS from NOAA-20 satellite (375m resolution, ~3hr updates)
  dayRange: 1, // Last 24 hours of detections
  timeout: 10000, // 10 second timeout
} as const;

/**
 * Validate NASA FIRMS API key format
 * MAP_KEY must be a 32-character hexadecimal string
 */
function validateFirmsApiKey(key: string): { valid: boolean; error?: string } {
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    return {
      valid: false,
      error: 'Invalid format - NASA FIRMS MAP_KEY must be 32 hexadecimal characters'
    };
  }
  return { valid: true };
}

export const GET = withApiHandler(async (request: Request) => {
  // 1. Authentication & Authorization
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000); // Unauthorized
  if (!user.scopes.includes('map:read')) throw new AppError(2001); // Forbidden

  // 1b. Reset circuit breaker if requested (e.g. user clicked "Retry")
  const url = new URL(request.url);
  const resetRequested = url.searchParams.get('reset') === 'true';
  if (resetRequested) {
    for (const ep of FIRMS_ENDPOINTS) {
      getCircuitBreaker(ep.id).reset();
    }
    clearFirmsCache();
    logger.info({ event: 'firms_circuit_breaker_reset', meta: { userId: user.userId } });
  }

  // 2. Rate Limiting (10 req/min for civilians, 100 req/min for officials)
  const isOfficial = user.role === 'OFFICIAL';
  const rateLimiter = createFirmsRateLimiter(isOfficial);
  const rateLimit = await rateLimiter.checkLimit(user.userId);

  if (!rateLimit.allowed) {
    logger.warn({
      event: 'firms_rate_limited',
      meta: {
        userId: user.userId,
        role: user.role,
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    });

    const response = NextResponse.json(
      {
        error: {
          code: 1002,
          name: 'RATE_LIMITED',
          userMessage: 'Too many requests. Please wait before trying again.',
          developerMessage: `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds.`,
        },
      },
      { status: 429 }
    );

    response.headers.set('X-RateLimit-Limit', String(isOfficial ? 100 : 10));
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));
    response.headers.set('Retry-After', String(rateLimit.retryAfter || 60));

    return response;
  }

  // Set rate limit headers on successful requests
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', String(isOfficial ? 100 : 10));
  headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));

  // 3. Validate API key configuration
  const apiKey = process.env.FIRMS_MAP_KEY;
  if (!apiKey) {
    logger.error({
      event: 'firms_api_key_missing',
      meta: { message: 'FIRMS_MAP_KEY environment variable not set' }
    });
    throw new AppError(5001, {
      message: 'FIRMS_MAP_KEY environment variable not configured',
      meta: { missingVar: 'FIRMS_MAP_KEY' },
    });
  }

  // Validate API key format
  const validation = validateFirmsApiKey(apiKey);
  if (!validation.valid) {
    logger.error({
      event: 'firms_api_key_invalid_format',
      meta: { error: validation.error }
    });
    throw new AppError(5004, {
      message: validation.error,
      meta: {
        hint: 'Obtain a valid API key from https://firms.modaps.eosdis.nasa.gov/api/area/',
        expectedFormat: '32 hexadecimal characters (a-f, 0-9)'
      }
    });
  }

  const bboxString = `${IFRANE_BBOX.minLon},${IFRANE_BBOX.minLat},${IFRANE_BBOX.maxLon},${IFRANE_BBOX.maxLat}`;

  // 3. Try cache first (15-minute TTL)
  const cached = await getCachedFirmsDetections(bboxString, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange);
  if (cached) {
    const stats = getFirmsStats(cached.data);
    const response = NextResponse.json(cached.data);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Age', String(Math.floor((Date.now() - cached.cachedAt) / 1000)));
    response.headers.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300'); // 15min + 5min stale
    response.headers.set('X-Detection-Count', String(cached.data.features.length));
    response.headers.set('X-High-Confidence-Count', String(stats.highConfidence));
    response.headers.set('X-Recent-Count', String(stats.recentCount));
    // Add rate limit headers
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  // 4. Fetch from FIRMS API with multi-endpoint fallback, then EFFIS if all FIRMS fail
  let result;

  try {
    result = await fetchFirmsWithFallback({
      apiKey,
      source: FIRMS_CONFIG.source,
      bbox: bboxString,
      dayRange: FIRMS_CONFIG.dayRange,
      timeoutMs: FIRMS_CONFIG.timeout,
    });
  } catch (firmsError) {
    // FIRMS completely failed — try EFFIS as fallback
    logger.warn({
      event: 'firms_failed_trying_effis',
      meta: { firmsError: (firmsError as Error)?.message },
    });

    try {
      const effisResult = await fetchEffisDetections({ bbox: MIDDLE_ATLAS_BBOX });

      // Normalize EFFIS GeoJSON to match FIRMS structure
      const effisGeo = effisResult.geojson as { features?: { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }[] };
      const geoJSON = {
        type: 'FeatureCollection' as const,
        features: (effisGeo?.features ?? []).map((f) => ({
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: {
            ...f.properties,
            _source: 'effis' as const,
          },
        })),
      };

      const normalizedGeoJSON = geoJSON as unknown as Parameters<typeof getFirmsStats>[0];
      const stats = getFirmsStats(normalizedGeoJSON);
      await setCachedFirmsDetections(bboxString, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange, normalizedGeoJSON);

      logger.info({
        event: 'effis_fallback_success',
        meta: { detections: geoJSON.features.length, durationMs: Math.round(effisResult.durationMs) },
      });

      const apiResponse = NextResponse.json(geoJSON);
      apiResponse.headers.set('X-Cache', 'MISS');
      apiResponse.headers.set('X-Data-Source', 'effis-fallback');
      apiResponse.headers.set('X-Detection-Count', String(geoJSON.features.length));
      apiResponse.headers.set('X-High-Confidence-Count', String(stats.highConfidence));
      apiResponse.headers.set('X-Recent-Count', String(stats.recentCount));
      headers.forEach((value, key) => apiResponse.headers.set(key, value));
      return apiResponse;
    } catch (effisError) {
      logger.error({
        event: 'all_fire_sources_failed',
        meta: {
          firmsError: (firmsError as Error)?.message,
          effisError: (effisError as Error)?.message,
        },
      });
      throw firmsError; // Re-throw original FIRMS error
    }
  }

  // 5. Validate CSV response
  if (!isFirmsCSVResponse(result.csvText)) {
    logger.error({
      event: 'firms_invalid_response',
      meta: {
        bodyLength: result.csvText.length,
        bodyPreview: result.csvText.slice(0, 200),
        endpointUsed: result.endpointUsed,
      },
    });

    throw captureExternalApiError(
      {
        provider: result.endpointUsed,
        url: 'REDACTED',
        method: 'GET',
        startedAt: performance.now() - result.durationMs,
        durationMs: result.durationMs,
      },
      new Error('Invalid FIRMS API response structure - expected CSV format')
    );
  }

  // 6. Transform CSV to GeoJSON
  const geoJSON = transformFirmsToGeoJSON(result.csvText);
  const stats = getFirmsStats(geoJSON);

  // 7. Cache successful response
  await setCachedFirmsDetections(bboxString, FIRMS_CONFIG.source, FIRMS_CONFIG.dayRange, geoJSON);

  logger.info({
    event: 'firms_fetch_success',
    meta: {
      detections: geoJSON.features.length,
      highConfidence: stats.highConfidence,
      avgFRP: stats.avgFRP,
      duration: Math.round(result.durationMs),
      endpointUsed: result.endpointUsed,
      attemptsMade: result.attemptsMade,
    },
  });

  // 8. Return successful response with metadata headers
  const apiResponse = NextResponse.json(geoJSON);
  apiResponse.headers.set('X-Cache', 'MISS');
  apiResponse.headers.set('X-Data-Source', 'firms');
  apiResponse.headers.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
  apiResponse.headers.set('X-Detection-Count', String(geoJSON.features.length));
  apiResponse.headers.set('X-High-Confidence-Count', String(stats.highConfidence));
  apiResponse.headers.set('X-Recent-Count', String(stats.recentCount));
  apiResponse.headers.set('X-API-Duration-Ms', String(Math.round(result.durationMs)));
  apiResponse.headers.set('X-Endpoint-Used', result.endpointUsed);
  apiResponse.headers.set('X-Fetch-Attempts', String(result.attemptsMade));
  // Add rate limit headers
  headers.forEach((value, key) => apiResponse.headers.set(key, value));
  apiResponse.headers.set('X-Avg-FRP', String(stats.avgFRP));

  return apiResponse;
});

// Cache management endpoints (for admin/debugging)
export const DELETE = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const { clearFirmsCache, getFirmsCacheStats } = await import('@/lib/firms/cache');
  const statsBefore = getFirmsCacheStats();
  clearFirmsCache();

  logger.info({
    event: 'firms_cache_manual_clear',
    meta: { clearedBy: user.cin, ...statsBefore }
  });

  return NextResponse.json({
    message: 'FIRMS cache cleared',
    cleared: statsBefore
  });
});
