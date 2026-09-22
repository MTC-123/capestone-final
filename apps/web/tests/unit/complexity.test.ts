import { describe, it, expect } from 'vitest';
import { computeSACILevel } from '@/lib/map/complexity';
import type { IncidentStatus } from '@/types';

describe('computeSACILevel', () => {
  describe('Level 3 — Complex', () => {
    it('returns level 3 when assignedResourceCount > 10', () => {
      const result = computeSACILevel(1, 'VIGILANCE', 11);
      expect(result.level).toBe(3);
      expect(result.label).toBe('Complex');
      expect(result.labelKey).toBe('complexity3');
      expect(result.color).toBe('#991b1b');
    });

    it('returns level 3 when severity >= 5', () => {
      const result = computeSACILevel(5, 'VIGILANCE', 0);
      expect(result.level).toBe(3);
    });

    it('returns level 3 when severity is 6 (above 5)', () => {
      const result = computeSACILevel(6, 'VIGILANCE', 0);
      expect(result.level).toBe(3);
    });

    it('returns level 3 when both severity >= 5 AND resources > 10', () => {
      const result = computeSACILevel(5, 'INTERVENTION', 15);
      expect(result.level).toBe(3);
    });
  });

  describe('Level 2 — Moderate', () => {
    it('returns level 2 when assignedResourceCount is exactly 3', () => {
      const result = computeSACILevel(1, 'VIGILANCE', 3);
      expect(result.level).toBe(2);
      expect(result.label).toBe('Moderate');
      expect(result.labelKey).toBe('complexity2');
      expect(result.color).toBe('#f59e0b');
    });

    it('returns level 2 when assignedResourceCount is 10 (boundary)', () => {
      const result = computeSACILevel(1, 'VIGILANCE', 10);
      expect(result.level).toBe(2);
    });

    it('returns level 2 when severity is 3', () => {
      const result = computeSACILevel(3, 'VIGILANCE', 0);
      expect(result.level).toBe(2);
    });

    it('returns level 2 when severity is 4', () => {
      const result = computeSACILevel(4, 'VIGILANCE', 0);
      expect(result.level).toBe(2);
    });

    it('returns level 2 when status is INTERVENTION (regardless of other params)', () => {
      const result = computeSACILevel(1, 'INTERVENTION', 0);
      expect(result.level).toBe(2);
    });
  });

  describe('Level 1 — Simple', () => {
    it('returns level 1 for low severity, low resources, non-intervention status', () => {
      const result = computeSACILevel(1, 'VIGILANCE', 0);
      expect(result.level).toBe(1);
      expect(result.label).toBe('Simple');
      expect(result.labelKey).toBe('complexity1');
      expect(result.color).toBe('#22c55e');
    });

    it('returns level 1 with severity 2 and 2 resources', () => {
      const result = computeSACILevel(2, 'VIGILANCE', 2);
      expect(result.level).toBe(1);
    });

    it('returns level 1 with ALERTE status but low severity and resources', () => {
      const result = computeSACILevel(1, 'ALERTE', 0);
      expect(result.level).toBe(1);
    });

    it('returns level 1 with MAITRISE status', () => {
      const result = computeSACILevel(1, 'MAITRISE', 0);
      expect(result.level).toBe(1);
    });

    it('returns level 1 with ETEINT status', () => {
      const result = computeSACILevel(1, 'ETEINT', 0);
      expect(result.level).toBe(1);
    });
  });

  describe('boundary conditions', () => {
    it('exactly 10 resources is level 2 (not level 3)', () => {
      expect(computeSACILevel(1, 'VIGILANCE', 10).level).toBe(2);
    });

    it('exactly 11 resources is level 3', () => {
      expect(computeSACILevel(1, 'VIGILANCE', 11).level).toBe(3);
    });

    it('severity 4 is level 2 (not level 3)', () => {
      expect(computeSACILevel(4, 'VIGILANCE', 0).level).toBe(2);
    });

    it('severity 5 is level 3', () => {
      expect(computeSACILevel(5, 'VIGILANCE', 0).level).toBe(3);
    });

    it('exactly 2 resources with severity 2 is level 1', () => {
      expect(computeSACILevel(2, 'VIGILANCE', 2).level).toBe(1);
    });

    it('exactly 3 resources is level 2 (not level 1)', () => {
      expect(computeSACILevel(1, 'VIGILANCE', 3).level).toBe(2);
    });

    it('0 resources and 0 severity is level 1', () => {
      expect(computeSACILevel(0, 'VIGILANCE', 0).level).toBe(1);
    });
  });

  describe('return shape', () => {
    it('always returns level, label, labelKey, and color', () => {
      const statuses: IncidentStatus[] = ['VIGILANCE', 'ALERTE', 'INTERVENTION', 'MAITRISE', 'ETEINT'];
      for (const status of statuses) {
        const result = computeSACILevel(1, status, 0);
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('labelKey');
        expect(result).toHaveProperty('color');
      }
    });
  });
});
