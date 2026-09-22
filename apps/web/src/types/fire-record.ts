// ============================================
// Fire Event Record — Detailed Types
// ============================================

export interface LocationDetail {
  coordinates?: [number, number]; // [lng, lat]
  commune?: string;
  dpeflcd?: string; // Direction Provinciale des Eaux et Forêts
  district?: string;
  triage?: string;
  locationName?: string;
}

export type CauseCertainty = 'CONFIRMED' | 'PROBABLE' | 'SUSPECTED' | 'UNKNOWN';
export type CauseCategory =
  | 'NATURAL'
  | 'AGRICULTURAL'
  | 'PASTORAL'
  | 'NEGLIGENCE'
  | 'INTENTIONAL'
  | 'RECREATION'
  | 'INFRASTRUCTURE'
  | 'UNKNOWN';

export interface CauseDetail {
  investigatedCause?: string;
  certainty?: CauseCertainty;
  category?: CauseCategory;
  notes?: string;
}

export type VegetationType =
  | 'FOREST_CONIFER'
  | 'FOREST_BROADLEAF'
  | 'FOREST_MIXED'
  | 'MAQUIS'
  | 'GARRIGUE'
  | 'GRASSLAND'
  | 'AGRICULTURE'
  | 'OTHER';

export interface DamageDetail {
  surfaceBurnedHa?: number;
  vegetationTypes?: VegetationType[];
  forestAreaHa?: number;
  infrastructureDamage?: number; // MAD
  agricultureDamage?: number; // MAD
  propertyDamage?: number; // MAD
  otherDamage?: number; // MAD
  totalEstimate?: number; // MAD
}

export interface ResponseDetail {
  vehicleCount?: number;
  aircraftCount?: number;
  personnelCount?: number;
  waterVolumeLiters?: number;
  retardantVolumeLiters?: number;
  responseTimeMinutes?: number;
  poiLevel?: number; // 1-4
  saciComplexity?: number; // 1-5
}

export interface WeatherAtTime {
  temperatureC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  windDirection?: string;
  daysSinceRain?: number;
}

export type SeverityAssessment = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
export type RecoveryStatus = 'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface PostFireDetail {
  severityAssessment?: SeverityAssessment;
  rehabilitationPlan?: string;
  recoveryStatus?: RecoveryStatus;
  notes?: string;
}

export interface FireDatabaseStats {
  totalFiresThisYear: number;
  totalHectaresBurned: number;
  avgResponseTimeMinutes: number | null;
  mostAffectedCommune: string | null;
}
