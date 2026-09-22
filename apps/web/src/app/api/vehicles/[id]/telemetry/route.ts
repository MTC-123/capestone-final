export const dynamic = 'force-dynamic';

/**
 * Vehicle Telemetry Ingestion API
 * POST: Ingest telemetry data for a vehicle
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { isGeoJSONPoint } from '@/lib/validation/geojson';
import { publishVehicleTelemetry } from '@/lib/realtime/ably';

/**
 * POST /api/vehicles/[id]/telemetry
 */
export const POST = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const vehicleId = context?.params?.id;
  if (!vehicleId) throw new AppError(1000, { message: 'Vehicle ID is required' });

  // Validate vehicle exists
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new AppError(7000, { meta: { vehicleId } });

  const body = await request.json();
  const { position, speed, heading, engineOn, fuelLevel } = body;

  // Validate position
  if (!position || !isGeoJSONPoint(position)) {
    throw new AppError(7002, {
      message: 'position must be a valid GeoJSON Point',
      meta: { vehicleId },
    });
  }

  // Cast to Prisma-compatible JSON
  const positionJson = JSON.parse(JSON.stringify(position));

  // Create telemetry record
  const telemetry = await prisma.vehicleTelemetry.create({
    data: {
      vehicleId,
      position: positionJson,
      speed: typeof speed === 'number' ? speed : undefined,
      heading: typeof heading === 'number' ? heading : undefined,
      engineOn: typeof engineOn === 'boolean' ? engineOn : undefined,
      fuelLevel: typeof fuelLevel === 'number' ? fuelLevel : undefined,
    },
  });

  // Update vehicle's current location
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { location: positionJson },
  });

  // Publish to Ably if configured (no-op if not)
  await publishVehicleTelemetry(vehicleId, {
    vehicleId,
    position,
    speed,
    heading,
    engineOn,
    fuelLevel,
    timestamp: telemetry.timestamp,
  });

  return NextResponse.json(telemetry, { status: 201 });
});
