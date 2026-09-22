import type { GeoFeatureCollection, GeoFirmsDetectionProps } from '@/types';
import { logger } from '@/lib/observability/logger';

/**
 * EFFIS WFS GeoJSON feature properties (as returned by Copernicus)
 * Property names may differ from FIRMS CSV columns
 */
interface EffisFeatureProperties {
  /** Latitude */
  latitude?: number;
  /** Longitude */
  longitude?: number;
  /** Brightness temperature */
  brightness?: number;
  bright_ti4?: number;
  /** Fire Radiative Power in MW */
  frp?: number;
  /** Confidence level (string or number) */
  confidence?: string | number;
  /** Acquisition date (YYYY-MM-DD or ISO) */
  acq_date?: string;
  /** Acquisition time (HHMM) */
  acq_time?: string;
  /** Satellite identifier */
  satellite?: string;
  /** Instrument (VIIRS, MODIS) */
  instrument?: string;
  /** Day/Night flag */
  daynight?: string;
  /** EFFIS-specific: ISO datetime string */
  firedate?: string;
  /** EFFIS-specific: area in hectares */
  area_ha?: number;
  [key: string]: unknown;
}

interface EffisGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: EffisFeatureProperties;
}

interface EffisGeoJSON {
  type: 'FeatureCollection';
  features: EffisGeoJSONFeature[];
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/**
 * Check if detection is recent (within last 12 hours)
 */
function isRecentDetection(dateStr: string, timeStr?: string): boolean {
  try {
    let detectionTime: Date;

    if (timeStr && /^\d{4}$/.test(timeStr)) {
      // FIRMS-style: separate date + HHMM time
      detectionTime = new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00Z`);
    } else {
      // ISO string or date-only
      detectionTime = new Date(dateStr);
    }

    if (isNaN(detectionTime.getTime())) return false;
    return (Date.now() - detectionTime.getTime()) <= TWELVE_HOURS_MS;
  } catch {
    return false;
  }
}

/**
 * Normalize confidence from EFFIS to FIRMS format
 */
function normalizeConfidence(raw: string | number | undefined): 'low' | 'nominal' | 'high' | number {
  if (raw === undefined || raw === null) return 'nominal';

  if (typeof raw === 'number') {
    if (raw >= 75) return 'high';
    if (raw >= 50) return 'nominal';
    return 'low';
  }

  const lower = String(raw).toLowerCase().trim();
  if (lower === 'high' || lower === 'h') return 'high';
  if (lower === 'low' || lower === 'l') return 'low';
  if (lower === 'nominal' || lower === 'n') return 'nominal';

  const num = parseFloat(lower);
  if (!isNaN(num)) {
    if (num >= 75) return 'high';
    if (num >= 50) return 'nominal';
    return 'low';
  }

  return 'nominal';
}

/**
 * Validate GeoJSON structure from EFFIS WFS response
 */
function isValidEffisGeoJSON(data: unknown): data is EffisGeoJSON {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection') return false;
  if (!Array.isArray(obj.features)) return false;
  return true;
}

/**
 * Validate coordinates are within valid bounds
 */
function isValidCoordinate(coords: unknown): coords is [number, number] {
  if (!Array.isArray(coords) || coords.length < 2) return false;
  const [lon, lat] = coords;
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  if (isNaN(lon) || isNaN(lat)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Transform EFFIS WFS GeoJSON to normalized GeoFirmsDetectionProps format.
 * Sets source: 'EFFIS' on each feature.
 */
export function transformEffisToGeoJSON(
  rawData: unknown
): GeoFeatureCollection<GeoFirmsDetectionProps> {
  if (!isValidEffisGeoJSON(rawData)) {
    logger.warn({
      event: 'effis_invalid_geojson',
      meta: { type: typeof rawData },
    });
    return { type: 'FeatureCollection', features: [] };
  }

  let validCount = 0;
  let invalidCount = 0;

  const features: GeoFeatureCollection<GeoFirmsDetectionProps>['features'] = [];

  for (let i = 0; i < rawData.features.length; i++) {
    const feature = rawData.features[i];

    // Validate geometry
    if (!feature.geometry || feature.geometry.type !== 'Point') {
      invalidCount++;
      continue;
    }

    if (!isValidCoordinate(feature.geometry.coordinates)) {
      invalidCount++;
      continue;
    }

    const [lon, lat] = feature.geometry.coordinates;
    const props = feature.properties;

    // Extract brightness (EFFIS may use bright_ti4 or brightness)
    const brightness = props.brightness ?? props.bright_ti4 ?? 0;
    if (typeof brightness !== 'number' || isNaN(brightness)) {
      invalidCount++;
      continue;
    }

    // Extract FRP
    const frp = typeof props.frp === 'number' && !isNaN(props.frp) ? props.frp : 0;

    // Build acquisition datetime string
    let acqDateTime: string;
    let dateForRecency: string;
    let timeForRecency: string | undefined;

    if (props.firedate) {
      // EFFIS ISO datetime
      const d = new Date(props.firedate);
      if (!isNaN(d.getTime())) {
        acqDateTime = `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
        dateForRecency = props.firedate;
      } else {
        acqDateTime = String(props.firedate);
        dateForRecency = String(props.firedate);
      }
    } else if (props.acq_date && props.acq_time) {
      const time = String(props.acq_time);
      acqDateTime = `${props.acq_date} ${time.slice(0, 2)}:${time.slice(2)}`;
      dateForRecency = props.acq_date;
      timeForRecency = time;
    } else {
      acqDateTime = 'Unknown';
      dateForRecency = new Date().toISOString();
    }

    const id = `effis:${lat},${lon},${acqDateTime}`;

    validCount++;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties: {
        id,
        brightness,
        frp,
        confidence: normalizeConfidence(props.confidence),
        satellite: props.satellite ?? 'EFFIS',
        instrument: props.instrument ?? 'VIIRS',
        acqDateTime,
        daynight: (props.daynight === 'D' || props.daynight === 'N') ? props.daynight : 'D',
        isRecent: isRecentDetection(dateForRecency, timeForRecency),
        source: 'EFFIS',
      },
    });
  }

  logger.info({
    event: 'effis_transform_complete',
    meta: {
      totalFeatures: rawData.features.length,
      validFeatures: validCount,
      invalidFeatures: invalidCount,
    },
  });

  return { type: 'FeatureCollection', features };
}
