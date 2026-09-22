import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Map Styles', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('free tier (no MAPTILER key)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_MAPTILER_API_KEY', '');
    });

    it('streets returns CARTO voyager URL', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('streets');
      expect(typeof style).toBe('string');
      expect(style).toContain('cartocdn.com');
      expect(style).toContain('voyager');
    });

    it('light returns CARTO positron URL', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('light');
      expect(typeof style).toBe('string');
      expect(style).toContain('positron');
    });

    it('dark returns CARTO dark-matter URL', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('dark');
      expect(typeof style).toBe('string');
      expect(style).toContain('dark-matter');
    });

    it('satellite returns object with ESRI source', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('satellite');
      expect(typeof style).toBe('object');
      const obj = style as Record<string, unknown>;
      expect(obj).toHaveProperty('sources');
      const sources = obj.sources as Record<string, Record<string, unknown>>;
      expect(sources.satellite.tiles).toBeDefined();
      const tiles = sources.satellite.tiles as string[];
      expect(tiles[0]).toContain('arcgisonline.com');
    });

    it('getOsmFallbackStyle returns version 8 with OSM source', async () => {
      const { getOsmFallbackStyle } = await import('@/lib/map/styles');
      const style = getOsmFallbackStyle() as Record<string, unknown>;
      expect(style.version).toBe(8);
      const sources = style.sources as Record<string, Record<string, unknown>>;
      expect(sources.osm).toBeDefined();
      const tiles = sources.osm.tiles as string[];
      expect(tiles[0]).toContain('openstreetmap.org');
    });

    it('HAS_PREMIUM_TILES is false', async () => {
      const { HAS_PREMIUM_TILES } = await import('@/lib/map/styles');
      expect(HAS_PREMIUM_TILES).toBe(false);
    });
  });

  describe('premium tier (MAPTILER key set)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_MAPTILER_API_KEY', 'test-maptiler-key-123');
    });

    it('streets returns MapTiler URL with key', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('streets') as string;
      expect(style).toContain('api.maptiler.com');
      expect(style).toContain('test-maptiler-key-123');
    });

    it('light returns MapTiler URL with key', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('light') as string;
      expect(style).toContain('api.maptiler.com');
      expect(style).toContain('test-maptiler-key-123');
    });

    it('dark returns MapTiler URL with key', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('dark') as string;
      expect(style).toContain('api.maptiler.com');
      expect(style).toContain('test-maptiler-key-123');
    });

    it('satellite returns MapTiler URL with key', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const style = getMapStyle('satellite') as string;
      expect(style).toContain('api.maptiler.com');
      expect(style).toContain('test-maptiler-key-123');
    });

    it('HAS_PREMIUM_TILES is true', async () => {
      const { HAS_PREMIUM_TILES } = await import('@/lib/map/styles');
      expect(HAS_PREMIUM_TILES).toBe(true);
    });

    it('all 4 basemaps return strings (not objects)', async () => {
      const { getMapStyle } = await import('@/lib/map/styles');
      const basemaps = ['streets', 'light', 'dark', 'satellite'] as const;
      for (const b of basemaps) {
        expect(typeof getMapStyle(b)).toBe('string');
      }
    });
  });
});
