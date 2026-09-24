import { describe, it, expect } from 'vitest';
import {
  maskPhone,
  maskEmail,
  maskRecipient,
  escapeCsvField,
  toCsv,
  getActionLabel,
  formatRelativeTime,
} from '@/components/admin/formatters';

describe('maskPhone', () => {
  it('keeps a short prefix and suffix, masking the middle', () => {
    expect(maskPhone('+212612345678')).toBe('+2126•••••678');
  });

  it('returns a placeholder for empty input', () => {
    expect(maskPhone(null)).toBe('—');
    expect(maskPhone(undefined)).toBe('—');
    expect(maskPhone('')).toBe('—');
  });

  it('returns short numbers unmasked', () => {
    expect(maskPhone('1234')).toBe('1234');
  });
});

describe('maskEmail', () => {
  it('keeps the first character of the local part and the full domain', () => {
    expect(maskEmail('jsmith@mail.com')).toBe('j•••@mail.com');
  });

  it('returns a placeholder for empty input', () => {
    expect(maskEmail(null)).toBe('—');
    expect(maskEmail('')).toBe('—');
  });

  it('returns the raw value when there is no @ sign', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});

describe('maskRecipient', () => {
  it('dispatches to email masking when the value contains @', () => {
    expect(maskRecipient('officer@ricer.ma')).toBe('o•••@ricer.ma');
  });

  it('dispatches to phone masking otherwise', () => {
    expect(maskRecipient('+212600000001')).toBe('+2126•••••001');
  });
});

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCsvField('Ifrane, Morocco')).toBe('"Ifrane, Morocco"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null/undefined as an empty field', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('builds a BOM-prefixed CSV with header and rows', () => {
    const csv = toCsv(['a', 'b'], [
      [1, 'x'],
      ['y, z', 3],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toEqual(['a,b', '1,x', '"y, z",3']);
  });
});

describe('getActionLabel', () => {
  const t = (key: string) => `label:${key}`;

  it('resolves a known action to its label key', () => {
    expect(getActionLabel('official_request.approve', t as never)).toBe(
      'label:auditActionOfficialRequestApprove'
    );
  });

  it('falls back to the raw action string when unmapped', () => {
    expect(getActionLabel('unknown.action', t as never)).toBe('unknown.action');
  });
});

describe('formatRelativeTime', () => {
  it('formats a past time in English', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const threeHoursAgo = new Date('2026-01-01T09:00:00Z');
    expect(formatRelativeTime(threeHoursAgo, 'en', now)).toBe('3 hours ago');
  });

  it('formats minutes correctly', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const fiveMinAgo = new Date('2026-01-01T11:55:00Z');
    expect(formatRelativeTime(fiveMinAgo, 'en', now)).toBe('5 minutes ago');
  });

  it('returns a placeholder for an invalid date', () => {
    expect(formatRelativeTime('not-a-date', 'en')).toBe('—');
  });
});
