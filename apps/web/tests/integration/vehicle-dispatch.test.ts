import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Vehicle } from '@prisma/client';

/**
 * Integration test: Vehicle dispatch lifecycle
 * Tests: create vehicle → assign to incident → telemetry update → status transitions
 */

// Mock Prisma with stateful tracking
const vehicleStore: Record<string, any> = {};
const dispatchStore: Record<string, any> = {};
const telemetryStore: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: {
      create: vi.fn((args: any) => {
        const v = { id: 'v-int-1', ...args.data, createdAt: new Date(), updatedAt: new Date() };
        vehicleStore[v.id] = v;
        return Promise.resolve(v);
      }),
      findUnique: vi.fn((args: any) => Promise.resolve(vehicleStore[args.where.id] ?? null)),
      findMany: vi.fn(() => Promise.resolve(Object.values(vehicleStore))),
      update: vi.fn((args: any) => {
        const v = vehicleStore[args.where.id];
        if (!v) return Promise.resolve(null);
        Object.assign(v, args.data, { updatedAt: new Date() });
        return Promise.resolve(v);
      }),
    },
    dispatch: {
      create: vi.fn((args: any) => {
        const d = { id: `d-${Date.now()}`, ...args.data, createdAt: new Date(), updatedAt: new Date() };
        dispatchStore[d.id] = d;
        return Promise.resolve(d);
      }),
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
    vehicleTelemetry: {
      create: vi.fn((args: any) => {
        const t = { id: `tel-${Date.now()}`, ...args.data, timestamp: new Date() };
        telemetryStore.push(t);
        return Promise.resolve(t);
      }),
    },
  },
}));

const mockGetRoute = vi.fn().mockResolvedValue({
  primary: { coordinates: [[-5.1, 33.5], [-5.08, 33.55]], distance_km: 5, duration_min: 8, instructions: [] },
  alternatives: [],
  metadata: { provider: 'graphhopper', cached: false, computed_at: new Date().toISOString() },
});

vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: mockGetRoute,
  })),
}));

vi.mock('@/lib/dispatch/geospatial', () => ({
  haversineDistance: vi.fn().mockReturnValue(5000), // 5km default
}));

vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn().mockResolvedValue(null),
  setCachedRoute: vi.fn(),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { assignVehicleToIncident } from '@/lib/dispatch/vehicleAssignment';
import { validateVehicleAvailable } from '@/lib/dispatch/vehicleValidation';
import { haversineDistance } from '@/lib/dispatch/geospatial';

describe('Vehicle Dispatch Lifecycle (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(vehicleStore).forEach((k) => delete vehicleStore[k]);
    Object.keys(dispatchStore).forEach((k) => delete dispatchStore[k]);
    telemetryStore.length = 0;
  });

  it('create → assign → telemetry → complete lifecycle', async () => {
    // 1. Create vehicle
    const created = await prisma.vehicle.create({
      data: {
        callSign: 'FT-INT-001',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        capabilities: ['water_pump'],
        baseLocation: { type: 'Point', coordinates: [-5.1, 33.5] },
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        capacity: 5000,
      },
    });

    expect(created.callSign).toBe('FT-INT-001');
    expect(created.status).toBe('AVAILABLE');

    // 2. Validate available
    expect(() => validateVehicleAvailable(created as Vehicle)).not.toThrow();

    // 3. Assign to incident
    const incident = { id: 'inc-int-1', location: { type: 'Point', coordinates: [-5.08, 33.55] } };
    const assignment = await assignVehicleToIncident(created as Vehicle, incident, 'user-1');

    expect(assignment.vehicleId).toBe('v-int-1');
    expect(assignment.callSign).toBe('FT-INT-001');
    expect(assignment.distance_km).toBe(5);
    expect(assignment.duration_min).toBe(8);

    // Vehicle should be EN_ROUTE now
    const updated = vehicleStore['v-int-1'];
    expect(updated.status).toBe('EN_ROUTE');
    expect(updated.assignedTo).toBe('inc-int-1');

    // 4. Send telemetry
    const telemetry = await prisma.vehicleTelemetry.create({
      data: {
        vehicleId: 'v-int-1',
        position: { type: 'Point', coordinates: [-5.09, 33.53] },
        speed: 45,
        heading: 90,
      },
    });
    expect(telemetry.vehicleId).toBe('v-int-1');
    expect(telemetryStore).toHaveLength(1);

    // Update vehicle location
    await prisma.vehicle.update({
      where: { id: 'v-int-1' },
      data: { location: { type: 'Point', coordinates: [-5.09, 33.53] } },
    });

    // 5. Complete dispatch — vehicle returns to AVAILABLE
    await prisma.vehicle.update({
      where: { id: 'v-int-1' },
      data: { status: 'AVAILABLE', assignedTo: null },
    });

    const final = vehicleStore['v-int-1'];
    expect(final.status).toBe('AVAILABLE');
    expect(final.assignedTo).toBeNull();
  });

  it('create → haversine fallback → assign → verify EN_ROUTE + dispatch record', async () => {
    // Simulate GraphHopper being down
    const serviceError = new Error('GraphHopper unavailable') as Error & { code: string };
    serviceError.code = 'SERVICE_UNAVAILABLE';
    mockGetRoute.mockRejectedValue(serviceError);

    // Haversine returns 5km
    (haversineDistance as any).mockReturnValue(5000);

    // 1. Create vehicle
    const created = await prisma.vehicle.create({
      data: {
        callSign: 'FT-FALLBACK',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        capabilities: ['water_pump'],
        baseLocation: { type: 'Point', coordinates: [-5.1, 33.5] },
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        capacity: 5000,
      },
    });

    // 2. Validate available
    expect(() => validateVehicleAvailable(created as Vehicle)).not.toThrow();

    // 3. Assign to incident — should fall back to haversine
    const incident = { id: 'inc-fallback', location: { type: 'Point', coordinates: [-5.08, 33.55] } };
    const assignment = await assignVehicleToIncident(created as Vehicle, incident, 'user-1');

    // 4. Verify haversine fallback route
    expect(assignment.route.primary.coordinates).toEqual([[-5.1, 33.5], [-5.08, 33.55]]);
    expect(assignment.route.primary.distance_km).toBe(5);
    expect(assignment.route.primary.duration_min).toBe(7.5); // (5/40)*60

    // 5. Verify vehicle is EN_ROUTE
    const updated = vehicleStore[created.id];
    expect(updated.status).toBe('EN_ROUTE');
    expect(updated.assignedTo).toBe('inc-fallback');

    // 6. Verify dispatch record was created
    expect(Object.keys(dispatchStore).length).toBeGreaterThan(0);
  });
});
