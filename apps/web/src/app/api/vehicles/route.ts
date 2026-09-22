export const dynamic = 'force-dynamic';

/**
 * Vehicle CRUD API
 * GET: List vehicles (optional filters)
 * POST: Create a new vehicle
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { isGeoJSONPoint } from '@/lib/validation/geojson';
import type { VehicleType, VehicleStatus } from '@prisma/client';

const VALID_VEHICLE_TYPES: VehicleType[] = ['FIRE_TRUCK', 'WATER_TANKER', 'COMMAND', 'AMBULANCE', 'HELICOPTER'];
const VALID_VEHICLE_STATUSES: VehicleStatus[] = ['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'OUT_OF_SERVICE'];

/**
 * GET /api/vehicles
 * List vehicles with optional ?status=AVAILABLE&type=FIRE_TRUCK filters
 */
export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') as VehicleStatus | null;
  const typeFilter = url.searchParams.get('type') as VehicleType | null;

  const where: Record<string, unknown> = {};
  if (statusFilter && VALID_VEHICLE_STATUSES.includes(statusFilter)) {
    where.status = statusFilter;
  }
  if (typeFilter && VALID_VEHICLE_TYPES.includes(typeFilter)) {
    where.type = typeFilter;
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(vehicles);
});

/**
 * POST /api/vehicles
 * Create a new vehicle
 */
export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const { callSign, type, baseLocation, capabilities, capacity } = body;

  // Validate required fields
  const fields = [];
  if (!callSign || typeof callSign !== 'string') {
    fields.push({ field: 'callSign', code: 'required', message: 'Call sign is required' });
  }
  if (!type || !VALID_VEHICLE_TYPES.includes(type)) {
    fields.push({ field: 'type', code: 'invalid', message: `Type must be one of: ${VALID_VEHICLE_TYPES.join(', ')}` });
  }
  if (fields.length) throw new AppError(1001, { fields });

  // Validate baseLocation if provided
  if (baseLocation && !isGeoJSONPoint(baseLocation)) {
    throw new AppError(7002, {
      message: 'baseLocation must be a valid GeoJSON Point',
      meta: { field: 'baseLocation' },
    });
  }

  // Check unique callSign
  const existing = await prisma.vehicle.findUnique({ where: { callSign } });
  if (existing) {
    throw new AppError(7003, {
      message: `Call sign "${callSign}" already exists`,
      meta: { callSign },
    });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      callSign,
      type,
      baseLocation: baseLocation ?? undefined,
      location: baseLocation ?? undefined, // Initial location = base
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      capacity: typeof capacity === 'number' ? capacity : 0,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
});
