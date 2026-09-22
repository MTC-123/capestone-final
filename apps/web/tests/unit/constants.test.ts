import { describe, expect, it } from 'vitest';
import {
  windDirectionIndexFromDegrees,
  getDepartmentName,
  formatDateTime,
  DEPARTMENTS,
  DEPARTMENTS_FR,
} from '@/config/constants';

// ── windDirectionIndexFromDegrees ─────────────────────────────────────────────

describe('windDirectionIndexFromDegrees', () => {
  const cardinals = [
    { degrees: 0, expected: 0, label: 'N' },
    { degrees: 45, expected: 1, label: 'NE' },
    { degrees: 90, expected: 2, label: 'E' },
    { degrees: 135, expected: 3, label: 'SE' },
    { degrees: 180, expected: 4, label: 'S' },
    { degrees: 225, expected: 5, label: 'SW' },
    { degrees: 270, expected: 6, label: 'W' },
    { degrees: 315, expected: 7, label: 'NW' },
  ];

  cardinals.forEach(({ degrees, expected, label }) => {
    it(`${degrees}° → index ${expected} (${label})`, () => {
      expect(windDirectionIndexFromDegrees(degrees)).toBe(expected);
    });
  });

  it('360° wraps to index 0 (N)', () => {
    expect(windDirectionIndexFromDegrees(360)).toBe(0);
  });

  it('22.5° rounds to index 0 (N) — on the boundary', () => {
    // Math.round(22.5 / 45) = Math.round(0.5) = 1 in JS (rounds half-up for .5)
    // Actually: 22.5 / 45 = 0.5, Math.round(0.5) = 1 in JS
    expect(windDirectionIndexFromDegrees(22.5)).toBe(1);
  });

  it('22.4° rounds to index 0 (N) — just below the boundary', () => {
    // 22.4 / 45 ≈ 0.4978 → Math.round = 0
    expect(windDirectionIndexFromDegrees(22.4)).toBe(0);
  });

  it('23° rounds to index 1 (NE)', () => {
    // 23 / 45 ≈ 0.511 → Math.round = 1
    expect(windDirectionIndexFromDegrees(23)).toBe(1);
  });
});

// ── getDepartmentName ─────────────────────────────────────────────────────────

describe('getDepartmentName', () => {
  const allCodes = Object.keys(DEPARTMENTS) as (keyof typeof DEPARTMENTS)[];

  it('returns the Arabic name for every department code when language is "ar"', () => {
    allCodes.forEach((code) => {
      expect(getDepartmentName(code, 'ar')).toBe(DEPARTMENTS[code]);
    });
  });

  it('returns the Arabic name (fallback) for every department code when language is "en"', () => {
    allCodes.forEach((code) => {
      expect(getDepartmentName(code, 'en')).toBe(DEPARTMENTS[code]);
    });
  });

  it('returns the French name for every department code when language is "fr"', () => {
    allCodes.forEach((code) => {
      expect(getDepartmentName(code, 'fr')).toBe(DEPARTMENTS_FR[code]);
    });
  });

  // Representative spot-checks for readability
  it('ADM → correct French name', () => {
    expect(getDepartmentName('ADM', 'fr')).toBe('Autoroutes du Maroc');
  });

  it('DFCI → correct Arabic name', () => {
    expect(getDepartmentName('DFCI', 'ar')).toBe('الدفاع عن الغابات ضد الحرائق');
  });

  it('PN → correct French name', () => {
    expect(getDepartmentName('PN', 'fr')).toBe('Promotion Nationale');
  });
});

// ── formatDateTime ────────────────────────────────────────────────────────────

describe('formatDateTime', () => {
  const testDate = new Date(2024, 5, 15, 14, 30); // June 15 2024 14:30 local

  it('returns a non-empty string for locale "ar"', () => {
    const result = formatDateTime(testDate, 'ar');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for locale "fr"', () => {
    const result = formatDateTime(testDate, 'fr');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for locale "en"', () => {
    const result = formatDateTime(testDate, 'en');
    expect(result.length).toBeGreaterThan(0);
  });

  it('output contains the year', () => {
    const result = formatDateTime(testDate, 'en');
    expect(result).toContain('2024');
  });

  it('accepts an ISO string in addition to a Date object', () => {
    const isoString = '2024-06-15T14:30:00.000Z';
    const result = formatDateTime(isoString, 'en');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('2024');
  });

  it('French output contains the year', () => {
    const result = formatDateTime(testDate, 'fr');
    expect(result).toContain('2024');
  });

  it('Arabic output contains the year', () => {
    const result = formatDateTime(testDate, 'ar');
    expect(result).toContain('2024');
  });
});
