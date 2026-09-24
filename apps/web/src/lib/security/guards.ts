import { getCurrentUser, type AccessTokenPayload, type Role } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';

/** Returns the authenticated user or throws 401. */
export async function requireUser(request: Request): Promise<AccessTokenPayload> {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  return user;
}

/** Returns the authenticated user when they hold one of `roles`, otherwise throws 401/403. */
export async function requireRole(request: Request, ...roles: Role[]): Promise<AccessTokenPayload> {
  const user = await requireUser(request);
  if (!roles.includes(user.role)) throw new AppError(2001);
  return user;
}

export function requireOfficial(request: Request): Promise<AccessTokenPayload> {
  return requireRole(request, 'OFFICIAL');
}
