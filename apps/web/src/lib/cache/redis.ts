import { getKv } from '@/lib/kv';
import { logger } from '@/lib/observability/logger';

/**
 * JSON cache helpers on top of the shared key-value store (Upstash Redis over
 * HTTP in production, process memory otherwise). Cache failures never break
 * a request: reads degrade to a miss and writes are best-effort.
 */

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

const client: CacheClient = {
  async get(key) {
    const value = await getKv().get<unknown>(key);
    if (value === null || value === undefined) return null;
    // Upstash deserialises JSON automatically; callers expect the raw string.
    return typeof value === 'string' ? value : JSON.stringify(value);
  },
  async set(key, value, options) {
    await getKv().set(key, value, { ttlSeconds: options?.ex });
  },
  async del(key) {
    await getKv().del(key);
  },
};

export async function getCacheClient(): Promise<CacheClient> {
  return client;
}

export async function cacheJSON<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (error) {
    logger.warn({ event: 'cache_write_failed', meta: { key }, error: { message: (error as Error)?.message } });
  }
}

export async function getCachedJSON<T>(key: string): Promise<T | null> {
  try {
    const cached = await client.get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (error) {
    logger.warn({ event: 'cache_read_failed', meta: { key }, error: { message: (error as Error)?.message } });
    return null;
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    await client.del(key);
  } catch (error) {
    logger.warn({ event: 'cache_delete_failed', meta: { key }, error: { message: (error as Error)?.message } });
  }
}
