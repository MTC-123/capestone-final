import { describe, expect, it } from 'vitest';
import { mapUnknownToAppError } from '@/lib/errors/mapError';

describe('mapUnknownToAppError', () => {
  it('maps missing env errors to 5001 with missingEnv meta', () => {
    const err = new Error('Environment variable not found: DATABASE_URL.');
    const mapped = mapUnknownToAppError(err);
    expect(mapped.code).toBe(5001);
    expect(mapped.meta?.missingEnv).toEqual(['DATABASE_URL']);
  });

  it('maps prisma-like errors to 5002', () => {
    const err = { name: 'PrismaClientKnownRequestError', message: 'boom' };
    const mapped = mapUnknownToAppError(err);
    expect(mapped.code).toBe(5002);
  });

  it('maps unknown errors to 5000', () => {
    const mapped = mapUnknownToAppError({ message: 'x' });
    expect(mapped.code).toBe(5000);
  });
});

