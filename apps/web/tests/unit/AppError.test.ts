import { describe, expect, it } from 'vitest';
import { AppError, asAppError, isAppError } from '@/lib/errors/AppError';

describe('AppError', () => {
  it('detects AppError instances', () => {
    const err = new AppError(1000);
    expect(isAppError(err)).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
  });

  it('converts unknown errors to AppError(5000)', () => {
    const original = new Error('boom');
    const converted = asAppError(original);
    expect(converted.code).toBe(5000);
    expect(converted.cause).toBe(original);
    expect(asAppError(converted)).toBe(converted);
  });
});

