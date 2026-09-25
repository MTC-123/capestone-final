/**
 * TomTom Routing client (Routing API v1 + Calculate Reachable Range).
 *
 * Routes use live traffic. Fire engines are routed as 12-tonne trucks so the
 * route respects weight and height limits; if no truck route exists (forest
 * tracks are often unclassified), the request is retried as a car.
 */

import { logger } from '@/lib/observability/logger';
import {
  RoutingError,
  RoutingErrorCode,
  type Coordinates,
  type IsochroneRequest,
  type IsochroneResponse,
  type RouteInstruction,
  type RouteRequest,
  type RouteResponse,
  type RouteSegment,
  type RoutingProfile,
} from './types';

const BASE_URL = 'https://api.tomtom.com/routing/1';
const TIMEOUT_MS = 10_000;

type TravelMode = 'car' | 'truck' | 'pedestrian';

interface TomTomPoint {
  latitude: number;
  longitude: number;
}

interface TomTomRoute {
  summary: { lengthInMeters: number; travelTimeInSeconds: number; trafficDelayInSeconds?: number };
  legs: { points: TomTomPoint[] }[];
  guidance?: {
    instructions?: { message?: string; routeOffsetInMeters: number; travelTimeInSeconds: number; maneuver?: string }[];
  };
}

const TRUCK_PARAMS = { vehicleWeight: '12000', vehicleHeight: '3.3', vehicleWidth: '2.5', vehicleLength: '8' };

function travelMode(profile: RoutingProfile): TravelMode {
  if (profile === 'fire_truck') return 'truck';
  if (profile === 'foot') return 'pedestrian';
  return 'car';
}

const toLatLng = ([lng, lat]: Coordinates) => `${lat},${lng}`;
const toCoords = (points: TomTomPoint[]): Coordinates[] => points.map((p) => [p.longitude, p.latitude]);

export function isTomTomConfigured(): boolean {
  return Boolean(process.env.TOMTOM_API_KEY);
}

export class TomTomClient {
  constructor(private readonly apiKey = process.env.TOMTOM_API_KEY) {}

  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    const mode = travelMode(request.profile);
    try {
      return await this.route(request, mode);
    } catch (error) {
      if (mode === 'truck' && error instanceof RoutingError && error.code === RoutingErrorCode.NOT_FOUND) {
        logger.info({ event: 'tomtom_truck_route_fallback_car', meta: { origin: request.origin, destination: request.destination } });
        return this.route(request, 'car');
      }
      throw error;
    }
  }

  async getIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const mode = travelMode(request.profile);
    const features = await Promise.all(
      request.times.map(async (minutes, bucket) => {
        const params: Record<string, string> = {
          timeBudgetInSec: String(minutes * 60),
          travelMode: mode,
          traffic: 'true',
          ...(mode === 'truck' ? TRUCK_PARAMS : {}),
        };
        const data = await this.get<{ reachableRange: { boundary: TomTomPoint[] } }>(
          `/calculateReachableRange/${toLatLng(request.origin)}/json`,
          params
        );
        const ring = toCoords(data.reachableRange.boundary);
        if (ring.length > 0) ring.push(ring[0]);
        return {
          type: 'Feature' as const,
          properties: { time_minutes: minutes, bucket },
          geometry: { type: 'Polygon' as const, coordinates: [ring] },
        };
      })
    );
    return { type: 'FeatureCollection', features, metadata: { provider: 'tomtom', computed_at: new Date().toISOString() } };
  }

  private async route(request: RouteRequest, mode: TravelMode): Promise<RouteResponse> {
    const params: Record<string, string> = {
      travelMode: mode,
      traffic: 'true',
      routeType: 'fastest',
      instructionsType: 'text',
      language: 'fr-FR',
      maxAlternatives: String(Math.min(request.alternatives ?? 0, 3)),
      ...(mode === 'truck' ? TRUCK_PARAMS : {}),
    };
    const data = await this.get<{ routes?: TomTomRoute[] }>(
      `/calculateRoute/${toLatLng(request.origin)}:${toLatLng(request.destination)}/json`,
      params
    );
    const [primary, ...alternatives] = (data.routes ?? []).map(toSegment);
    if (!primary) throw new RoutingError('No route found between origin and destination', RoutingErrorCode.NOT_FOUND, 'tomtom');
    return {
      primary,
      alternatives,
      metadata: { provider: 'tomtom', cached: false, computed_at: new Date().toISOString() },
    };
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) throw new RoutingError('TomTom is not configured', RoutingErrorCode.SERVICE_UNAVAILABLE, 'tomtom');
    const url = `${BASE_URL}${path}?${new URLSearchParams({ ...params, key: this.apiKey })}`;

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (res.ok) return (await res.json()) as T;
        // 400 with "NO_ROUTE_FOUND" / "MAP_MATCHING_FAILURE" means the points cannot be joined.
        if (res.status === 400) {
          const body = await res.text();
          if (/NO_ROUTE_FOUND|MAP_MATCHING_FAILURE|CANNOT_RESTORE/i.test(body)) {
            throw new RoutingError('No route found between origin and destination', RoutingErrorCode.NOT_FOUND, 'tomtom');
          }
          throw new RoutingError(`TomTom rejected the request (${res.status})`, RoutingErrorCode.INVALID_COORDINATES, 'tomtom');
        }
        if (res.status === 429) throw new RoutingError('TomTom rate limit reached', RoutingErrorCode.RATE_LIMIT_EXCEEDED, 'tomtom');
        if (res.status >= 500 && attempt === 0) continue;
        throw new RoutingError(`TomTom unavailable (${res.status})`, RoutingErrorCode.SERVICE_UNAVAILABLE, 'tomtom');
      } catch (error) {
        if (error instanceof RoutingError) throw error;
        if (attempt === 0) continue;
        const timedOut = error instanceof Error && error.name === 'AbortError';
        throw new RoutingError(
          timedOut ? 'TomTom timed out' : 'TomTom request failed',
          timedOut ? RoutingErrorCode.TIMEOUT : RoutingErrorCode.SERVICE_UNAVAILABLE,
          'tomtom',
          error
        );
      } finally {
        clearTimeout(timer);
      }
    }
  }
}

function toSegment(route: TomTomRoute): RouteSegment {
  const instructions: RouteInstruction[] | undefined = route.guidance?.instructions?.map((step, i, all) => ({
    text: step.message ?? '',
    distance: (all[i + 1]?.routeOffsetInMeters ?? route.summary.lengthInMeters) - step.routeOffsetInMeters,
    time: ((all[i + 1]?.travelTimeInSeconds ?? route.summary.travelTimeInSeconds) - step.travelTimeInSeconds) * 1000,
    sign: 0,
  }));
  return {
    coordinates: route.legs.flatMap((leg) => toCoords(leg.points)),
    distance_km: Math.round(route.summary.lengthInMeters / 10) / 100,
    duration_min: Math.round(route.summary.travelTimeInSeconds / 6) / 10,
    ...(instructions ? { instructions } : {}),
  };
}
