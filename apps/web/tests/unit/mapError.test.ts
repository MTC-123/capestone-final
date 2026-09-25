import { describe, expect, it } from 'vitest';
import { mapUnknownToAppError } from '@/lib/errors/mapError';

describe('mapUnknownToAppError', () => {
  it('maps missing env errors to 5001 with missingEnv meta', () => {
    const err = new Error('Environment variable not found: DATABASE_URL.');
    const mapped = mapUnknownToAppError(err);
    expect(mapped.code).toBe(5001);
    expect(mapped.meta?.missingEnv).toEqual(['DATABASE_URL']);
  });

  it('maps a missing record (P2025) to 404, not a server failure', () => {
    const mapped = mapUnknownToAppError({ name: 'PrismaClientKnownRequestError', code: 'P2025', message: 'No record found' });
    expect(mapped.code).toBe(1003);
  });

  it('maps a malformed id (P2023) to 400', () => {
    const mapped = mapUnknownToAppError({ name: 'PrismaClientKnownRequestError', code: 'P2023', message: 'Malformed ObjectID' });
    expect(mapped.code).toBe(1000);
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

