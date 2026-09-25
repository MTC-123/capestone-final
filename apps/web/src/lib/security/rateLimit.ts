import { Ratelimit } from '@upstash/ratelimit';
import { getUpstashRedis } from '@/lib/kv';
import { AppError } from '@/lib/errors/AppError';
import { getClientIp } from '@/lib/errors/rateLimit';

/**
 * Named request budgets. Values are per identifier (usually client IP, or
 * IP + account for authentication) within a sliding window.
 */
export const RATE_LIMITS = {
  signin: { limit: 10, windowSeconds: 60 },
  signup: { limit: 5, windowSeconds: 600 },
  tokenRefresh: { limit: 30, windowSeconds: 60 },
  reportCreate: { limit: 20, windowSeconds: 600 },
  upload: { limit: 30, windowSeconds: 600 },
  mutation: { limit: 120, windowSeconds: 60 },
  proxy: { limit: 600, windowSeconds: 60 },
  geocode: { limit: 30, windowSeconds: 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type LimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

const memoryWindows = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hits = (memoryWindows.get(key) ?? []).filter((ts) => ts > now - windowMs);
  if (hits.length >= limit) {
    memoryWindows.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  memoryWindows.set(key, hits);
  if (memoryWindows.size > 20_000) memoryWindows.clear();
  return { allowed: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

const limiters = new Map<RateLimitName, Ratelimit>();

function upstashLimiter(name: RateLimitName): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  let limiter = limiters.get(name);
  if (!limiter) {
    const { limit, windowSeconds } = RATE_LIMITS[name];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `ricer:rl:${name}`,
      analytics: false,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

export async function checkRateLimit(name: RateLimitName, identifier: string): Promise<LimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  const limiter = upstashLimiter(name);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfterSeconds: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch {
      // Fail open to the local window rather than blocking every request
      // when the shared store is unreachable.
    }
  }
  return memoryLimit(`${name}:${identifier}`, limit, windowSeconds * 1000);
}

/** Throws a 429 AppError when the budget for this request is exhausted. */
export async function enforceRateLimit(name: RateLimitName, request: Request, extraKey?: string): Promise<void> {
  const identifier = extraKey ? `${getClientIp(request)}:${extraKey}` : getClientIp(request);
  const result = await checkRateLimit(name, identifier);
  if (!result.allowed) {
    throw new AppError(1002, { meta: { limit: name, retryAfterSeconds: result.retryAfterSeconds } });
  }
}

/** Test hook: clears in-memory windows. */
export function __resetRateLimits() {
  memoryWindows.clear();
}
