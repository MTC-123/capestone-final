import { describe, expect, it } from 'vitest';
import {
  isAlertSource,
  isRecordStatus,
  isLockableSection,
  validateAgencyArrivals,
  validateMeansEngaged,
  validateEconomicLoss,
  createAuditEntry,
  isSectionLocked,
  ALERT_SOURCES,
  RECORD_STATUSES,
  LOCKABLE_SECTIONS,
} from '@/lib/fire-records/validation';

describe('Enum validators', () => {
  it('isAlertSource accepts all valid sources', () => {
    for (const src of ALERT_SOURCES) {
      expect(isAlertSource(src)).toBe(true);
    }
  });

  it('isAlertSource rejects invalid values', () => {
    expect(isAlertSource('DRONE')).toBe(false);
    expect(isAlertSource(123)).toBe(false);
    expect(isAlertSource(null)).toBe(false);
    expect(isAlertSource(undefined)).toBe(false);
  });

  it('isRecordStatus accepts all valid statuses', () => {
    for (const s of RECORD_STATUSES) {
      expect(isRecordStatus(s)).toBe(true);
    }
  });

  it('isRecordStatus rejects invalid values', () => {
    expect(isRecordStatus('PENDING')).toBe(false);
    expect(isRecordStatus('')).toBe(false);
  });

  it('isLockableSection accepts all valid sections', () => {
    for (const sec of LOCKABLE_SECTIONS) {
      expect(isLockableSection(sec)).toBe(true);
    }
  });

  it('isLockableSection rejects invalid values', () => {
    expect(isLockableSection('weather')).toBe(false);
    expect(isLockableSection(42)).toBe(false);
  });
});

describe('validateAgencyArrivals', () => {
  it('accepts a valid array', () => {
    const result = validateAgencyArrivals([
      { agencyName: 'Protection Civile', arrivedAt: '2026-01-15T10:30:00Z', personnelCount: 12 },
    ]);
    expect(result.valid).toBe(true);
  });

  it('accepts an empty array', () => {
    expect(validateAgencyArrivals([]).valid).toBe(true);
  });

  it('rejects non-array', () => {
    expect(validateAgencyArrivals('not-array').valid).toBe(false);
  });

  it('rejects entries with missing agencyName', () => {
    const result = validateAgencyArrivals([
      { arrivedAt: '2026-01-15T10:30:00Z', personnelCount: 5 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('agencyName');
  });

  it('rejects entries with missing arrivedAt', () => {
    const result = validateAgencyArrivals([
      { agencyName: 'Test', personnelCount: 5 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('arrivedAt');
  });

  it('rejects entries with negative personnelCount', () => {
    const result = validateAgencyArrivals([
      { agencyName: 'Test', arrivedAt: '2026-01-15T10:30:00Z', personnelCount: -1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('personnelCount');
  });
});

describe('validateMeansEngaged', () => {
  it('accepts valid means', () => {
    const result = validateMeansEngaged({
      vehicleCount: 3,
      aircraftCount: 1,
      personnelCount: 25,
      waterVolumeLiters: 10000,
      retardantVolumeLiters: 500,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects negative numbers', () => {
    const result = validateMeansEngaged({ vehicleCount: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('vehicleCount');
  });

  it('rejects non-numeric values', () => {
    const result = validateMeansEngaged({ personnelCount: 'many' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('personnelCount');
  });

  it('rejects non-object', () => {
    expect(validateMeansEngaged(null).valid).toBe(false);
  });
});

describe('validateEconomicLoss', () => {
  it('accepts valid economic loss', () => {
    const result = validateEconomicLoss({
      forestAreaHa: 50,
      infrastructureDamage: 100000,
      agricultureDamage: 50000,
      otherDamage: 10000,
      totalEstimate: 160000,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects negative values', () => {
    const result = validateEconomicLoss({ forestAreaHa: -5 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('forestAreaHa');
  });

  it('rejects non-object', () => {
    expect(validateEconomicLoss(undefined).valid).toBe(false);
  });
});

describe('createAuditEntry', () => {
  it('creates an entry with correct timestamp', () => {
    const before = new Date().toISOString();
    const entry = createAuditEntry('user-1', 'AB123456', 'UPDATE', 'timeline', { status: 'DRAFT' });
    const after = new Date().toISOString();

    expect(entry.userId).toBe('user-1');
    expect(entry.cin).toBe('AB123456');
    expect(entry.action).toBe('UPDATE');
    expect(entry.section).toBe('timeline');
    expect(entry.changes).toEqual({ status: 'DRAFT' });
    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
  });

  it('omits optional section and changes when not provided', () => {
    const entry = createAuditEntry('user-1', 'AB123456', 'CREATE');
    expect(entry.section).toBeUndefined();
    expect(entry.changes).toBeUndefined();
  });
});

describe('isSectionLocked', () => {
  it('detects locked response fields', () => {
    const result = isSectionLocked(['response'], ['alertSource', 'alertReceivedAt']);
    expect(result.locked).toBe(true);
    expect(result.section).toBe('response');
  });

  it('detects locked location fields', () => {
    const result = isSectionLocked(['location'], ['locationDetail']);
    expect(result.locked).toBe(true);
    expect(result.section).toBe('location');
  });

  it('returns false when section is not locked', () => {
    const result = isSectionLocked(['response'], ['locationDetail']);
    expect(result.locked).toBe(false);
  });

  it('returns false for unknown fields', () => {
    const result = isSectionLocked(['response'], ['unknownField']);
    expect(result.locked).toBe(false);
  });

  it('returns false for empty locked sections', () => {
    const result = isSectionLocked([], ['alertSource']);
    expect(result.locked).toBe(false);
  });
});
