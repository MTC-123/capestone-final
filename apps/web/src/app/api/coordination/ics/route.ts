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
  const incidentId = url.searchParams.get('incidentId');
  if (!incidentId) throw new AppError(1001);

  const assignments = await prisma.iCSAssignment.findMany({
    where: { incidentId, relievedAt: null },
    orderBy: { assignedAt: 'desc' },
  });

  return NextResponse.json({ assignments });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  if (!body.incidentId || !body.role || !body.assigneeName) throw new AppError(1001);

  // Relieve current holder if occupied
  await prisma.iCSAssignment.updateMany({
    where: { incidentId: body.incidentId, role: body.role, relievedAt: null },
    data: { relievedAt: new Date() },
  });

  const assignment = await prisma.iCSAssignment.create({
    data: {
      incidentId: body.incidentId,
      role: body.role,
      assigneeName: body.assigneeName,
      assigneeAgency: body.assigneeAgency || undefined,
      assigneePhone: body.assigneePhone || undefined,
      assignedBy: user.cin,
      notes: body.notes || undefined,
    },
  });

  // Auto-create comm log
  await prisma.communicationLog.create({
    data: {
      incidentId: body.incidentId,
      category: 'ORDER_GIVEN',
      message: `${body.assigneeName} assigned as ${body.role.replace(/_/g, ' ')}`,
      authorId: user.userId,
      authorCin: user.cin,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
});
