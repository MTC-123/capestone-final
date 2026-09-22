/**
 * Shared map basemap styles.
 *
 * Priority:
 *  1. MapTiler (premium) – when NEXT_PUBLIC_MAPTILER_API_KEY is set
 *  2. CARTO vector tiles (free, beautiful, no key needed)
 *  3. ESRI World Imagery for satellite (free for limited use)
 *  4. OpenStreetMap raster (ultimate fallback)
 */

export type Basemap = 'streets' | 'light' | 'dark' | 'satellite';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

/* ---------- Free glyph server for raster-only styles ---------- */
const FREE_GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

/* ---------- Free CARTO vector styles ---------- */
const CARTO_STYLES: Record<string, string> = {
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

/* ---------- Raster satellite ---------- */
const SATELLITE_STYLE = {
  version: 8 as const,
  glyphs: FREE_GLYPHS,
  sources: {
    satellite: {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
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

/* ---------- MapTiler premium styles ---------- */
function maptilerStyles(): Record<Basemap, string> {
  return {
    streets: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
    light: `https://api.maptiler.com/maps/positron/style.json?key=${MAPTILER_KEY}`,
    dark: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`,
    satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  };
}

/* ---------- Public API ---------- */

export function getMapStyle(basemap: Basemap): string | object {
  if (MAPTILER_KEY) return maptilerStyles()[basemap];

  if (basemap === 'satellite') return SATELLITE_STYLE;
  return CARTO_STYLES[basemap] ?? CARTO_STYLES.streets;
}

/** Guaranteed-working OSM raster — useful as final fallback */
export function getOsmFallbackStyle(): object {
  return OSM_STYLE;
}

export const HAS_PREMIUM_TILES = Boolean(MAPTILER_KEY);
