import { describe, expect, it } from 'vitest';
import { translations } from '@/i18n/translations';

describe('translations', () => {
  it('keeps ar, fr, and en keys in sync', () => {
    const arKeys = Object.keys(translations.ar).sort();
    const frKeys = Object.keys(translations.fr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(frKeys).toEqual(arKeys);
    expect(enKeys).toEqual(arKeys);
  });
});

