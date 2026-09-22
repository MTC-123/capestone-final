import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatValueForError,
  labelOperation,
  captureExternalApiError,
  logRetryAttempt,
  validationError,
} from '@/lib/errors/context';
import { AppError } from '@/lib/errors/AppError';

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/observability/logger';

describe('Error Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatValueForError', () => {
    it('returns "undefined" for undefined', () => {
      expect(formatValueForError(undefined)).toBe('undefined');
    });

    it('returns "null" for null', () => {
      expect(formatValueForError(null)).toBe('null');
    });

    it('returns short string as-is', () => {
      expect(formatValueForError('hello')).toBe('hello');
    });

    it('truncates strings longer than 100 characters', () => {
      const long = 'x'.repeat(150);
      const result = formatValueForError(long);
      expect(result).toHaveLength(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('stringifies objects', () => {
      expect(formatValueForError({ a: 1 })).toBe('{"a":1}');
    });

    it('falls back to String() for circular references', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const result = formatValueForError(circular);
      expect(result).toBe('[object Object]');
    });

    it('stringifies numbers', () => {
      expect(formatValueForError(42)).toBe('42');
    });

    it('stringifies arrays', () => {
      expect(formatValueForError([1, 2])).toBe('[1,2]');
    });
  });

  describe('labelOperation', () => {
    it('passes through a resolving promise', async () => {
      const result = await labelOperation(Promise.resolve(42), 'test-op');
      expect(result).toBe(42);
    });

    it('wraps a rejection in AppError(5000) with label in meta', async () => {
      const failing = Promise.reject(new Error('boom'));
      await expect(labelOperation(failing, 'fetch-data')).rejects.toThrow(AppError);

      try {
        await labelOperation(Promise.reject(new Error('boom2')), 'fetch-data');
      } catch (err) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(5000);
        expect(appErr.meta?.operation).toBe('fetch-data');
        expect(appErr.meta?.originalMessage).toBe('boom2');
        expect(appErr.message).toBe('Operation "fetch-data" failed');
      }
    });

    it('extracts code/name/message from original error', async () => {
      const original = Object.assign(new Error('oops'), { code: 'ECONNREFUSED' });
      try {
        await labelOperation(Promise.reject(original), 'connect');
      } catch (err) {
        const appErr = err as AppError;
        expect(appErr.meta?.originalCode).toBe('ECONNREFUSED');
        expect(appErr.meta?.originalName).toBe('Error');
      }
    });

    it('handles non-Error rejection values', async () => {
      try {
        await labelOperation(Promise.reject('string-error'), 'op');
      } catch (err) {
        const appErr = err as AppError;
        expect(appErr.code).toBe(5000);
        expect(appErr.meta?.operation).toBe('op');
      }
    });
  });

  describe('captureExternalApiError', () => {
    const baseContext = {
      provider: 'NASA FIRMS',
      url: 'https://firms.modaps.eosdis.nasa.gov/api',
      method: 'GET',
      startedAt: performance.now() - 500,
    };

    it('returns AppError with code 4000', () => {
      const result = captureExternalApiError(baseContext, new Error('timeout'));
      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(4000);
    });

    it('calls logger.error', () => {
      captureExternalApiError(baseContext, new Error('fail'));
      expect(logger.error).toHaveBeenCalledOnce();
    });

    it('includes provider, url, method in meta', () => {
      const result = captureExternalApiError(baseContext, new Error('fail'));
      expect(result.meta?.provider).toBe('NASA FIRMS');
      expect(result.meta?.url).toBe(baseContext.url);
      expect(result.meta?.method).toBe('GET');
    });

    it('calculates durationMs from startedAt when not provided', () => {
      const result = captureExternalApiError(baseContext, new Error('fail'));
      expect(typeof result.meta?.durationMs).toBe('number');
      expect(result.meta?.durationMs as number).toBeGreaterThan(0);
    });

    it('uses explicit durationMs when provided', () => {
      const ctx = { ...baseContext, durationMs: 123 };
      const result = captureExternalApiError(ctx, new Error('fail'));
      expect(result.meta?.durationMs).toBe(123);
    });

    it('includes optional responseStatus', () => {
      const ctx = { ...baseContext, responseStatus: 503 };
      const result = captureExternalApiError(ctx, new Error('fail'));
      expect(result.meta?.responseStatus).toBe(503);
    });

    it('includes optional responseHeaders', () => {
      const headers = { 'retry-after': '60' };
      const ctx = { ...baseContext, responseHeaders: headers };
      const result = captureExternalApiError(ctx, new Error('fail'));
      expect(result.meta?.responseHeaders).toEqual(headers);
    });

    it('includes optional responseBodyPreview', () => {
      const ctx = { ...baseContext, responseBodyPreview: '{"error":"rate limited"}' };
      const result = captureExternalApiError(ctx, new Error('fail'));
      expect(result.meta?.responseBodyPreview).toBe('{"error":"rate limited"}');
    });

    it('omits optional fields when not provided', () => {
      const result = captureExternalApiError(baseContext, new Error('fail'));
      expect(result.meta).not.toHaveProperty('responseStatus');
      expect(result.meta).not.toHaveProperty('responseHeaders');
      expect(result.meta).not.toHaveProperty('responseBodyPreview');
    });
  });

  describe('logRetryAttempt', () => {
    it('calls logger.warn', () => {
      logRetryAttempt({
        operation: 'fetchIncidents',
        attempt: 2,
        maxAttempts: 3,
        cumulativeDurationMs: 500,
      });
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('sets isLastAttempt true when attempt >= maxAttempts', () => {
      logRetryAttempt({
        operation: 'fetchIncidents',
        attempt: 3,
        maxAttempts: 3,
        cumulativeDurationMs: 1500,
      });
      const call = vi.mocked(logger.warn).mock.calls[0][0] as Record<string, unknown>;
      const meta = call.meta as Record<string, unknown>;
      expect(meta.isLastAttempt).toBe(true);
    });

    it('sets isLastAttempt false when attempt < maxAttempts', () => {
      logRetryAttempt({
        operation: 'fetchIncidents',
        attempt: 1,
        maxAttempts: 3,
        cumulativeDurationMs: 200,
      });
      const call = vi.mocked(logger.warn).mock.calls[0][0] as Record<string, unknown>;
      const meta = call.meta as Record<string, unknown>;
      expect(meta.isLastAttempt).toBe(false);
    });

    it('includes lastError and classification when provided', () => {
      logRetryAttempt({
        operation: 'dbQuery',
        attempt: 2,
        maxAttempts: 3,
        cumulativeDurationMs: 800,
        lastError: 'connection reset',
        classification: 'network',
      });
      const call = vi.mocked(logger.warn).mock.calls[0][0] as Record<string, unknown>;
      const meta = call.meta as Record<string, unknown>;
      expect(meta.lastError).toBe('connection reset');
      expect(meta.classification).toBe('network');
    });
  });

  describe('validationError', () => {
    it('returns AppError with code 1001', () => {
      const err = validationError('email', 'invalid_format', 'not-an-email');
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(1001);
    });

    it('uses default message when none provided', () => {
      const err = validationError('email', 'invalid_format', 'bad');
      expect(err.message).toBe('Validation failed for field "email"');
    });

    it('uses custom message when provided', () => {
      const err = validationError('email', 'invalid_format', 'bad', 'Email is malformed');
      expect(err.message).toBe('Email is malformed');
    });

    it('includes fields array with correct structure', () => {
      const err = validationError('lat', 'out_of_range', 95);
      expect(err.fields).toHaveLength(1);
      expect(err.fields![0].field).toBe('lat');
      expect(err.fields![0].code).toBe('out_of_range');
    });

    it('stores invalidValues in meta', () => {
      const err = validationError('coords', 'invalid', [999, 999]);
      expect(err.meta?.invalidValues).toEqual({ coords: [999, 999] });
    });
  });
});
