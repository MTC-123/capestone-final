import { describe, it, expect } from 'vitest';
import {
  PMA_STEP_ORDER,
  getStepIndex,
  getNextStep,
  canAdvance,
  getStepLabelKey,
} from '@/lib/coordination/pmaSteps';
import type { PMAStepType } from '@/types/coordination';

describe('pmaSteps', () => {
  describe('PMA_STEP_ORDER', () => {
    it('has 9 steps', () => {
      expect(PMA_STEP_ORDER).toHaveLength(9);
    });

    it('starts with DETECTION', () => {
      expect(PMA_STEP_ORDER[0]).toBe('DETECTION');
    });

    it('ends with AIRCRAFT_ON_SCENE', () => {
      expect(PMA_STEP_ORDER[PMA_STEP_ORDER.length - 1]).toBe('AIRCRAFT_ON_SCENE');
    });

    it('contains all expected steps in order', () => {
      expect(PMA_STEP_ORDER).toEqual([
        'DETECTION',
        'VERIFICATION',
        'ASSESSMENT',
        'POI_ACTIVATION',
        'PMA_REQUEST',
        'PROVINCIAL_APPROVAL',
        'NATIONAL_RELAY',
        'AIRCRAFT_DISPATCH',
        'AIRCRAFT_ON_SCENE',
      ]);
    });
  });

  describe('getStepIndex', () => {
    it('returns 0 for DETECTION', () => {
      expect(getStepIndex('DETECTION')).toBe(0);
    });

    it('returns 4 for PMA_REQUEST', () => {
      expect(getStepIndex('PMA_REQUEST')).toBe(4);
    });

    it('returns 8 for AIRCRAFT_ON_SCENE (last step)', () => {
      expect(getStepIndex('AIRCRAFT_ON_SCENE')).toBe(8);
    });

    it('returns -1 for an unknown step', () => {
      expect(getStepIndex('NONEXISTENT' as PMAStepType)).toBe(-1);
    });

    it('returns correct index for every step', () => {
      PMA_STEP_ORDER.forEach((step, idx) => {
        expect(getStepIndex(step)).toBe(idx);
      });
    });
  });

  describe('getNextStep', () => {
    it('returns VERIFICATION after DETECTION', () => {
      expect(getNextStep('DETECTION')).toBe('VERIFICATION');
    });

    it('returns ASSESSMENT after VERIFICATION', () => {
      expect(getNextStep('VERIFICATION')).toBe('ASSESSMENT');
    });

    it('returns AIRCRAFT_ON_SCENE after AIRCRAFT_DISPATCH', () => {
      expect(getNextStep('AIRCRAFT_DISPATCH')).toBe('AIRCRAFT_ON_SCENE');
    });

    it('returns null for the last step (AIRCRAFT_ON_SCENE)', () => {
      expect(getNextStep('AIRCRAFT_ON_SCENE')).toBeNull();
    });

    it('returns null for an unknown step', () => {
      expect(getNextStep('NONEXISTENT' as PMAStepType)).toBeNull();
    });

    it('chains through all steps correctly', () => {
      let current: PMAStepType | null = 'DETECTION';
      const visited: PMAStepType[] = [current];
      while (current) {
        current = getNextStep(current);
        if (current) visited.push(current);
      }
      expect(visited).toEqual(PMA_STEP_ORDER);
    });
  });

  describe('canAdvance', () => {
    it('returns true for consecutive steps (DETECTION -> VERIFICATION)', () => {
      expect(canAdvance('DETECTION', 'VERIFICATION')).toBe(true);
    });

    it('returns true for consecutive steps (PMA_REQUEST -> PROVINCIAL_APPROVAL)', () => {
      expect(canAdvance('PMA_REQUEST', 'PROVINCIAL_APPROVAL')).toBe(true);
    });

    it('returns false for skipping a step (DETECTION -> ASSESSMENT)', () => {
      expect(canAdvance('DETECTION', 'ASSESSMENT')).toBe(false);
    });

    it('returns false for going backward (VERIFICATION -> DETECTION)', () => {
      expect(canAdvance('VERIFICATION', 'DETECTION')).toBe(false);
    });

    it('returns false for the same step', () => {
      expect(canAdvance('DETECTION', 'DETECTION')).toBe(false);
    });

    it('returns false when current is the last step', () => {
      expect(canAdvance('AIRCRAFT_ON_SCENE', 'DETECTION')).toBe(false);
    });

    it('returns true when unknown current maps to index -1 and next is index 0 (edge case)', () => {
      // indexOf returns -1 for unknown, and DETECTION is at 0, so -1+1===0 is true
      expect(canAdvance('NONEXISTENT' as PMAStepType, 'DETECTION')).toBe(true);
    });

    it('returns false when both steps are unknown', () => {
      expect(canAdvance('NONEXISTENT' as PMAStepType, 'ALSO_UNKNOWN' as PMAStepType)).toBe(false);
    });

    it('returns true for every valid consecutive pair', () => {
      for (let i = 0; i < PMA_STEP_ORDER.length - 1; i++) {
        expect(canAdvance(PMA_STEP_ORDER[i], PMA_STEP_ORDER[i + 1])).toBe(true);
      }
    });

    it('returns false for every non-consecutive pair', () => {
      for (let i = 0; i < PMA_STEP_ORDER.length - 2; i++) {
        expect(canAdvance(PMA_STEP_ORDER[i], PMA_STEP_ORDER[i + 2])).toBe(false);
      }
    });
  });

  describe('getStepLabelKey', () => {
    it('returns pmaDetection for DETECTION', () => {
      expect(getStepLabelKey('DETECTION')).toBe('pmaDetection');
    });

    it('returns pmaVerification for VERIFICATION', () => {
      expect(getStepLabelKey('VERIFICATION')).toBe('pmaVerification');
    });

    it('returns pmaPOIActivation for POI_ACTIVATION', () => {
      expect(getStepLabelKey('POI_ACTIVATION')).toBe('pmaPOIActivation');
    });

    it('returns pmaAircraftOnScene for AIRCRAFT_ON_SCENE', () => {
      expect(getStepLabelKey('AIRCRAFT_ON_SCENE')).toBe('pmaAircraftOnScene');
    });

    it('returns a label key for every step', () => {
      PMA_STEP_ORDER.forEach((step) => {
        const key = getStepLabelKey(step);
        expect(key).toBeTruthy();
        expect(typeof key).toBe('string');
      });
    });

    it('all label keys start with "pma"', () => {
      PMA_STEP_ORDER.forEach((step) => {
        expect(getStepLabelKey(step)).toMatch(/^pma/);
      });
    });

    it('all label keys are unique', () => {
      const keys = PMA_STEP_ORDER.map(getStepLabelKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
