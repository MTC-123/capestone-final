export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const incidentId = url.searchParams.get('incidentId') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const fromAgency = url.searchParams.get('fromAgency') || undefined;

  const where: Record<string, unknown> = {};
  if (incidentId) where.incidentId = incidentId;
  if (category) where.category = category;
  if (fromAgency) where.fromAgency = fromAgency;

  const items = await prisma.communicationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  return NextResponse.json({
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
  });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  if (!body.message?.trim()) throw new AppError(1001);

  const entry = await prisma.communicationLog.create({
    data: {
      incidentId: body.incidentId || undefined,
      category: body.category || 'GENERAL',
      fromAgency: body.fromAgency || undefined,
      toAgency: body.toAgency || undefined,
      message: body.message.trim(),
      metadata: body.metadata || undefined,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
});
