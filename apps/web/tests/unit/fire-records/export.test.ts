import { describe, expect, it } from 'vitest';
import { recordsToCSV, recordsToGeoJSON } from '@/lib/fire-records/export';

const mockRecords = [
  {
    id: 'rec-1',
    incidentId: 'inc-1',
    alertSource: 'FIRMS_SATELLITE',
    recordStatus: 'APPROVED',
    burnAreaHa: 12.5,
    alertReceivedAt: '2026-01-15T10:00:00Z',
    verifiedAt: '2026-01-15T10:15:00Z',
    firstResponseAt: '2026-01-15T10:30:00Z',
    onSceneAt: '2026-01-15T11:00:00Z',
    containedAt: '2026-01-15T14:00:00Z',
    extinguishedAt: '2026-01-15T18:00:00Z',
    burnPerimeter: {
      type: 'Polygon',
      coordinates: [[[-5.12, 33.52], [-5.10, 33.52], [-5.10, 33.54], [-5.12, 33.54], [-5.12, 33.52]]],
    },
    burnCentroid: [-5.11, 33.53],
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'rec-2',
    incidentId: 'inc-2',
    alertSource: 'CITIZEN_REPORT',
    recordStatus: 'DRAFT',
    burnAreaHa: null,
    alertReceivedAt: null,
    verifiedAt: null,
    firstResponseAt: null,
    onSceneAt: null,
    containedAt: null,
    extinguishedAt: null,
    burnPerimeter: null,
    burnCentroid: null,
    createdAt: '2026-01-16T09:00:00Z',
  },
  {
    id: 'rec-3',
    incidentId: 'inc-3',
    alertSource: 'PATROL',
    recordStatus: 'VALIDATED',
    burnAreaHa: 3.2,
    alertReceivedAt: '2026-01-17T08:00:00Z',
    verifiedAt: null,
    firstResponseAt: null,
    onSceneAt: null,
    containedAt: null,
    extinguishedAt: null,
    burnPerimeter: null,
    burnCentroid: null,
    createdAt: '2026-01-17T08:00:00Z',
  },
];

describe('recordsToCSV', () => {
  it('produces correct headers', () => {
    const csv = recordsToCSV(mockRecords);
    const headerLine = csv.split('\n')[0];
    expect(headerLine).toBe(
      'id,incidentId,alertSource,recordStatus,burnAreaHa,commune,locationName,causeCategory,causeCertainty,surfaceBurnedHa,vegetationTypes,totalDamageEstimate,responseTimeMinutes,personnelCount,vehicleCount,aircraftCount,temperatureC,humidityPct,windSpeedKmh,severityAssessment,recoveryStatus,ignitionAt,alertReceivedAt,verifiedAt,firstResponseAt,onSceneAt,containedAt,extinguishedAt,createdAt'
    );
  });

  it('produces correct row count', () => {
    const csv = recordsToCSV(mockRecords);
    const lines = csv.split('\n');
    expect(lines.length).toBe(4); // 1 header + 3 data
  });

  it('escapes values with commas', () => {
    const records = [{
      ...mockRecords[0],
      alertSource: 'FIRMS,SATELLITE',
    }];
    const csv = recordsToCSV(records);
    expect(csv).toContain('"FIRMS,SATELLITE"');
  });

  it('handles null burnAreaHa', () => {
    const csv = recordsToCSV([mockRecords[1]]);
    const dataLine = csv.split('\n')[1];
    // burnAreaHa is the 5th field (index 4), should be empty
    const fields = dataLine.split(',');
    expect(fields[4]).toBe('');
  });
});

describe('recordsToGeoJSON', () => {
  it('returns a valid FeatureCollection', () => {
    const geojson = recordsToGeoJSON(mockRecords) as { type: string; features: unknown[] };
    expect(geojson.type).toBe('FeatureCollection');
    expect(Array.isArray(geojson.features)).toBe(true);
  });

  it('only includes records with burnPerimeter', () => {
    const geojson = recordsToGeoJSON(mockRecords) as { features: unknown[] };
    // Only rec-1 has a perimeter
    expect(geojson.features).toHaveLength(1);
  });
});
