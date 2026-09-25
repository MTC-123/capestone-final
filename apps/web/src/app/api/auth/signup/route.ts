export const dynamic = 'force-dynamic';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { buildAuthResponse, issueSession, toPublicUser } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { parseJsonBody } from '@/lib/validation/parse';
import { signupSchema } from '@/lib/validation/auth';
import { audit } from '@/lib/audit/log';

/**
 * Public registration. Every account starts as CIVILIAN; asking for official
 * access files an OfficialRequest that an existing official must approve
 * (ASVS 8.2 — users cannot grant themselves privileges).
 */
export const POST = withApiHandler(async (request: Request) => {
  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missingEnv.length) throw new AppError(5001, { meta: { missingEnv } });

  await enforceRateLimit('signup', request);
  const input = await parseJsonBody(request, signupSchema);

  const existingUser = await prisma.user.findUnique({ where: { cin: input.cin } });
  if (existingUser) throw new AppError(3001);

  const user = await prisma.user.create({
    data: {
      cin: input.cin,
      phone: input.phone,
      password: await bcrypt.hash(input.password, 12),
      role: 'CIVILIAN',
      fullName: input.fullName,
      email: input.email,
    },
  });

  let officialRequestId: string | undefined;
  if (input.requestOfficial) {
    const officialRequest = await prisma.officialRequest.create({
      data: {
        userId: user.id,
        department: input.requestOfficial.department,
        position: input.requestOfficial.position,
        justification: input.requestOfficial.justification,
      },
    });
    officialRequestId = officialRequest.id;
  }

  const actor = { userId: user.id, cin: user.cin, role: user.role };
  await audit({ action: 'auth.signup', actor, targetType: 'user', targetId: user.id, request });
  if (officialRequestId) {
    await audit({ action: 'official_request.create', actor, targetType: 'official_request', targetId: officialRequestId, request });
  }

  const { accessToken, refreshToken } = await issueSession(user, request);
  return buildAuthResponse(
    { user: toPublicUser(user), officialRequest: officialRequestId ? { id: officialRequestId, status: 'PENDING' } : undefined },
    accessToken,
    refreshToken
  );
});
