export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { loadModel, predictProbability } from '@/lib/risk/xgboost';
import { buildFeatureVector, requiredFeatureNames, type WeatherAggregates24h } from '@/lib/risk/features';
import {
  MODEL_DOMAIN_BBOX,
  levelFromScore,
  aggregateHourlyWeather,
  isOpenMeteoHourly,
  type OpenMeteoHourly,
} from '@/lib/risk/riskService';
import { logger } from '@/lib/observability/logger';

/** ~2 km steps (1 deg lat ≈ 111 km; 1 deg lng ≈ 93 km at this latitude). */
const GRID_STEP_DEG = 0.018;
/** Points per Open-Meteo multi-coordinate call — batched, not one call per cell. */
const BATCH_SIZE = 100;
const CACHE_TTL_SECONDS = 30 * 60;

interface GridPoint {
  lat: number;
  lng: number;
}

function pointKey(p: GridPoint): string {
  return `${p.lat},${p.lng}`;
}

function buildGridPoints(): GridPoint[] {
  const { minLat, maxLat, minLng, maxLng } = MODEL_DOMAIN_BBOX;
  const latCount = Math.max(1, Math.round((maxLat - minLat) / GRID_STEP_DEG));
  const lngCount = Math.max(1, Math.round((maxLng - minLng) / GRID_STEP_DEG));
  const points: GridPoint[] = [];
  for (let i = 0; i <= latCount; i++) {
    const lat = +(minLat + (i * (maxLat - minLat)) / latCount).toFixed(4);
    for (let j = 0; j <= lngCount; j++) {
      const lng = +(minLng + (j * (maxLng - minLng)) / lngCount).toFixed(4);
      points.push({ lat, lng });
    }
  }
  return points;
}

interface OpenMeteoGridPoint {
  latitude: number;
  longitude: number;
  hourly: OpenMeteoHourly;
}

function isValidGridResponse(data: unknown): data is OpenMeteoGridPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((d) => {
      if (!d || typeof d !== 'object') return false;
      const o = d as Record<string, unknown>;
      return typeof o.latitude === 'number' && typeof o.longitude === 'number' && isOpenMeteoHourly(o.hourly);
    })
  );
}

type WeatherByKey = Map<string, { weather: WeatherAggregates24h; dataTime: string } | null>;

/** Fetches one batch of points' hourly weather in a single Open-Meteo multi-coordinate call. */
async function fetchBatchWeather(points: GridPoint[], at: Date): Promise<WeatherByKey> {
  const result: WeatherByKey = new Map();
  const lats = points.map((p) => p.lat).join(',');
  const lngs = points.map((p) => p.lng).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,shortwave_radiation` +
    `&past_days=1&forecast_days=1&timezone=UTC`;

  try {
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) {
      logger.warn({ event: 'risk_grid_batch_failed', meta: { status: response.status, count: points.length } });
      for (const p of points) result.set(pointKey(p), null);
      return result;
    }
    const data: unknown = await response.json();
    if (!isValidGridResponse(data) || data.length !== points.length) {
      logger.warn({ event: 'risk_grid_batch_invalid', meta: { count: points.length } });
      for (const p of points) result.set(pointKey(p), null);
      return result;
    }
    data.forEach((point, idx) => {
      result.set(pointKey(points[idx]), aggregateHourlyWeather(point.hourly, at));
    });
  } catch (error) {
    logger.warn({ event: 'risk_grid_batch_error', meta: { error: String(error), count: points.length } });
    for (const p of points) result.set(pointKey(p), null);
  }
  return result;
}

async function computeGrid(): Promise<GeoJSON.FeatureCollection> {
  const model = loadModel();
  const at = new Date();
  const points = buildGridPoints();
  const required = new Set(requiredFeatureNames());

  const weatherByKey: WeatherByKey = new Map();
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const batchResult = await fetchBatchWeather(batch, at);
    for (const [key, value] of batchResult) weatherByKey.set(key, value);
  }

  const features: GeoJSON.Feature[] = [];
  for (const point of points) {
    const weatherResult = weatherByKey.get(pointKey(point));
    if (!weatherResult) continue; // no weather for this cell — omit rather than guess

    const { vector, missing } = buildFeatureVector({ at, weather: weatherResult.weather });
    const missingRequired = missing.filter((name) => required.has(name));
    if (missingRequired.length > 0) continue;

    const score = predictProbability(vector, model);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        score,
        level: levelFromScore(score),
        lat: point.lat,
        lng: point.lng,
        dataTime: weatherResult.dataTime,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
    // Non-standard but widely-tolerated top-level metadata (mirrors how
    // other RICER GeoJSON endpoints attach summary info for the map layer).
    ...({
      properties: {
        modelId: model.modelId,
        modelVersion: model.modelVersion,
        generatedAt: at.toISOString(),
        cellCount: features.length,
        requestedCellCount: points.length,
      },
    } as Record<string, unknown>),
  };
}

const getCachedGrid = unstable_cache(computeGrid, ['risk-grid-v1'], { revalidate: CACHE_TTL_SECONDS });

/** GET /api/risk/grid — ~2km risk grid over Ifrane Province, cached 30 minutes. */
export const GET = withApiHandler(async () => {
  let geojson: GeoJSON.FeatureCollection;
  try {
    geojson = await getCachedGrid();
  } catch (error) {
    // `unstable_cache` requires a live Next.js server incremental-cache
    // context, which isn't present outside `next start`/`next dev` (e.g.
    // vitest, or an unusual runtime edge case). Degrade to an uncached
    // (always-fresh) computation rather than failing the route; any other
    // error still propagates to `withApiHandler`.
    if (error instanceof Error && /incrementalCache missing/i.test(error.message)) {
      geojson = await computeGrid();
    } else {
      throw error;
    }
  }
  const response = NextResponse.json(geojson);
  response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
  return response;
});
