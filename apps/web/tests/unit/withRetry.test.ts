import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/errors/context', () => ({
  logRetryAttempt: vi.fn(),
}));

import { withRetry } from '@/lib/database/withRetry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('returns on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42), 'test');
    expect(result).toBe(42);
  });

  it('retries on Prisma error and succeeds', async () => {
    let attempt = 0;
    const op = async () => {
      attempt++;
      if (attempt === 1) {
        const err = new Error('Connection lost');
        err.name = 'PrismaClientKnownRequestError';
        throw err;
      }
      return 'ok';
    };

    const promise = withRetry(op, 'test-retry');
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;
    expect(result).toBe('ok');
    expect(attempt).toBe(2);
  });

  it('throws immediately on non-Prisma error', async () => {
    const op = async () => { throw new Error('Not a Prisma error'); };
    await expect(withRetry(op, 'test-non-prisma')).rejects.toThrow('Not a Prisma error');
  });

  it('exhausts retries and throws', async () => {
    let attempts = 0;
    const prismaError = async () => {
      attempts++;
      const err = new Error('Connection reset');
      err.name = 'PrismaClientKnownRequestError';
      throw err;
    };

    let caughtError: Error | undefined;
    const promise = withRetry(prismaError, 'test-exhaust', 1).catch((e: Error) => {
      caughtError = e;
    });
    // Flush all timers to let all retries complete
    await vi.runAllTimersAsync();
    await promise;
    expect(caughtError?.message).toBe('Connection reset');
    expect(attempts).toBe(2); // 1 initial + 1 retry
  });
});
