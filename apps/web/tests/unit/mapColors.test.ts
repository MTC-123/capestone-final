import { describe, it, expect } from 'vitest';
import {
  getFRPColor,
  INCIDENT_STATUS_COLORS,
  RESOURCE_TYPE_COLORS,
  TRUCK_STATUS_COLORS,
  FIRMS_CONFIDENCE_COLORS,
  FIRMS_FRP_GRADIENT,
  EFFIS_FWI_COLORS,
  EFFIS_BURNED_AREA_COLOR,
} from '@/lib/map/colors';

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

describe('Map Colors', () => {
  describe('getFRPColor', () => {
    it('returns low color for FRP 0', () => {
      expect(getFRPColor(0)).toBe(FIRMS_FRP_GRADIENT.low.color);
    });

    it('returns low color for FRP 9 (below medium threshold)', () => {
      expect(getFRPColor(9)).toBe(FIRMS_FRP_GRADIENT.low.color);
    });

    it('returns low color at threshold 10 (below medium 50)', () => {
      expect(getFRPColor(10)).toBe(FIRMS_FRP_GRADIENT.low.color);
    });

    it('returns low color for FRP 49 (below medium 50)', () => {
      expect(getFRPColor(49)).toBe(FIRMS_FRP_GRADIENT.low.color);
    });

    it('returns medium color at threshold 50', () => {
      expect(getFRPColor(50)).toBe(FIRMS_FRP_GRADIENT.medium.color);
    });

    it('returns high color at threshold 100', () => {
      expect(getFRPColor(100)).toBe(FIRMS_FRP_GRADIENT.high.color);
    });

    it('returns extreme color at threshold 200', () => {
      expect(getFRPColor(200)).toBe(FIRMS_FRP_GRADIENT.extreme.color);
    });

    it('returns extreme color for FRP 500', () => {
      expect(getFRPColor(500)).toBe(FIRMS_FRP_GRADIENT.extreme.color);
    });

    it('returns low color for negative FRP', () => {
      expect(getFRPColor(-5)).toBe(FIRMS_FRP_GRADIENT.low.color);
    });
  });

  describe('INCIDENT_STATUS_COLORS', () => {
    const expectedKeys = ['VIGILANCE', 'ALERTE', 'INTERVENTION', 'MAITRISE', 'ETEINT'];

    it('has all 5 status keys', () => {
      expect(Object.keys(INCIDENT_STATUS_COLORS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(INCIDENT_STATUS_COLORS)).toHaveLength(5);
    });

    it('all values are valid hex colors', () => {
      for (const color of Object.values(INCIDENT_STATUS_COLORS)) {
        expect(color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('RESOURCE_TYPE_COLORS', () => {
    const expectedKeys = ['TRUCK', 'AIRCRAFT', 'PERSONNEL', 'EQUIPMENT'];

    it('has all 4 resource keys', () => {
      expect(Object.keys(RESOURCE_TYPE_COLORS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(RESOURCE_TYPE_COLORS)).toHaveLength(4);
    });

    it('all values are valid hex colors', () => {
      for (const color of Object.values(RESOURCE_TYPE_COLORS)) {
        expect(color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('TRUCK_STATUS_COLORS', () => {
    const expectedKeys = ['Disponible', 'En route', 'En intervention'];

    it('has all 3 status keys', () => {
      expect(Object.keys(TRUCK_STATUS_COLORS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(TRUCK_STATUS_COLORS)).toHaveLength(3);
    });

    it('all values are valid hex colors', () => {
      for (const color of Object.values(TRUCK_STATUS_COLORS)) {
        expect(color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('FIRMS_CONFIDENCE_COLORS', () => {
    const expectedKeys = ['low', 'nominal', 'high'];

    it('has all 3 confidence keys', () => {
      expect(Object.keys(FIRMS_CONFIDENCE_COLORS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(FIRMS_CONFIDENCE_COLORS)).toHaveLength(3);
    });

    it('all values are valid hex colors', () => {
      for (const color of Object.values(FIRMS_CONFIDENCE_COLORS)) {
        expect(color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('FIRMS_FRP_GRADIENT', () => {
    it('thresholds are strictly ascending', () => {
      const thresholds = [
        FIRMS_FRP_GRADIENT.low.threshold,
        FIRMS_FRP_GRADIENT.medium.threshold,
        FIRMS_FRP_GRADIENT.high.threshold,
        FIRMS_FRP_GRADIENT.extreme.threshold,
      ];
      for (let i = 1; i < thresholds.length; i++) {
        expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
      }
    });

    it('all gradient colors are valid hex', () => {
      for (const entry of Object.values(FIRMS_FRP_GRADIENT)) {
        expect(entry.color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('EFFIS_FWI_COLORS', () => {
    const expectedKeys = ['low', 'moderate', 'high', 'extreme'];

    it('has all 4 FWI keys', () => {
      expect(Object.keys(EFFIS_FWI_COLORS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.keys(EFFIS_FWI_COLORS)).toHaveLength(4);
    });

    it('all values are valid hex colors', () => {
      for (const color of Object.values(EFFIS_FWI_COLORS)) {
        expect(color).toMatch(HEX_REGEX);
      }
    });
  });

  describe('EFFIS_BURNED_AREA_COLOR', () => {
    it('is a valid hex color', () => {
      expect(EFFIS_BURNED_AREA_COLOR).toMatch(HEX_REGEX);
    });
  });
});
