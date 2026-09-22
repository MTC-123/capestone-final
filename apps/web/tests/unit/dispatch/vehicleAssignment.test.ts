import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Vehicle } from '@prisma/client';
import type { RouteResponse } from '@/lib/routing/types';

// Mocks
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dispatch: { create: vi.fn() },
    vehicle: { update: vi.fn() },
  },
}));

vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: vi.fn(),
  })),
}));

vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn(),
  setCachedRoute: vi.fn(),
}));

vi.mock('@/lib/dispatch/geospatial', () => ({
  haversineDistance: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import { getCachedRoute, setCachedRoute } from '@/lib/routing/cache';
import { haversineDistance } from '@/lib/dispatch/geospatial';
import { assignVehicleToIncident, assignVehiclesToIncident } from '@/lib/dispatch/vehicleAssignment';

const ORIGIN: [number, number] = [-5.1, 33.5];
const DEST: [number, number] = [-5.08, 33.55];

function makeVehicle(overrides?: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1',
    callSign: 'FT-001',
    type: 'FIRE_TRUCK',
    status: 'AVAILABLE',
    capabilities: [],
    baseLocation: { type: 'Point', coordinates: ORIGIN },
    location: { type: 'Point', coordinates: ORIGIN },
    assignedTo: null,
    capacity: 5000,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Vehicle;
}

function makeIncident() {
  return { id: 'inc-1', location: { type: 'Point', coordinates: DEST } };
}

function makeRouteResponse(): RouteResponse {
  return {
    primary: { coordinates: [ORIGIN, DEST], distance_km: 8.5, duration_min: 12, instructions: [] },
    alternatives: [],
    metadata: { provider: 'graphhopper', cached: false, computed_at: '2026-02-19T10:00:00.000Z' },
  };
}

describe('Vehicle Assignment', () => {
  let mockGetRoute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T10:00:00.000Z'));

    (getCachedRoute as any).mockResolvedValue(null);
    (setCachedRoute as any).mockResolvedValue(undefined);

    mockGetRoute = vi.fn().mockResolvedValue(makeRouteResponse());
    (GraphHopperClient as any).mockImplementation(() => ({ getRoute: mockGetRoute }));

    (prisma.dispatch.create as any).mockResolvedValue({
      id: 'dispatch-v-001', vehicleId: 'v-1', incidentId: 'inc-1', status: 'ASSIGNED',
    });
    (prisma.vehicle.update as any).mockResolvedValue({ id: 'v-1', status: 'EN_ROUTE' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('assignVehicleToIncident - happy path', () => {
    it('should assign vehicle, create dispatch, and update status', async () => {
      const result = await assignVehicleToIncident(makeVehicle(), makeIncident(), 'user-1');

      expect(prisma.dispatch.create).toHaveBeenCalledOnce();
      expect(prisma.dispatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vehicleId: 'v-1',
          incidentId: 'inc-1',
          status: 'ASSIGNED',
          distance: 8.5,
          duration: 12,
        }),
      });

      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { status: 'EN_ROUTE', assignedTo: 'inc-1' },
      });

      expect(result).toEqual(expect.objectContaining({
        dispatchId: 'dispatch-v-001',
        vehicleId: 'v-1',
        callSign: 'FT-001',
        distance_km: 8.5,
        duration_min: 12,
      }));
      expect(result.eta).toBe('2026-02-19T10:12:00.000Z');
    });
  });

  describe('assignVehicleToIncident - cache', () => {
    it('should use cached route', async () => {
      const cached = makeRouteResponse();
      cached.metadata.cached = true;
      (getCachedRoute as any).mockResolvedValue(cached);

      await assignVehicleToIncident(makeVehicle(), makeIncident(), 'user-1');

      expect(mockGetRoute).not.toHaveBeenCalled();
      expect(setCachedRoute).not.toHaveBeenCalled();
    });
  });

  describe('assignVehicleToIncident - haversine fallback', () => {
    it('should fall back to haversine on SERVICE_UNAVAILABLE', async () => {
      const serviceError = new Error('GraphHopper service unavailable') as Error & { code: string };
      serviceError.code = 'SERVICE_UNAVAILABLE';
      mockGetRoute.mockRejectedValue(serviceError);

      // Mock haversine to return 6km (6000m)
      (haversineDistance as any).mockReturnValue(6000);

      const result = await assignVehicleToIncident(makeVehicle(), makeIncident(), 'user-1');

      // Should produce a straight-line fallback route
      expect(result.route.primary.coordinates).toEqual([ORIGIN, DEST]);
      expect(result.route.primary.distance_km).toBe(6); // 6000m / 1000
      expect(result.route.primary.duration_min).toBe(9); // (6/40)*60 = 9, rounded
      expect(result.route.primary.instructions).toEqual([]);

      // Dispatch record should still be created
      expect(prisma.dispatch.create).toHaveBeenCalledOnce();

      // Vehicle should be updated to EN_ROUTE
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { status: 'EN_ROUTE', assignedTo: 'inc-1' },
      });

      // Fallback route should be cached
      expect(setCachedRoute).toHaveBeenCalledOnce();
    });

    it('should fall back to haversine on ROUTING_TIMEOUT', async () => {
      const timeoutError = new Error('Request timed out') as Error & { code: string };
      timeoutError.code = 'ROUTING_TIMEOUT';
      mockGetRoute.mockRejectedValue(timeoutError);

      (haversineDistance as any).mockReturnValue(4000); // 4km

      const result = await assignVehicleToIncident(makeVehicle(), makeIncident(), 'user-1');

      expect(result.route.primary.coordinates).toEqual([ORIGIN, DEST]);
      expect(result.route.primary.distance_km).toBe(4);
      expect(result.route.primary.duration_min).toBe(6); // (4/40)*60 = 6
      expect(prisma.dispatch.create).toHaveBeenCalledOnce();
    });
  });

  describe('assignVehicleToIncident - routing failure', () => {
    it('should propagate generic GraphHopper errors', async () => {
      mockGetRoute.mockRejectedValue(new Error('Network error'));

      await expect(
        assignVehicleToIncident(makeVehicle(), makeIncident(), 'user-1')
      ).rejects.toThrow('Network error');

      expect(prisma.dispatch.create).not.toHaveBeenCalled();
    });
  });

  describe('assignVehiclesToIncident', () => {
    it('should assign multiple vehicles sequentially', async () => {
      (prisma.dispatch.create as any)
        .mockResolvedValueOnce({ id: 'd-1', vehicleId: 'v-1', incidentId: 'inc-1', status: 'ASSIGNED' })
        .mockResolvedValueOnce({ id: 'd-2', vehicleId: 'v-2', incidentId: 'inc-1', status: 'ASSIGNED' });

      const v1 = makeVehicle({ id: 'v-1', callSign: 'FT-001' });
      const v2 = makeVehicle({ id: 'v-2', callSign: 'FT-002' });

      const results = await assignVehiclesToIncident([v1, v2], makeIncident(), 'user-1');
      expect(results).toHaveLength(2);
      expect(prisma.vehicle.update).toHaveBeenCalledTimes(2);
    });
  });
});
