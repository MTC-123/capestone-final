export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { checkDatabaseHealth } from '@/lib/prisma';

export const runtime = 'nodejs';

export const GET = withApiHandler(async () => {
  const dbHealthy = await checkDatabaseHealth();

  return NextResponse.json({
    ok: dbHealthy,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
    },
  }, {
    status: dbHealthy ? 200 : 503
  });
});
