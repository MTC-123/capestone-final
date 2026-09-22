export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * EFFIS WMS tile proxy.
 *
 * Proxies requests to EFFIS WMS to:
 * 1. Avoid CORS issues in the browser
 * 2. Convert EPSG:3857 bbox to EPSG:4326 for WMS 1.1.1
 * 3. Detect XML/HTML error responses and return a transparent tile instead
 * 4. Add server-side caching headers (FWI data updates ~6-hourly)
 *
 * Query params:
 *   layer  – WMS layer name (default: mf010.fwi)
 *   bbox   – EPSG:3857 bbox as "minx,miny,maxx,maxy"
 *   width  – tile width (default: 256)
 *   height – tile height (default: 256)
 *   time   – ISO date string for TIME parameter (e.g. "2026-03-06")
 */

const ALLOWED_LAYERS = new Set([
  'mf010.fwi',
  'mf010.ranking',
  'modis.ba',
  'modis.ba.season',
  'modis.ba.week',
  'modis.ba.month',
]);

const WMS_TIMEOUT_MS = 15_000;

// 1px transparent PNG for error fallback
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAxJREFUCNdjYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==',
  'base64',
);

/** Convert EPSG:3857 (Web Mercator) meters to EPSG:4326 (lon/lat degrees) */
function epsg3857ToEpsg4326(x: number, y: number): [number, number] {
  const lon = (x / 20037508.342789244) * 180;
  let lat = (y / 20037508.342789244) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lon, lat];
}

export const GET = withApiHandler(async (request) => {
  const url = new URL(request.url);
  const layer = url.searchParams.get('layer') || 'mf010.fwi';
  const bboxStr = url.searchParams.get('bbox');
  const width = url.searchParams.get('width') || '256';
  const height = url.searchParams.get('height') || '256';
  const time = url.searchParams.get('time');

  if (!ALLOWED_LAYERS.has(layer)) {
    return new NextResponse('Invalid layer', { status: 400 });
  }

  if (!bboxStr) {
    return new NextResponse('Missing bbox parameter', { status: 400 });
  }

  // Parse EPSG:3857 bbox and convert to EPSG:4326
  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return new NextResponse('Invalid bbox format', { status: 400 });
  }

  const [minLon, minLat] = epsg3857ToEpsg4326(parts[0], parts[1]);
  const [maxLon, maxLat] = epsg3857ToEpsg4326(parts[2], parts[3]);

  // WMS 1.1.1 with SRS=EPSG:4326 uses lon,lat order (minx,miny,maxx,maxy)
  const wmsUrl = new URL('https://maps.effis.emergency.copernicus.eu/effis');
  wmsUrl.searchParams.set('SERVICE', 'WMS');
  wmsUrl.searchParams.set('VERSION', '1.1.1');
  wmsUrl.searchParams.set('REQUEST', 'GetMap');
  wmsUrl.searchParams.set('LAYERS', layer);
  wmsUrl.searchParams.set('STYLES', '');
  wmsUrl.searchParams.set('FORMAT', 'image/png');
  wmsUrl.searchParams.set('TRANSPARENT', 'true');
  wmsUrl.searchParams.set('SRS', 'EPSG:4326');
  wmsUrl.searchParams.set('BBOX', `${minLon},${minLat},${maxLon},${maxLat}`);
  wmsUrl.searchParams.set('WIDTH', width);
  wmsUrl.searchParams.set('HEIGHT', height);
  if (time) {
    wmsUrl.searchParams.set('TIME', time);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WMS_TIMEOUT_MS);

    const wmsResponse = await fetch(wmsUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'image/png, image/*' },
    });

    clearTimeout(timeout);

    const contentType = wmsResponse.headers.get('content-type') || '';

    // Detect XML/HTML error response instead of an image
    if (
      contentType.includes('text/xml') ||
      contentType.includes('application/xml') ||
      contentType.includes('text/html')
    ) {
      const errorText = await wmsResponse.text();
      console.error('[EFFIS WMS] XML/HTML error response:', errorText.slice(0, 500));
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
          'X-EFFIS-Error': 'WMS returned non-image response',
        },
      });
    }

    if (!wmsResponse.ok) {
      console.error('[EFFIS WMS] HTTP error:', wmsResponse.status);
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
          'X-EFFIS-Error': `HTTP ${wmsResponse.status}`,
        },
      });
    }

    const imageBuffer = await wmsResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType.includes('image') ? contentType : 'image/png',
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout) {
      console.error('[EFFIS WMS] Request timed out after', WMS_TIMEOUT_MS, 'ms');
    } else {
      console.error('[EFFIS WMS] Fetch error:', err instanceof Error ? err.message : err);
    }

    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'X-EFFIS-Error': isTimeout ? 'timeout' : 'fetch-error',
      },
    });
  }
});
