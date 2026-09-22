type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000; // Increased from 30s to 60s
const DEFAULT_MAX = 15;           // Increased from 5 to 15
const MAX_BUCKETS = 10_000;

function nowMs() {
  return Date.now();
}

function cleanupIfNeeded(current: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= current) buckets.delete(key);
  });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export type RateLimitResult =
  | { limited: false; retryAfterSeconds: 0 }
  | { limited: true; retryAfterSeconds: number };

export function checkErrorRateLimit(
  key: string,
  opts: { windowMs?: number; max?: number } = {}
): RateLimitResult {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts.max ?? DEFAULT_MAX;

  const current = nowMs();
  cleanupIfNeeded(current);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= current) {
    buckets.set(key, { count: 1, resetAt: current + windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - current) / 1000)) };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

