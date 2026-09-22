import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/firms/detections/route';
import { getCurrentUser } from '@/lib/auth';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/firms/cache');
vi.mock('@/lib/observability/logger');
vi.mock('@/lib/ratelimit/slidingWindow', () => ({
  createFirmsRateLimiter: vi.fn(() => ({
    checkLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    }),
  })),
}));
vi.mock('@/lib/platform/circuitBreaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    canRequest: vi.fn().mockReturnValue(true),
    onSuccess: vi.fn(),
    onFailure: vi.fn(),
    reset: vi.fn(),
  })),
}));

// Helper to create authenticated request with map:read scope
function createAuthenticatedRequest() {
  return new Request('http://localhost/api/firms/detections');
}

// Mock authenticated user with map:read scope
function mockAuthenticatedUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-123',
    cin: '123',
    role: 'CIVILIAN' as const,
    scopes: ['map:read'],
  });
}

describe('FIRMS API Authentication & Error Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset cache to null to force API calls
    const { getCachedFirmsDetections, setCachedFirmsDetections } = await import('@/lib/firms/cache');
    vi.mocked(getCachedFirmsDetections).mockResolvedValue(null);
    vi.mocked(setCachedFirmsDetections).mockResolvedValue(undefined);
  });

  describe('API Key Validation', () => {
    it('should reject missing FIRMS_MAP_KEY', async () => {
      delete process.env.FIRMS_MAP_KEY;
      mockAuthenticatedUser();

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error.code).toBe(5001);
      expect(json.error.message).toContain('FIRMS_MAP_KEY');
    });

    it('should reject invalid API key format - too short', async () => {
      process.env.FIRMS_MAP_KEY = 'invalid-key-123';
      mockAuthenticatedUser();

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502);

      const json = await response.json();
      expect(json.error.code).toBe(5004);
      expect(json.error.message).toContain('32 hexadecimal characters');
      expect(json.error.meta.hint).toContain('https://firms.modaps.eosdis.nasa.gov');
    });

    it('should reject invalid API key format - wrong characters', async () => {
      process.env.FIRMS_MAP_KEY = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'; // Invalid hex
      mockAuthenticatedUser();

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502);

      const json = await response.json();
      expect(json.error.code).toBe(5004);
      expect(json.error.message).toContain('Invalid format');
    });

    it('should accept valid 32-character hex API key (lowercase)', async () => {
      process.env.FIRMS_MAP_KEY = 'a'.repeat(32);
      mockAuthenticatedUser();

      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv; charset=utf-8' }),
        text: () => Promise.resolve('latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,320.5,45.2,D')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(200);
    });

    it('should accept valid 32-character hex API key (mixed case)', async () => {
      process.env.FIRMS_MAP_KEY = 'AbCdEf0123456789aBcDeF0123456789';
      mockAuthenticatedUser();

      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: () => Promise.resolve('latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(200);
    });
  });

  describe('HTML Response Detection', () => {
    beforeEach(() => {
      process.env.FIRMS_MAP_KEY = 'b4039aa65200b6bb80100855ecab68fd'; // Valid format
      mockAuthenticatedUser();
    });

    it('should detect HTML login page and return error after exhausting all endpoints', async () => {
      const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head><title>NASA Earthdata Login</title></head>
<body>Authentication required</body>
</html>`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
        text: () => Promise.resolve(htmlResponse)
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502);

      const json = await response.json();
      // Both endpoints return HTML auth failure → AppError(4000) all endpoints failed
      expect(json.error.code).toBe(4000);
      expect(json.error.message).toContain('All FIRMS endpoints failed');
    });

    it('should handle earthdata.nasa.gov redirect page', async () => {
      const htmlResponse = `<!DOCTYPE html>
<html lang="en" xmlns:fb="http://ogp.me/ns/fb#">
<head>
  <meta charset="utf-8">
  <title>NASA Earthdata Login</title>
</head>
<body>
  <h1>Login Required</h1>
  <p>Please authenticate to access this resource.</p>
</body>
</html>`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve(htmlResponse)
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502);

      const json = await response.json();
      // Both endpoints return HTML → AppError(4000) all endpoints failed
      expect(json.error.code).toBe(4000);
    });

    it('should detect HTML even without explicit DOCTYPE', async () => {
      const htmlResponse = `<html><head><title>Error</title></head><body>Invalid credentials</body></html>`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        text: () => Promise.resolve(htmlResponse)
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502);

      const json = await response.json();
      expect(json.error.code).toBe(4000);
    });

    it('should accept valid CSV response', async () => {
      const csvResponse = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,320.5,45.2,D
33.6,-5.2,340.2,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,310.1,38.5,D`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv; charset=utf-8' }),
        text: () => Promise.resolve(csvResponse)
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.type).toBe('FeatureCollection');
      expect(data.features.length).toBe(2);
    });
  });

  describe('Rate Limiting & HTTP Errors', () => {
    beforeEach(() => {
      process.env.FIRMS_MAP_KEY = 'b4039aa65200b6bb80100855ecab68fd';
      mockAuthenticatedUser();
    });

    it('should handle NASA FIRMS rate limit (HTTP 429)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({
          'retry-after': '60',
          'content-type': 'text/plain'
        }),
        text: () => Promise.resolve('Rate limit exceeded')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure

      const json = await response.json();
      expect(json.error).toBeDefined();
      // Should trigger circuit breaker
    });

    it('should handle HTTP 401 Unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Unauthorized')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });

    it('should handle HTTP 403 Forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Forbidden')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });

    it('should handle HTTP 500 Internal Server Error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Internal Server Error')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });

    it('should handle HTTP 503 Service Unavailable', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({
          'content-type': 'text/plain',
          'retry-after': '120'
        }),
        text: () => Promise.resolve('Service Unavailable')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });
  });

  describe('Network & Timeout Errors', () => {
    beforeEach(() => {
      process.env.FIRMS_MAP_KEY = 'b4039aa65200b6bb80100855ecab68fd';
      mockAuthenticatedUser();
    });

    it('should handle network timeout across all endpoints', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 50);
        });
      });

      const response = await GET(createAuthenticatedRequest());
      // All endpoints timeout → AppError(4000) → 502
      expect(response.status).toBe(502);

      const json = await response.json();
      expect(json.error.code).toBe(4000);
      expect(json.error.message).toContain('All FIRMS endpoints failed');
    });

    it('should handle network connection failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });

    it('should handle DNS resolution failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // External service failure
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.FIRMS_MAP_KEY = 'b4039aa65200b6bb80100855ecab68fd';
      mockAuthenticatedUser();
    });

    it('should handle empty response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: () => Promise.resolve('')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // CSV validation fails, external API error

      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it('should handle response with only headers, no data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: () => Promise.resolve('latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.features).toHaveLength(0);
    });

    it('should handle mixed content type (text/html in CSV response)', async () => {
      // Simulates misconfigured server returning HTML with wrong content-type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: () => Promise.resolve('<!DOCTYPE html><html><body>Error</body></html>')
      });

      const response = await GET(createAuthenticatedRequest());
      expect(response.status).toBe(502); // CSV validation fails, external API error

      const json = await response.json();
      // Should be caught by CSV validation in transform
      expect(json.error).toBeDefined();
    });
  });
});
