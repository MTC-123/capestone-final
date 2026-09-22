// ============================================
// Enums
// ============================================

export const ALERT_SOURCES = [
  'FIRMS_SATELLITE',
  'CITIZEN_REPORT',
  'PATROL',
  'PHONE_CALL',
  'RADIO',
  'OTHER',
] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

export const RECORD_STATUSES = ['DRAFT', 'VERIFIED', 'LOCKED'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const LOCKABLE_SECTIONS = [
  'location',
  'cause',
  'damage',
  'response',
  'postFire',
] as const;
export type LockableSection = (typeof LOCKABLE_SECTIONS)[number];

export const CAUSE_CERTAINTIES = ['CONFIRMED', 'PROBABLE', 'SUSPECTED', 'UNKNOWN'] as const;
export const CAUSE_CATEGORIES = [
  'NATURAL', 'AGRICULTURAL', 'PASTORAL', 'NEGLIGENCE',
  'INTENTIONAL', 'RECREATION', 'INFRASTRUCTURE', 'UNKNOWN',
] as const;
export const VEGETATION_TYPES = [
  'FOREST_CONIFER', 'FOREST_BROADLEAF', 'FOREST_MIXED',
  'MAQUIS', 'GARRIGUE', 'GRASSLAND', 'AGRICULTURE', 'OTHER',
] as const;
export const SEVERITY_ASSESSMENTS = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const;
export const RECOVERY_STATUSES = ['NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const;

// ============================================
// Enum validators
// ============================================

export function isAlertSource(value: unknown): value is AlertSource {
  return typeof value === 'string' && (ALERT_SOURCES as readonly string[]).includes(value);
}

export function isRecordStatus(value: unknown): value is RecordStatus {
  return typeof value === 'string' && (RECORD_STATUSES as readonly string[]).includes(value);
}

export function isLockableSection(value: unknown): value is LockableSection {
  return typeof value === 'string' && (LOCKABLE_SECTIONS as readonly string[]).includes(value);
}

// ============================================
// Sub-interfaces
// ============================================

export interface AgencyArrival {
  agencyName: string;
  arrivedAt: string; // ISO date
  personnelCount: number;
}

export interface MeansEngaged {
  vehicleCount: number;
  aircraftCount: number;
  personnelCount: number;
  waterVolumeLiters: number;
  retardantVolumeLiters: number;
}

export interface EconomicLoss {
  forestAreaHa: number;
  infrastructureDamage: number; // MAD
  agricultureDamage: number; // MAD
  otherDamage: number; // MAD
  totalEstimate: number; // MAD
}

export interface AuditEntry {
  userId: string;
  cin: string;
  action: string;
  section?: string;
  changes?: Record<string, unknown>;
  timestamp: string; // ISO date
}

// ============================================
// Struct validators
// ============================================

export function validateAgencyArrivals(value: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(value)) return { valid: false, error: 'agencyArrivals must be an array' };

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!entry || typeof entry !== 'object') {
      return { valid: false, error: `agencyArrivals[${i}] must be an object` };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.agencyName !== 'string' || !e.agencyName) {
      return { valid: false, error: `agencyArrivals[${i}].agencyName is required` };
    }
    if (typeof e.arrivedAt !== 'string' || !e.arrivedAt) {
      return { valid: false, error: `agencyArrivals[${i}].arrivedAt is required` };
    }
    if (typeof e.personnelCount !== 'number' || e.personnelCount < 0) {
      return { valid: false, error: `agencyArrivals[${i}].personnelCount must be a non-negative number` };
    }
  }

  return { valid: true };
}

export function validateMeansEngaged(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'meansEngaged must be an object' };

  const m = value as Record<string, unknown>;
  const numericFields = ['vehicleCount', 'aircraftCount', 'personnelCount', 'waterVolumeLiters', 'retardantVolumeLiters'];

  for (const field of numericFields) {
    if (m[field] !== undefined) {
      if (typeof m[field] !== 'number') {
        return { valid: false, error: `meansEngaged.${field} must be a number` };
      }
      if ((m[field] as number) < 0) {
        return { valid: false, error: `meansEngaged.${field} must be non-negative` };
      }
    }
  }

  return { valid: true };
}

export function validateEconomicLoss(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'economicLoss must be an object' };

  const e = value as Record<string, unknown>;
  const numericFields = ['forestAreaHa', 'infrastructureDamage', 'agricultureDamage', 'otherDamage', 'totalEstimate'];

  for (const field of numericFields) {
    if (e[field] !== undefined) {
      if (typeof e[field] !== 'number') {
        return { valid: false, error: `economicLoss.${field} must be a number` };
      }
      if ((e[field] as number) < 0) {
        return { valid: false, error: `economicLoss.${field} must be non-negative` };
      }
    }
  }

  return { valid: true };
}

function validateOptionalNumericFields(
  obj: Record<string, unknown>,
  prefix: string,
  fields: string[]
): { valid: boolean; error?: string } {
  for (const field of fields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      if (typeof obj[field] !== 'number') {
        return { valid: false, error: `${prefix}.${field} must be a number` };
      }
      if ((obj[field] as number) < 0) {
        return { valid: false, error: `${prefix}.${field} must be non-negative` };
      }
    }
  }
  return { valid: true };
}

function validateOptionalStringFields(
  obj: Record<string, unknown>,
  prefix: string,
  fields: string[]
): { valid: boolean; error?: string } {
  for (const field of fields) {
    if (obj[field] !== undefined && obj[field] !== null && typeof obj[field] !== 'string') {
      return { valid: false, error: `${prefix}.${field} must be a string` };
    }
  }
  return { valid: true };
}

export function validateLocationDetail(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'locationDetail must be an object' };
  const v = value as Record<string, unknown>;

  if (v.coordinates !== undefined && v.coordinates !== null) {
    if (!Array.isArray(v.coordinates) || v.coordinates.length !== 2 ||
        typeof v.coordinates[0] !== 'number' || typeof v.coordinates[1] !== 'number') {
      return { valid: false, error: 'locationDetail.coordinates must be [lng, lat]' };
    }
  }

  const strCheck = validateOptionalStringFields(v, 'locationDetail', [
    'commune', 'dpeflcd', 'district', 'triage', 'locationName',
  ]);
  if (!strCheck.valid) return strCheck;

  return { valid: true };
}

export function validateCauseDetail(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'causeDetail must be an object' };
  const v = value as Record<string, unknown>;

  if (v.certainty !== undefined && v.certainty !== null) {
    if (!(CAUSE_CERTAINTIES as readonly string[]).includes(v.certainty as string)) {
      return { valid: false, error: 'causeDetail.certainty is invalid' };
    }
  }
  if (v.category !== undefined && v.category !== null) {
    if (!(CAUSE_CATEGORIES as readonly string[]).includes(v.category as string)) {
      return { valid: false, error: 'causeDetail.category is invalid' };
    }
  }

  const strCheck = validateOptionalStringFields(v, 'causeDetail', ['investigatedCause', 'notes']);
  if (!strCheck.valid) return strCheck;

  return { valid: true };
}

export function validateDamageDetail(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'damageDetail must be an object' };
  const v = value as Record<string, unknown>;

  const numCheck = validateOptionalNumericFields(v, 'damageDetail', [
    'surfaceBurnedHa', 'forestAreaHa', 'infrastructureDamage',
    'agricultureDamage', 'propertyDamage', 'otherDamage', 'totalEstimate',
  ]);
  if (!numCheck.valid) return numCheck;

  if (v.vegetationTypes !== undefined && v.vegetationTypes !== null) {
    if (!Array.isArray(v.vegetationTypes)) {
      return { valid: false, error: 'damageDetail.vegetationTypes must be an array' };
    }
    for (const vt of v.vegetationTypes) {
      if (!(VEGETATION_TYPES as readonly string[]).includes(vt as string)) {
        return { valid: false, error: `damageDetail.vegetationTypes contains invalid value: ${vt}` };
      }
    }
  }

  return { valid: true };
}

export function validateResponseDetail(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'responseDetail must be an object' };
  const v = value as Record<string, unknown>;

  const numCheck = validateOptionalNumericFields(v, 'responseDetail', [
    'vehicleCount', 'aircraftCount', 'personnelCount',
    'waterVolumeLiters', 'retardantVolumeLiters', 'responseTimeMinutes',
    'poiLevel', 'saciComplexity',
  ]);
  if (!numCheck.valid) return numCheck;

  return { valid: true };
}

export function validateWeatherAtTime(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'weatherAtTime must be an object' };
  const v = value as Record<string, unknown>;

  const numCheck = validateOptionalNumericFields(v, 'weatherAtTime', [
    'temperatureC', 'humidityPct', 'windSpeedKmh', 'daysSinceRain',
  ]);
  if (!numCheck.valid) return numCheck;

  const strCheck = validateOptionalStringFields(v, 'weatherAtTime', ['windDirection']);
  if (!strCheck.valid) return strCheck;

  return { valid: true };
}

export function validatePostFire(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object') return { valid: false, error: 'postFire must be an object' };
  const v = value as Record<string, unknown>;

  if (v.severityAssessment !== undefined && v.severityAssessment !== null) {
    if (!(SEVERITY_ASSESSMENTS as readonly string[]).includes(v.severityAssessment as string)) {
      return { valid: false, error: 'postFire.severityAssessment is invalid' };
    }
  }
  if (v.recoveryStatus !== undefined && v.recoveryStatus !== null) {
    if (!(RECOVERY_STATUSES as readonly string[]).includes(v.recoveryStatus as string)) {
      return { valid: false, error: 'postFire.recoveryStatus is invalid' };
    }
  }

  const strCheck = validateOptionalStringFields(v, 'postFire', ['rehabilitationPlan', 'notes']);
  if (!strCheck.valid) return strCheck;

  return { valid: true };
}

// ============================================
// Audit entry helper
// ============================================

export function createAuditEntry(
  userId: string,
  cin: string,
  action: string,
  section?: string,
  changes?: Record<string, unknown>
): AuditEntry {
  return {
    userId,
    cin,
    action,
    ...(section && { section }),
    ...(changes && { changes }),
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// Field → Section mapping
// ============================================

const FIELD_TO_SECTION: Record<string, LockableSection> = {
  // location section
  locationDetail: 'location',
  burnPerimeter: 'location',
  burnAreaHa: 'location',
  burnCentroid: 'location',
  burnBoundingBox: 'location',
  // cause section
  causeDetail: 'cause',
  // damage section
  damageDetail: 'damage',
  economicLoss: 'damage',
  // response section
  alertSource: 'response',
  ignitionAt: 'response',
  alertReceivedAt: 'response',
  verifiedAt: 'response',
  firstResponseAt: 'response',
  onSceneAt: 'response',
  containedAt: 'response',
  extinguishedAt: 'response',
  agencyArrivals: 'response',
  meansEngaged: 'response',
  responseDetail: 'response',
  weatherAtTime: 'response',
  // postFire section
  postFire: 'postFire',
};

/**
 * Check if any of the fields being updated belong to a locked section.
 */
export function isSectionLocked(
  lockedSections: string[],
  fieldsBeingUpdated: string[]
): { locked: boolean; section?: string } {
  for (const field of fieldsBeingUpdated) {
    const section = FIELD_TO_SECTION[field];
    if (section && lockedSections.includes(section)) {
      return { locked: true, section };
    }
  }
  return { locked: false };
}
