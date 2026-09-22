import { describe, expect, it } from 'vitest';
import { getApiErrorUserMessage, getApiFieldErrors, isApiErrorResponse, getApiRequestId } from '@/lib/errors/sdk';

describe('error sdk', () => {
  it('detects standardized API errors', () => {
    const payload = {
      error: {
        code: 1001,
        message: 'Validation failed',
        userMessage: 'Please fix fields',
        severity: 'LOW',
        timestamp: new Date().toISOString(),
        requestId: 'req-1',
      },
    };
    expect(isApiErrorResponse(payload)).toBe(true);
    expect(getApiErrorUserMessage(payload, 'fallback')).toBe('Please fix fields');
    expect(getApiRequestId(payload)).toBe('req-1');
  });

  it('returns safe fallbacks for non-standard errors', () => {
    expect(isApiErrorResponse({})).toBe(false);
    expect(getApiErrorUserMessage({}, 'fallback')).toBe('fallback');
    expect(getApiFieldErrors({})).toEqual([]);
  });
});

