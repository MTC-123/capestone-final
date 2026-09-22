export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) throw new AppError(11000);

  return NextResponse.json({ item });
});

export const PATCH = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) throw new AppError(11000);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.type === 'string') data.type = body.type;
  if (typeof body.name === 'string') data.name = body.name;
  if (typeof body.status === 'string') data.status = body.status;
  if (typeof body.quantity === 'number') data.quantity = body.quantity;
  if (typeof body.department === 'string') data.department = body.department;
  if (body.department === null) data.department = null;
  if (typeof body.latitude === 'number') data.latitude = body.latitude;
  if (body.latitude === null) data.latitude = null;
  if (typeof body.longitude === 'number') data.longitude = body.longitude;
  if (body.longitude === null) data.longitude = null;
  if (typeof body.lastMaintenance === 'string') data.lastMaintenance = new Date(body.lastMaintenance);
  if (body.lastMaintenance === null) data.lastMaintenance = null;
  if (typeof body.notes === 'string') data.notes = body.notes;
  if (body.notes === null) data.notes = null;

  const item = await prisma.equipment.update({ where: { id }, data });

  return NextResponse.json({ item });
});

export const DELETE = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) throw new AppError(11000);

  await prisma.equipment.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
