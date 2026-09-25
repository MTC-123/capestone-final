export const dynamic = 'force-dynamic';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { buildAuthResponse, issueSession, toPublicUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { parseJsonBody } from '@/lib/validation/parse';
import { signinSchema } from '@/lib/validation/auth';
import { audit } from '@/lib/audit/log';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Compared against when the CIN is unknown so both paths cost one bcrypt
// round and response timing does not reveal which accounts exist.
const DUMMY_HASH = '$2b$10$FJm6JlzB4q2P7vgfVZc4A.H67Kefiw7fmd0Kp7K8wdsNyX/Gc54Yy';

export const POST = withApiHandler(async (request: Request) => {
  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missingEnv.length) throw new AppError(5001, { meta: { missingEnv } });

  await enforceRateLimit('signin', request);
  const { cin, password } = await parseJsonBody(request, signinSchema);
  await enforceRateLimit('signin', request, cin);

  const user = await prisma.user.findUnique({ where: { cin } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await audit({ action: 'auth.signin_failed', targetType: 'user', targetId: user.id, outcome: 'DENIED', meta: { reason: 'locked' }, request });
    throw new AppError(2004, { meta: { lockedUntil: user.lockedUntil.toISOString() } });
  }

  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !valid) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined,
        },
      });
      await audit({
        action: lock ? 'auth.locked' : 'auth.signin_failed',
        targetType: 'user',
        targetId: user.id,
        outcome: 'DENIED',
        meta: { failedAttempts: failed },
        request,
      });
    } else {
      await audit({ action: 'auth.signin_failed', outcome: 'DENIED', meta: { reason: 'unknown_cin' }, request });
    }
    throw new AppError(2002);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = await issueSession(updated, request);
  const actor = { userId: updated.id, cin: updated.cin, role: updated.role };
  await audit({ action: 'auth.signin', actor, targetType: 'user', targetId: updated.id, request });

  return buildAuthResponse({ user: toPublicUser(updated) }, accessToken, refreshToken);
});
