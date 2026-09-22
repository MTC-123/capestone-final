import { describe, expect, it, beforeEach } from 'vitest';
import {
  getCachedEffisDetections,
  setCachedEffisDetections,
  clearEffisCache,
  getEffisCacheStats,
} from '@/lib/effis/cache';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

describe('EFFIS Cache', () => {
  beforeEach(() => {
    clearEffisCache();
  });

  it('should store and retrieve cached data', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [33.5, -5.1] },
          properties: {
            id: 'effis:33.5,-5.1,2024-02-09 13:45',
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
    expect(cached?.data.features.length).toBe(1);
    expect(cached?.data.features[0].properties.brightness).toBe(350);
  });

  it('should return null for cache miss', async () => {
    const cached = await getCachedEffisDetections('0,0,1,1');
    expect(cached).toBeNull();
  });

  it('should track cache statistics', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [33.5, -5.1] },
          properties: {
            id: '1',
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
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [33.6, -5.2] },
          properties: {
            id: '2',
            brightness: 360,
            frp: 48,
            confidence: 'high',
            satellite: 'EFFIS',
            instrument: 'VIIRS',
            acqDateTime: '2024-02-09 13:50',
            daynight: 'D',
            isRecent: true,
            source: 'EFFIS',
          },
        },
      ],
    };

    await setCachedEffisDetections('32.5,-6.0,34.0,-4.5,EPSG:4326', testData);
    const stats = getEffisCacheStats();

    expect(stats.entries).toBe(1);
    expect(stats.totalDetections).toBe(2);
  });

  it('should clear all cache entries', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    await setCachedEffisDetections('bbox1', testData);
    await setCachedEffisDetections('bbox2', testData);

    let stats = getEffisCacheStats();
    expect(stats.entries).toBe(2);

    clearEffisCache();
    stats = getEffisCacheStats();
    expect(stats.entries).toBe(0);
  });

  it('should evict oldest entry when max size reached', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    for (let i = 0; i < 101; i++) {
      await setCachedEffisDetections(`bbox-${i}`, testData);
    }

    const stats = getEffisCacheStats();
    expect(stats.entries).toBeLessThanOrEqual(100);

    const firstEntry = await getCachedEffisDetections('bbox-0');
    expect(firstEntry).toBeNull();

    const lastEntry = await getCachedEffisDetections('bbox-100');
    expect(lastEntry).not.toBeNull();
  });

  it('should include cachedAt timestamp', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    const beforeCache = Date.now();
    await setCachedEffisDetections('bbox', testData);
    const cached = await getCachedEffisDetections('bbox');
    const afterCache = Date.now();

    expect(cached).not.toBeNull();
    expect(cached?.cachedAt).toBeGreaterThanOrEqual(beforeCache);
    expect(cached?.cachedAt).toBeLessThanOrEqual(afterCache);
  });
});
