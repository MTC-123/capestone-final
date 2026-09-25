export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { requireOfficial } from '@/lib/security/guards';

/** Lists requests for official access (default: pending first). OFFICIAL only. */
export const GET = withApiHandler(async (request: Request) => {
  await requireOfficial(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const where: Prisma.OfficialRequestWhereInput =
    status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? { status } : {};

  const items = await prisma.officialRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { user: { select: { id: true, cin: true, fullName: true, phone: true, email: true, role: true, createdAt: true } } },
  });
  const pending = await prisma.officialRequest.count({ where: { status: 'PENDING' } });
  return NextResponse.json({ items, pending });
});
