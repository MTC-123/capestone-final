import { describe, expect, it } from 'vitest';
import { getRequestLocale } from '@/lib/errors/withApiHandler';

describe('getRequestLocale', () => {
  it('prefers the ricer-language cookie', () => {
    const req = new Request('http://localhost', { headers: { cookie: 'ricer-language=fr' } });
    expect(getRequestLocale(req)).toBe('fr');
  });

  it('falls back to Accept-Language', () => {
    const req = new Request('http://localhost', { headers: { 'accept-language': 'ar-MA,fr;q=0.8,en;q=0.7' } });
    expect(getRequestLocale(req)).toBe('ar');
  });

  it('defaults to en when locale is unknown', () => {
    const req = new Request('http://localhost', { headers: { 'accept-language': 'de-DE,de;q=0.9' } });
    expect(getRequestLocale(req)).toBe('en');
  });
});

