import { describe, expect, it } from 'vitest';
import { guestReportSchema } from '@/lib/validation/guestReport';

const base = {
  clientSubmissionId: '3f693d47-bc54-479a-9224-32ec9e3e559b',
  observation: 'SMOKE',
  locationBasis: 'LANDMARK',
  capturedAt: '2026-09-26T10:00:00.000Z',
};

describe('guest fire report validation', () => {
  it('accepts a landmark report without a map pin or specialist fields', () => {
    const parsed = guestReportSchema.parse({ ...base, locationText: 'Cedar forest near Azrou' });
    expect(parsed.latitude).toBeUndefined();
    expect(parsed.description).toBe('');
    expect(parsed.images).toEqual([]);
  });

  it('keeps an observer position distinct from the fire location', () => {
    const parsed = guestReportSchema.parse({ ...base, locationBasis: 'OBSERVER', latitude: 33.44, longitude: -5.23, accuracyMeters: 18 });
    expect(parsed.locationBasis).toBe('OBSERVER');
    expect(parsed.latitude).toBe(33.44);
    expect(parsed.accuracyMeters).toBe(18);
  });

  it('rejects absent locations, incomplete coordinate pairs, and positions outside Morocco', () => {
    expect(guestReportSchema.safeParse(base).success).toBe(false);
    expect(guestReportSchema.safeParse({ ...base, latitude: 33.44 }).success).toBe(false);
    expect(guestReportSchema.safeParse({ ...base, latitude: 48.85, longitude: 2.35 }).success).toBe(false);
    expect(guestReportSchema.safeParse({ ...base, locationBasis: 'FIRE', locationText: 'Azrou' }).success).toBe(false);
  });

  it('rejects excessive photos', () => {
    const images = Array.from({ length: 4 }, (_, index) => `/api/uploads/${String(index + 1).padStart(24, '0')}`);
    expect(guestReportSchema.safeParse({ ...base, locationText: 'Azrou', images }).success).toBe(false);
  });

});
