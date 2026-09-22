import { describe, expect, it, beforeEach, vi } from 'vitest';
import { transformFirmsToGeoJSON, isFirmsCSVResponse, getFirmsStats } from '@/lib/firms/transform';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

// Mock logger
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FIRMS Transform Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transformFirmsToGeoJSON', () => {
    it('should transform valid CSV to GeoJSON', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].geometry.type).toBe('Point');
      expect(result.features[0].geometry.coordinates).toEqual([-5.1, 33.5]);
      expect(result.features[0].properties.brightness).toBe(350.5);
      expect(result.features[0].properties.frp).toBe(45.2);
      expect(result.features[0].properties.confidence).toBe('high');
      expect(result.features[0].properties.satellite).toBe('N');
      expect(result.features[0].properties.instrument).toBe('VIIRS');
      expect(result.features[0].properties.daynight).toBe('D');
    });

    it('should handle numeric confidence values', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,T,MODIS,85,2.0,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features[0].properties.confidence).toBe(85);
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const result = transformFirmsToGeoJSON(csv);

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });

    it('should skip header row', () => {
      const csv = `LATITUDE,LONGITUDE,BRIGHTNESS,SCAN,TRACK,ACQ_DATE,ACQ_TIME,SATELLITE,INSTRUMENT,CONFIDENCE,VERSION,BRIGHT_T31,FRP,DAYNIGHT
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(1);
    });

    it('should filter out invalid coordinates', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
91.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-181.0,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(1);
      const coords = result.features[0]!.geometry.coordinates as [number, number];
      expect(coords[1]).toBe(33.5);
    });

    it('should filter out lines with invalid numeric values', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
invalid,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,invalid,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.1,invalid,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,invalid,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(0);
    });

    it('should filter out lines with insufficient columns', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(1);
    });

    it('should handle invalid confidence values with default', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,invalid_value,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features[0].properties.confidence).toBe('nominal');
    });

    it('should mark recent detections correctly', () => {
      const now = new Date();
      const recentDate = now.toISOString().split('T')[0];
      const recentTime = now.toTimeString().split(' ')[0].replace(/:/g, '').slice(0, 4);

      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,${recentDate},${recentTime},N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.2,350.5,1.2,1.1,2024-01-01,0000,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(2);
      expect(result.features[0].properties.isRecent).toBe(true);
      expect(result.features[1].properties.isRecent).toBe(false);
    });

    it('should handle multiple detections', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,360.0,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,320.0,50.0,D
33.4,-5.0,340.0,1.1,1.0,2024-02-09,1430,T,MODIS,75,2.0,300.0,40.0,N`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(3);
      expect(result.features[0].properties.confidence).toBe('high');
      expect(result.features[1].properties.confidence).toBe('nominal');
      expect(result.features[2].properties.confidence).toBe(75);
    });

    it('should handle invalid date formats gracefully', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,invalid-date,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.1,350.5,1.2,1.1,2024-02-09,invalid,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features).toHaveLength(3);
      expect(result.features[0].properties.isRecent).toBe(false);
      expect(result.features[1].properties.isRecent).toBe(false);
    });

    it('should handle daynight field validation', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,X`;

      const result = transformFirmsToGeoJSON(csv);

      expect(result.features[0].properties.daynight).toBe('D');
    });

    describe('Error Recovery', () => {
      it('should handle partially corrupted CSV gracefully', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
INVALID_ROW_WITH_GARBAGE_DATA
33.6,-5.2,340.2,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,300.1,38.5,D`;

        const result = transformFirmsToGeoJSON(csv);

        // Should only parse valid rows
        expect(result.features).toHaveLength(2);
        expect(result.features[0].geometry.coordinates).toEqual([-5.1, 33.5]);
        expect(result.features[1].geometry.coordinates).toEqual([-5.2, 33.6]);
      });

      it('should handle CSV with mixed valid and invalid coordinates', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
95.0,-5.2,340.2,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,300.1,38.5,D
33.6,-200.0,340.2,1.3,1.2,2024-02-09,1430,N,VIIRS,nominal,2.0NRT,300.1,38.5,D
33.7,-5.3,340.2,1.3,1.2,2024-02-09,1500,N,VIIRS,nominal,2.0NRT,300.1,38.5,D`;

        const result = transformFirmsToGeoJSON(csv);

        // Should only include rows with valid coordinates
        expect(result.features).toHaveLength(2);
        expect((result.features[0].geometry.coordinates as number[])[1]).toBe(33.5);
        expect((result.features[1].geometry.coordinates as number[])[1]).toBe(33.7);
      });

      it('should handle CSV with missing critical numeric fields', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,300.1,38.5,D
33.7,-5.3,340.2,1.3,1.2,2024-02-09,1430,N,VIIRS,nominal,2.0NRT,300.1,,D`;

        const result = transformFirmsToGeoJSON(csv);

        // Should only include row with all required fields
        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties.brightness).toBe(350.5);
      });

      it('should handle very large datasets efficiently', () => {
        // Generate CSV with 1000+ rows
        const header = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight';
        const rows = Array.from({ length: 1500 }, (_, i) => {
          const lat = 33.5 + (i % 10) * 0.01;
          const lon = -5.1 - (i % 10) * 0.01;
          return `${lat},${lon},350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;
        });
        const csv = [header, ...rows].join('\n');

        const startTime = performance.now();
        const result = transformFirmsToGeoJSON(csv);
        const duration = performance.now() - startTime;

        expect(result.features).toHaveLength(1500);
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
      });

      it('should handle all rows invalid gracefully', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid
GARBAGE_DATA
,,,,,,,,,,,,`;

        const result = transformFirmsToGeoJSON(csv);

        expect(result.type).toBe('FeatureCollection');
        expect(result.features).toHaveLength(0);
      });
    });
  });

  describe('isFirmsCSVResponse', () => {
    it('should return true for valid CSV with header', () => {
      const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

      expect(isFirmsCSVResponse(csv)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isFirmsCSVResponse('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      const csv = `
      `;

      expect(isFirmsCSVResponse(csv)).toBe(false);
    });

    describe('HTML Response Rejection', () => {
      it('should reject HTML with DOCTYPE declaration', () => {
        const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head><title>NASA Earthdata Login</title></head>
<body>Authentication required</body>
</html>`;

        expect(isFirmsCSVResponse(htmlResponse)).toBe(false);
      });

      it('should reject HTML without DOCTYPE', () => {
        const htmlResponse = `<html>
<head><title>Error</title></head>
<body>Invalid API key</body>
</html>`;

        expect(isFirmsCSVResponse(htmlResponse)).toBe(false);
      });

      it('should reject uppercase HTML tags', () => {
        const htmlResponse = `<HTML>
<HEAD><TITLE>Error</TITLE></HEAD>
<BODY>Error</BODY>
</HTML>`;

        expect(isFirmsCSVResponse(htmlResponse)).toBe(false);
      });

      it('should reject HTML with whitespace prefix', () => {
        const htmlResponse = `
<!DOCTYPE html>
<html>Error</html>`;

        expect(isFirmsCSVResponse(htmlResponse)).toBe(false);
      });

      it('should accept valid CSV with header', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D`;

        expect(isFirmsCSVResponse(csv)).toBe(true);
      });

      it('should require all three key headers (latitude, longitude, brightness)', () => {
        const missingLatitude = `longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`;
        const missingLongitude = `latitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`;
        const missingBrightness = `latitude,longitude,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight`;

        expect(isFirmsCSVResponse(missingLatitude)).toBe(false);
        expect(isFirmsCSVResponse(missingLongitude)).toBe(false);
        expect(isFirmsCSVResponse(missingBrightness)).toBe(false);
      });

      it('should accept VIIRS format with bright_ti4 instead of brightness', () => {
        const viirsHeader = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight`;
        expect(isFirmsCSVResponse(viirsHeader)).toBe(true);
      });
    });

    describe('Empty and Valid CSV Handling', () => {
      it('should accept empty valid CSV (header only, no detections)', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
`;

        expect(isFirmsCSVResponse(csv)).toBe(true);

        const result = transformFirmsToGeoJSON(csv);
        expect(result.type).toBe('FeatureCollection');
        expect(result.features).toHaveLength(0);
      });

      it('should accept CSV with multiple rows', () => {
        const csv = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
33.5,-5.1,350.5,1.2,1.1,2024-02-09,1345,N,VIIRS,high,2.0NRT,310.5,45.2,D
33.6,-5.2,340.2,1.3,1.2,2024-02-09,1400,N,VIIRS,nominal,2.0NRT,300.1,38.5,D`;

        expect(isFirmsCSVResponse(csv)).toBe(true);

        const result = transformFirmsToGeoJSON(csv);
        expect(result.features).toHaveLength(2);
      });
    });
  });

  describe('getFirmsStats', () => {
    it('should calculate stats for empty collection', () => {
      const collection: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [],
      };

      const stats = getFirmsStats(collection);

      expect(stats.total).toBe(0);
      expect(stats.highConfidence).toBe(0);
      expect(stats.nominalConfidence).toBe(0);
      expect(stats.lowConfidence).toBe(0);
      expect(stats.avgFRP).toBe(0);
      expect(stats.maxFRP).toBe(0);
      expect(stats.recentCount).toBe(0);
    });

    it('should count confidence levels correctly with string values', () => {
      const collection: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: '1',
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
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
            properties: {
              id: '2',
              brightness: 360,
              frp: 50,
              confidence: 'nominal',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 14:00',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.0, 33.4] },
            properties: {
              id: '3',
              brightness: 340,
              frp: 40,
              confidence: 'low',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 14:30',
              daynight: 'D',
              isRecent: false,
            },
          },
        ],
      };

      const stats = getFirmsStats(collection);

      expect(stats.total).toBe(3);
      expect(stats.highConfidence).toBe(1);
      expect(stats.nominalConfidence).toBe(1);
      expect(stats.lowConfidence).toBe(1);
      expect(stats.recentCount).toBe(1);
    });

    it('should count confidence levels correctly with numeric values', () => {
      const collection: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: '1',
              brightness: 350,
              frp: 45,
              confidence: 85,
              satellite: 'T',
              instrument: 'MODIS',
              acqDateTime: '2024-02-09 13:45',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
            properties: {
              id: '2',
              brightness: 360,
              frp: 50,
              confidence: 60,
              satellite: 'T',
              instrument: 'MODIS',
              acqDateTime: '2024-02-09 14:00',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.0, 33.4] },
            properties: {
              id: '3',
              brightness: 340,
              frp: 40,
              confidence: 30,
              satellite: 'T',
              instrument: 'MODIS',
              acqDateTime: '2024-02-09 14:30',
              daynight: 'D',
              isRecent: false,
            },
          },
        ],
      };

      const stats = getFirmsStats(collection);

      expect(stats.total).toBe(3);
      expect(stats.highConfidence).toBe(1);
      expect(stats.nominalConfidence).toBe(1);
      expect(stats.lowConfidence).toBe(1);
    });

    it('should calculate FRP stats correctly', () => {
      const collection: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: '1',
              brightness: 350,
              frp: 45.5,
              confidence: 'high',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 13:45',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
            properties: {
              id: '2',
              brightness: 360,
              frp: 50.3,
              confidence: 'high',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 14:00',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.0, 33.4] },
            properties: {
              id: '3',
              brightness: 340,
              frp: 60.2,
              confidence: 'high',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 14:30',
              daynight: 'D',
              isRecent: false,
            },
          },
        ],
      };

      const stats = getFirmsStats(collection);

      expect(stats.total).toBe(3);
      expect(stats.avgFRP).toBe(52.0); // (45.5 + 50.3 + 60.2) / 3 = 52.0
      expect(stats.maxFRP).toBe(60.2);
    });

    it('should handle mixed confidence types', () => {
      const collection: GeoFeatureCollection<GeoFirmsDetectionProps> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
            properties: {
              id: '1',
              brightness: 350,
              frp: 45,
              confidence: 'high',
              satellite: 'N',
              instrument: 'VIIRS',
              acqDateTime: '2024-02-09 13:45',
              daynight: 'D',
              isRecent: false,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
            properties: {
              id: '2',
              brightness: 360,
              frp: 50,
              confidence: 80,
              satellite: 'T',
              instrument: 'MODIS',
              acqDateTime: '2024-02-09 14:00',
              daynight: 'D',
              isRecent: false,
            },
          },
        ],
      };

      const stats = getFirmsStats(collection);

      expect(stats.highConfidence).toBe(2);
    });
  });
});
