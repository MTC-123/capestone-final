import { logger } from '@/lib/observability/logger';

type WeatherData = {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  timestamp: string;
};

type CacheEntry = {
  data: WeatherData;
  expiresAt: number;
};

const weatherCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(lat: number, lng: number): string {
  return `weather:${lat}:${lng}`;
}

export async function getCachedWeather(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  const key = getCacheKey(lat, lng);
  const entry = weatherCache.get(key);

  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    weatherCache.delete(key);
    return null;
  }

  logger.info({ event: 'weather_cache_hit', meta: { lat, lng } });
  return entry.data;
}

export async function setCachedWeather(
  lat: number,
  lng: number,
  data: WeatherData
): Promise<void> {
  const key = getCacheKey(lat, lng);
  weatherCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  logger.info({ event: 'weather_cached', meta: { lat, lng, ttlMs: CACHE_TTL_MS } });
}

export function clearWeatherCache(): void {
  weatherCache.clear();
}
