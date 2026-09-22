import { describe, expect, it, beforeEach } from 'vitest';
import {
  getCachedFirmsDetections,
  setCachedFirmsDetections,
  clearFirmsCache,
  getFirmsCacheStats,
} from '@/lib/firms/cache';
import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';

describe('FIRMS Cache', () => {
  beforeEach(() => {
    clearFirmsCache();
  });

  it('should store and retrieve cached data', async () => {
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
            satellite: 'N',
            instrument: 'VIIRS',
            acqDateTime: '2024-02-09 13:45',
            daynight: 'D',
            isRecent: true,
          },
        },
      ],
    };

    await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData);
    const cached = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);

    expect(cached).not.toBeNull();
    expect(cached?.data.features.length).toBe(1);
    expect(cached?.data.features[0].properties.brightness).toBe(350);
  });

  it('should return null for cache miss', async () => {
    const cached = await getCachedFirmsDetections('0,0,1,1', 'VIIRS_NOAA20_NRT', 1);
    expect(cached).toBeNull();
  });

  it('should handle different cache keys for different parameters', async () => {
    const testData1: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };
    const testData2: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [33.5, -5.1] },
          properties: {
            id: '2',
            brightness: 400,
            frp: 50,
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

    // Different bbox
    await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData1);
    await setCachedFirmsDetections('34.0,-6.0,34.5,-5.5', 'VIIRS_NOAA20_NRT', 1, testData2);

    const cached1 = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);
    const cached2 = await getCachedFirmsDetections('34.0,-6.0,34.5,-5.5', 'VIIRS_NOAA20_NRT', 1);

    expect(cached1?.data.features.length).toBe(0);
    expect(cached2?.data.features.length).toBe(1);
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
            satellite: 'N',
            instrument: 'VIIRS',
            acqDateTime: '2024-02-09 13:45',
            daynight: 'D',
            isRecent: true,
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
            satellite: 'N',
            instrument: 'VIIRS',
            acqDateTime: '2024-02-09 13:50',
            daynight: 'D',
            isRecent: true,
          },
        },
      ],
    };

    await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData);
    const stats = getFirmsCacheStats();

    expect(stats.entries).toBe(1);
    expect(stats.totalDetections).toBe(2);
  });

  it('should clear all cache entries', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData);
    await setCachedFirmsDetections('34.0,-6.0,34.5,-5.5', 'MODIS_NRT', 2, testData);

    let stats = getFirmsCacheStats();
    expect(stats.entries).toBe(2);

    clearFirmsCache();
    stats = getFirmsCacheStats();
    expect(stats.entries).toBe(0);

    const cached = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);
    expect(cached).toBeNull();
  });

  it('should evict oldest entry when max size reached', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    // Create 101 cache entries to trigger eviction
    for (let i = 0; i < 101; i++) {
      await setCachedFirmsDetections(`${i},${i},${i + 1},${i + 1}`, 'VIIRS_NOAA20_NRT', 1, testData);
    }

    const stats = getFirmsCacheStats();
    expect(stats.entries).toBeLessThanOrEqual(100);

    // First entry should have been evicted
    const firstEntry = await getCachedFirmsDetections('0,0,1,1', 'VIIRS_NOAA20_NRT', 1);
    expect(firstEntry).toBeNull();

    // Last entry should still exist
    const lastEntry = await getCachedFirmsDetections('100,100,101,101', 'VIIRS_NOAA20_NRT', 1);
    expect(lastEntry).not.toBeNull();
  });

  it('should include cachedAt timestamp', async () => {
    const testData: GeoFeatureCollection<GeoFirmsDetectionProps> = {
      type: 'FeatureCollection',
      features: [],
    };

    const beforeCache = Date.now();
    await setCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1, testData);
    const cached = await getCachedFirmsDetections('33.3,-5.3,33.7,-4.9', 'VIIRS_NOAA20_NRT', 1);
    const afterCache = Date.now();

    expect(cached).not.toBeNull();
    expect(cached?.cachedAt).toBeGreaterThanOrEqual(beforeCache);
    expect(cached?.cachedAt).toBeLessThanOrEqual(afterCache);
  });
});
