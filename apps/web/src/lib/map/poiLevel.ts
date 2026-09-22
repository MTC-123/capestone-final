import type { IncidentStatus } from '@/types';

export interface POILevel {
  level: 1 | 2 | 3;
  label: string;
  labelKey: string;
}

/**
 * Compute POI operational intervention level (1-3).
 * - POI 1 (Local): single commune involved
 * - POI 2 (Provincial): multi-commune, provincial coordination
 * - POI 3 (National): inter-provincial, national coordination
 */
export function computePOILevel(
  severity: number,
  status: IncidentStatus,
): POILevel {
  if (severity >= 5 || status === 'INTERVENTION') {
    return { level: 3, label: 'National', labelKey: 'poiLevel3' };
  }
  if (severity >= 3 || status === 'ALERTE') {
    return { level: 2, label: 'Provincial', labelKey: 'poiLevel2' };
  }
  return { level: 1, label: 'Local', labelKey: 'poiLevel1' };
}
