export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deriveScopes, hashRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

const DEFAULT_DEMO_ADMIN_CIN = 'CD789012';
const DEMO_SESSION_SECONDS = 60 * 60 * 6;

function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const requestUrl = new URL(request.url);

  if (host) {
    return `${forwardedProto || requestUrl.protocol.replace(':', '')}://${host}`;
  }

  return requestUrl.origin;
}

function setDemoAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  response.cookies.set('auth-token', accessToken, { ...base, maxAge: 60 * 15 });
  response.cookies.set('refresh-token', refreshToken, { ...base, maxAge: DEMO_SESSION_SECONDS });
}

export const GET = withApiHandler(async (request: Request) => {
  if (process.env.DEMO_AUTO_LOGIN_ENABLED === 'false') {
    throw new AppError(2001, { message: 'Demo auto-login is disabled' });
  }

  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !process.env[key]);
  if (missingEnv.length) throw new AppError(5001, { meta: { missingEnv } });

  const cin = process.env.DEMO_ADMIN_CIN?.trim() || DEFAULT_DEMO_ADMIN_CIN;
  const user = await prisma.user.findUnique({ where: { cin } });
  if (!user) {
    throw new AppError(1003, { message: 'Demo admin user not found', meta: { cin } });
  }
  if (user.role !== 'OFFICIAL') {
    throw new AppError(2001, { message: 'Demo user must be an official account', meta: { cin } });
  }

  const scopes = deriveScopes(user.role);
  const accessToken = signAccessToken({
    userId: user.id,
    cin: user.cin,
    role: user.role,
    department: user.department ?? undefined,
    scopes,
  });

  const jti = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`;
  const refreshToken = signRefreshToken({ userId: user.id, jti, scopes });
  const expiresAt = new Date(Date.now() + DEMO_SESSION_SECONDS * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      tokenHash: hashRefreshToken(refreshToken),
      scopes,
      expiresAt,
      ip: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
  });

  const response = NextResponse.redirect(new URL('/map', getPublicOrigin(request)), 302);
  response.headers.set('Cache-Control', 'no-store');
  setDemoAuthCookies(response, accessToken, refreshToken);
  return response;
});
