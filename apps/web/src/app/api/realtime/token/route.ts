export const dynamic = 'force-dynamic';

/**
 * Ably token auth. Browsers never see the API key: they get a one-hour token
 * that can only *subscribe*, and only to their own channels. Every signed-in
 * user gets `ricer:user:<id>`; officials also get the shared officials channel
 * and vehicle telemetry.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { realtimeCapability } from '@/lib/realtime/channels';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'REALTIME_NOT_CONFIGURED', message: 'Realtime service not configured' } },
      { status: 501 }
    );
  }

  try {
    const Ably = await import('ably');
    const AblyRest = Ably.default?.Rest ?? Ably.Rest;
    const rest = new AblyRest({ key: apiKey });
    const tokenRequest = await (rest.auth as any).createTokenRequest({
      capability: realtimeCapability(user.userId, user.role),
      ttl: 3600 * 1000, // 1 hour
      clientId: user.userId,
    });
    return NextResponse.json(tokenRequest);
  } catch {
    return NextResponse.json(
      { error: { code: 'REALTIME_TOKEN_FAILED', message: 'Failed to generate realtime token' } },
      { status: 500 }
    );
  }
});
