/**
 * Vehicle Dispatch Validation Logic
 * Validates vehicle availability and dispatch constraints
 */

import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import type { Vehicle } from '@prisma/client';

/**
 * Validate vehicle is available for dispatch
 */
export function validateVehicleAvailable(vehicle: Vehicle): void {
  if (vehicle.status !== 'AVAILABLE') {
    throw new AppError(7001, {
      message: `Vehicle ${vehicle.callSign} is not available (status: ${vehicle.status})`,
      meta: { vehicleId: vehicle.id, callSign: vehicle.callSign, currentStatus: vehicle.status },
    });
  }
}

/**
 * Validate vehicle exists and return it
 */
export async function validateVehicleExists(vehicleId: string): Promise<Vehicle> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    throw new AppError(7000, {
      message: 'Vehicle not found',
      meta: { vehicleId },
    });
  }

  return vehicle;
}

/**
 * Validate vehicle is not already assigned to this incident
 */
export async function validateNoDuplicateVehicleAssignment(
  vehicleId: string,
  incidentId: string
): Promise<void> {
  const existingAssignment = await prisma.dispatch.findFirst({
    where: {
      vehicleId,
      incidentId,
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'] },
    },
  });

  if (existingAssignment) {
    throw new AppError(7004, {
      message: 'Vehicle is already assigned to this incident',
      meta: { vehicleId, incidentId, dispatchId: existingAssignment.id },
    });
  }
}

/**
 * Validate vehicles exist and are available
 */
export async function validateVehiclesExistAndAvailable(vehicleIds: string[]): Promise<Vehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
  });

  if (vehicles.length !== vehicleIds.length) {
    const foundIds = vehicles.map((v) => v.id);
    const missingIds = vehicleIds.filter((id) => !foundIds.includes(id));
    throw new AppError(7000, {
      message: `Vehicle(s) not found: ${missingIds.join(', ')}`,
      meta: { missingVehicleIds: missingIds },
    });
  }

  for (const vehicle of vehicles) {
    validateVehicleAvailable(vehicle);
  }

  return vehicles;
}
