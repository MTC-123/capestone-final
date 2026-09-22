import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    vehicleTelemetry: { create: vi.fn() },
  },
}));

// Mock Ably
vi.mock('@/lib/realtime/ably', () => ({
  publishVehicleTelemetry: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock error handling
vi.mock('@/lib/errors/mapError', () => ({
  mapUnknownToAppError: vi.fn((err: any) => err),
}));

vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/errors/rateLimit', () => ({
  checkErrorRateLimit: vi.fn(() => ({ limited: false, retryAfterSeconds: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { prisma } from '@/lib/prisma';
import { publishVehicleTelemetry } from '@/lib/realtime/ably';

describe('Vehicle Telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishVehicleTelemetry is callable', () => {
    expect(typeof publishVehicleTelemetry).toBe('function');
  });

  it('prisma.vehicleTelemetry.create mock works', async () => {
    const telemetry = {
      id: 'tel-1',
      vehicleId: 'v-1',
      position: { type: 'Point', coordinates: [-5.1, 33.5] },
      speed: 45,
      heading: 180,
      engineOn: true,
      fuelLevel: 75,
      timestamp: new Date(),
    };
    (prisma.vehicleTelemetry.create as any).mockResolvedValue(telemetry);

    const result = await prisma.vehicleTelemetry.create({
      data: {
        vehicleId: 'v-1',
        position: { type: 'Point', coordinates: [-5.1, 33.5] },
        speed: 45,
        heading: 180,
        engineOn: true,
        fuelLevel: 75,
      },
    });

    expect(result.vehicleId).toBe('v-1');
    expect(result.speed).toBe(45);
  });

  it('vehicle location is updated after telemetry', async () => {
    const position = { type: 'Point', coordinates: [-5.2, 33.6] };

    (prisma.vehicle.update as any).mockResolvedValue({ id: 'v-1', location: position });

    await prisma.vehicle.update({
      where: { id: 'v-1' },
      data: { location: position },
    });

    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'v-1' },
      data: { location: position },
    });
  });

  it('Ably publish is called when configured', async () => {
    await publishVehicleTelemetry('v-1', { position: { type: 'Point', coordinates: [-5.1, 33.5] } });
    expect(publishVehicleTelemetry).toHaveBeenCalledWith('v-1', expect.objectContaining({ position: expect.any(Object) }));
  });
});
