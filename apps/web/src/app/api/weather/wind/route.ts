export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';

/**
 * Ifrane Province bounding box — covers the full province area
 */
const IFRANE_BBOX = {
  latMin: 33.0,
  latMax: 34.0,
  lonMin: -5.5,
  lonMax: -4.5,
};

const GRID_SIZE = 5;

/** In-memory cache: 30-minute TTL */
let cachedData: { geojson: object; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

function generateGrid(): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  const lons: number[] = [];
  const latStep = (IFRANE_BBOX.latMax - IFRANE_BBOX.latMin) / (GRID_SIZE - 1);
  const lonStep = (IFRANE_BBOX.lonMax - IFRANE_BBOX.lonMin) / (GRID_SIZE - 1);

  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      lats.push(+(IFRANE_BBOX.latMin + i * latStep).toFixed(4));
      lons.push(+(IFRANE_BBOX.lonMin + j * lonStep).toFixed(4));
    }
  }
  return { lats, lons };
}

/** Single location response from Open-Meteo */
interface OpenMeteoPointResponse {
  latitude: number;
  longitude: number;
  current: {
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
}

/** Open-Meteo returns an array of objects for multi-coordinate queries */
type OpenMeteoMultiResponse = OpenMeteoPointResponse[];

function isValidPoint(d: unknown): d is OpenMeteoPointResponse {
  if (!d || typeof d !== 'object') return false;
  const obj = d as Record<string, unknown>;
  if (typeof obj.latitude !== 'number' || typeof obj.longitude !== 'number') return false;
  const current = obj.current as Record<string, unknown> | undefined;
  if (!current || typeof current !== 'object') return false;
  return (
    typeof current.wind_speed_10m === 'number' &&
    typeof current.wind_direction_10m === 'number' &&
    typeof current.wind_gusts_10m === 'number'
  );
}

function isValidResponse(data: unknown): data is OpenMeteoMultiResponse {
  return Array.isArray(data) && data.length > 0 && data.every(isValidPoint);
}

export const GET = withApiHandler(async () => {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL_MS) {
    const response = NextResponse.json(cachedData.geojson);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
    return response;
  }

  const { lats, lons } = generateGrid();
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Open-Meteo returned HTTP ${res.status}`);
  }

  const data: unknown = await res.json();

  if (!isValidResponse(data)) {
    throw new Error('Invalid Open-Meteo multi-point response structure');
  }

  const features = data.map((point) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.longitude, point.latitude],
    },
    properties: {
      speed: point.current.wind_speed_10m,
      direction: point.current.wind_direction_10m,
      gusts: point.current.wind_gusts_10m,
      lat: point.latitude,
      lon: point.longitude,
    },
  }));

  const geojson = {
    type: 'FeatureCollection' as const,
    features,
  };

  cachedData = { geojson, timestamp: Date.now() };

  const response = NextResponse.json(geojson);
  response.headers.set('X-Cache', 'MISS');
  response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
  return response;
});
