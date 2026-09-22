import { describe, it, expect } from 'vitest';
import { computePOILevel } from '@/lib/map/poiLevel';
import type { IncidentStatus } from '@/types';

describe('computePOILevel', () => {
  describe('Level 3 — National', () => {
    it('returns level 3 when severity >= 5', () => {
      const result = computePOILevel(5, 'VIGILANCE');
      expect(result.level).toBe(3);
      expect(result.label).toBe('National');
      expect(result.labelKey).toBe('poiLevel3');
    });

    it('returns level 3 when severity is 6', () => {
      expect(computePOILevel(6, 'VIGILANCE').level).toBe(3);
    });

    it('returns level 3 when status is INTERVENTION', () => {
      const result = computePOILevel(1, 'INTERVENTION');
      expect(result.level).toBe(3);
    });

    it('returns level 3 when both severity >= 5 and status is INTERVENTION', () => {
      expect(computePOILevel(5, 'INTERVENTION').level).toBe(3);
    });
  });

  describe('Level 2 — Provincial', () => {
    it('returns level 2 when severity is 3', () => {
      const result = computePOILevel(3, 'VIGILANCE');
      expect(result.level).toBe(2);
      expect(result.label).toBe('Provincial');
      expect(result.labelKey).toBe('poiLevel2');
    });

    it('returns level 2 when severity is 4', () => {
      expect(computePOILevel(4, 'VIGILANCE').level).toBe(2);
    });

    it('returns level 2 when status is ALERTE', () => {
      const result = computePOILevel(1, 'ALERTE');
      expect(result.level).toBe(2);
    });

    it('returns level 2 for severity 3 with ALERTE', () => {
      expect(computePOILevel(3, 'ALERTE').level).toBe(2);
    });
  });

  describe('Level 1 — Local', () => {
    it('returns level 1 for low severity and non-escalated status', () => {
      const result = computePOILevel(1, 'VIGILANCE');
      expect(result.level).toBe(1);
      expect(result.label).toBe('Local');
      expect(result.labelKey).toBe('poiLevel1');
    });

    it('returns level 1 for severity 2 and VIGILANCE', () => {
      expect(computePOILevel(2, 'VIGILANCE').level).toBe(1);
    });

    it('returns level 1 for severity 0 and MAITRISE', () => {
      expect(computePOILevel(0, 'MAITRISE').level).toBe(1);
    });

    it('returns level 1 for severity 0 and ETEINT', () => {
      expect(computePOILevel(0, 'ETEINT').level).toBe(1);
    });

    it('returns level 1 for severity 2 and MAITRISE', () => {
      expect(computePOILevel(2, 'MAITRISE').level).toBe(1);
    });
  });

  describe('boundary conditions', () => {
    it('severity 4 is level 2, not level 3', () => {
      expect(computePOILevel(4, 'VIGILANCE').level).toBe(2);
    });

    it('severity 5 is level 3', () => {
      expect(computePOILevel(5, 'VIGILANCE').level).toBe(3);
    });

    it('severity 2 is level 1, not level 2', () => {
      expect(computePOILevel(2, 'VIGILANCE').level).toBe(1);
    });

    it('severity 3 is level 2', () => {
      expect(computePOILevel(3, 'VIGILANCE').level).toBe(2);
    });

    it('severity 0 is level 1', () => {
      expect(computePOILevel(0, 'VIGILANCE').level).toBe(1);
    });
  });

  describe('all statuses', () => {
    it.each<[IncidentStatus, number, number]>([
      ['VIGILANCE', 1, 1],
      ['ALERTE', 1, 2],
      ['INTERVENTION', 1, 3],
      ['MAITRISE', 1, 1],
      ['ETEINT', 1, 1],
    ])('status %s with severity %i gives level %i', (status, severity, expectedLevel) => {
      expect(computePOILevel(severity, status).level).toBe(expectedLevel);
    });
  });

  describe('return shape', () => {
    it('always returns level, label, and labelKey', () => {
      const result = computePOILevel(1, 'VIGILANCE');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('labelKey');
      expect(typeof result.level).toBe('number');
      expect(typeof result.label).toBe('string');
      expect(typeof result.labelKey).toBe('string');
    });
  });
});
