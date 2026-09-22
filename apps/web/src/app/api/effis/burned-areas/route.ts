export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * Proxy EFFIS WFS burned areas to avoid CORS issues.
 * Attempts to fetch vector GeoJSON from the EFFIS WFS service.
 * Tries multiple TYPENAMES since EFFIS layer names change over time.
 * Returns GeoJSON FeatureCollection or empty FC if EFFIS is unavailable.
 */

const IFRANE_BBOX = '33.0,-5.5,34.0,-4.5';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WFS_TIMEOUT_MS = 15_000;

// EFFIS WFS type names to try in order of preference.
// burnt_areas_ha was the original; EFFIS may rename layers across versions.
// modis.ba matches the WMS layer name used by the tile proxy.
// viirs.ba is the VIIRS-based alternative; ecmwf.ba.poly is forecast polygons.
// Last verified: 2026-03-06 (EFFIS 502 — service down, could not confirm).
const WFS_TYPENAMES = ['modis.ba', 'burnt_areas_ha', 'viirs.ba', 'burnt_area', 'ecmwf.ba.poly'];

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

let cachedData: { geojson: object; timestamp: number } | null = null;

function buildWfsUrl(typeName: string): string {
  return (
    `https://maps.effis.emergency.copernicus.eu/effis?` +
    `SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=${typeName}` +
    `&OUTPUTFORMAT=application/json` +
    `&SRSNAME=EPSG:4326` +
    `&BBOX=${IFRANE_BBOX}`
  );
}

async function tryFetchWfs(typeName: string, signal: AbortSignal): Promise<object | null> {
  try {
    const res = await fetch(buildWfsUrl(typeName), {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!res.ok) {
      console.warn(`[EFFIS WFS] TYPENAMES=${typeName} returned HTTP ${res.status}`);
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json') && !contentType.includes('geo')) {
      console.warn(`[EFFIS WFS] TYPENAMES=${typeName} returned non-JSON: ${contentType}`);
      return null;
    }

    const data: unknown = await res.json();

    if (
      !data ||
      typeof data !== 'object' ||
      !('type' in data) ||
      (data as Record<string, unknown>).type !== 'FeatureCollection'
    ) {
      console.warn(`[EFFIS WFS] TYPENAMES=${typeName} returned invalid GeoJSON`);
      return null;
    }

    return data as object;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    console.warn(`[EFFIS WFS] TYPENAMES=${typeName} fetch error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export const GET = withApiHandler(async () => {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json(cachedData.geojson);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    return response;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WFS_TIMEOUT_MS);

  try {
    // Try each TYPENAME until one returns valid data
    for (const typeName of WFS_TYPENAMES) {
      const data = await tryFetchWfs(typeName, controller.signal);
      if (data) {
        clearTimeout(timeout);
        cachedData = { geojson: data, timestamp: Date.now() };

        const response = NextResponse.json(data);
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('X-EFFIS-TypeName', typeName);
        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
        return response;
      }
    }

    clearTimeout(timeout);
    // All type names exhausted — return empty FC (outside fire season this is normal)
    console.warn('[EFFIS WFS] All TYPENAMES failed or returned empty data');
    const response = NextResponse.json(EMPTY_FC);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-EFFIS-Error', 'all-typenames-failed');
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return response;
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === 'AbortError';

    if (isTimeout) {
      console.error('[EFFIS WFS] Request timed out after', WFS_TIMEOUT_MS, 'ms');
    } else {
      console.error('[EFFIS WFS] Unexpected error:', err instanceof Error ? err.message : err);
    }

    // Return empty FC instead of 502 so the frontend never sees an error state
    const response = NextResponse.json(EMPTY_FC);
    response.headers.set('X-EFFIS-Error', isTimeout ? 'timeout' : 'fetch-error');
    response.headers.set('Cache-Control', 'public, s-maxage=60');
    return response;
  }
});
