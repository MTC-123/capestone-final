import { describe, expect, it, beforeEach, vi } from 'vitest';
import { transformEffisToGeoJSON } from '@/lib/effis/transform';
import { getCachedEffisDetections, setCachedEffisDetections, clearEffisCache } from '@/lib/effis/cache';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('EFFIS Functionality Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEffisCache();
  });

  describe('End-to-End GeoJSON Processing', () => {
    it('should transform EFFIS WFS GeoJSON to normalized format', () => {
      const effisResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1234, 33.5235] },
            properties: {
              brightness: 335.4,
              frp: 48.5,
              confidence: 'high',
              satellite: 'N20',
              instrument: 'VIIRS',
              acq_date: '2024-02-09',
              acq_time: '1445',
              daynight: 'D',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.0987, 33.5890] },
            properties: {
              bright_ti4: 342.1,
              frp: 52.1,
              confidence: 60,
              firedate: '2024-02-09T15:00:00Z',
              daynight: 'D',
            },
          },
        ],
      };

      const result = transformEffisToGeoJSON(effisResponse);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(2);

      expect(result.features[0].properties.source).toBe('EFFIS');
      expect(result.features[0].properties.brightness).toBeCloseTo(335.4, 1);
      expect(result.features[0].properties.confidence).toBe('high');

      expect(result.features[1].properties.source).toBe('EFFIS');
      expect(result.features[1].properties.brightness).toBeCloseTo(342.1, 1);
      expect(result.features[1].properties.confidence).toBe('nominal');
    });
  });

  describe('Cache Integration', () => {
    it('should cache and retrieve EFFIS data correctly', async () => {
      const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: 'effis:33.5,-5.1,test',
              brightness: 350,
              frp: 45,
              confidence: 'high',
              satellite: 'EFFIS',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 13:45',
              daynight: 'D',
              isRecent: true,
              source: 'EFFIS',
            },
          },
        ],
      };

      await setCachedEffisDetections('32.5,-6.0,34.0,-4.5,EPSG:4326', testData);
      const cached = await getCachedEffisDetections('32.5,-6.0,34.0,-4.5,EPSG:4326');

      expect(cached).not.toBeNull();
      expect(cached?.data.features).toHaveLength(1);
      expect(cached?.data.features[0].properties.source).toBe('EFFIS');
    });

    it('should handle cache miss correctly', async () => {
      const cached = await getCachedEffisDetections('0,0,1,1');
      expect(cached).toBeNull();
    });
  });

  describe('Transform then Cache roundtrip', () => {
    it('should transform, cache, then retrieve correctly', async () => {
      const effisResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: { brightness: 350, frp: 45, confidence: 'high', acq_date: '2024-02-09', acq_time: '1345', daynight: 'D' },
          },
        ],
      };

      const transformed = transformEffisToGeoJSON(effisResponse);
      await setCachedEffisDetections('test-bbox', transformed);
      const cached = await getCachedEffisDetections('test-bbox');

      expect(cached).not.toBeNull();
      expect(cached?.data.features[0].properties.source).toBe('EFFIS');
      expect(cached?.data.features[0].properties.frp).toBe(45);
    });
  });
});
