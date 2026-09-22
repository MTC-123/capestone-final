import { describe, expect, it } from 'vitest';
import { computePolygonStats } from '@/lib/fire-records/polygonStats';
import type { GeoJSONPolygon } from '@/lib/validation/geojson';

describe('computePolygonStats', () => {
  it('computes area for a known square at equator (~1.24 ha for 0.001° square)', () => {
    // A 0.001° x 0.001° square at the equator ≈ 111m × 111m ≈ 12321 m² ≈ 1.23 ha
    const square: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [[
        [0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0],
      ]],
    };

    const stats = computePolygonStats(square);
    expect(stats.burnAreaHa).toBeGreaterThan(1.0);
    expect(stats.burnAreaHa).toBeLessThan(1.5);
  });

  it('computes stats for an Ifrane-region polygon', () => {
    const ifrane: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-5.12, 33.52], [-5.10, 33.52], [-5.10, 33.54], [-5.12, 33.54], [-5.12, 33.52],
      ]],
    };

    const stats = computePolygonStats(ifrane);
    expect(stats.burnAreaHa).toBeGreaterThan(0);
    expect(stats.centroid[0]).toBeCloseTo(-5.11, 1);
    expect(stats.centroid[1]).toBeCloseTo(33.53, 1);
    expect(stats.boundingBox[0]).toBeCloseTo(-5.12, 2);
    expect(stats.boundingBox[1]).toBeCloseTo(33.52, 2);
    expect(stats.boundingBox[2]).toBeCloseTo(-5.10, 2);
    expect(stats.boundingBox[3]).toBeCloseTo(33.54, 2);
  });

  it('computes stats for a minimal polygon (triangle)', () => {
    const triangle: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [[
        [0, 0], [0.01, 0], [0.005, 0.01], [0, 0],
      ]],
    };

    const stats = computePolygonStats(triangle);
    expect(stats.burnAreaHa).toBeGreaterThan(0);
  });

  it('centroid is within polygon bounding box', () => {
    const poly: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-5.12, 33.52], [-5.10, 33.52], [-5.10, 33.54], [-5.12, 33.54], [-5.12, 33.52],
      ]],
    };

    const stats = computePolygonStats(poly);
    const [lng, lat] = stats.centroid;
    const [minLng, minLat, maxLng, maxLat] = stats.boundingBox;
    expect(lng).toBeGreaterThanOrEqual(minLng);
    expect(lng).toBeLessThanOrEqual(maxLng);
    expect(lat).toBeGreaterThanOrEqual(minLat);
    expect(lat).toBeLessThanOrEqual(maxLat);
  });

  it('bounding box contains all vertices', () => {
    const coords: [number, number][] = [
      [-5.15, 33.50], [-5.08, 33.50], [-5.08, 33.56], [-5.15, 33.56], [-5.15, 33.50],
    ];
    const poly: GeoJSONPolygon = { type: 'Polygon', coordinates: [coords] };
    const stats = computePolygonStats(poly);
    const [minLng, minLat, maxLng, maxLat] = stats.boundingBox;

    for (const [lng, lat] of coords) {
      expect(lng).toBeGreaterThanOrEqual(minLng - 0.0001);
      expect(lng).toBeLessThanOrEqual(maxLng + 0.0001);
      expect(lat).toBeGreaterThanOrEqual(minLat - 0.0001);
      expect(lat).toBeLessThanOrEqual(maxLat + 0.0001);
    }
  });
});
