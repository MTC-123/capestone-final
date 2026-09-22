/**
 * Map utility helper functions
 */

/**
 * Creates a circular SVG icon data URL for map markers
 * @param color - Hex color code for the circle fill
 * @returns Data URL string for use in image sources
 */
const iconCache = new Map<string, string>();

export function circleIcon(color: string): string {
  return shapeIcon('circle', color);
}

export type IconShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'pentagon' | 'shield' | 'droplet' | 'house' | 'hexagon';

const SHAPE_PATHS: Record<IconShape, string> = {
  circle: '<circle cx="12" cy="12" r="10" fill="COLOR" stroke="white" stroke-width="2"/>',
  square: '<rect x="2" y="2" width="20" height="20" rx="3" fill="COLOR" stroke="white" stroke-width="2"/>',
  diamond: '<polygon points="12,1 23,12 12,23 1,12" fill="COLOR" stroke="white" stroke-width="2"/>',
  triangle: '<polygon points="12,2 23,21 1,21" fill="COLOR" stroke="white" stroke-width="2"/>',
  pentagon: '<polygon points="12,2 22,9 19,21 5,21 2,9" fill="COLOR" stroke="white" stroke-width="2"/>',
  shield: '<path d="M12,2 L21,6 L21,13 C21,18 12,22 12,22 C12,22 3,18 3,13 L3,6 Z" fill="COLOR" stroke="white" stroke-width="2"/>',
  droplet: '<path d="M12,2 C12,2 4,11 4,15 C4,19.4 7.6,22 12,22 C16.4,22 20,19.4 20,15 C20,11 12,2 12,2 Z" fill="COLOR" stroke="white" stroke-width="2"/>',
  house: '<path d="M12,2 L22,10 L22,21 C22,21.5 21.5,22 21,22 L3,22 C2.5,22 2,21.5 2,21 L2,10 Z" fill="COLOR" stroke="white" stroke-width="2"/>',
  hexagon: '<polygon points="12,2 21,6 21,16 12,22 3,16 3,6" fill="COLOR" stroke="white" stroke-width="2"/>',
};

/**
 * Creates an SVG icon data URL for map markers with the given shape and color.
 * Results are cached by shape+color combination.
 */
export function shapeIcon(shape: IconShape, color: string): string {
  const key = `${shape}:${color}`;
  let cached = iconCache.get(key);
  if (!cached) {
    const svgBody = SHAPE_PATHS[shape].replace('COLOR', color);
    cached = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">${svgBody}</svg>`,
    )}`;
    iconCache.set(key, cached);
  }
  return cached;
}

/** Map from resource type to its icon shape */
export const RESOURCE_SHAPE: Record<string, IconShape> = {
  TRUCK: 'square',
  AIRCRAFT: 'diamond',
  PERSONNEL: 'triangle',
  EQUIPMENT: 'pentagon',
};

/** Map from infrastructure type to its icon shape */
export const INFRA_SHAPE: Record<string, IconShape> = {
  WATCHTOWER: 'triangle',
  WATER_POINT: 'droplet',
  STATION: 'house',
  FIREBREAK: 'shield',
  HELIPAD: 'diamond',
};

/**
 * Type-safe GeoJSON caster for use with map libraries
 * @param fc - Feature collection to cast
 * @returns The feature collection as any type for library compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asGeoJSON(fc: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return fc as any;
}

/**
 * Formats coordinates to a readable string
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Formatted coordinate string
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

/**
 * Converts a hex color string to an RGBA tuple for use with deck.gl layers
 * @param hex - Hex color string (e.g. '#ef4444' or 'ef4444')
 * @param alpha - Alpha channel 0-255 (default 255)
 * @returns [r, g, b, a] tuple
 */
const HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const r = HEX_RE.exec(hex);
  return r
    ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16), alpha]
    : [100, 100, 100, alpha];
}
