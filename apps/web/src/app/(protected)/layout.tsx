import { cookies } from 'next/headers';
import AuthProvider from '@/components/layout/AuthProvider';
import { AppFrame } from '@/components/shell/AppFrame';
import { verifyAccessToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { User } from '@/types';

/**
 * Resolves the signed-in user during the server render so protected pages
 * paint immediately instead of showing a loading state while /api/auth/me
 * runs. When only a refresh token is present, AuthProvider renews the
 * session on the client.
 */
async function loadInitialUser(): Promise<User | null> {
  const token = cookies().get('auth-token')?.value;
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        cin: true,
        phone: true,
        role: true,
        fullName: true,
        email: true,
        department: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return null;
    return {
      ...user,
      fullName: user.fullName ?? undefined,
      email: user.email ?? undefined,
      department: user.department ?? undefined,
      position: user.position ?? undefined,
    };
  } catch {
    return null;
  }
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await loadInitialUser();
  return (
    <AuthProvider initialUser={initialUser}>
      <AppFrame>{children}</AppFrame>
    </AuthProvider>
  );
}
