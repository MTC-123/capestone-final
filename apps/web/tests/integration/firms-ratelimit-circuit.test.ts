/**
 * Task 34 — FIRMS rate limiting and circuit breaker tests
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/firms/detections/route';
import { getCurrentUser } from '@/lib/auth';
import type { Scope } from '@/lib/auth';

vi.mock('@/lib/auth');
vi.mock('@/lib/firms/cache');
vi.mock('@/lib/observability/logger');

// Hoisted mocks — available inside vi.mock() factories
const { mockCheckLimit, mockCanRequest } = vi.hoisted(() => ({
  mockCheckLimit: vi.fn(),
  mockCanRequest: vi.fn(),
}));

vi.mock('@/lib/ratelimit/slidingWindow', () => ({
  createFirmsRateLimiter: () => ({ checkLimit: mockCheckLimit }),
}));

// Partial mock: override only getCircuitBreaker; keep real CircuitBreaker class for unit tests
vi.mock('@/lib/platform/circuitBreaker', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/platform/circuitBreaker')>();
  return {
    ...real,
    getCircuitBreaker: () => ({
      canRequest: mockCanRequest,
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

const OFFICIAL_USER = {
  tokenUse: 'access' as const,
  userId: 'official-1',
  cin: 'OFF1',
  role: 'OFFICIAL' as const,
  scopes: ['map:read', 'map:write'] as Scope[],
};

const CIVILIAN_USER = {
  tokenUse: 'access' as const,
  userId: 'civilian-1',
  cin: 'CIV1',
  role: 'CIVILIAN' as const,
  scopes: ['map:read'] as Scope[],
};

function makeRequest() {
  return new Request('http://localhost/api/firms/detections');
}

describe('FIRMS Rate Limiting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.FIRMS_MAP_KEY = 'a'.repeat(32);

    // Defaults: rate limiter allows, circuit breaker closed, cache miss
    mockCheckLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    mockCanRequest.mockReturnValue(true);

    const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
    vi.mocked(getCachedFirmsDetections).mockResolvedValue(null);
  });

  it('returns 429 with Retry-After header when rate limit is exceeded', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);

    mockCheckLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfter: 60,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(429);
    const retryAfter = response.headers.get('Retry-After');
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

describe('FIRMS Circuit Breaker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.FIRMS_MAP_KEY = 'a'.repeat(32);

    // Defaults: rate limiter allows, circuit breaker closed, cache miss
    mockCheckLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 });
    mockCanRequest.mockReturnValue(true);

    const { getCachedFirmsDetections } = await import('@/lib/firms/cache');
    vi.mocked(getCachedFirmsDetections).mockResolvedValue(null);
  });

  it('returns 502 when circuit breaker is open (no upstream call)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);

    mockCanRequest.mockReturnValue(false);

    const response = await GET(makeRequest());

    // AppError(4000) → EXTERNAL_SERVICE_FAILED → httpStatus 502 (all endpoints failed / circuit breakers open)
    expect(response.status).toBe(502);
  });

  it('circuit breaker transitions to open after threshold failures', async () => {
    const { CircuitBreaker } = await import('@/lib/platform/circuitBreaker');
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    expect(breaker.canRequest()).toBe(true);
    breaker.onFailure();
    breaker.onFailure();
    expect(breaker.canRequest()).toBe(true); // Still under threshold
    breaker.onFailure();
    expect(breaker.canRequest()).toBe(false); // Now open
  });

  it('circuit breaker transitions to half-open after timeout', async () => {
    const { CircuitBreaker } = await import('@/lib/platform/circuitBreaker');
    const breaker = new CircuitBreaker({ failureThreshold: 1, openTimeoutMs: 1000 });

    const t0 = Date.now();
    breaker.onFailure(t0);
    expect(breaker.canRequest(t0)).toBe(false); // Open

    // After timeout, transitions to half-open → allows 1 request
    expect(breaker.canRequest(t0 + 1500)).toBe(true);
    const snap = breaker.snapshot(t0 + 1500);
    expect(snap.state).toBe('half_open');
  });
});
