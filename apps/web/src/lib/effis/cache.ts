import { logger } from '@/lib/observability/logger';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

type CacheEntry = {
  data: GeoFeatureCollection<GeoFirmsDetectionProps>;
  expiresAt: number;
  cachedAt: number;
};

const effisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 100;

function getCacheKey(bbox: string): string {
  return `effis:viirs_hs:${bbox}`;
}

/**
 * Evict the oldest cache entry if max size is reached (LRU policy)
 */
function evictOldestIfNeeded(): void {
  if (effisCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = effisCache.keys().next().value;
    if (firstKey) {
      effisCache.delete(firstKey);
      logger.info({
        event: 'effis_cache_eviction',
        meta: { evictedKey: firstKey, reason: 'max_size_reached', maxSize: MAX_CACHE_ENTRIES },
      });
    }
  }
}

export async function getCachedEffisDetections(
  bbox: string
): Promise<{ data: GeoFeatureCollection<GeoFirmsDetectionProps>; cachedAt: number } | null> {
  const key = getCacheKey(bbox);
  const entry = effisCache.get(key);

  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    effisCache.delete(key);
    logger.info({ event: 'effis_cache_expired', meta: { bbox } });
    return null;
  }

  logger.info({
    event: 'effis_cache_hit',
    meta: { bbox, ageSeconds: Math.floor((now - entry.cachedAt) / 1000) },
  });
  return { data: entry.data, cachedAt: entry.cachedAt };
}

export async function setCachedEffisDetections(
  bbox: string,
  data: GeoFeatureCollection<GeoFirmsDetectionProps>
): Promise<void> {
  evictOldestIfNeeded();
  const key = getCacheKey(bbox);
  const now = Date.now();
  effisCache.set(key, {
    data,
    expiresAt: now + CACHE_TTL_MS,
    cachedAt: now,
  });
  logger.info({
    event: 'effis_cached',
    meta: {
      bbox,
      ttlMs: CACHE_TTL_MS,
      detectionCount: data.features.length,
      cacheSize: effisCache.size,
    },
  });
}

export function clearEffisCache(): void {
  const size = effisCache.size;
  effisCache.clear();
  logger.info({ event: 'effis_cache_cleared', meta: { entriesCleared: size } });
}

export function getEffisCacheStats(): { entries: number; totalDetections: number } {
  let totalDetections = 0;
  effisCache.forEach((entry) => {
    totalDetections += entry.data.features.length;
  });
  return { entries: effisCache.size, totalDetections };
}
