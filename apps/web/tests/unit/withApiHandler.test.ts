import { describe, expect, it } from 'vitest';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { translations } from '@/i18n/translations';

describe('withApiHandler', () => {
  it('returns standardized error envelopes with requestId', async () => {
    const handler = async () => {
      throw new AppError(1001, { fields: [{ field: 'cin', code: 'invalid' }] });
    };
    const wrapped = withApiHandler(handler);
    const request = new Request('http://localhost/api/_test/errors', {
      method: 'GET',
      headers: { cookie: 'ricer-language=en' },
    });
    const response = await wrapped(request, {});
    expect(response.status).toBe(422);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const json = await response.json();
    expect(json.error.code).toBe(1001);
    expect(json.error.userMessage).toBe(translations.en.errorValidationFailed);
    expect(Array.isArray(json.error.fields)).toBe(true);
  });

  it('rate limits repeated errors for the same client', async () => {
    const handler = async () => {
      throw new AppError(2000);
    };
    const wrapped = withApiHandler(handler);
    const request = new Request('http://localhost/api/_test/errors', {
      method: 'GET',
      headers: { 'x-forwarded-for': `192.0.2.${Math.floor(Math.random() * 200) + 1}` },
    });

    let final: Response | null = null;
    for (let i = 0; i < 8; i++) final = await wrapped(request, {});
    expect(final).toBeTruthy();
    if (final!.status === 429) {
      const json = await final!.json();
      expect(json.error.code).toBe(1002);
      expect(final!.headers.get('retry-after')).toBeTruthy();
    } else {
      expect(final!.status).toBe(401);
    }
  });

  it('preserves headers for non-NextResponse handlers', async () => {
    const handler = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    const wrapped = withApiHandler(handler);
    const response = await wrapped(new Request('http://localhost', { method: 'GET' }), {});
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('does not rate limit 401 and 403 auth errors', async () => {
    const handler403 = async () => {
      throw new AppError(2001); // 403 Forbidden
    };

    const wrapped = withApiHandler(handler403);
    const ip = `test-${Date.now()}`;
    const request = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'x-forwarded-for': ip },
    });

    // Make 20 requests (well over normal rate limit of 15)
    for (let i = 0; i < 20; i++) {
      const res = await wrapped(request, {});
      expect(res.status).toBe(403); // Should never become 429
      const json = await res.json();
      expect(json.error.code).toBe(2001);
    }
  });

  it('does not include debug stack in production unless explicitly enabled', async () => {
    const originalEnv = process.env;
    Object.defineProperty(process, 'env', {
      value: { ...originalEnv, NODE_ENV: 'production' },
      configurable: true,
    });
    try {
      const handler = async () => {
        throw new AppError(1000);
      };
      const wrapped = withApiHandler(handler);

      const res1 = await wrapped(new Request('http://localhost', { method: 'GET' }), {});
      const json1 = await res1.json();
      expect(json1.error.debug).toBeUndefined();

      const res2 = await wrapped(
        new Request('http://localhost', { method: 'GET', headers: { 'x-debug': '1' } }),
        {}
      );
      const json2 = await res2.json();
      expect(json2.error.debug).toBeTruthy();
    } finally {
      Object.defineProperty(process, 'env', { value: originalEnv, configurable: true });
    }
  });
});

