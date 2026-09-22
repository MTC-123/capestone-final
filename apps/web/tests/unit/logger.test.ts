import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@/lib/observability/logger';

describe('logger', () => {
  const original = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    debug: console.debug,
  };

  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    console.error = original.error;
    console.warn = original.warn;
    console.log = original.log;
    console.debug = original.debug;
  });

  it('writes structured JSON for each log level', () => {
    logger.error({ event: 'e' });
    logger.warn({ event: 'w' });
    logger.info({ event: 'i' });
    logger.debug({ event: 'd' });

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.debug).toHaveBeenCalledTimes(1);

    const [line] = (console.error as any).mock.calls[0];
    const parsed = JSON.parse(line);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('level', 'error');
    expect(parsed).toHaveProperty('event', 'e');
  });
});

