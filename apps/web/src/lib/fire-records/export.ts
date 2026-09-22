/**
 * Pure functions for exporting fire records to CSV and GeoJSON.
 */

interface FireRecordRow {
  id: string;
  incidentId: string;
  alertSource: string;
  recordStatus: string;
  burnAreaHa?: number | null;
  ignitionAt?: string | Date | null;
  alertReceivedAt?: string | Date | null;
  verifiedAt?: string | Date | null;
  firstResponseAt?: string | Date | null;
  onSceneAt?: string | Date | null;
  containedAt?: string | Date | null;
  extinguishedAt?: string | Date | null;
  burnPerimeter?: unknown;
  burnCentroid?: unknown;
  locationDetail?: unknown;
  causeDetail?: unknown;
  damageDetail?: unknown;
  responseDetail?: unknown;
  weatherAtTime?: unknown;
  postFire?: unknown;
  createdAt: string | Date;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toDateStr(val: string | Date | null | undefined): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

function jsonField(obj: unknown, path: string): string {
  if (!obj || typeof obj !== 'object') return '';
  const val = (obj as Record<string, unknown>)[path];
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return val.join(';');
  return String(val);
}

export function recordsToCSV(records: FireRecordRow[]): string {
  const headers = [
    'id',
    'incidentId',
    'alertSource',
    'recordStatus',
    'burnAreaHa',
    'commune',
    'locationName',
    'causeCategory',
    'causeCertainty',
    'surfaceBurnedHa',
    'vegetationTypes',
    'totalDamageEstimate',
    'responseTimeMinutes',
    'personnelCount',
    'vehicleCount',
    'aircraftCount',
    'temperatureC',
    'humidityPct',
    'windSpeedKmh',
    'severityAssessment',
    'recoveryStatus',
    'ignitionAt',
    'alertReceivedAt',
    'verifiedAt',
    'firstResponseAt',
    'onSceneAt',
    'containedAt',
    'extinguishedAt',
    'createdAt',
  ];

  const rows = records.map((r) => [
    escapeCSV(r.id),
    escapeCSV(r.incidentId),
    escapeCSV(r.alertSource),
    escapeCSV(r.recordStatus),
    r.burnAreaHa != null ? String(r.burnAreaHa) : '',
    escapeCSV(jsonField(r.locationDetail, 'commune')),
    escapeCSV(jsonField(r.locationDetail, 'locationName')),
    escapeCSV(jsonField(r.causeDetail, 'category')),
    escapeCSV(jsonField(r.causeDetail, 'certainty')),
    jsonField(r.damageDetail, 'surfaceBurnedHa'),
    escapeCSV(jsonField(r.damageDetail, 'vegetationTypes')),
    jsonField(r.damageDetail, 'totalEstimate'),
    jsonField(r.responseDetail, 'responseTimeMinutes'),
    jsonField(r.responseDetail, 'personnelCount'),
    jsonField(r.responseDetail, 'vehicleCount'),
    jsonField(r.responseDetail, 'aircraftCount'),
    jsonField(r.weatherAtTime, 'temperatureC'),
    jsonField(r.weatherAtTime, 'humidityPct'),
    jsonField(r.weatherAtTime, 'windSpeedKmh'),
    escapeCSV(jsonField(r.postFire, 'severityAssessment')),
    escapeCSV(jsonField(r.postFire, 'recoveryStatus')),
    toDateStr(r.ignitionAt),
    toDateStr(r.alertReceivedAt),
    toDateStr(r.verifiedAt),
    toDateStr(r.firstResponseAt),
    toDateStr(r.onSceneAt),
    toDateStr(r.containedAt),
    toDateStr(r.extinguishedAt),
    toDateStr(r.createdAt),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function recordsToGeoJSON(records: FireRecordRow[]): object {
  const features = records
    .filter((r) => r.burnPerimeter != null || hasCoordinates(r.locationDetail))
    .map((r) => ({
      type: 'Feature' as const,
      geometry: r.burnPerimeter ?? pointFromLocation(r.locationDetail),
      properties: {
        id: r.id,
        incidentId: r.incidentId,
        alertSource: r.alertSource,
        recordStatus: r.recordStatus,
        burnAreaHa: r.burnAreaHa,
        commune: jsonField(r.locationDetail, 'commune'),
        causeCategory: jsonField(r.causeDetail, 'category'),
        responseTimeMinutes: jsonField(r.responseDetail, 'responseTimeMinutes'),
        createdAt: toDateStr(r.createdAt),
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

function hasCoordinates(loc: unknown): boolean {
  if (!loc || typeof loc !== 'object') return false;
  const coords = (loc as Record<string, unknown>).coordinates;
  return Array.isArray(coords) && coords.length === 2;
}

function pointFromLocation(loc: unknown): object | null {
  if (!loc || typeof loc !== 'object') return null;
  const coords = (loc as Record<string, unknown>).coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  return { type: 'Point', coordinates: coords };
}
