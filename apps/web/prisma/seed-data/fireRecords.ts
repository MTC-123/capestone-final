import area from '@turf/area';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import { polygon as turfPolygon } from '@turf/helpers';
import type { SeedRng } from './rng';
import { burnPolygon } from './rng';
import type { IncidentStatusSeed } from './incidents';

const COMMANDERS = [
  { name: 'Khalid Benali', rank: 'Capitaine' },
  { name: 'Youssef Idrissi', rank: 'Lieutenant' },
  { name: 'Hassan Alaoui', rank: 'Commandant' },
  { name: 'Nabil Cherkaoui', rank: 'Lieutenant' },
  { name: 'Fatima Marzouki', rank: 'Sous-lieutenant' },
];

const VEGETATION_BY_CAUSE: Record<string, string[]> = {
  CAMPFIRE_UNATTENDED: ['FOREST_CONIFER', 'MAQUIS'],
  CIGARETTE: ['MAQUIS', 'GRASSLAND'],
  AGRICULTURAL_BURNING: ['AGRICULTURE', 'GRASSLAND'],
  ELECTRICAL: ['MAQUIS', 'FOREST_BROADLEAF'],
  LIGHTNING: ['FOREST_CONIFER', 'FOREST_MIXED'],
  ARSON: ['FOREST_MIXED', 'MAQUIS'],
  EQUIPMENT_MALFUNCTION: ['GRASSLAND', 'AGRICULTURE'],
  OTHER: ['MAQUIS'],
  UNKNOWN: ['MAQUIS', 'GRASSLAND'],
};

function haRangeForSeverity(severity: number): [number, number] {
  switch (severity) {
    case 1: return [0.5, 1.5];
    case 2: return [1.5, 4];
    case 3: return [4, 10];
    case 4: return [10, 22];
    default: return [20, 40];
  }
}

export interface BuildFireRecordInput {
  incidentIndex: number;
  incidentId: string;
  actorCin: string;
  cause: string;
  severity: number;
  status: IncidentStatusSeed;
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
  commune: string;
  forestName: string;
  legalFollowUp?: boolean;
}

export interface BuiltFireRecord {
  incidentIndex: number;
  data: Record<string, unknown>;
  burnAreaHa: number;
  commanderName: string;
}

export function buildFireEventRecord(r: SeedRng, input: BuildFireRecordInput): BuiltFireRecord {
  const commander = r.pick(COMMANDERS);
  const [minHa, maxHa] = haRangeForSeverity(input.severity);
  const targetHa = r.float(minHa, maxHa, 2);
  const ring = burnPolygon(r, input.lat, input.lng, targetHa);
  const feature = turfPolygon([ring]);
  const areaM2 = area(feature);
  const burnAreaHa = Math.round((areaM2 / 10_000) * 100) / 100;
  const center = centroid(feature).geometry.coordinates as [number, number];
  const bb = bbox(feature) as [number, number, number, number];

  const ignitionAt = input.createdAt;
  const alertReceivedAt = new Date(ignitionAt.getTime() + r.int(10, 40) * 60_000);
  const verifiedAt = new Date(alertReceivedAt.getTime() + r.int(10, 25) * 60_000);
  const firstResponseAt = new Date(verifiedAt.getTime() + r.int(10, 30) * 60_000);
  const onSceneAt = new Date(firstResponseAt.getTime() + r.int(10, 35) * 60_000);
  const isResolved = input.status === 'ETEINT' || input.status === 'COMPLETED' || input.status === 'MAITRISE';
  const containedAt = isResolved ? new Date(onSceneAt.getTime() + r.int(60, 300) * 60_000) : undefined;
  const extinguishedAt = input.status === 'ETEINT' || input.status === 'COMPLETED'
    ? new Date((containedAt ?? onSceneAt).getTime() + r.int(30, 240) * 60_000)
    : undefined;

  const recordStatus: 'DRAFT' | 'VERIFIED' | 'LOCKED' = input.status === 'ETEINT' || input.status === 'COMPLETED'
    ? (r.bool(0.6) ? 'LOCKED' : 'VERIFIED')
    : 'VERIFIED';

  const alertSource = r.pickWeighted([
    { value: 'FIRMS_SATELLITE' as const, weight: 3 },
    { value: 'CITIZEN_REPORT' as const, weight: 4 },
    { value: 'PATROL' as const, weight: 2 },
    { value: 'PHONE_CALL' as const, weight: 1 },
  ]);

  const vegetationTypes = VEGETATION_BY_CAUSE[input.cause] ?? ['MAQUIS'];
  const forestAreaHa = Math.round(burnAreaHa * r.float(0.6, 0.95, 2) * 100) / 100;
  const investigated = input.cause === 'ARSON' || input.cause === 'UNKNOWN' ? 'PROBABLE' : 'CONFIRMED';

  const lockedSections = recordStatus === 'LOCKED'
    ? ['location', 'cause', 'damage', 'response', 'weather']
    : recordStatus === 'VERIFIED'
      ? ['location', 'response']
      : [];

  // recordStatus is always 'VERIFIED' or 'LOCKED' in this function (fire
  // records are only built for incidents that already reached a status
  // where verification makes sense) — the CREATED+VERIFIED entries are
  // therefore unconditional, LOCKED is added on top when applicable.
  const auditTrail = [
    { action: 'CREATED', actor: input.actorCin, at: alertReceivedAt.toISOString() },
    { action: 'VERIFIED', actor: input.actorCin, at: verifiedAt.toISOString() },
    ...((recordStatus as string) === 'LOCKED' ? [{ action: 'LOCKED', actor: input.actorCin, at: new Date((extinguishedAt ?? containedAt ?? onSceneAt).getTime() + 86_400_000).toISOString() }] : []),
  ];

  const data: Record<string, unknown> = {
    incidentId: input.incidentId,
    alertSource,
    ignitionAt,
    alertReceivedAt,
    verifiedAt,
    firstResponseAt,
    onSceneAt,
    containedAt,
    extinguishedAt,
    locationDetail: {
      coordinates: [input.lng, input.lat],
      commune: input.commune,
      dpeflcd: 'Direction Provinciale des Eaux et Forêts — Ifrane',
      district: input.forestName,
      locationName: input.forestName,
    },
    causeDetail: {
      investigatedCause: input.cause,
      certainty: investigated,
      category: input.cause === 'LIGHTNING' ? 'NATURAL'
        : input.cause === 'AGRICULTURAL_BURNING' ? 'AGRICULTURAL'
        : input.cause === 'ARSON' ? 'INTENTIONAL'
        : input.cause === 'CAMPFIRE_UNATTENDED' ? 'RECREATION'
        : input.cause === 'CIGARETTE' ? 'NEGLIGENCE'
        : input.cause === 'ELECTRICAL' || input.cause === 'EQUIPMENT_MALFUNCTION' ? 'INFRASTRUCTURE'
        : 'UNKNOWN',
      notes: input.legalFollowUp
        ? 'Procès-verbal transmis à la Gendarmerie Royale — suite judiciaire en cours.'
        : undefined,
    },
    damageDetail: {
      surfaceBurnedHa: burnAreaHa,
      vegetationTypes,
      forestAreaHa,
      infrastructureDamage: 0,
      agricultureDamage: input.cause === 'AGRICULTURAL_BURNING' ? r.int(5000, 40000) : 0,
      propertyDamage: 0,
      otherDamage: 0,
      totalEstimate: input.cause === 'AGRICULTURAL_BURNING' ? r.int(5000, 40000) : r.int(2000, 15000) * burnAreaHa,
    },
    responseDetail: {
      vehicleCount: r.int(1, 4),
      aircraftCount: input.severity >= 4 ? 1 : 0,
      personnelCount: r.int(6, 10) * r.int(1, Math.max(1, Math.round(input.severity / 2))),
      waterVolumeLiters: r.int(2, 10) * 1000 * Math.max(1, Math.round(burnAreaHa)),
      retardantVolumeLiters: input.severity >= 3 ? r.int(200, 1500) : 0,
      responseTimeMinutes: Math.round((onSceneAt.getTime() - alertReceivedAt.getTime()) / 60000),
      poiLevel: input.severity >= 4 ? 2 : 1,
      saciComplexity: Math.min(5, Math.max(1, input.severity)),
    },
    weatherAtTime: {
      temperatureC: r.int(20, 38),
      humidityPct: r.int(12, 45),
      windSpeedKmh: r.int(8, 55),
      windDirection: r.pick(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
      daysSinceRain: r.int(3, 60),
    },
    burnPerimeter: { type: 'Polygon', coordinates: [ring] },
    burnAreaHa,
    burnCentroid: center,
    burnBoundingBox: bb,
    recordStatus,
    lockedSections,
    auditTrail,
  };

  if (isResolved) {
    data.postFire = {
      severityAssessment: input.severity >= 4 ? 'HIGH' : input.severity >= 2 ? 'MODERATE' : 'LOW',
      rehabilitationPlan: forestAreaHa > 3 ? 'Reboisement programmé au titre de la campagne post-incendie 2026' : undefined,
      recoveryStatus: 'PLANNED',
    };
  }

  return { incidentIndex: input.incidentIndex, data, burnAreaHa, commanderName: `${commander.rank} ${commander.name}` };
}

export interface DebriefingSeed {
  incidentIndex: number;
  offsetDaysAfterExtinction: number;
  superficieIncendiee: number;
  heureDeclenchement: string;
  typeEssence: string;
  topographie: string[];
  quAvaitEtePlanifie: string;
  quEstCeQuiEstArrive: string;
  pourquoi: string;
  prochaineFois: string;
  observationsParticulieres: string;
  animateurNom: string;
  animateurQualite: string;
}

// Debriefings for the two most significant closed incidents (index 9 = the
// major Parc National lightning fire, index 8 = the arson case).
export const DEBRIEFING_INCIDENT_INDICES = [9, 8];

export const EQUIPMENT_AUDIT_INCIDENT_INDEX = 9;
