export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { getCachedEffisDetections, setCachedEffisDetections } from '@/lib/effis/cache';
import { fetchEffisDetections, MIDDLE_ATLAS_BBOX } from '@/lib/effis/client';
import { transformEffisToGeoJSON } from '@/lib/effis/transform';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/observability/logger';

export const GET = withApiHandler(async (request: Request) => {
  // 1. Authentication
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (!user.scopes.includes('map:read')) throw new AppError(2001);

  const bbox = MIDDLE_ATLAS_BBOX;

  // 2. Try cache first (15-minute TTL)
  const cached = await getCachedEffisDetections(bbox);
  if (cached) {
    const response = NextResponse.json(cached.data);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Cache-Age', String(Math.floor((Date.now() - cached.cachedAt) / 1000)));
    response.headers.set('X-Detection-Count', String(cached.data.features.length));
    response.headers.set('X-Detection-Source', 'effis');
    return response;
  }

  // 3. Fetch from EFFIS WFS
  const result = await fetchEffisDetections({ bbox });

  // 4. Transform to normalized GeoJSON
  const geoJSON = transformEffisToGeoJSON(result.geojson);

  // 5. Cache successful response
  await setCachedEffisDetections(bbox, geoJSON);

  logger.info({
    event: 'effis_fetch_success',
    meta: {
      detections: geoJSON.features.length,
      duration: Math.round(result.durationMs),
      attemptsMade: result.attemptsMade,
    },
  });

  const apiResponse = NextResponse.json(geoJSON);
  apiResponse.headers.set('X-Cache', 'MISS');
  apiResponse.headers.set('X-Detection-Count', String(geoJSON.features.length));
  apiResponse.headers.set('X-Detection-Source', 'effis');
  apiResponse.headers.set('X-API-Duration-Ms', String(Math.round(result.durationMs)));
  return apiResponse;
});
