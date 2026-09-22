export type Role = 'CIVILIAN' | 'OFFICIAL';
export type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type AgencyType = 'FORESTIER' | 'PROTECTION_CIVILE' | 'COORDINATEUR' | 'OBSERVATEUR';

export interface User {
  id: string;
  cin: string;
  phone: string;
  role: Role;
  agencyType?: AgencyType;
  department?: string;
  position?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  description: string;
  images: string[];
  status: Status;
  cause?: string;
  incidentId?: string | null;
  incident?: Incident | null;
  anonymous?: boolean;
  contactPhone?: string;
  characteristics?: Record<string, unknown>;
  referenceNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export type IncidentStatus = 'VIGILANCE' | 'ALERTE' | 'INTERVENTION' | 'MAITRISE' | 'ETEINT';

export interface Incident {
  id: string;
  location: { type: 'Point'; coordinates: [number, number] };
  cause: string;
  severity: number;
  status: IncidentStatus;
  description?: string;
  reportId?: string | null;
  report?: Report | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIncidentInput {
  reportId?: string;
  latitude: number;
  longitude: number;
  cause: string;
  severity: number;
  status?: IncidentStatus;
  description?: string;
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  severity?: number;
  description?: string;
}

export type ResourceType = 'TRUCK' | 'AIRCRAFT' | 'PERSONNEL' | 'EQUIPMENT';

export type InfrastructureType = 'WATCHTOWER' | 'WATER_POINT' | 'FIREBREAK' | 'STATION' | 'FOREST_ROAD' | 'HELIPAD';

export interface GeoFeature<P> {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: P;
}

export interface GeoFeatureCollection<P> {
  type: 'FeatureCollection';
  features: GeoFeature<P>[];
}

export interface GeoIncidentProps {
  id: string;
  cause: string;
  severity: number;
  status: IncidentStatus;
  description?: string;
  createdAt: string;
}

export type GeoIncident = GeoFeature<GeoIncidentProps>;

export interface GeoResourceProps {
  id: string;
  type: ResourceType;
  name: string;
  status: string;
  assignedTo?: string;
}

export type GeoResource = GeoFeature<GeoResourceProps>;

export interface GeoInfrastructureProps {
  id: string;
  type: InfrastructureType;
  name: string;
  status: string;
  description: string;
}

export type GeoInfrastructure = GeoFeature<GeoInfrastructureProps>;

export type { Equipment, RetardantProduct, Infrastructure } from './equipment';
export type {
  EquipmentType,
  EquipmentStatus,
  RetardantType,
  InfrastructureType as EquipmentInfrastructureType,
  InfrastructureStatus,
  EquipmentTab,
} from './equipment';

export interface TruckDeployment {
  id: string;
  truckId: string;
  truckName: string;
  latitude: number;
  longitude: number;
  status: string;
  assignedTo?: string;
  vehicleType?: string;
  crewCount?: number;
  lastUpdate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoWindPointProps {
  speed: number;      // km/h
  direction: number;  // degrees (meteorological)
  gusts: number;      // km/h
  lat: number;
  lon: number;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  timestamp: string;
  /** Relative humidity 0–100%. Optional — not all weather providers return this field. */
  humidity?: number;
}

/**
 * NASA FIRMS fire detection from satellite (MODIS/VIIRS)
 * Raw CSV format from FIRMS API
 */
export interface FirmsDetection {
  id: string; // Generated: `${lat},${lon},${acq_time}`
  latitude: number;
  longitude: number;
  brightness: number; // Brightness temperature (Kelvin)
  scan: number; // Pixel size E-W (km)
  track: number; // Pixel size N-S (km)
  acq_date: string; // Acquisition date: YYYY-MM-DD
  acq_time: string; // Acquisition time: HHMM (UTC)
  satellite: string; // e.g., "N" (Suomi-NPP), "T" (Terra), "A" (Aqua)
  instrument: string; // VIIRS or MODIS
  confidence: 'low' | 'nominal' | 'high' | number; // Confidence level (0-100 or category)
  version: string; // Data version
  bright_t31: number; // Brightness temperature channel 31
  frp: number; // Fire Radiative Power (MW) - fire intensity
  daynight: 'D' | 'N'; // Day or night detection
}

export type DetectionSource = 'FIRMS' | 'EFFIS' | 'FIRMS+EFFIS';

/**
 * GeoJSON properties for FIRMS detection visualization
 * Simplified from raw detection for frontend rendering
 */
export interface GeoFirmsDetectionProps {
  id: string;
  brightness: number; // Kelvin
  frp: number; // Fire Radiative Power in MW
  confidence: 'low' | 'nominal' | 'high' | number;
  satellite: string;
  instrument: string;
  acqDateTime: string; // Combined date + time for display (e.g., "2024-02-09 13:45")
  daynight: 'D' | 'N';
  isRecent: boolean; // True if detected within last 12 hours (for pulsing animation)
  source?: DetectionSource;
}

/**
 * GeoJSON Feature for FIRMS detection
 */
export type GeoFirmsDetection = GeoFeature<GeoFirmsDetectionProps>;

/**
 * FIRMS detection cluster properties (for clustered map markers)
 */
export interface FirmsClusterProps {
  cluster: true;
  point_count: number;
  point_count_abbreviated: string;
}

// ============================================
// Vehicle Types
// ============================================

export type VehicleType = 'FIRE_TRUCK' | 'WATER_TANKER' | 'COMMAND' | 'AMBULANCE' | 'HELICOPTER';
export type VehicleStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'OUT_OF_SERVICE';

export interface Vehicle {
  id: string;
  callSign: string;
  type: VehicleType;
  status: VehicleStatus;
  capabilities: string[];
  baseLocation?: { type: 'Point'; coordinates: [number, number] };
  location?: { type: 'Point'; coordinates: [number, number] };
  assignedTo?: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeoVehicleProps {
  id: string;
  callSign: string;
  type: VehicleType;
  status: VehicleStatus;
  assignedTo?: string;
}

export type GeoVehicle = GeoFeature<GeoVehicleProps>;

// ============================================
// Fire Event Record Types
// ============================================

export type AlertSource = 'FIRMS_SATELLITE' | 'CITIZEN_REPORT' | 'PATROL' | 'PHONE_CALL' | 'RADIO' | 'OTHER';
export type RecordStatus = 'DRAFT' | 'VERIFIED' | 'LOCKED';
export type LockableSection = 'location' | 'cause' | 'damage' | 'response' | 'postFire';

export interface AgencyArrival {
  agencyName: string;
  arrivedAt: string;
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
  infrastructureDamage: number;
  agricultureDamage: number;
  otherDamage: number;
  totalEstimate: number;
}

export interface AuditEntry {
  userId: string;
  cin: string;
  action: string;
  section?: string;
  changes?: Record<string, unknown>;
  timestamp: string;
}

export interface FireEventRecord {
  id: string;
  incidentId: string;
  alertSource: AlertSource;
  ignitionAt?: string | null;
  alertReceivedAt?: string | null;
  verifiedAt?: string | null;
  firstResponseAt?: string | null;
  onSceneAt?: string | null;
  containedAt?: string | null;
  extinguishedAt?: string | null;
  agencyArrivals?: AgencyArrival[] | null;
  meansEngaged?: MeansEngaged | null;
  economicLoss?: EconomicLoss | null;
  locationDetail?: import('./fire-record').LocationDetail | null;
  causeDetail?: import('./fire-record').CauseDetail | null;
  damageDetail?: import('./fire-record').DamageDetail | null;
  responseDetail?: import('./fire-record').ResponseDetail | null;
  weatherAtTime?: import('./fire-record').WeatherAtTime | null;
  postFire?: import('./fire-record').PostFireDetail | null;
  burnPerimeter?: { type: 'Polygon'; coordinates: [number, number][][] } | null;
  burnAreaHa?: number | null;
  burnCentroid?: [number, number] | null;
  burnBoundingBox?: [number, number, number, number] | null;
  recordStatus: RecordStatus;
  lockedSections: string[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  incident?: Incident | null;
}

export interface CreateFireRecordInput {
  incidentId: string;
  alertSource?: AlertSource;
  locationDetail?: import('./fire-record').LocationDetail;
}

export interface UpdateFireRecordInput {
  alertSource?: AlertSource;
  ignitionAt?: string;
  alertReceivedAt?: string;
  verifiedAt?: string;
  firstResponseAt?: string;
  onSceneAt?: string;
  containedAt?: string;
  extinguishedAt?: string;
  agencyArrivals?: AgencyArrival[];
  meansEngaged?: MeansEngaged;
  economicLoss?: EconomicLoss;
  locationDetail?: import('./fire-record').LocationDetail;
  causeDetail?: import('./fire-record').CauseDetail;
  damageDetail?: import('./fire-record').DamageDetail;
  responseDetail?: import('./fire-record').ResponseDetail;
  weatherAtTime?: import('./fire-record').WeatherAtTime;
  postFire?: import('./fire-record').PostFireDetail;
  recordStatus?: RecordStatus;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 'FIRE_DETECTION' | 'STATUS_CHANGE' | 'WEATHER_ALERT' | 'NEW_REPORT' | 'POI_ACTIVATION';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  referenceId?: string;
  referenceUrl?: string;
}
