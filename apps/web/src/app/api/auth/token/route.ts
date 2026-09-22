export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
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
    where: { tokenHash, jti: decoded.jti, userId: decoded.userId, revokedAt: null, rotatedAt: null },
  });
  if (!stored) throw new AppError(2003);
  if (stored.expiresAt.getTime() <= Date.now()) throw new AppError(2003);

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new AppError(2003);

  const scopes = decoded.scopes?.length ? decoded.scopes : deriveScopes(user.role);
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

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { rotatedAt: new Date(), replacedByJti: newJti },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti: newJti,
        tokenHash: newRefreshTokenHash,
        scopes,
        expiresAt,
        ip: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    }),
  ]);

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
