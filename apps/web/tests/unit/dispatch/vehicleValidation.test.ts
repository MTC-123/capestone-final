import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Vehicle } from '@prisma/client';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findUnique: vi.fn(), findMany: vi.fn() },
    dispatch: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/errors/catalog', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/errors/catalog')>();
  return mod;
});

import { prisma } from '@/lib/prisma';
import {
  validateVehicleAvailable,
  validateVehicleExists,
  validateNoDuplicateVehicleAssignment,
  validateVehiclesExistAndAvailable,
} from '@/lib/dispatch/vehicleValidation';
import { AppError } from '@/lib/errors/AppError';

function makeVehicle(overrides?: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1',
    callSign: 'FT-001',
    type: 'FIRE_TRUCK',
    status: 'AVAILABLE',
    capabilities: ['water_pump'],
    baseLocation: { type: 'Point', coordinates: [-5.1, 33.5] },
    location: { type: 'Point', coordinates: [-5.1, 33.5] },
    assignedTo: null,
    capacity: 5000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Vehicle;
}

describe('vehicleValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateVehicleAvailable', () => {
    it('passes for AVAILABLE vehicle', () => {
      expect(() => validateVehicleAvailable(makeVehicle())).not.toThrow();
    });

    it('throws 7001 for EN_ROUTE vehicle', () => {
      const vehicle = makeVehicle({ status: 'EN_ROUTE' });
      expect(() => validateVehicleAvailable(vehicle)).toThrow(AppError);
      try {
        validateVehicleAvailable(vehicle);
      } catch (e) {
        expect((e as AppError).code).toBe(7001);
      }
    });

    it('throws 7001 for OUT_OF_SERVICE vehicle', () => {
      const vehicle = makeVehicle({ status: 'OUT_OF_SERVICE' });
      expect(() => validateVehicleAvailable(vehicle)).toThrow(AppError);
      try {
        validateVehicleAvailable(vehicle);
      } catch (e) {
        expect((e as AppError).code).toBe(7001);
      }
    });
  });

  describe('validateVehicleExists', () => {
    it('returns vehicle when found', async () => {
      const vehicle = makeVehicle();
      (prisma.vehicle.findUnique as any).mockResolvedValue(vehicle);
      const result = await validateVehicleExists('v-1');
      expect(result).toEqual(vehicle);
    });

    it('throws 7000 when not found', async () => {
      (prisma.vehicle.findUnique as any).mockResolvedValue(null);
      await expect(validateVehicleExists('v-missing')).rejects.toThrow(AppError);
      try {
        await validateVehicleExists('v-missing');
      } catch (e) {
        expect((e as AppError).code).toBe(7000);
      }
    });
  });

  describe('validateNoDuplicateVehicleAssignment', () => {
    it('passes when no active assignment', async () => {
      (prisma.dispatch.findFirst as any).mockResolvedValue(null);
      await expect(validateNoDuplicateVehicleAssignment('v-1', 'inc-1')).resolves.not.toThrow();
    });

    it('throws 7004 when active assignment exists', async () => {
      (prisma.dispatch.findFirst as any).mockResolvedValue({ id: 'd-1' });
      await expect(validateNoDuplicateVehicleAssignment('v-1', 'inc-1')).rejects.toThrow(AppError);
      try {
        await validateNoDuplicateVehicleAssignment('v-1', 'inc-1');
      } catch (e) {
        expect((e as AppError).code).toBe(7004);
      }
    });
  });

  describe('validateVehiclesExistAndAvailable', () => {
    it('returns vehicles when all found and available', async () => {
      const vehicles = [makeVehicle({ id: 'v-1' }), makeVehicle({ id: 'v-2' })];
      (prisma.vehicle.findMany as any).mockResolvedValue(vehicles);
      const result = await validateVehiclesExistAndAvailable(['v-1', 'v-2']);
      expect(result).toHaveLength(2);
    });

    it('throws 7000 when a vehicle is missing', async () => {
      (prisma.vehicle.findMany as any).mockResolvedValue([makeVehicle({ id: 'v-1' })]);
      await expect(validateVehiclesExistAndAvailable(['v-1', 'v-missing'])).rejects.toThrow(AppError);
    });

    it('throws 7001 when a vehicle is not available', async () => {
      const vehicles = [makeVehicle({ id: 'v-1' }), makeVehicle({ id: 'v-2', status: 'EN_ROUTE' })];
      (prisma.vehicle.findMany as any).mockResolvedValue(vehicles);
      await expect(validateVehiclesExistAndAvailable(['v-1', 'v-2'])).rejects.toThrow(AppError);
    });
  });
});
