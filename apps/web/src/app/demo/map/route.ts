export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildAuthResponse, issueSession } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { audit } from '@/lib/audit/log';
import { DEMO_PERSONAS, isDemoMode, type DemoPersona } from '@/lib/demo';

const DEMO_SESSION_SECONDS = 60 * 60 * 6;

function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const requestUrl = new URL(request.url);
  if (host) return `${forwardedProto || requestUrl.protocol.replace(':', '')}://${host}`;
  return requestUrl.origin;
}

/** One-click sign-in as a seeded demo persona. Only exists when DEMO_MODE=true. */
export const GET = withApiHandler(async (request: Request) => {
  if (!isDemoMode()) throw new AppError(1003);
  await enforceRateLimit('signin', request);

  const url = new URL(request.url);
  const persona: DemoPersona = url.searchParams.get('as') === 'civilian' ? 'civilian' : 'official';
  const { cin, landing } = DEMO_PERSONAS[persona];

  const user = await prisma.user.findUnique({ where: { cin } });
  if (!user) throw new AppError(1003, { message: 'Demo persona not seeded', meta: { persona } });

  const { accessToken, refreshToken } = await issueSession(user, request, { refreshSeconds: DEMO_SESSION_SECONDS });
  await audit({
    action: 'auth.signin',
    actor: { userId: user.id, cin: user.cin, role: user.role },
    targetType: 'user',
    targetId: user.id,
    meta: { demoPersona: persona },
    request,
  });

  const redirect = NextResponse.redirect(new URL(landing, getPublicOrigin(request)), 302);
  const withCookies = buildAuthResponse({}, accessToken, refreshToken);
  withCookies.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  redirect.cookies.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_SECONDS,
  });
  redirect.headers.set('Cache-Control', 'no-store');
  return redirect;
});
