/**
 * Road routing with provider failover: TomTom (live traffic) first, then
 * GraphHopper when one is configured. When every provider fails or none is
 * configured, the call throws and the caller falls back to a straight-line
 * estimate, labelled `estimate` so the UI never presents it as a road route.
 */

import { logger } from '@/lib/observability/logger';
import { GraphHopperClient } from './graphhopper';
import { TomTomClient, isTomTomConfigured } from './tomtom';
import {
  RoutingError,
  RoutingErrorCode,
  type IsochroneRequest,
  type IsochroneResponse,
  type RouteRequest,
  type RouteResponse,
  type RoutingProvider,
} from './types';

interface RoutingBackend {
  name: RoutingProvider;
  getRoute(request: RouteRequest): Promise<RouteResponse>;
  getIsochrone(request: IsochroneRequest): Promise<IsochroneResponse>;
}

function isGraphHopperConfigured(): boolean {
  return Boolean(process.env.GRAPHHOPPER_URL || process.env.GRAPHHOPPER_API_KEY);
}

/** Providers in failover order; empty when no road routing is configured. */
export function configuredRoutingProviders(): RoutingProvider[] {
  const providers: RoutingProvider[] = [];
  if (isTomTomConfigured()) providers.push('tomtom');
  if (isGraphHopperConfigured()) providers.push('graphhopper');
  return providers;
}

function backends(): RoutingBackend[] {
  return configuredRoutingProviders().map((name) => {
    const client = name === 'tomtom' ? new TomTomClient() : new GraphHopperClient();
    return {
      name,
      getRoute: (request) => client.getRoute(request),
      getIsochrone: (request) => client.getIsochrone(request),
    };
  });
}

async function withFailover<T>(operation: string, run: (backend: RoutingBackend) => Promise<T>): Promise<T> {
  const chain = backends();
  if (chain.length === 0) {
    throw new RoutingError('No routing provider is configured', RoutingErrorCode.SERVICE_UNAVAILABLE);
  }
  let lastError: unknown;
  for (const backend of chain) {
    try {
      return await run(backend);
    } catch (error) {
      lastError = error;
      // Invalid input fails the same way everywhere; don't burn the next provider's quota.
      if (error instanceof RoutingError && error.code === RoutingErrorCode.INVALID_COORDINATES) throw error;
      logger.warn({
        event: 'routing_provider_failed',
        meta: { operation, provider: backend.name, code: (error as { code?: string })?.code },
      });
    }
  }
  throw lastError;
}

export const routing = {
  getRoute: (request: RouteRequest) => withFailover('route', (b) => b.getRoute(request)),
  getIsochrone: (request: IsochroneRequest) => withFailover('isochrone', (b) => b.getIsochrone(request)),
};
