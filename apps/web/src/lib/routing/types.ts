/**
 * Routing Types - MVP Phase
 * Defines data structures for dispatch routing system
 */

// ============================================
// Core Types
// ============================================

export type Coordinates = [number, number]; // [longitude, latitude]

export type RoutingProfile = 'fire_truck' | 'car' | 'foot';

export type RoutingProvider = 'graphhopper' | 'mapbox';

// ============================================
// Request Types
// ============================================

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  profile: RoutingProfile;
  alternatives?: number; // Number of alternative routes (0-3), default 0 for MVP
  avoidTerrain?: boolean; // V2 feature
}

export interface IsochroneRequest {
  origin: Coordinates;
  profile: RoutingProfile;
  times: number[]; // Time buckets in minutes, e.g., [5, 10, 15, 30]
}

// ============================================
// Response Types
// ============================================

export interface RouteSegment {
  coordinates: Coordinates[];
  distance_km: number;
  duration_min: number;
  instructions?: RouteInstruction[];
  elevation?: number[]; // V2 feature
}

export interface RouteInstruction {
  text: string;
  distance: number; // meters
  time: number; // milliseconds
  sign: number; // Turn type code
}

export interface RouteResponse {
  primary: RouteSegment;
  alternatives: RouteSegment[]; // Empty array for MVP
  metadata: RouteMetadata;
}

export interface RouteMetadata {
  provider: RoutingProvider;
  cached: boolean;
  cache_age_seconds?: number;
  computed_at: string; // ISO 8601 timestamp
}

export interface IsochroneResponse {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
  metadata: {
    provider: RoutingProvider;
    computed_at: string;
  };
}

export interface IsochroneFeature {
  type: 'Feature';
  properties: {
    time_minutes: number;
    bucket: number;
  };
  geometry: {
    type: 'Polygon';
    coordinates: Coordinates[][];
  };
}

// ============================================
// GraphHopper-Specific Types
// ============================================

export interface GraphHopperRouteRequest {
  points: Coordinates[];
  profile: string;
  locale?: string;
  instructions?: boolean;
  calc_points?: boolean;
  elevation?: boolean;
  points_encoded?: boolean;
  alternative_route?: {
    max_paths?: number;
    max_weight_factor?: number;
    max_share_factor?: number;
  };
}

export interface GraphHopperPath {
  distance: number; // meters
  time: number; // milliseconds
  points: {
    type: 'LineString';
    coordinates: Coordinates[];
  };
  instructions?: GraphHopperInstruction[];
  ascend?: number;
  descend?: number;
}

export interface GraphHopperInstruction {
  text: string;
  distance: number;
  time: number;
  sign: number;
}

export interface GraphHopperRouteResponse {
  paths: GraphHopperPath[];
}

export interface GraphHopperIsochroneRequest {
  point: Coordinates;
  profile: string;
  time_limit: number; // seconds
  buckets?: number;
}

export interface GraphHopperIsochroneResponse {
  polygons: {
    properties: {
      bucket: number; // time in seconds
    };
    geometry: {
      type: 'Polygon';
      coordinates: Coordinates[][];
    };
  }[];
}

// ============================================
// Error Types
// ============================================

export class RoutingError extends Error {
  constructor(
    message: string,
    public code: RoutingErrorCode,
    public provider?: RoutingProvider,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

export enum RoutingErrorCode {
  TIMEOUT = 'ROUTING_TIMEOUT',
  NOT_FOUND = 'ROUTE_NOT_FOUND',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNKNOWN = 'ROUTING_UNKNOWN_ERROR',
}

// ============================================
// Client Configuration
// ============================================

export interface RoutingClientConfig {
  baseUrl: string;
  timeout?: number; // milliseconds, default 10000
  retries?: number; // default 2
  apiKey?: string; // For Mapbox
}
