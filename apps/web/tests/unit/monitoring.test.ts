import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/nextjs', () => {
  const init = vi.fn();
  const captureException = vi.fn();
  const withScope = (fn: (scope: any) => void) => {
    const scope = {
      setTag: vi.fn(),
      setContext: vi.fn(),
    };
    fn(scope);
  };
  return { init, captureException, withScope };
});

describe('monitoring', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0';
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  });

  it('captures exceptions with tags when DSN is configured', async () => {
    const { captureException } = await import('@/lib/observability/monitoring');
    await captureException(new Error('boom'), {
      requestId: 'req-1',
      route: '/api/test',
      method: 'GET',
      code: 1001,
      severity: 'LOW',
      meta: { a: 1 },
    });

    const Sentry = await import('@sentry/nextjs');
    expect((Sentry as any).init).toHaveBeenCalled();
    expect((Sentry as any).captureException).toHaveBeenCalled();
  });

  it('does nothing when DSN is missing', async () => {
    process.env.SENTRY_DSN = '';
    const { captureException } = await import('@/lib/observability/monitoring');
    await captureException(new Error('boom'), { requestId: 'req-2' });
    const Sentry = await import('@sentry/nextjs');
    expect((Sentry as any).captureException).toHaveBeenCalledTimes(0);
  });
});

