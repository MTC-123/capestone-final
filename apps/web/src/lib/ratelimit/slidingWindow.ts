import { getCacheClient } from '@/lib/cache/redis';
import { logger } from '@/lib/observability/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp when the window resets
  retryAfter?: number; // Seconds to wait before retrying (if rate limited)
}

/**
 * Sliding window rate limiter using Redis or in-memory fallback
 */
export class SlidingWindowRateLimiter {
  private config: RateLimitConfig;
  private inMemoryStore: Map<string, { timestamps: number[] }> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed and update the rate limit
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const client = await getCacheClient();

      // Try Redis-based implementation
      if (process.env.REDIS_URL) {
        return await this.checkLimitRedis(identifier, now, windowStart, client);
      }
    } catch (error) {
      logger.error({
        event: 'ratelimit_redis_error',
        meta: { identifier },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
    }

    // Fallback to in-memory
    return this.checkLimitInMemory(identifier, now, windowStart);
  }

  private async checkLimitRedis(
    identifier: string,
    now: number,
    windowStart: number,
    client: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, opts?: { ex: number }) => Promise<unknown>; del: (key: string) => Promise<unknown> }
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;

    // Get all timestamps within the window
    const timestamps = await client.get(key);
    let requestTimestamps: number[] = timestamps ? JSON.parse(timestamps) : [];

    // Remove old timestamps outside the window
    requestTimestamps = requestTimestamps.filter((ts: number) => ts > windowStart);

    // Check if limit exceeded
    const allowed = requestTimestamps.length < this.config.maxRequests;

    if (allowed) {
      // Add current timestamp
      requestTimestamps.push(now);
      await client.set(
        key,
        JSON.stringify(requestTimestamps),
        { ex: Math.ceil(this.config.windowMs / 1000) }
      );
    }

    const remaining = Math.max(0, this.config.maxRequests - requestTimestamps.length);
    const oldestTimestamp = requestTimestamps[0] || now;
    const resetAt = oldestTimestamp + this.config.windowMs;
    const retryAfter = allowed ? undefined : Math.ceil((resetAt - now) / 1000);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter,
    };
  }

  private checkLimitInMemory(
    identifier: string,
    now: number,
    windowStart: number
  ): RateLimitResult {
    let entry = this.inMemoryStore.get(identifier);

    if (!entry) {
      entry = { timestamps: [] };
      this.inMemoryStore.set(identifier, entry);
    }

    // Remove old timestamps outside the window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    const allowed = entry.timestamps.length < this.config.maxRequests;

    if (allowed) {
      entry.timestamps.push(now);
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.timestamps.length);
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetAt = oldestTimestamp + this.config.windowMs;
    const retryAfter = allowed ? undefined : Math.ceil((resetAt - now) / 1000);

    // Clean up expired entries to prevent memory leaks
    if (entry.timestamps.length === 0 && now - windowStart > this.config.windowMs) {
      this.inMemoryStore.delete(identifier);
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter,
    };
  }

  /**
   * Reset rate limit for an identifier (useful for testing)
   */
  async reset(identifier: string): Promise<void> {
    try {
      const client = await getCacheClient();
      const key = `ratelimit:${identifier}`;
      await client.del(key);
    } catch (error) {
      logger.error({
        event: 'ratelimit_reset_error',
        meta: { identifier },
        error: {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
        },
      });
    }

    this.inMemoryStore.delete(identifier);
  }
}

/**
 * Create a rate limiter for FIRMS API
 * - Civilians: 10 requests per minute
 * - Officials: 100 requests per minute
 */
export function createFirmsRateLimiter(isOfficial: boolean): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: isOfficial ? 100 : 10,
  });
}
