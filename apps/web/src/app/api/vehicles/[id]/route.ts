export const dynamic = 'force-dynamic';

/**
 * Vehicle by ID API
 * GET: Get single vehicle
 * PATCH: Update vehicle
 * DELETE: Delete vehicle (only if AVAILABLE or OUT_OF_SERVICE)
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { isGeoJSONPoint } from '@/lib/validation/geojson';
import type { VehicleStatus } from '@prisma/client';

const VALID_VEHICLE_STATUSES: VehicleStatus[] = ['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'OUT_OF_SERVICE'];

/**
 * GET /api/vehicles/[id]
 */
export const GET = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000, { message: 'Vehicle ID is required' });

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError(7000, { meta: { vehicleId: id } });

  return NextResponse.json(vehicle);
});

/**
 * PATCH /api/vehicles/[id]
 */
export const PATCH = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000, { message: 'Vehicle ID is required' });

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError(7000, { meta: { vehicleId: id } });

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_VEHICLE_STATUSES.includes(body.status)) {
      throw new AppError(1001, {
        fields: [{ field: 'status', code: 'invalid', message: `Status must be one of: ${VALID_VEHICLE_STATUSES.join(', ')}` }],
      });
    }
    data.status = body.status;
  }

  if (body.location !== undefined) {
    if (!isGeoJSONPoint(body.location)) {
      throw new AppError(7002, { message: 'location must be a valid GeoJSON Point' });
    }
    data.location = body.location;
  }

  if (body.capabilities !== undefined) {
    if (!Array.isArray(body.capabilities)) {
      throw new AppError(1001, {
        fields: [{ field: 'capabilities', code: 'invalid', message: 'Capabilities must be an array' }],
      });
    }
    data.capabilities = body.capabilities;
  }

  if (body.assignedTo !== undefined) {
    data.assignedTo = body.assignedTo;
  }

  if (body.capacity !== undefined) {
    data.capacity = body.capacity;
  }

  const updated = await prisma.vehicle.update({ where: { id }, data });
  return NextResponse.json(updated);
});

/**
 * DELETE /api/vehicles/[id]
 * Only allowed when vehicle is AVAILABLE or OUT_OF_SERVICE
 */
export const DELETE = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000, { message: 'Vehicle ID is required' });

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new AppError(7000, { meta: { vehicleId: id } });

  if (vehicle.status !== 'AVAILABLE' && vehicle.status !== 'OUT_OF_SERVICE') {
    throw new AppError(7001, {
      message: `Cannot delete vehicle with status ${vehicle.status}. Must be AVAILABLE or OUT_OF_SERVICE.`,
      meta: { vehicleId: id, currentStatus: vehicle.status },
    });
  }

  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ deleted: true, id });
});
