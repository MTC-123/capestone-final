export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const PATCH = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const status = (body as { status?: unknown })?.status;
  const allowed = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
  if (typeof status !== 'string' || !allowed.includes(status as (typeof allowed)[number])) {
    throw new AppError(1001, { fields: [{ field: 'status', code: 'invalid' }] });
  }

  const report = await prisma.report.update({
    where: { id },
    data: { status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' },
    include: {
      user: {
        select: {
          cin: true,
          phone: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json({ report });
});
