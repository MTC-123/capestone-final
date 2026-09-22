import { logger } from '@/lib/observability/logger';

/**
 * Redis cache client with graceful fallback to in-memory cache
 * when Redis is not configured.
 */

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

// In-memory cache fallback
const inMemoryCache = new Map<string, { value: string; expiresAt: number | null }>();

class InMemoryCacheClient implements CacheClient {
  async get(key: string): Promise<string | null> {
    const item = inMemoryCache.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    inMemoryCache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    inMemoryCache.delete(key);
  }
}

class RedisCacheClient implements CacheClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Redis client type from dynamic import
  private client: any;
  private isConnected = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Dynamically import Redis only if REDIS_URL is configured
      if (!process.env.REDIS_URL) {
        logger.info({
          event: 'redis_not_configured',
          meta: { fallback: 'in-memory' },
        });
        return;
      }

      const { createClient } = await import('redis');
      this.client = createClient({
        url: process.env.REDIS_URL,
      });

      this.client.on('error', (err: Error) => {
        logger.error({
          event: 'redis_error',
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info({ event: 'redis_connected' });
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error({
        event: 'redis_initialization_failed',
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error({
        event: 'redis_get_error',
        meta: { key },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
      return null;
    }
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      if (options?.ex) {
        await this.client.setEx(key, options.ex, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error({
        event: 'redis_set_error',
        meta: { key },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({
        event: 'redis_del_error',
        meta: { key },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
    }
  }
}

// Singleton cache client with fallback
let cacheClient: CacheClient | null = null;

export async function getCacheClient(): Promise<CacheClient> {
  if (cacheClient) return cacheClient;

  // Try Redis first, fallback to in-memory
  if (process.env.REDIS_URL) {
    cacheClient = new RedisCacheClient();
  } else {
    logger.info({
      event: 'cache_using_in_memory',
      meta: { reason: 'REDIS_URL not configured' },
    });
    cacheClient = new InMemoryCacheClient();
  }

  return cacheClient;
}

/**
 * Cache helper for JSON data with TTL
 */
export async function cacheJSON<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const client = await getCacheClient();
  await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
}

/**
 * Get cached JSON data
 */
export async function getCachedJSON<T>(key: string): Promise<T | null> {
  const client = await getCacheClient();
  const cached = await client.get(key);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as T;
  } catch (error) {
    logger.error({
      event: 'cache_json_parse_error',
      meta: { key },
      error: {
        name: (error as Error)?.name,
        message: (error as Error)?.message,
      },
    });
    return null;
  }
}

/**
 * Delete cached data
 */
export async function deleteCached(key: string): Promise<void> {
  const client = await getCacheClient();
  await client.del(key);
}
