import { describe, expect, it } from 'vitest';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { NextResponse } from 'next/server';

describe('withApiHandler performance', () => {
  it('adds less than 10ms average overhead per request', async () => {
    const handler = async () => NextResponse.json({ ok: true });
    const wrapped = withApiHandler(handler);
    const request = new Request('http://localhost/api/_test/errors', { method: 'GET' });

    const iterations = 200;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const response = await wrapped(request, {});
      await response.arrayBuffer();
    }
    const avg = (performance.now() - start) / iterations;
    expect(avg).toBeLessThan(10);
  });
});

