export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const PATCH = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;

  const existing = await prisma.phaseChecklist.findUnique({ where: { id } });
  if (!existing) throw new AppError(10003);

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) data.status = body.status;
  if (body.task !== undefined) data.task = body.task;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.responsibleUnit !== undefined) data.responsibleUnit = body.responsibleUnit;
  if (body.deadline !== undefined) data.deadline = body.deadline ? new Date(body.deadline) : null;

  // Auto-stamp completion
  if (body.status === 'DONE') {
    data.completedBy = user.cin;
    data.completedAt = new Date();
  } else if (body.status && body.status !== 'DONE') {
    data.completedBy = null;
    data.completedAt = null;
  }

  const item = await prisma.phaseChecklist.update({ where: { id }, data });

  return NextResponse.json({ item });
});

export const DELETE = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;

  const existing = await prisma.phaseChecklist.findUnique({ where: { id } });
  if (!existing) throw new AppError(10003);

  await prisma.phaseChecklist.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
