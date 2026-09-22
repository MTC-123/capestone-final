import { describe, expect, it } from 'vitest';
import { deriveScopes, hashRefreshToken, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '@/lib/auth';

describe('auth tokens', () => {
  it('issues and verifies access tokens with scopes', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    const token = signAccessToken({ userId: 'u1', cin: 'c1', role: 'CIVILIAN', scopes: deriveScopes('CIVILIAN') });
    const decoded = verifyAccessToken(token);
    expect(decoded?.tokenUse).toBe('access');
    expect(decoded?.userId).toBe('u1');
    expect(Array.isArray(decoded?.scopes)).toBe(true);
    expect(decoded?.scopes.includes('map:read')).toBe(true);
  });

  it('issues and verifies refresh tokens with jti', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    const token = signRefreshToken({ userId: 'u1', jti: 'jti-1', scopes: deriveScopes('OFFICIAL') });
    const decoded = verifyRefreshToken(token);
    expect(decoded?.tokenUse).toBe('refresh');
    expect(decoded?.jti).toBe('jti-1');
    expect(decoded?.scopes.includes('map:read')).toBe(true);
  });

  it('hashes refresh tokens deterministically', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    const token = signRefreshToken({ userId: 'u1', jti: 'jti-2', scopes: ['map:read'] });
    const h1 = hashRefreshToken(token);
    const h2 = hashRefreshToken(token);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

