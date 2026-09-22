export const dynamic = 'force-dynamic';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { buildAuthResponse, deriveScopes, hashRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const POST = withApiHandler(async (request: Request) => {
  const missingEnv = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missingEnv.length) throw new AppError(5001, { meta: { missingEnv } });

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const cin = typeof (body as { cin?: unknown })?.cin === 'string' ? (body as { cin: string }).cin.trim() : '';
  const phone = typeof (body as { phone?: unknown })?.phone === 'string' ? (body as { phone: string }).phone.trim() : '';
  const password = typeof (body as { password?: unknown })?.password === 'string' ? (body as { password: string }).password : '';
  const role = typeof (body as { role?: unknown })?.role === 'string' ? (body as { role: string }).role : '';
  const department =
    typeof (body as { department?: unknown })?.department === 'string' ? (body as { department: string }).department : '';
  const position =
    typeof (body as { position?: unknown })?.position === 'string' ? (body as { position: string }).position : '';

  const fields = [];
  if (!cin) fields.push({ field: 'cin', code: 'required' });
  if (!phone) fields.push({ field: 'phone', code: 'required' });
  if (!password) fields.push({ field: 'password', code: 'required' });
  if (!role) fields.push({ field: 'role', code: 'required' });
  if (fields.length) throw new AppError(1001, { fields });

  if (role === 'OFFICIAL' && !department) {
    throw new AppError(1001, { fields: [{ field: 'department', code: 'required' }] });
  }

  const existingUser = await prisma.user.findUnique({ where: { cin } });
  if (existingUser) throw new AppError(3001);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      cin,
      phone,
      password: hashedPassword,
      role: role as 'CIVILIAN' | 'OFFICIAL',
      department: role === 'OFFICIAL' ? department : undefined,
      position: role === 'OFFICIAL' ? position : undefined,
    },
  });

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
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      tokenHash: refreshTokenHash,
      scopes,
      expiresAt,
      ip: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    },
  });

  const userWithoutPassword = {
    id: user.id,
    cin: user.cin,
    phone: user.phone,
    role: user.role,
    department: user.department ?? undefined,
    position: user.position ?? undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return buildAuthResponse({ user: userWithoutPassword }, accessToken, refreshToken);
});
