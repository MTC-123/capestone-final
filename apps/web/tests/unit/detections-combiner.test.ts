import { describe, expect, it, vi } from 'vitest';
import { combineDetections } from '@/lib/detections/combiner';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function makeFeature(
  lat: number,
  lon: number,
  frp: number,
  acqDateTime: string,
  source?: 'FIRMS' | 'EFFIS'
): GeoFeatureCollection<GeoFirmsDetectionProps>['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id: `${source ?? 'test'}:${lat},${lon}`,
      brightness: 350,
      frp,
      confidence: 'high',
      satellite: 'N',
      instrument: 'VIIRS',
      acqDateTime,
      daynight: 'D',
      isRecent: true,
      source,
    },
  };
}

function makeCollection(
  features: GeoFeatureCollection<GeoFirmsDetectionProps>['features']
): GeoFeatureCollection<GeoFirmsDetectionProps> {
  return { type: 'FeatureCollection', features };
}

describe('combineDetections', () => {
  it('should combine non-overlapping detections', () => {
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.6, -5.2, 50, '2024-02-09 14:00', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(2);
  });

  it('should deduplicate nearby detections within time window', () => {
    // Same location (within 375m), same time (within 30 min)
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.5001, -5.1001, 50, '2024-02-09 13:50', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
    // Should keep higher FRP (50 from EFFIS)
    expect(result.features[0].properties.frp).toBe(50);
  });

  it('should keep FIRMS detection when it has higher FRP', () => {
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 60, '2024-02-09 13:45', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.5001, -5.1001, 40, '2024-02-09 13:50', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.frp).toBe(60);
    expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
  });

  it('should not deduplicate distant detections', () => {
    // Detections more than 375m apart
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.51, -5.11, 50, '2024-02-09 13:50', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(2);
  });

  it('should not deduplicate temporally distant detections', () => {
    // Same location but > 30 min apart
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:00', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.5001, -5.1001, 50, '2024-02-09 14:00', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(2);
  });

  it('should handle empty FIRMS collection', () => {
    const firms = makeCollection([]);
    const effis = makeCollection([
      makeFeature(33.5, -5.1, 50, '2024-02-09 13:45', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.source).toBe('EFFIS');
  });

  it('should handle empty EFFIS collection', () => {
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
    ]);
    const effis = makeCollection([]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.source).toBe('FIRMS');
  });

  it('should handle both empty collections', () => {
    const result = combineDetections(makeCollection([]), makeCollection([]));
    expect(result.features).toHaveLength(0);
  });

  it('should handle all duplicates', () => {
    const firms = makeCollection([
      makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
      makeFeature(33.6, -5.2, 55, '2024-02-09 14:00', 'FIRMS'),
    ]);
    const effis = makeCollection([
      makeFeature(33.5001, -5.1001, 50, '2024-02-09 13:50', 'EFFIS'),
      makeFeature(33.6001, -5.2001, 40, '2024-02-09 14:05', 'EFFIS'),
    ]);

    const result = combineDetections(firms, effis);
    expect(result.features).toHaveLength(2);
    expect(result.features.every((f) => f.properties.source === 'FIRMS+EFFIS')).toBe(true);
  });

  describe('Edge Cases', () => {
    it('deduplicates at exactly boundary distance (~375m apart)', () => {
      // ~375m north at lat 33.5 ≈ 0.00337 degrees latitude
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.50337, -5.1, 50, '2024-02-09 13:45', 'EFFIS'),
      ]);

      const result = combineDetections(firms, effis);
      // Should deduplicate (within 375m)
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
    });

    it('does not deduplicate just outside distance threshold (>375m)', () => {
      // ~400m north at lat 33.5 ≈ 0.0036 degrees latitude
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 45, '2024-02-09 13:45', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.5036, -5.1, 50, '2024-02-09 13:45', 'EFFIS'),
      ]);

      const result = combineDetections(firms, effis);
      expect(result.features).toHaveLength(2);
    });

    it('deduplicates at exactly boundary time (30 min apart)', () => {
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 45, '2024-02-09 13:00', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.5001, -5.1001, 50, '2024-02-09 13:30', 'EFFIS'),
      ]);

      const result = combineDetections(firms, effis);
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
    });

    it('does not deduplicate just outside time window (>30 min)', () => {
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 45, '2024-02-09 13:00', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.5001, -5.1001, 50, '2024-02-09 13:31', 'EFFIS'),
      ]);

      const result = combineDetections(firms, effis);
      expect(result.features).toHaveLength(2);
    });

    it('handles very large FRP values (1000+ MW)', () => {
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 1500, '2024-02-09 13:45', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.5001, -5.1001, 1200, '2024-02-09 13:50', 'EFFIS'),
      ]);

      const result = combineDetections(firms, effis);
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.frp).toBe(1500);
      expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
    });

    it('does not crash when acqDateTime is "Unknown"', () => {
      const firms = makeCollection([
        makeFeature(33.5, -5.1, 45, 'Unknown', 'FIRMS'),
      ]);
      const effis = makeCollection([
        makeFeature(33.5001, -5.1001, 50, 'Unknown', 'EFFIS'),
      ]);

      // parseAcqDateTime returns 0 for both → timeDiff = 0 → within window
      const result = combineDetections(firms, effis);
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.source).toBe('FIRMS+EFFIS');
    });

    it('handles large dataset performance (200+200 features < 500ms)', () => {
      // Use non-overlapping regions to avoid deduplication
      const firmsFeatures = Array.from({ length: 200 }, (_, i) =>
        makeFeature(30.0 + i * 0.01, -3.0 - i * 0.01, 30 + i, '2024-02-09 13:45', 'FIRMS')
      );
      const effisFeatures = Array.from({ length: 200 }, (_, i) =>
        makeFeature(40.0 + i * 0.01, -8.0 - i * 0.01, 40 + i, '2024-02-09 14:00', 'EFFIS')
      );

      const start = performance.now();
      const result = combineDetections(makeCollection(firmsFeatures), makeCollection(effisFeatures));
      const duration = performance.now() - start;

      expect(result.features).toHaveLength(400);
      expect(duration).toBeLessThan(500);
    });
  });
});
