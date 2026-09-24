import { Redis } from '@upstash/redis';

/**
 * Key-value store used for caching, idempotency keys and short-lived locks.
 *
 * Production uses Upstash Redis over HTTP, which works from serverless and
 * edge functions without a connection pool. Without credentials the store
 * falls back to process memory, which is fine for local development and
 * tests but is not shared between serverless instances.
 */
export interface KeyValueStore {
  readonly backend: 'upstash' | 'memory';
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ttlSeconds?: number; onlyIfAbsent?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
}

function readUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function isUpstashConfigured(): boolean {
  return readUpstashConfig() !== null;
}

class UpstashStore implements KeyValueStore {
  readonly backend = 'upstash' as const;
  constructor(readonly redis: Redis) {}

  get<T>(key: string) {
    return this.redis.get<T>(key);
  }

  async set(key: string, value: unknown, opts: { ttlSeconds?: number; onlyIfAbsent?: boolean } = {}) {
    const result = opts.ttlSeconds
      ? opts.onlyIfAbsent
        ? await this.redis.set(key, value, { ex: opts.ttlSeconds, nx: true })
        : await this.redis.set(key, value, { ex: opts.ttlSeconds })
      : opts.onlyIfAbsent
        ? await this.redis.set(key, value, { nx: true })
        : await this.redis.set(key, value);
    return result === 'OK';
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  async ping() {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}

class MemoryStore implements KeyValueStore {
  readonly backend = 'memory' as const;
  private readonly items = new Map<string, { value: unknown; expiresAt: number | null }>();

  private live(key: string) {
    const item = this.items.get(key);
    if (item && item.expiresAt !== null && item.expiresAt <= Date.now()) {
      this.items.delete(key);
      return undefined;
    }
    return item;
  }

  async get<T>(key: string) {
    return (this.live(key)?.value as T | undefined) ?? null;
  }

  async set(key: string, value: unknown, opts: { ttlSeconds?: number; onlyIfAbsent?: boolean } = {}) {
    if (opts.onlyIfAbsent && this.live(key)) return false;
    if (this.items.size > 10_000) this.sweep();
    this.items.set(key, { value, expiresAt: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null });
    return true;
  }

  async del(key: string) {
    this.items.delete(key);
  }

  async ping() {
    return true;
  }

  private sweep() {
    const now = Date.now();
    this.items.forEach((item, key) => {
      if (item.expiresAt !== null && item.expiresAt <= now) this.items.delete(key);
    });
  }
}

const globalForKv = globalThis as unknown as { __ricerKv?: KeyValueStore; __ricerRedis?: Redis | null };

export function getUpstashRedis(): Redis | null {
  if (globalForKv.__ricerRedis === undefined) {
    const config = readUpstashConfig();
    globalForKv.__ricerRedis = config ? new Redis(config) : null;
  }
  return globalForKv.__ricerRedis;
}

export function getKv(): KeyValueStore {
  if (!globalForKv.__ricerKv) {
    const redis = getUpstashRedis();
    globalForKv.__ricerKv = redis ? new UpstashStore(redis) : new MemoryStore();
  }
  return globalForKv.__ricerKv;
}
