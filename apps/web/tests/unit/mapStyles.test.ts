import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('self-hosted map styles', () => {
  beforeEach(() => { vi.resetModules(); });

  it.each(['streets', 'light', 'dark'] as const)('%s uses the Ifrane PMTiles archive with attribution', async (basemap) => {
    const { getMapStyle } = await import('@/lib/map/styles');
    const style = getMapStyle(basemap) as { sources: { protomaps: { url: string; attribution: string } }; glyphs: string };
    expect(style.sources.protomaps.url).toContain('/maps/ifrane.pmtiles');
    expect(style.sources.protomaps.attribution).toContain('OpenStreetMap');
    expect(style.glyphs).toContain('/maps/fonts/');
  });

  it('uses keyless NASA GIBS for satellite context', async () => {
    const { getMapStyle } = await import('@/lib/map/styles');
    const style = getMapStyle('satellite') as { sources: { satellite: { tiles: string[]; attribution: string } } };
    expect(style.sources.satellite.tiles[0]).toContain('gibs.earthdata.nasa.gov');
    expect(style.sources.satellite.attribution).toContain('NASA GIBS');
  });

  it('does not switch core basemaps to a paid provider when a terrain key exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPTILER_API_KEY', 'test-maptiler-key-123');
    const { getMapStyle, HAS_PREMIUM_TILES } = await import('@/lib/map/styles');
    expect(HAS_PREMIUM_TILES).toBe(true);
    const style = getMapStyle('streets') as { sources: { protomaps: { url: string } } };
    expect(style.sources.protomaps.url).toContain('/maps/ifrane.pmtiles');
    vi.unstubAllEnvs();
  });

  it('retains the attributed OSM emergency fallback', async () => {
    const { getOsmFallbackStyle } = await import('@/lib/map/styles');
    const style = getOsmFallbackStyle() as { version: number; sources: { osm: { tiles: string[] } } };
    expect(style.version).toBe(8);
    expect(style.sources.osm.tiles[0]).toContain('openstreetmap.org');
  });
});
