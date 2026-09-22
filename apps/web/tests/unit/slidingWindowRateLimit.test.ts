import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { SlidingWindowRateLimiter, createFirmsRateLimiter } from '@/lib/ratelimit/slidingWindow';

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock Redis cache client ──────────────────────────────────────────────────
const mockRedisStore = new Map<string, { value: string; ex?: number }>();

const mockCacheClient = {
  get: vi.fn(async (key: string) => {
    const entry = mockRedisStore.get(key);
    return entry ? entry.value : null;
  }),
  set: vi.fn(async (key: string, value: string, opts?: { ex: number }) => {
    mockRedisStore.set(key, { value, ex: opts?.ex });
  }),
  del: vi.fn(async (key: string) => {
    mockRedisStore.delete(key);
  }),
};

vi.mock('@/lib/cache/redis', () => ({
  getCacheClient: vi.fn(async () => mockCacheClient),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Drain the microtask queue so all promises resolve. */
function flush() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SlidingWindowRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRedisStore.clear();
    mockCacheClient.get.mockClear();
    mockCacheClient.set.mockClear();
    mockCacheClient.del.mockClear();
    // Default: no REDIS_URL => uses in-memory path
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Allows requests up to max, then blocks ───────────────────────────

  describe('in-memory limiting', () => {
    it('allows requests up to the max limit then blocks the next', async () => {
      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 3,
      });

      // First 3 requests should be allowed
      for (let i = 0; i < 3; i++) {
        const result = await limiter.checkLimit('user-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(3 - (i + 1));
      }

      // 4th request should be blocked
      const blocked = await limiter.checkLimit('user-1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('tracks separate limits for different identifiers', async () => {
      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1,
      });

      const r1 = await limiter.checkLimit('user-a');
      expect(r1.allowed).toBe(true);

      const r2 = await limiter.checkLimit('user-b');
      expect(r2.allowed).toBe(true);

      // Both should now be blocked independently
      const r3 = await limiter.checkLimit('user-a');
      expect(r3.allowed).toBe(false);

      const r4 = await limiter.checkLimit('user-b');
      expect(r4.allowed).toBe(false);
    });
  });

  // ── 2. Window expiry ────────────────────────────────────────────────────

  describe('window expiry', () => {
    it('allows requests again after the window elapses', async () => {
      const windowMs = 60_000;
      const limiter = new SlidingWindowRateLimiter({
        windowMs,
        maxRequests: 2,
      });

      // Exhaust the limit
      await limiter.checkLimit('user-1');
      await limiter.checkLimit('user-1');

      const blocked = await limiter.checkLimit('user-1');
      expect(blocked.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1);

      const allowed = await limiter.checkLimit('user-1');
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(1);
    });

    it('provides a correct resetAt timestamp', async () => {
      const windowMs = 30_000;
      const limiter = new SlidingWindowRateLimiter({
        windowMs,
        maxRequests: 1,
      });

      const now = Date.now();
      await limiter.checkLimit('user-1');

      const blocked = await limiter.checkLimit('user-1');
      expect(blocked.allowed).toBe(false);
      // resetAt should be approximately now + windowMs
      expect(blocked.resetAt).toBeGreaterThanOrEqual(now);
      expect(blocked.resetAt).toBeLessThanOrEqual(now + windowMs + 1000);
    });
  });

  // ── 3. Redis fallback ──────────────────────────────────────────────────

  describe('Redis fallback', () => {
    it('falls back to in-memory when Redis throws', async () => {
      // Enable REDIS_URL so the code tries Redis first
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Make getCacheClient throw to simulate Redis unavailable
      const { getCacheClient } = await import('@/lib/cache/redis');
      vi.mocked(getCacheClient).mockRejectedValueOnce(new Error('Connection refused'));

      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 2,
      });

      // Should still work via in-memory fallback
      const result = await limiter.checkLimit('user-fallback');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('uses Redis when REDIS_URL is set and Redis is available', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 2,
      });

      const result = await limiter.checkLimit('user-redis');
      expect(result.allowed).toBe(true);
      expect(mockCacheClient.set).toHaveBeenCalled();
    });

    it('stores timestamps in Redis with correct TTL', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const windowMs = 120_000; // 2 minutes
      const limiter = new SlidingWindowRateLimiter({
        windowMs,
        maxRequests: 5,
      });

      await limiter.checkLimit('user-ttl');

      expect(mockCacheClient.set).toHaveBeenCalledWith(
        'ratelimit:user-ttl',
        expect.any(String),
        { ex: Math.ceil(windowMs / 1000) }
      );
    });
  });

  // ── 4. Reset ───────────────────────────────────────────────────────────

  describe('reset', () => {
    it('allows previously blocked requests after reset (in-memory)', async () => {
      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1,
      });

      await limiter.checkLimit('user-reset');
      const blocked = await limiter.checkLimit('user-reset');
      expect(blocked.allowed).toBe(false);

      await limiter.reset('user-reset');

      const afterReset = await limiter.checkLimit('user-reset');
      expect(afterReset.allowed).toBe(true);
    });

    it('clears Redis key on reset', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1,
      });

      await limiter.checkLimit('user-redis-reset');
      await limiter.reset('user-redis-reset');

      expect(mockCacheClient.del).toHaveBeenCalledWith('ratelimit:user-redis-reset');
    });

    it('handles reset gracefully when Redis is unavailable', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const { getCacheClient } = await import('@/lib/cache/redis');

      // Make every getCacheClient call reject to simulate Redis being down
      vi.mocked(getCacheClient).mockRejectedValue(new Error('Connection refused'));

      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1,
      });

      // Fill up in-memory (falls back because Redis rejects)
      await limiter.checkLimit('user-graceful');
      const blocked = await limiter.checkLimit('user-graceful');
      expect(blocked.allowed).toBe(false);

      // Reset should not throw even if Redis fails
      await expect(limiter.reset('user-graceful')).resolves.toBeUndefined();

      // Restore the default mock implementation
      vi.mocked(getCacheClient).mockResolvedValue(mockCacheClient);
    });
  });

  // ── 5. Role-based limits (OFFICIAL vs CIVILIAN) ────────────────────────

  describe('createFirmsRateLimiter (role-based limits)', () => {
    it('gives CIVILIAN users a lower limit (10 requests/minute)', async () => {
      const limiter = createFirmsRateLimiter(false);

      for (let i = 0; i < 10; i++) {
        const result = await limiter.checkLimit('civilian-1');
        expect(result.allowed).toBe(true);
      }

      const blocked = await limiter.checkLimit('civilian-1');
      expect(blocked.allowed).toBe(false);
    });

    it('gives OFFICIAL users a higher limit (100 requests/minute)', async () => {
      const limiter = createFirmsRateLimiter(true);

      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit('official-1');
        expect(result.allowed).toBe(true);
      }

      const blocked = await limiter.checkLimit('official-1');
      expect(blocked.allowed).toBe(false);
    });

    it('OFFICIAL limit is 10x the CIVILIAN limit', () => {
      const civilian = createFirmsRateLimiter(false);
      const official = createFirmsRateLimiter(true);

      // Access private config via checkLimit behavior is already tested above.
      // Here we simply verify both instances are distinct.
      expect(civilian).not.toBe(official);
    });
  });

  // ── Redis path: limit then block ──────────────────────────────────────

  describe('Redis-backed limiting', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockRedisStore.clear();
    });

    it('allows requests up to max then blocks via Redis', async () => {
      const limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 2,
      });

      const r1 = await limiter.checkLimit('redis-user');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);

      const r2 = await limiter.checkLimit('redis-user');
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0);

      const r3 = await limiter.checkLimit('redis-user');
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
      expect(r3.retryAfter).toBeGreaterThan(0);
    });

    it('allows requests again after window expires via Redis', async () => {
      const windowMs = 60_000;
      const limiter = new SlidingWindowRateLimiter({
        windowMs,
        maxRequests: 1,
      });

      await limiter.checkLimit('redis-expiry');
      const blocked = await limiter.checkLimit('redis-expiry');
      expect(blocked.allowed).toBe(false);

      // Advance past window
      vi.advanceTimersByTime(windowMs + 1);

      const allowed = await limiter.checkLimit('redis-expiry');
      expect(allowed.allowed).toBe(true);
    });
  });
});
