export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { clearAuthCookies, getCurrentUser, getRefreshToken, hashRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const POST = withApiHandler(async (request: Request) => {
  try {
    const refreshToken = await getRefreshToken(request);
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    } else {
      const currentUser = await getCurrentUser(request);
      if (currentUser) {
        await prisma.refreshToken.updateMany({ where: { userId: currentUser.userId }, data: { revokedAt: new Date() } });
      }
    }

    await clearAuthCookies();
    return NextResponse.json({ ok: true });
  } catch (error) {
    throw new AppError(5000, { cause: error });
  }
});
