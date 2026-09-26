export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { issueGuestToken } from '@/lib/security/guestReport';
import { parseJsonBody } from '@/lib/validation/parse';

export const POST = withApiHandler(async (request: Request) => {
  await enforceRateLimit('guestSession', request);
  const { clientSubmissionId } = await parseJsonBody(request, z.object({ clientSubmissionId: z.string().uuid() }));
  return NextResponse.json({ token: await issueGuestToken(clientSubmissionId), expiresInSeconds: 1800 });
});
