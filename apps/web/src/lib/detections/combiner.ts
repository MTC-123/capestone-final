import type { GeoFeatureCollection, GeoFirmsDetectionProps, DetectionSource } from '@/types';
import { logger } from '@/lib/observability/logger';

/**
 * Deduplication thresholds
 * Two detections are duplicates if within 375m AND within 30 minutes
 */
const DEDUP_DISTANCE_M = 375;
const DEDUP_TIME_WINDOW_MS = 30 * 60 * 1000;

/**
 * Approximate distance in meters between two lat/lon pairs using Haversine
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse acqDateTime string to timestamp for temporal comparison
 */
function parseAcqDateTime(acqDateTime: string): number {
  // Format: "YYYY-MM-DD HH:MM" or ISO string
  const parsed = new Date(acqDateTime.replace(' ', 'T') + (acqDateTime.includes('Z') ? '' : ':00Z'));
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

type Feature = GeoFeatureCollection<GeoFirmsDetectionProps>['features'][number];

/**
 * Combine FIRMS + EFFIS detections with deduplication.
 *
 * Deduplication: two detections are duplicates if within 375m AND within 30 min.
 * When duplicates found: keep higher FRP detection, set source to 'FIRMS+EFFIS'.
 *
 * Simple O(n*m) comparison — fine for <500 detections in Ifrane region.
 */
export function combineDetections(
  firms: GeoFeatureCollection<GeoFirmsDetectionProps>,
  effis: GeoFeatureCollection<GeoFirmsDetectionProps>
): GeoFeatureCollection<GeoFirmsDetectionProps> {
  // Tag FIRMS features with source if not already tagged
  const firmsFeatures = firms.features.map((f) => ({
    ...f,
    properties: { ...f.properties, source: (f.properties.source ?? 'FIRMS') as DetectionSource },
  }));

  const effisFeatures = effis.features.map((f) => ({
    ...f,
    properties: { ...f.properties, source: (f.properties.source ?? 'EFFIS') as DetectionSource },
  }));

  // Track which EFFIS features are duplicates of FIRMS features
  const effisDuplicate = new Set<number>();
  const mergedFirms: Feature[] = [];

  for (const firmsF of firmsFeatures) {
    const firmsCoords = firmsF.geometry.coordinates as [number, number];
    const firmsTime = parseAcqDateTime(firmsF.properties.acqDateTime);
    let merged = false;

    for (let j = 0; j < effisFeatures.length; j++) {
      if (effisDuplicate.has(j)) continue;

      const effisF = effisFeatures[j];
      const effisCoords = effisF.geometry.coordinates as [number, number];
      const effisTime = parseAcqDateTime(effisF.properties.acqDateTime);

      const dist = haversineDistance(firmsCoords[1], firmsCoords[0], effisCoords[1], effisCoords[0]);
      const timeDiff = Math.abs(firmsTime - effisTime);

      if (dist <= DEDUP_DISTANCE_M && timeDiff <= DEDUP_TIME_WINDOW_MS) {
        // Duplicate found — keep higher FRP, tag as combined
        effisDuplicate.add(j);
        const keepFirms = firmsF.properties.frp >= effisF.properties.frp;
        const kept = keepFirms ? firmsF : effisF;
        mergedFirms.push({
          ...kept,
          properties: { ...kept.properties, source: 'FIRMS+EFFIS' },
        });
        merged = true;
        break;
      }
    }

    if (!merged) {
      mergedFirms.push(firmsF);
    }
  }

  // Add non-duplicate EFFIS features
  const uniqueEffis = effisFeatures.filter((_, i) => !effisDuplicate.has(i));

  const combined = [...mergedFirms, ...uniqueEffis];

  logger.info({
    event: 'detections_combined',
    meta: {
      firmsCount: firms.features.length,
      effisCount: effis.features.length,
      duplicatesFound: effisDuplicate.size,
      combinedCount: combined.length,
    },
  });

  return { type: 'FeatureCollection', features: combined };
}
