export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const user = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    select: {
      id: true,
      cin: true,
      phone: true,
      role: true,
      department: true,
      position: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new AppError(1003, { meta: { resource: 'User' } });

  return NextResponse.json({ user });
});
