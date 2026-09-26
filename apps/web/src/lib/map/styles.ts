/**
 * Shared map basemap styles.
 *
 * The default basemap is the project-hosted Ifrane PMTiles extract. External
 * imagery is only used when explicitly selected and requires connectivity.
 */

import { layers, namedFlavor } from '@protomaps/basemaps';

export type Basemap = 'streets' | 'light' | 'dark' | 'satellite';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

/* ---------- Free glyph server for raster-only styles ---------- */
const FREE_GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

/* ---------- Self-hosted Protomaps / OSM extract ---------- */
function localStyle(flavor: 'light' | 'dark') {
  const origin = typeof window !== 'undefined' ? window.location.origin : process.env.BASE_URL || 'http://localhost:3000';
  return {
    version: 8 as const,
    glyphs: `${origin}/maps/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/maps/sprites/${flavor}`,
    sources: {
      protomaps: {
        type: 'vector' as const,
        url: `pmtiles://${origin}/maps/ifrane.pmtiles`,
        attribution: '© OpenStreetMap contributors · Protomaps',
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), { lang: 'en' }),
  };
}

/* ---------- NASA GIBS satellite context (daily, coarse at local zoom) ---------- */
const SATELLITE_STYLE = {
  version: 8 as const,
  glyphs: '/maps/fonts/{fontstack}/{range}.pbf',
  sources: {
    satellite: {
      type: 'raster' as const,
      tiles: [
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA21_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg',
      ],
      tileSize: 256,
      maxzoom: 9,
      attribution: 'NASA GIBS · VIIRS NOAA-21',
    },
  },
  layers: [{ id: 'satellite', type: 'raster' as const, source: 'satellite' }],
};

/* ---------- OSM raster fallback ---------- */
const OSM_STYLE = {
  version: 8 as const,
  glyphs: FREE_GLYPHS,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

/* ---------- Public API ---------- */

export function getMapStyle(basemap: Basemap): string | object {
  if (basemap === 'satellite') return SATELLITE_STYLE;
  return localStyle(basemap === 'dark' ? 'dark' : 'light');
}

/** Guaranteed-working OSM raster — useful as final fallback */
export function getOsmFallbackStyle(): object {
  return OSM_STYLE;
}

export const HAS_PREMIUM_TILES = Boolean(MAPTILER_KEY);
