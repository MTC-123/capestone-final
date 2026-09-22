/**
 * GraphHopper Routing Client - MVP Phase
 * Handles route calculation via self-hosted GraphHopper instance
 */

import { logger } from '@/lib/observability/logger';
import type {
  Coordinates,
  RouteRequest,
  RouteResponse,
  RouteSegment,
  RoutingClientConfig,
  RoutingErrorCode,
  GraphHopperRouteRequest,
  GraphHopperRouteResponse,
  GraphHopperPath,
  RouteInstruction,
  IsochroneRequest,
  IsochroneResponse,
  GraphHopperIsochroneResponse,
} from './types';

const DEFAULT_CONFIG: Required<Omit<RoutingClientConfig, 'apiKey'>> = {
  baseUrl: process.env.GRAPHHOPPER_URL || 'http://localhost:8989',
  timeout: 10000, // 10 seconds
  retries: 2,
};

export class GraphHopperClient {
  private config: RoutingClientConfig;

  constructor(config?: Partial<RoutingClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate route between two points
   */
  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    const startTime = Date.now();
    const { origin, destination, profile, alternatives = 0 } = request;

    // Validate coordinates
    this.validateCoordinates(origin, 'origin');
    this.validateCoordinates(destination, 'destination');

    // Build GraphHopper request
    const ghRequest: GraphHopperRouteRequest = {
      points: [origin, destination],
      profile: this.mapProfile(profile),
      locale: 'en',
      instructions: true,
      calc_points: true,
      elevation: false, // V2 feature
      points_encoded: false, // Return raw coordinates, not encoded polyline
    };

    // Add alternatives if requested (V1 feature, not MVP)
    if (alternatives > 0) {
      ghRequest.alternative_route = {
        max_paths: alternatives > 3 ? 3 : alternatives + 1, // Primary + alternatives; capped at 3 when request exceeds limit
        max_weight_factor: 1.5, // Alternative can be max 50% longer
        max_share_factor: 0.7, // Alternative must differ by at least 30%
      };
    }

    try {
      const response = await this.fetchWithRetry<GraphHopperRouteResponse>(
        '/route',
        ghRequest
      );

      if (!response.paths || response.paths.length === 0) {
        throw this.createError(
          'No route found between origin and destination',
          'ROUTE_NOT_FOUND' as RoutingErrorCode
        );
      }

      const duration = Date.now() - startTime;
      logger.info({
        event: 'graphhopper_route_calculated',
        meta: {
          origin,
          destination,
          profile,
          alternatives,
          pathsReturned: response.paths.length,
          durationMs: duration,
        },
      });

      return this.transformRouteResponse(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        event: 'graphhopper_route_error',
        meta: {
          origin,
          destination,
          profile,
          alternatives,
          durationMs: duration,
        },
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      throw this.createError(
        'GraphHopper request failed',
        'UNKNOWN' as RoutingErrorCode,
        error
      );
    }
  }

  /**
   * Calculate isochrones (reachability polygons) from an origin point
   * GraphHopper requires separate API calls for each time bucket
   */
  async getIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const { origin, profile = 'car', times } = request;

    // Validate coordinates
    this.validateCoordinates(origin, 'origin');

    // GraphHopper requires separate calls for each time bucket
    const isochronePromises = times.map(async (timeMinutes) => {
      const params = new URLSearchParams({
        point: `${origin[1]},${origin[0]}`, // lat,lon for GraphHopper
        time_limit: String(timeMinutes * 60), // Convert to seconds
        buckets: '1',
        profile: this.mapProfile(profile),
      });

      const url = `${this.config.baseUrl}/isochrone?${params}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw this.createError(
            `GraphHopper isochrone request failed: ${response.status}`,
            'SERVICE_UNAVAILABLE' as RoutingErrorCode
          );
        }

        const data = (await response.json()) as GraphHopperIsochroneResponse;

        // Extract polygon and tag with time
        const polygon = data.polygons[0];
        return {
          type: 'Feature' as const,
          geometry: polygon.geometry,
          properties: {
            time_minutes: timeMinutes,
            bucket: 0,
          },
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });

    const features = await Promise.all(isochronePromises);

    logger.info({
      event: 'graphhopper_isochrone_calculated',
      meta: {
        origin,
        profile,
        times,
        featureCount: features.length,
      },
    });

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        provider: 'graphhopper',
        computed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Fetch with timeout and retry logic
   */
  private async fetchWithRetry<T>(
    endpoint: string,
    body: unknown,
    attempt = 1
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw this.createError('Route not found', 'ROUTE_NOT_FOUND' as RoutingErrorCode);
        }
        if (response.status === 429) {
          throw this.createError(
            'Rate limit exceeded',
            'RATE_LIMIT_EXCEEDED' as RoutingErrorCode
          );
        }
        throw this.createError(
          `GraphHopper returned ${response.status}`,
          'SERVICE_UNAVAILABLE' as RoutingErrorCode
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < this.config.retries!) {
          logger.warn({
            event: 'graphhopper_retry',
            meta: { attempt, maxRetries: this.config.retries, reason: 'timeout' },
          });
          return this.fetchWithRetry<T>(endpoint, body, attempt + 1);
        }
        throw this.createError(
          `Request timed out after ${this.config.timeout}ms`,
          'TIMEOUT' as RoutingErrorCode
        );
      }

      // Handle network errors (TypeError covers 'Failed to fetch', 'Network error', etc.)
      if (error instanceof TypeError) {
        if (attempt < this.config.retries!) {
          logger.warn({
            event: 'graphhopper_retry',
            meta: { attempt, maxRetries: this.config.retries, reason: 'network_error' },
          });
          return this.fetchWithRetry<T>(endpoint, body, attempt + 1);
        }
        throw this.createError(
          'GraphHopper service unavailable',
          'SERVICE_UNAVAILABLE' as RoutingErrorCode,
          error
        );
      }

      // Re-throw routing errors
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      throw error;
    }
  }

  /**
   * Transform GraphHopper response to our RouteResponse format
   */
  private transformRouteResponse(
    ghResponse: GraphHopperRouteResponse
  ): RouteResponse {
    const primaryPath = ghResponse.paths[0];
    const alternativePaths = ghResponse.paths.slice(1);

    return {
      primary: this.transformPath(primaryPath),
      alternatives: alternativePaths.map((p) => this.transformPath(p)),
      metadata: {
        provider: 'graphhopper',
        cached: false,
        computed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Transform GraphHopper path to RouteSegment
   */
  private transformPath(path: GraphHopperPath): RouteSegment {
    return {
      coordinates: path.points.coordinates,
      distance_km: path.distance / 1000, // Convert meters to km
      duration_min: path.time / 60000, // Convert milliseconds to minutes
      instructions: path.instructions?.map((inst) => ({
        text: inst.text,
        distance: inst.distance,
        time: inst.time,
        sign: inst.sign,
      })) as RouteInstruction[],
    };
  }

  /**
   * Map our routing profile to GraphHopper profile
   */
  private mapProfile(profile: string): string {
    const profileMap: Record<string, string> = {
      fire_truck: 'car', // GraphHopper doesn't have fire_truck, use car as base
      car: 'car',
      foot: 'foot',
    };
    return profileMap[profile] || 'car';
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(coords: Coordinates, name: string): void {
    if (!Array.isArray(coords) || coords.length !== 2) {
      throw this.createError(
        `Invalid ${name}: must be [longitude, latitude]`,
        'INVALID_COORDINATES' as RoutingErrorCode
      );
    }

    const [lon, lat] = coords;
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      throw this.createError(
        `Invalid ${name}: coordinates must be numbers`,
        'INVALID_COORDINATES' as RoutingErrorCode
      );
    }

    if (lon < -180 || lon > 180) {
      throw this.createError(
        `Invalid ${name}: longitude must be between -180 and 180`,
        'INVALID_COORDINATES' as RoutingErrorCode
      );
    }

    if (lat < -90 || lat > 90) {
      throw this.createError(
        `Invalid ${name}: latitude must be between -90 and 90`,
        'INVALID_COORDINATES' as RoutingErrorCode
      );
    }
  }

  /**
   * Create a RoutingError with consistent structure
   */
  private createError(
    message: string,
    code: RoutingErrorCode,
    originalError?: unknown
  ): Error {
    const error = new Error(message) as Error & { code: RoutingErrorCode; provider: string; originalError?: unknown };
    error.code = code;
    error.provider = 'graphhopper';
    error.originalError = originalError;
    return error;
  }
}
