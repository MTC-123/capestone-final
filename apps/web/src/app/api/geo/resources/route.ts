export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { validatePoint } from '@/lib/validation/geojson';
import { logger } from '@/lib/observability/logger';
import { withRetry } from '@/lib/database/withRetry';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  // Explicit role check - resources are OFFICIAL only
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001);
  }

  // Keep scope checks as secondary validation
  if (!user.scopes.includes('map:read')) throw new AppError(2001);
  if (!user.scopes.includes('equipment:read')) throw new AppError(2001);

  const resources = await withRetry(
    () => prisma.resource.findMany({ orderBy: { createdAt: 'desc' } }),
    'geo:resources:fetch'
  );

  const features = resources
    .map((res) => {
      const location = validatePoint(res.location);
      if (!location) {
        logger.warn({ event: 'invalid_resource_location', meta: { resourceId: res.id } });
        return null;
      }
      return {
        type: 'Feature' as const,
        geometry: location,
        properties: {
          id: res.id,
          type: res.type,
          name: res.name,
          status: res.status,
          assignedTo: res.assignedTo ?? undefined,
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const response = NextResponse.json({ type: 'FeatureCollection', features });
  response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');
  return response;
});
