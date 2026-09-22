import { describe, it, vi, beforeEach, afterEach } from 'vitest';

describe('monitoring (import failures)', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    vi.doMock('@sentry/nextjs', () => {
      throw new Error('import fail');
    });
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
    vi.resetModules();
    vi.unmock('@sentry/nextjs');
  });

  it('swallows monitoring import failures', async () => {
    const { captureException } = await import('@/lib/observability/monitoring');
    await captureException(new Error('boom'), { requestId: 'req-x' });
  });
});

