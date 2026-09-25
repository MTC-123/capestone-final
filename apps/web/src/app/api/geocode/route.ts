export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { requireUser } from '@/lib/security/guards';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { parseWith } from '@/lib/validation/parse';
import { cacheJSON, getCachedJSON } from '@/lib/cache/redis';
import { logger } from '@/lib/observability/logger';

export type GeocodeResult = { name: string; label: string; lat: number; lng: number; kind: string };

const querySchema = z.object({
  q: z.string().trim().min(2, 'too_short').max(120),
  lang: z.enum(['ar', 'fr', 'en']).default('fr'),
});

/** Ifrane Province, used to bias (not restrict) results. */
const VIEWBOX = '-5.75,33.95,-4.55,32.95';
const CACHE_SECONDS = 60 * 60 * 24;

type ProviderHit = { display_name: string; name?: string; lat: string; lon: string; type?: string; class?: string };

async function search(q: string, lang: string): Promise<GeocodeResult[]> {
  const key = process.env.LOCATIONIQ_API_KEY;
  const params = new URLSearchParams({
    q,
    format: 'json',
    countrycodes: 'ma',
    limit: '6',
    viewbox: VIEWBOX,
    'accept-language': lang,
  });
  const url = key
    ? `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(key)}&${params}`
    : `https://nominatim.openstreetmap.org/search?${params}`;

  const response = await fetch(url, {
    // Nominatim's usage policy requires an identifying User-Agent.
    headers: { 'User-Agent': 'RICER-Ifrane/1.0 (wildfire response capstone, Al Akhawayn University)' },
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new AppError(4000, { meta: { provider: key ? 'locationiq' : 'nominatim', status: response.status } });

  const hits = (await response.json()) as ProviderHit[];
  return hits.map((hit) => ({
    name: hit.name || hit.display_name.split(',')[0],
    label: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    kind: hit.type || hit.class || 'place',
  }));
}

/** GET /api/geocode?q=Dayet+Aoua&lang=fr — place search for pinning a report. */
export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const { q, lang } = parseWith(querySchema, { q: url.searchParams.get('q') ?? '', lang: url.searchParams.get('lang') ?? undefined });
  await enforceRateLimit('geocode', request, user.userId);

  const cacheKey = `geocode:${lang}:${q.toLowerCase()}`;
  const cached = await getCachedJSON<GeocodeResult[]>(cacheKey);
  if (cached) return NextResponse.json({ results: cached, cached: true });

  try {
    const results = await search(q, lang);
    await cacheJSON(cacheKey, results, CACHE_SECONDS);
    return NextResponse.json({ results, cached: false });
  } catch (error) {
    logger.warn({ event: 'geocode_failed', meta: { q }, error: { message: (error as Error)?.message } });
    if (error instanceof AppError) throw error;
    throw new AppError(4000, { cause: error });
  }
});
