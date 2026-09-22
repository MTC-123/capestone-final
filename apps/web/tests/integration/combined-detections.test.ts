import { describe, expect, it, vi } from 'vitest';
import { combineDetections } from '@/lib/detections/combiner';
import { transformEffisToGeoJSON } from '@/lib/effis/transform';
import { transformFirmsToGeoJSON, getFirmsStats } from '@/lib/firms/transform';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('Combined Detections Integration', () => {
  it('should combine FIRMS CSV + EFFIS GeoJSON into unified collection', () => {
    const firmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

    const effisGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
          properties: { brightness: 360, frp: 55, confidence: 'high', acq_date: '2024-02-09', acq_time: '1400', daynight: 'D' },
        },
      ],
    };

    const firms = transformFirmsToGeoJSON(firmsCSV);
    // Tag FIRMS features
    firms.features = firms.features.map((f) => ({
      ...f,
      properties: { ...f.properties, source: 'FIRMS' as const },
    }));
    const effis = transformEffisToGeoJSON(effisGeoJSON);
    const combined = combineDetections(firms, effis);

    expect(combined.features).toHaveLength(2);
    const stats = getFirmsStats(combined);
    expect(stats.total).toBe(2);
    expect(stats.highConfidence).toBe(2);
  });

  it('should deduplicate when FIRMS and EFFIS detect same fire', () => {
    const firmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

    const effisGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1001, 33.5001] },
          properties: { brightness: 355, frp: 50, confidence: 'high', acq_date: '2024-02-09', acq_time: '1350', daynight: 'D' },
        },
      ],
    };

    const firms = transformFirmsToGeoJSON(firmsCSV);
    firms.features = firms.features.map((f) => ({
      ...f,
      properties: { ...f.properties, source: 'FIRMS' as const },
    }));
    const effis = transformEffisToGeoJSON(effisGeoJSON);
    const combined = combineDetections(firms, effis);

    expect(combined.features).toHaveLength(1);
    expect(combined.features[0].properties.source).toBe('FIRMS+EFFIS');
  });

  it('should gracefully handle when one source returns empty', () => {
    const firmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

    const emptyEffis = { type: 'FeatureCollection', features: [] };

    const firms = transformFirmsToGeoJSON(firmsCSV);
    firms.features = firms.features.map((f) => ({
      ...f,
      properties: { ...f.properties, source: 'FIRMS' as const },
    }));
    const effis = transformEffisToGeoJSON(emptyEffis);
    const combined = combineDetections(firms, effis);

    expect(combined.features).toHaveLength(1);
    expect(combined.features[0].properties.source).toBe('FIRMS');
  });

  it('should preserve stats through the pipeline', () => {
    const firmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,55.8,D`;

    const effisGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
          properties: { brightness: 340, frp: 40, confidence: 30, acq_date: '2024-02-09', acq_time: '1430', daynight: 'N' },
        },
      ],
    };

    const firms = transformFirmsToGeoJSON(firmsCSV);
    firms.features = firms.features.map((f) => ({
      ...f,
      properties: { ...f.properties, source: 'FIRMS' as const },
    }));
    const effis = transformEffisToGeoJSON(effisGeoJSON);
    const combined = combineDetections(firms, effis);
    const stats = getFirmsStats(combined);

    expect(stats.total).toBe(3);
    expect(stats.highConfidence).toBe(1);
  });
});
