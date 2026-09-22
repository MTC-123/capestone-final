import { describe, expect, it, vi } from 'vitest';
import { transformEffisToGeoJSON } from '@/lib/effis/transform';

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('transformEffisToGeoJSON', () => {
  it('should transform valid EFFIS WFS GeoJSON', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: {
            brightness: 350,
            frp: 45,
            confidence: 'high',
            satellite: 'N20',
            instrument: 'VIIRS',
            acq_date: '2024-02-09',
            acq_time: '1345',
            daynight: 'D',
          },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.source).toBe('EFFIS');
    expect(result.features[0].properties.frp).toBe(45);
    expect(result.features[0].properties.confidence).toBe('high');
    expect(result.features[0].properties.acqDateTime).toBe('2024-02-09 13:45');
  });

  it('should return empty collection for invalid input', () => {
    expect(transformEffisToGeoJSON(null).features).toHaveLength(0);
    expect(transformEffisToGeoJSON('not json').features).toHaveLength(0);
    expect(transformEffisToGeoJSON({ type: 'Wrong' }).features).toHaveLength(0);
  });

  it('should skip features with invalid geometry', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [] },
          properties: { brightness: 350, frp: 45 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: { brightness: 350, frp: 45 },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    expect(result.features).toHaveLength(1);
  });

  it('should skip features with out-of-bounds coordinates', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [200, 33.5] },
          properties: { brightness: 350, frp: 45 },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    expect(result.features).toHaveLength(0);
  });

  it('should normalize confidence values', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: { brightness: 350, frp: 45, confidence: 90 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
          properties: { brightness: 350, frp: 45, confidence: 60 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.3, 33.7] },
          properties: { brightness: 350, frp: 45, confidence: 30 },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    expect(result.features[0].properties.confidence).toBe('high');
    expect(result.features[1].properties.confidence).toBe('nominal');
    expect(result.features[2].properties.confidence).toBe('low');
  });

  it('should handle EFFIS firedate property', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: {
            brightness: 350,
            frp: 45,
            firedate: '2024-02-09T13:45:00Z',
          },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    expect(result.features[0].properties.acqDateTime).toBe('2024-02-09 13:45');
  });

  it('should handle bright_ti4 as brightness fallback', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: { bright_ti4: 360, frp: 45 },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    expect(result.features[0].properties.brightness).toBe(360);
  });

  it('should set source to EFFIS on all features', () => {
    const input = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
          properties: { brightness: 350, frp: 45 },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
          properties: { brightness: 360, frp: 50 },
        },
      ],
    };

    const result = transformEffisToGeoJSON(input);
    for (const f of result.features) {
      expect(f.properties.source).toBe('EFFIS');
    }
  });
});
