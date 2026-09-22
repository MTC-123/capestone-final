export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * WorldPop population density tile proxy.
 *
 * Proxies requests to WorldPop ArcGIS ImageServer to:
 * 1. Avoid CORS issues in the browser
 * 2. Add long-lived cache headers (population data is static)
 * 3. Return transparent fallback tile on error
 *
 * Query params:
 *   bbox – EPSG:3857 bbox as "minx,miny,maxx,maxy"
 */

const WP_TIMEOUT_MS = 10_000;

// 1px transparent PNG for error fallback
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAxJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
  'base64',
);

export const GET = withApiHandler(async (request) => {
  const url = new URL(request.url);
  const bboxStr = url.searchParams.get('bbox');

  if (!bboxStr) {
    return new NextResponse('Missing bbox parameter', { status: 400 });
  }

  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return new NextResponse('Invalid bbox format', { status: 400 });
  }

  const wpUrl =
    `https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_1km/ImageServer/exportImage` +
    `?bbox=${bboxStr}&bboxSR=3857&size=256,256&imageSR=3857&format=png&f=image`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WP_TIMEOUT_MS);

    const wpResponse = await fetch(wpUrl, {
      signal: controller.signal,
      headers: { Accept: 'image/png, image/*' },
    });

    clearTimeout(timeout);

    const contentType = wpResponse.headers.get('content-type') || '';

    // ArcGIS may return JSON error instead of image
    if (contentType.includes('json') || contentType.includes('text/html')) {
      const errorText = await wpResponse.text();
      console.error('[WorldPop] Non-image response:', errorText.slice(0, 300));
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
          'X-WorldPop-Error': 'non-image-response',
        },
      });
    }

    if (!wpResponse.ok) {
      console.error('[WorldPop] HTTP error:', wpResponse.status);
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
          'X-WorldPop-Error': `HTTP ${wpResponse.status}`,
        },
      });
    }

    const imageBuffer = await wpResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType.includes('image') ? contentType : 'image/png',
        // Population data is static — cache for 24 hours
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout) {
      console.error('[WorldPop] Request timed out after', WP_TIMEOUT_MS, 'ms');
    } else {
      console.error('[WorldPop] Fetch error:', err instanceof Error ? err.message : err);
    }

    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
        'X-WorldPop-Error': isTimeout ? 'timeout' : 'fetch-error',
      },
    });
  }
});
