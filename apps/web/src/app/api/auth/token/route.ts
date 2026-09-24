export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { unset } from '@/lib/database/unset';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { audit } from '@/lib/audit/log';
import {
  buildAuthResponse,
  deriveScopes,
  getRefreshToken,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/auth';

export const POST = withApiHandler(async (request: Request) => {
  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missingEnv.length) throw new AppError(5001, { meta: { missingEnv } });
  await enforceRateLimit('tokenRefresh', request);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const refreshTokenFromBody =
    typeof (body as { refreshToken?: unknown })?.refreshToken === 'string'
      ? ((body as { refreshToken: string }).refreshToken.trim() || undefined)
      : undefined;
  const refreshTokenFromCookie = await getRefreshToken(request);
  const refreshToken = refreshTokenFromCookie ?? refreshTokenFromBody;
  if (!refreshToken) throw new AppError(2000);

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) throw new AppError(2003);

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, jti: decoded.jti, userId: decoded.userId },
  });
  if (!stored || stored.revokedAt) throw new AppError(2003);

  // Reuse of an already-rotated token means it was copied: revoke every
  // session of this user (refresh-token family invalidation, ASVS 7.4).
  // A short grace window absorbs benign races — two tabs, or a retry after a
  // dropped response, presenting the same token within seconds.
  const REUSE_GRACE_MS = 60_000;
  const withinGrace = stored.rotatedAt ? Date.now() - stored.rotatedAt.getTime() < REUSE_GRACE_MS : false;
  if (stored.rotatedAt && !withinGrace) {
    await prisma.refreshToken.updateMany({ where: { userId: decoded.userId, ...unset('revokedAt') }, data: { revokedAt: new Date() } });
    await audit({
      action: 'auth.signin_failed',
      targetType: 'user',
      targetId: decoded.userId,
      outcome: 'DENIED',
      meta: { reason: 'refresh_token_reuse', jti: decoded.jti },
      request,
    });
    throw new AppError(2003);
  }
  if (stored.expiresAt.getTime() <= Date.now()) throw new AppError(2003);

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new AppError(2003);

  // Scopes always follow the current role, so promotions and demotions apply on refresh.
  const scopes = deriveScopes(user.role);
  const accessToken = signAccessToken({
    userId: user.id,
    cin: user.cin,
    role: user.role,
    department: user.department ?? undefined,
    scopes,
  });

  const newJti = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`;
  const newRefreshToken = signRefreshToken({ userId: user.id, jti: newJti, scopes });
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Mark the presented token as rotated with a conditional update (no
  // multi-document transaction, so concurrent refreshes cannot deadlock). If
  // another request rotated it a moment ago, that is the benign race the grace
  // window exists for; the first rotation time is kept either way.
  if (!withinGrace) {
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, ...unset('rotatedAt') },
      data: { rotatedAt: new Date(), replacedByJti: newJti },
    });
  }
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti: newJti,
      tokenHash: newRefreshTokenHash,
      scopes,
      expiresAt,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
    },
  });

  const includeRefreshToken = Boolean(refreshTokenFromBody);
  return buildAuthResponse(
    {
      ok: true,
      tokenType: 'Bearer',
      accessToken,
      expiresIn: 60 * 15,
      ...(includeRefreshToken ? { refreshToken: newRefreshToken } : {}),
    },
    accessToken,
    newRefreshToken
  );
});
