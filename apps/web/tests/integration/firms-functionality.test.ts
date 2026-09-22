import { describe, expect, it, beforeEach, vi } from 'vitest';
import { transformFirmsToGeoJSON, getFirmsStats } from '@/lib/firms/transform';
import { getCachedFirmsDetections, setCachedFirmsDetections, clearFirmsCache } from '@/lib/firms/cache';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

// Mock logger
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FIRMS Functionality Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFirmsCache();
  });

  describe('End-to-End CSV Processing', () => {
    it('should process real FIRMS CSV data correctly', () => {
      // Simulate real FIRMS API response
      const realFirmsCSV = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5235,-5.1234,335.4,1.2,1.1,2024-02-09,1445,N,VIIRS,high,2.0NRT,305.2,48.5,D
33.5890,-5.0987,342.1,1.3,1.2,2024-02-09,1500,N,VIIRS,nominal,2.0NRT,312.3,52.1,D
33.4567,-5.2345,328.7,1.1,1.0,2024-02-09,1530,T,MODIS,85,2.0,298.4,45.3,N`;

      const result = transformFirmsToGeoJSON(realFirmsCSV);

      // Verify GeoJSON structure
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(3);

      // Verify first detection (VIIRS with string confidence)
      const detection1 = result.features[0];
      expect(detection1.geometry.type).toBe('Point');
      const coords1 = detection1.geometry.coordinates as [number, number];
      expect(coords1[0]).toBeCloseTo(-5.1234, 4);
      expect(coords1[1]).toBeCloseTo(33.5235, 4);
      expect(detection1.properties.confidence).toBe('high');
      expect(detection1.properties.satellite).toBe('N');
      expect(detection1.properties.instrument).toBe('VIIRS');
      expect(detection1.properties.frp).toBeCloseTo(48.5, 1);

      // Verify second detection (VIIRS with nominal confidence)
      const detection2 = result.features[1];
      expect(detection2.properties.confidence).toBe('nominal');
      expect(detection2.properties.frp).toBeCloseTo(52.1, 1);

      // Verify third detection (MODIS with numeric confidence)
      const detection3 = result.features[2];
      expect(detection3.properties.confidence).toBe(85);
      expect(detection3.properties.satellite).toBe('T');
      expect(detection3.properties.daynight).toBe('N');
    });

    it('should calculate statistics correctly from processed data', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,55.8,D
33.4,-5.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,80,2.0,300.0,38.5,N
33.7,-5.3,355.0,1.2,1.1,2024-02-09,1445,T,MODIS,60,2.0,315.0,62.3,D
33.3,-5.4,330.0,1.0,1.0,2024-02-09,1500,N,VIIRS,low,2.0NRT,295.0,35.1,N`;

      const geoJSON = transformFirmsToGeoJSON(csv);
      const stats = getFirmsStats(geoJSON);

      expect(stats.total).toBe(5);
      expect(stats.highConfidence).toBe(2); // "high" + 80
      expect(stats.nominalConfidence).toBe(2); // "nominal" + 60
      expect(stats.lowConfidence).toBe(1); // "low"
      expect(stats.avgFRP).toBeCloseTo(47.4, 1); // (45.2 + 55.8 + 38.5 + 62.3 + 35.1) / 5
      expect(stats.maxFRP).toBeCloseTo(62.3, 1);
    });
  });

  describe('Cache Integration', () => {
    it('should cache and retrieve FIRMS data correctly', async () => {
      const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: 'test-1',
              brightness: 350,
              frp: 45,
              confidence: 'high',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 13:45',
              daynight: 'D',
              isRecent: true,
            },
          },
        ],
      };

      // Cache the data
      await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData);

      // Retrieve from cache
      const cached = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);

      expect(cached).not.toBeNull();
      expect(cached?.data.features).toHaveLength(1);
      expect(cached?.data.features[0].properties.frp).toBe(45);
      expect(cached?.cachedAt).toBeDefined();
      expect(typeof cached?.cachedAt).toBe('number');
    });

    it('should handle cache miss correctly', async () => {
      const cached = await getCachedFirmsDetections('0,0,1,1', 'VIIRS_NOAA20_NRT', 1);
      expect(cached).toBeNull();
    });

    it('should support multiple cache entries', async () => {
      const data1: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [],
      };
      const data2: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-6.0, 34.0] },
            properties: {
              id: 'test-2',
              brightness: 340,
              frp: 40,
              confidence: 'nominal',
              satellite: 'T',
              instrument: 'MODIS',
              acqDateTime: '2024-02-09 14:00',
              daynight: 'D',
              isRecent: false,
            },
          },
        ],
      };

      // Cache two different regions
      await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, data1);
      await setCachedFirmsDetections('34.0,-6.0,34.5,-5.5', 'MODIS_NRT', 1, data2);

      // Verify both are cached independently
      const cached1 = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);
      const cached2 = await getCachedFirmsDetections('34.0,-6.0,34.5,-5.5', 'MODIS_NRT', 1);

      expect(cached1?.data.features).toHaveLength(0);
      expect(cached2?.data.features).toHaveLength(1);
      expect(cached2?.data.features[0].properties.satellite).toBe('T');
    });
  });

  describe('Data Validation & Quality', () => {
    it('should handle boundary coordinates correctly', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
-90.0,-180.0,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
90.0,180.0,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D
0.0,0.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,75,2.0,300.0,40.0,N`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(3);
      expect(result.features[0].geometry.coordinates).toEqual([-180.0, -90.0]);
      expect(result.features[1].geometry.coordinates).toEqual([180.0, 90.0]);
      expect(result.features[2].geometry.coordinates).toEqual([0.0, 0.0]);
    });

    it('should reject out-of-bounds coordinates', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
91.0,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-181.0,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D
-91.0,5.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,75,2.0,300.0,40.0,N
33.5,181.0,330.0,1.0,1.0,2024-02-09,1500,N,VIIRS,low,2.0NRT,295.0,35.0,D`;

      const result = transformFirmsToGeoJSON(csv);

      // All should be rejected
      expect(result.features).toHaveLength(0);
    });

    it('should handle very large datasets efficiently', () => {
      // Generate 1000 detections
      let csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n`;

      for (let i = 0; i < 1000; i++) {
        const lat = 33.3 + (Math.random() * 0.4);
        const lon = -5.3 + (Math.random() * 0.4);
        const brightness = 300 + (Math.random() * 100);
        const frp = 30 + (Math.random() * 50);
        csv += `${lat},${lon},${brightness},1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,${frp},D\n`;
      }

      const startTime = performance.now();
      const result = transformFirmsToGeoJSON(csv);
      const endTime = performance.now();

      expect(result.features).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should process in under 1 second
    });
  });

  describe('Confidence Level Handling', () => {
    it('should correctly categorize all confidence types', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D
33.4,-5.0,340.0,1.1,1.0,2024-02-09,1430,N,VIIRS,low,2.0NRT,300.0,40.0,N
33.7,-5.3,355.0,1.2,1.1,2024-02-09,1445,T,MODIS,95,2.0,315.0,60.0,D
33.8,-5.4,345.0,1.3,1.2,2024-02-09,1500,T,MODIS,65,2.0,305.0,55.0,D
33.3,-5.5,335.0,1.1,1.0,2024-02-09,1530,T,MODIS,35,2.0,295.0,35.0,N`;

      const result = transformFirmsToGeoJSON(csv);
      const stats = getFirmsStats(result);

      // high: 1 string + 1 numeric (>=75)
      expect(stats.highConfidence).toBe(2);

      // nominal: 1 string + 1 numeric (50-74)
      expect(stats.nominalConfidence).toBe(2);

      // low: 1 string + 1 numeric (<50)
      expect(stats.lowConfidence).toBe(2);
    });

    it('should handle edge cases in numeric confidence', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,T,MODIS,75,2.0,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,T,MODIS,74,2.0,320.0,50.0,D
33.4,-5.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,50,2.0,300.0,40.0,N
33.7,-5.3,355.0,1.2,1.1,2024-02-09,1445,T,MODIS,49,2.0,315.0,60.0,D`;

      const result = transformFirmsToGeoJSON(csv);
      const stats = getFirmsStats(result);

      // 75 is high (>=75)
      expect(stats.highConfidence).toBe(1);

      // 74 and 50 are nominal (50-74)
      expect(stats.nominalConfidence).toBe(2);

      // 49 is low (<50)
      expect(stats.lowConfidence).toBe(1);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle empty results efficiently', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`;

      const result = transformFirmsToGeoJSON(csv);
      const stats = getFirmsStats(result);

      expect(result.features).toHaveLength(0);
      expect(stats.total).toBe(0);
      expect(stats.avgFRP).toBe(0);
      expect(stats.maxFRP).toBe(0);
    });

    it('should process data with various malformed lines', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
invalid,line,with,wrong,data
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D
,,,,,,,,,,,,,
33.4,-5.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,75,2.0,300.0,40.0,N`;

      const result = transformFirmsToGeoJSON(csv);

      // Only 3 valid lines should be processed
      expect(result.features).toHaveLength(3);
    });
  });

  describe('Recent Detection Calculation', () => {
    it('should mark very recent detections correctly', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const fifteenHoursAgo = new Date(now.getTime() - 15 * 60 * 60 * 1000);

      const recentDate = twoHoursAgo.toISOString().split('T')[0];
      const recentTime = twoHoursAgo.toTimeString().split(' ')[0].replace(/:/g, '').slice(0, 4);

      const oldDate = fifteenHoursAgo.toISOString().split('T')[0];
      const oldTime = fifteenHoursAgo.toTimeString().split(' ')[0].replace(/:/g, '').slice(0, 4);

      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,${recentDate},${recentTime},N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,${oldDate},${oldTime},N,VIIRS,nominal,2.0NRT,320.0,50.0,D`;

      const result = transformFirmsToGeoJSON(csv);
      const stats = getFirmsStats(result);

      expect(result.features[0].properties.isRecent).toBe(true);
      expect(result.features[1].properties.isRecent).toBe(false);
      expect(stats.recentCount).toBe(1);
    });
  });
});
