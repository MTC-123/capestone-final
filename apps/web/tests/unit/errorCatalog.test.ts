import { describe, expect, it } from 'vitest';
import { ERROR_CATALOG, getCatalogEntry } from '@/lib/errors/catalog';
import { ERROR_CODE_RANGES } from '@/lib/errors/types';
import { translations } from '@/i18n/translations';

describe('ERROR_CATALOG', () => {
  it('uses unique numeric codes', () => {
    const codes = Object.values(ERROR_CATALOG).map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps codes within declared taxonomy ranges', () => {
    const ranges = Object.entries(ERROR_CODE_RANGES) as [string, { min: number; max: number }][];
    for (const e of Object.values(ERROR_CATALOG)) {
      const range = ranges.find(([, r]) => e.code >= r.min && e.code <= r.max)?.[0] ?? null;
      expect(range, `code ${e.code} (${e.name}) is outside all declared taxonomy ranges`).not.toBeNull();
    }
  });

  it('references existing localization keys', () => {
    for (const e of Object.values(ERROR_CATALOG)) {
      expect(translations.ar[e.userMessageKey]).toBeTruthy();
      expect(translations.fr[e.userMessageKey]).toBeTruthy();
      expect(translations.en[e.userMessageKey]).toBeTruthy();
    }
  });

  it('falls back to SYSTEM_UNEXPECTED for unknown codes', () => {
    expect(getCatalogEntry(9999).code).toBe(5000);
  });
});

