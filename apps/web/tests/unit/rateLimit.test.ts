import { describe, expect, it } from 'vitest';
import { checkErrorRateLimit, getClientIp } from '@/lib/errors/rateLimit';

describe('checkErrorRateLimit', () => {
  it('limits after max hits within the window', () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const r = checkErrorRateLimit(key, { windowMs: 60_000, max: 5 });
      expect(r.limited).toBe(false);
    }
    const limited = checkErrorRateLimit(key, { windowMs: 60_000, max: 5 });
    expect(limited.limited).toBe(true);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('extracts client IP from forwarded headers', () => {
    const req1 = new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } });
    expect(getClientIp(req1)).toBe('203.0.113.1');
    const req2 = new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.2' } });
    expect(getClientIp(req2)).toBe('203.0.113.2');
    const req3 = new Request('http://localhost');
    expect(getClientIp(req3)).toBe('unknown');
  });

  it('cleans up buckets when capacity is exceeded', () => {
    const prefix = `cleanup:${Date.now()}:`;
    for (let i = 0; i < 10050; i++) {
      checkErrorRateLimit(`${prefix}${i}`, { windowMs: 0, max: 1 });
    }
    const final = checkErrorRateLimit(`${prefix}final`, { windowMs: 0, max: 1 });
    expect(final.limited).toBe(false);
  });
});

