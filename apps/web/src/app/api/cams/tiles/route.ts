export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * CAMS Aerosol WMS tile proxy.
 *
 * Proxies requests to ECMWF ecCharts WMS to:
 * 1. Avoid CORS issues in the browser
 * 2. Convert EPSG:3857 bbox to EPSG:4326 (lat/lon) expected by the WMS
 * 3. Detect XML error responses and return a transparent tile instead
 *
 * Query params:
 *   layer  – WMS layer name (composition_aod550 | composition_duaod550 | composition_bbaod550)
 *   bbox   – EPSG:3857 bbox as "minx,miny,maxx,maxy"
 */

const ALLOWED_LAYERS = new Set([
  'composition_aod550',
  'composition_duaod550',
  'composition_bbaod550',
]);

const WMS_TIMEOUT_MS = 20_000;

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
  const layer = url.searchParams.get('layer') || 'composition_duaod550';
  const bboxStr = url.searchParams.get('bbox');

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

  // WMS 1.3.0 with CRS=EPSG:4326 expects bbox in lat,lon order
  const wmsUrl = new URL('https://eccharts.ecmwf.int/wms/');
  wmsUrl.searchParams.set('token', 'public');
  wmsUrl.searchParams.set('SERVICE', 'WMS');
  wmsUrl.searchParams.set('VERSION', '1.3.0');
  wmsUrl.searchParams.set('REQUEST', 'GetMap');
  wmsUrl.searchParams.set('LAYERS', layer);
  wmsUrl.searchParams.set('STYLES', 'sh_BuYlRd_aod');
  wmsUrl.searchParams.set('FORMAT', 'image/png');
  wmsUrl.searchParams.set('TRANSPARENT', 'true');
  wmsUrl.searchParams.set('CRS', 'EPSG:4326');
  wmsUrl.searchParams.set('BBOX', `${minLat},${minLon},${maxLat},${maxLon}`);
  wmsUrl.searchParams.set('WIDTH', '256');
  wmsUrl.searchParams.set('HEIGHT', '256');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WMS_TIMEOUT_MS);

    const wmsResponse = await fetch(wmsUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'image/png, image/*' },
    });

    clearTimeout(timeout);

    const contentType = wmsResponse.headers.get('content-type') || '';

    // Detect XML error response instead of an image
    if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
      const errorText = await wmsResponse.text();
      console.error('[CAMS WMS] XML error response:', errorText);
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
          'X-CAMS-Error': 'WMS returned XML error',
        },
      });
    }

    if (!wmsResponse.ok) {
      console.error('[CAMS WMS] HTTP error:', wmsResponse.status);
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60',
          'X-CAMS-Error': `HTTP ${wmsResponse.status}`,
        },
      });
    }

    const imageBuffer = await wmsResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType.includes('image') ? contentType : 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout) {
      console.error('[CAMS WMS] Request timed out after', WMS_TIMEOUT_MS, 'ms');
    } else {
      console.error('[CAMS WMS] Fetch error:', err instanceof Error ? err.message : err);
    }

    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        'X-CAMS-Error': isTimeout ? 'timeout' : 'fetch-error',
      },
    });
  }
});
