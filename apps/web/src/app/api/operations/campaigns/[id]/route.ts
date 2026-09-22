export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new AppError(10000);

  return NextResponse.json({ campaign });
});

export const PATCH = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw new AppError(10000);

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.label !== undefined) data.label = body.label;

  const campaign = await prisma.campaign.update({ where: { id }, data });

  return NextResponse.json({ campaign });
});
