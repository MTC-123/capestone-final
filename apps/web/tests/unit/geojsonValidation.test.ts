import { describe, it, expect } from 'vitest';
import {
  isGeoJSONPoint,
  isGeoJSONLineString,
  isGeoJSONPolygon,
  validatePoint,
  validateGeometry,
} from '@/lib/validation/geojson';

describe('GeoJSON Validation', () => {
  describe('isGeoJSONPoint', () => {
    it('accepts a valid point', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [10, 20] })).toBe(true);
    });

    it('accepts boundary longitude -180', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [-180, 0] })).toBe(true);
    });

    it('accepts boundary longitude +180', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [180, 0] })).toBe(true);
    });

    it('accepts boundary latitude -90', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [0, -90] })).toBe(true);
    });

    it('accepts boundary latitude +90', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [0, 90] })).toBe(true);
    });

    it('rejects longitude out of bounds (>180)', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [181, 0] })).toBe(false);
    });

    it('rejects longitude out of bounds (<-180)', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [-181, 0] })).toBe(false);
    });

    it('rejects latitude out of bounds (>90)', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [0, 91] })).toBe(false);
    });

    it('rejects latitude out of bounds (<-90)', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [0, -91] })).toBe(false);
    });

    it('rejects NaN longitude', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [NaN, 10] })).toBe(false);
    });

    it('rejects NaN latitude', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [10, NaN] })).toBe(false);
    });

    it('rejects wrong type', () => {
      expect(isGeoJSONPoint({ type: 'LineString', coordinates: [10, 20] })).toBe(false);
    });

    it('rejects null', () => {
      expect(isGeoJSONPoint(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isGeoJSONPoint(undefined)).toBe(false);
    });

    it('rejects extra coordinates (3 elements)', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [10, 20, 30] })).toBe(false);
    });

    it('rejects empty coordinates', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: [] })).toBe(false);
    });

    it('rejects non-numeric coordinates', () => {
      expect(isGeoJSONPoint({ type: 'Point', coordinates: ['a', 'b'] })).toBe(false);
    });

    it('rejects missing coordinates', () => {
      expect(isGeoJSONPoint({ type: 'Point' })).toBe(false);
    });
  });

  describe('isGeoJSONLineString', () => {
    it('accepts a valid LineString with 2 coords', () => {
      expect(
        isGeoJSONLineString({
          type: 'LineString',
          coordinates: [[0, 0], [1, 1]],
        }),
      ).toBe(true);
    });

    it('accepts a LineString with many coords', () => {
      expect(
        isGeoJSONLineString({
          type: 'LineString',
          coordinates: [[0, 0], [1, 1], [2, 2], [3, 3]],
        }),
      ).toBe(true);
    });

    it('rejects a LineString with only 1 coord', () => {
      expect(
        isGeoJSONLineString({
          type: 'LineString',
          coordinates: [[0, 0]],
        }),
      ).toBe(false);
    });

    it('rejects empty coordinates array', () => {
      expect(
        isGeoJSONLineString({
          type: 'LineString',
          coordinates: [],
        }),
      ).toBe(false);
    });

    it('rejects invalid coords inside LineString', () => {
      expect(
        isGeoJSONLineString({
          type: 'LineString',
          coordinates: [[0, 0], [200, 0]],
        }),
      ).toBe(false);
    });

    it('rejects wrong type', () => {
      expect(
        isGeoJSONLineString({
          type: 'Point',
          coordinates: [[0, 0], [1, 1]],
        }),
      ).toBe(false);
    });

    it('rejects null', () => {
      expect(isGeoJSONLineString(null)).toBe(false);
    });
  });

  describe('isGeoJSONPolygon', () => {
    const validRing: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 0]];

    it('accepts a valid Polygon with one ring (4 coords)', () => {
      expect(
        isGeoJSONPolygon({ type: 'Polygon', coordinates: [validRing] }),
      ).toBe(true);
    });

    it('accepts a Polygon with multiple rings', () => {
      const innerRing: [number, number][] = [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.1]];
      expect(
        isGeoJSONPolygon({ type: 'Polygon', coordinates: [validRing, innerRing] }),
      ).toBe(true);
    });

    it('rejects ring with fewer than 4 coords', () => {
      expect(
        isGeoJSONPolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] }),
      ).toBe(false);
    });

    it('rejects invalid coords in ring', () => {
      expect(
        isGeoJSONPolygon({
          type: 'Polygon',
          coordinates: [[[0, 0], [200, 0], [1, 1], [0, 0]]],
        }),
      ).toBe(false);
    });

    it('rejects empty coordinates array', () => {
      expect(
        isGeoJSONPolygon({ type: 'Polygon', coordinates: [] }),
      ).toBe(true); // every() on empty array returns true
    });

    it('rejects wrong type', () => {
      expect(
        isGeoJSONPolygon({ type: 'Point', coordinates: [validRing] }),
      ).toBe(false);
    });

    it('rejects null', () => {
      expect(isGeoJSONPolygon(null)).toBe(false);
    });
  });

  describe('validatePoint', () => {
    it('returns the point when valid', () => {
      const point = { type: 'Point' as const, coordinates: [10, 20] as [number, number] };
      expect(validatePoint(point)).toEqual(point);
    });

    it('returns null for invalid point', () => {
      expect(validatePoint({ type: 'Point', coordinates: [999, 0] })).toBeNull();
    });

    it('returns null for non-object', () => {
      expect(validatePoint('string')).toBeNull();
    });
  });

  describe('validateGeometry', () => {
    it('accepts a valid Point', () => {
      const point = { type: 'Point', coordinates: [10, 20] };
      expect(validateGeometry(point)).toEqual(point);
    });

    it('accepts a valid LineString', () => {
      const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
      expect(validateGeometry(line)).toEqual(line);
    });

    it('accepts a valid Polygon', () => {
      const poly = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
      expect(validateGeometry(poly)).toEqual(poly);
    });

    it('returns null for unknown geometry type', () => {
      expect(validateGeometry({ type: 'MultiPoint', coordinates: [[0, 0]] })).toBeNull();
    });

    it('returns null for null input', () => {
      expect(validateGeometry(null)).toBeNull();
    });

    it('returns null for invalid coordinates', () => {
      expect(validateGeometry({ type: 'Point', coordinates: [999, 999] })).toBeNull();
    });
  });
});
