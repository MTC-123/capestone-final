export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { checkDatabaseHealth } from '@/lib/prisma';
import { getKv } from '@/lib/kv';

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - started) };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Liveness + readiness. The database is the only hard dependency (503 when
 * down); everything else is reported so degraded integrations are visible
 * without failing the deployment's health check. Only whether an
 * integration is configured is exposed — never its credentials.
 */
export const GET = withApiHandler(async () => {
  const [db, kv] = await Promise.all([
    timed(() => withTimeout(checkDatabaseHealth(), 4000, false)),
    timed(() => withTimeout(getKv().ping(), 2000, false)),
  ]);

  const configured = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]));
  const body = {
    ok: db.value,
    status: db.value ? (kv.value ? 'healthy' : 'degraded') : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? 'dev',
    region: process.env.VERCEL_REGION ?? 'local',
    services: {
      database: { status: db.value ? 'healthy' : 'unhealthy', latencyMs: db.ms },
      cache: { status: kv.value ? 'healthy' : 'unhealthy', backend: getKv().backend, latencyMs: kv.ms },
    },
    integrations: {
      photoStorage: configured('BLOB_READ_WRITE_TOKEN') ? 'vercel-blob' : 'database',
      realtime: configured('ABLY_API_KEY'),
      email: configured('RESEND_API_KEY'),
      whatsapp: configured('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'),
      queue: configured('QSTASH_TOKEN'),
      firms: configured('FIRMS_MAP_KEY'),
      weatherTiles: configured('NEXT_PUBLIC_OWM_API_KEY'),
      routing: configured('ORS_API_KEY') || configured('GRAPHHOPPER_API_KEY') || configured('GRAPHHOPPER_URL'),
      geocoding: configured('LOCATIONIQ_API_KEY'),
      errorTracking: configured('SENTRY_DSN') || configured('NEXT_PUBLIC_SENTRY_DSN'),
    },
  };

  return NextResponse.json(body, { status: db.value ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
});
