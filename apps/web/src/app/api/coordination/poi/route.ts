export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

const VALID_LEVELS = ['POI_1', 'POI_2', 'POI_3'];

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const incidentId = url.searchParams.get('incidentId') || undefined;

  const where: Record<string, unknown> = {};
  if (incidentId) where.incidentId = incidentId;

  const activations = await prisma.pOIActivation.findMany({
    where,
    orderBy: { activatedAt: 'desc' },
  });

  return NextResponse.json({ activations });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  if (!body.incidentId) throw new AppError(1001);
  if (!VALID_LEVELS.includes(body.level)) throw new AppError(9001);

  // Deactivate any existing active POI for this incident
  await prisma.pOIActivation.updateMany({
    where: { incidentId: body.incidentId, deactivatedAt: null },
    data: { deactivatedAt: new Date() },
  });

  const activation = await prisma.pOIActivation.create({
    data: {
      incidentId: body.incidentId,
      level: body.level,
      activatedBy: user.cin,
      notes: body.notes || undefined,
    },
  });

  // Auto-create comm log entry
  await prisma.communicationLog.create({
    data: {
      incidentId: body.incidentId,
      category: 'ESCALATION',
      message: `POI ${body.level.replace('_', ' ')} activated for incident`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ activation }, { status: 201 });
});
