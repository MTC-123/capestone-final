export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { requireUser } from '@/lib/security/guards';
import { parseJsonBody, parseWith } from '@/lib/validation/parse';
import { assessRisk } from '@/lib/risk/riskService';

const pointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  at: z.coerce.date().optional(),
});

const batchSchema = z.object({
  points: z.array(pointSchema).min(1, 'empty').max(50, 'too_many'),
});

function setCacheHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, max-age=300');
  return response;
}

/** GET /api/risk/predict?lat=..&lng=..&at=(optional ISO date) — single point. */
export const GET = withApiHandler(async (request: Request) => {
  await requireUser(request);

  const url = new URL(request.url);
  const point = parseWith(pointSchema, {
    lat: url.searchParams.get('lat') ?? undefined,
    lng: url.searchParams.get('lng') ?? undefined,
    at: url.searchParams.get('at') ?? undefined,
  });

  const result = await assessRisk(point);
  return setCacheHeaders(NextResponse.json(result));
});

/** POST /api/risk/predict — batch of up to 50 points: `{ points: [{ lat, lng, at? }] }`. */
export const POST = withApiHandler(async (request: Request) => {
  await requireUser(request);

  const { points } = await parseJsonBody(request, batchSchema);
  const results = await Promise.all(points.map((point) => assessRisk(point)));

  return setCacheHeaders(NextResponse.json({ results }));
});
