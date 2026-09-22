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
  const incidentId = url.searchParams.get('incidentId') || undefined;
  const status = url.searchParams.get('status') || undefined;

  const where: Record<string, unknown> = {};
  if (incidentId) where.incidentId = incidentId;
  if (status) where.status = status;

  const requests = await prisma.mutualAidRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  if (!body.incidentId || !body.targetProvince || !body.resourceType || !body.justification) {
    throw new AppError(1001);
  }

  const req = await prisma.mutualAidRequest.create({
    data: {
      incidentId: body.incidentId,
      requestingProvince: body.requestingProvince || 'Ifrane',
      targetProvince: body.targetProvince,
      resourceType: body.resourceType,
      justification: body.justification,
      requestedBy: user.cin,
    },
  });

  // Auto-create comm log
  await prisma.communicationLog.create({
    data: {
      incidentId: body.incidentId,
      category: 'MUTUAL_AID',
      message: `Mutual aid requested from ${body.targetProvince}: ${body.resourceType}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ request: req }, { status: 201 });
});
