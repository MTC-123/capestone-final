export const dynamic = 'force-dynamic';

import { withApiHandler } from '@/lib/errors/withApiHandler';

export const runtime = 'nodejs';

export const GET = withApiHandler(async () => {
  const body =
    `# HELP ricer_uptime_seconds Process uptime in seconds\n` +
    `# TYPE ricer_uptime_seconds gauge\n` +
    `ricer_uptime_seconds ${process.uptime()}\n`;

  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain; version=0.0.4' } });
});
