export const dynamic = 'force-dynamic';

/**
 * Geo Vehicles API
 * GET: Returns vehicles as GeoJSON FeatureCollection for map display
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { validatePoint } from '@/lib/validation/geojson';
import { logger } from '@/lib/observability/logger';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const features = vehicles
    .map((v) => {
      const location = validatePoint(v.location);
      if (!location) {
        logger.warn({ event: 'invalid_vehicle_location', meta: { vehicleId: v.id } });
        return null;
      }
      return {
        type: 'Feature' as const,
        geometry: location,
        properties: {
          id: v.id,
          callSign: v.callSign,
          type: v.type,
          status: v.status,
          assignedTo: v.assignedTo ?? undefined,
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const response = NextResponse.json({ type: 'FeatureCollection', features });
  response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');
  return response;
});
