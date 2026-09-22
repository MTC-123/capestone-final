import type { GeoFeatureCollection, GeoFirmsDetectionProps, FirmsDetection } from '@/types';
import { logger } from '@/lib/observability/logger';

/**
 * Parse CSV line to FirmsDetection object
 * CSV columns: latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
 */
function parseCSVLine(line: string, index: number): FirmsDetection | null {
  const cols = line.split(',');
  if (cols.length < 14) {
    logger.warn({
      event: 'firms_csv_invalid_line',
      meta: { lineIndex: index, columnCount: cols.length, line: line.slice(0, 100) }
    });
    return null;
  }

  const latitude = parseFloat(cols[0]);
  const longitude = parseFloat(cols[1]);
  const brightness = parseFloat(cols[2]);
  const scan = parseFloat(cols[3]);
  const track = parseFloat(cols[4]);
  const bright_t31 = parseFloat(cols[11]);
  const frp = parseFloat(cols[12]);

  // Validate critical numeric fields
  if (
    isNaN(latitude) || isNaN(longitude) || isNaN(brightness) || isNaN(frp) ||
    isNaN(scan) || isNaN(track)
  ) {
    logger.warn({
      event: 'firms_invalid_numeric_fields',
      meta: { line: index, latitude, longitude, brightness, frp }
    });
    return null;
  }

  // Validate coordinate bounds
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    logger.warn({
      event: 'firms_invalid_coords',
      meta: { line: index, latitude, longitude }
    });
    return null;
  }

  /**
   * Parse confidence (can be string like "nominal" or number 0-100)
   *
   * FIRMS API returns confidence in two formats depending on satellite:
   * - VIIRS (Suomi NPP/NOAA-20): String values ("low", "nominal", "high")
   * - MODIS (Terra/Aqua): Numeric values (0-100 percent)
   *
   * We preserve both formats as a union type and handle them in visualization:
   * - String "high" or numeric >= 75 = high confidence (red circle)
   * - String "nominal" or numeric 50-74 = nominal confidence (orange circle)
   * - String "low" or numeric < 50 = low confidence (gray circle)
   *
   * This design decision is pragmatic because:
   * 1. NASA FIRMS API doesn't normalize confidence across satellites
   * 2. Converting strings to numbers would lose semantic meaning
   * 3. Both formats are handled consistently in getFirmsStats() and visualization
   * 4. TypeScript union type provides type safety for both cases
   */
  let confidence: 'low' | 'nominal' | 'high' | number;
  const confidenceNum = parseFloat(cols[9]);
  if (!isNaN(confidenceNum)) {
    confidence = confidenceNum;
  } else if (['low', 'nominal', 'high'].includes(cols[9].toLowerCase())) {
    confidence = cols[9].toLowerCase() as 'low' | 'nominal' | 'high';
  } else {
    logger.warn({
      event: 'firms_invalid_confidence',
      meta: { line: index, confidence: cols[9] }
    });
    confidence = 'nominal'; // Default to nominal
  }

  // Validate daynight field
  let daynight: 'D' | 'N' = cols[13] as 'D' | 'N';
  if (daynight !== 'D' && daynight !== 'N') {
    logger.warn({
      event: 'firms_invalid_daynight',
      meta: { line: index, daynight: cols[13] }
    });
    daynight = 'D'; // Default to day
  }

  return {
    id: `${latitude},${longitude},${cols[6]}`, // lat,lon,acq_time
    latitude,
    longitude,
    brightness,
    scan,
    track,
    acq_date: cols[5],
    acq_time: cols[6],
    satellite: cols[7],
    instrument: cols[8],
    confidence,
    version: cols[10],
    bright_t31,
    frp,
    daynight,
  };
}

/**
 * Check if detection is recent (within last 12 hours) for pulsing animation
 */
function isRecentDetection(acqDate: string, acqTime: string): boolean {
  try {
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(acqDate)) {
      logger.warn({
        event: 'firms_invalid_date_format',
        meta: { acqDate, expectedFormat: 'YYYY-MM-DD' }
      });
      return false;
    }

    // Validate time format (HHMM)
    if (!/^\d{4}$/.test(acqTime)) {
      logger.warn({
        event: 'firms_invalid_time_format',
        meta: { acqTime, expectedFormat: 'HHMM' }
      });
      return false;
    }

    const detectionTime = new Date(`${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2)}:00Z`);

    // Validate parsed date is valid
    if (isNaN(detectionTime.getTime())) {
      logger.warn({
        event: 'firms_invalid_datetime',
        meta: { acqDate, acqTime }
      });
      return false;
    }

    const now = new Date();
    const ageHours = (now.getTime() - detectionTime.getTime()) / (1000 * 60 * 60);
    return ageHours <= 12;
  } catch (error) {
    logger.warn({
      event: 'firms_datetime_parse_error',
      meta: { acqDate, acqTime, error: error instanceof Error ? error.message : 'unknown' }
    });
    return false;
  }
}

/**
 * Transform FIRMS CSV response to GeoJSON FeatureCollection
 */
export function transformFirmsToGeoJSON(csvText: string): GeoFeatureCollection<GeoFirmsDetectionProps> {
  const lines = csvText.trim().split('\n');

  // Skip header row if present
  if (lines.length > 0 && lines[0].toLowerCase().includes('latitude')) {
    lines.shift();
  }

  if (lines.length === 0) {
    logger.warn({ event: 'firms_empty_response', meta: { csvLength: csvText.length } });
    return { type: 'FeatureCollection', features: [] };
  }

  let validCount = 0;
  let invalidCount = 0;

  const features: GeoFeatureCollection<GeoFirmsDetectionProps>['features'] = [];
  for (let i = 0; i < lines.length; i++) {
    const det = parseCSVLine(lines[i], i);
    if (!det) {
      invalidCount++;
      continue;
    }
    validCount++;
    features.push({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [det.longitude, det.latitude] as [number, number],
      },
      properties: {
        id: det.id,
        brightness: det.brightness,
        frp: det.frp,
        confidence: det.confidence,
        satellite: det.satellite,
        instrument: det.instrument,
        acqDateTime: `${det.acq_date} ${det.acq_time.slice(0, 2)}:${det.acq_time.slice(2)}`,
        daynight: det.daynight,
        isRecent: isRecentDetection(det.acq_date, det.acq_time),
      },
    });
  }

  logger.info({
    event: 'firms_transform_complete',
    meta: {
      totalLines: lines.length,
      validFeatures: validCount,
      invalidFeatures: invalidCount,
      dataQualityPercent: Math.round((validCount / lines.length) * 100)
    }
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Type guard for FIRMS CSV response validation
 * Rejects HTML responses and validates CSV structure
 */
export function isFirmsCSVResponse(text: string): boolean {
  const trimmed = text.trim();

  // Reject HTML responses (authentication failures return HTML login pages)
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    logger.warn({
      event: 'firms_html_response_rejected',
      meta: { preview: trimmed.slice(0, 100) }
    });
    return false;
  }

  const lines = trimmed.split('\n');
  if (lines.length === 0) return false;

  // Check if first line is CSV header with required columns
  // VIIRS format uses "bright_ti4" while MODIS uses "brightness"
  const firstLine = lines[0];
  const lowerFirst = firstLine.toLowerCase();
  const hasBrightnessColumn = lowerFirst.includes('brightness') || lowerFirst.includes('bright_ti4');
  const hasRequiredHeaders = lowerFirst.includes('latitude')
    && lowerFirst.includes('longitude')
    && hasBrightnessColumn;

  return hasRequiredHeaders;
}

/**
 * Get summary statistics from FIRMS detections
 */
export function getFirmsStats(collection: GeoFeatureCollection<GeoFirmsDetectionProps>) {
  const detections = collection.features;

  if (detections.length === 0) {
    return {
      total: 0,
      highConfidence: 0,
      nominalConfidence: 0,
      lowConfidence: 0,
      avgFRP: 0,
      maxFRP: 0,
      recentCount: 0,
    };
  }

  let highConfidence = 0;
  let nominalConfidence = 0;
  let lowConfidence = 0;
  let totalFRP = 0;
  let maxFRP = 0;
  let recentCount = 0;

  for (const feature of detections) {
    const { confidence, frp, isRecent } = feature.properties;

    // Count by confidence
    if (confidence === 'high' || (typeof confidence === 'number' && confidence >= 75)) {
      highConfidence++;
    } else if (confidence === 'low' || (typeof confidence === 'number' && confidence < 50)) {
      lowConfidence++;
    } else {
      nominalConfidence++;
    }

    // FRP stats
    totalFRP += frp;
    if (frp > maxFRP) maxFRP = frp;

    // Recent count
    if (isRecent) recentCount++;
  }

  return {
    total: detections.length,
    highConfidence,
    nominalConfidence,
    lowConfidence,
    avgFRP: Math.round(totalFRP / detections.length * 10) / 10,
    maxFRP: Math.round(maxFRP * 10) / 10,
    recentCount,
  };
}
