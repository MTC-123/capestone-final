/**
 * Cached API client with in-flight deduplication.
 * Wraps fetchWithAuth with a TTL-based memory cache.
 */

import { fetchWithAuth } from './fetchWithAuth';

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 30_000; // 30 seconds

function isExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expiresAt;
}

export async function cachedFetch<T = unknown>(
  url: string,
  options?: { ttl?: number; init?: RequestInit }
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTL_MS;
  const cacheKey = url;

  // Return cached data if fresh
  const cached = cache.get(cacheKey);
  if (cached && !isExpired(cached)) {
    return cached.data as T;
  }

  // Deduplicate in-flight requests
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    try {
      const res = await fetchWithAuth(url, options?.init);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      cache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
      return data as T;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

export function invalidateCache(url?: string) {
  if (url) {
    cache.delete(url);
  } else {
    cache.clear();
  }
}

/**
 * Prefetch a URL into cache without blocking.
 */
export function prefetch(url: string, ttl?: number) {
  cachedFetch(url, { ttl }).catch(() => {
    // Silently ignore prefetch failures
  });
}
