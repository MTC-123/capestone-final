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
  if (!user.scopes.includes('map:read')) throw new AppError(2001);

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '500'),
    1000
  );

  const incidents = await withRetry(
    () => prisma.incident.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    'geo:incidents:fetch'
  );

  let validCount = 0;
  let invalidCount = 0;
  const invalidIds: string[] = [];

  const features = incidents
    .map((inc) => {
      const location = validatePoint(inc.location);
      if (!location) {
        invalidCount++;
        if (invalidIds.length < 5) invalidIds.push(inc.id); // Only store first 5 samples
        return null;
      }
      validCount++;
      return {
        type: 'Feature' as const,
        geometry: location,
        properties: {
          id: inc.id,
          cause: inc.cause,
          severity: inc.severity,
          status: inc.status,
          description: inc.description ?? undefined,
          createdAt: inc.createdAt.toISOString(),
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // Single summary log instead of individual warnings
  if (invalidCount > 0) {
    logger.warn({
      event: 'invalid_incidents_filtered',
      meta: {
        total: incidents.length,
        valid: validCount,
        invalid: invalidCount,
        sampleIds: invalidIds,
      }
    });
  }

  const response = NextResponse.json({ type: 'FeatureCollection', features });
  response.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');
  response.headers.set('X-Data-Quality', `${validCount}/${incidents.length}`);
  return response;
});
