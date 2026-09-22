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

  const item = await prisma.retardantProduct.findUnique({ where: { id } });
  if (!item) throw new AppError(11001);

  return NextResponse.json({ item });
});

export const PATCH = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const existing = await prisma.retardantProduct.findUnique({ where: { id } });
  if (!existing) throw new AppError(11001);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string') data.name = body.name;
  if (typeof body.type === 'string') data.type = body.type;
  if (typeof body.quantity === 'number') data.quantity = body.quantity;
  if (typeof body.unit === 'string') data.unit = body.unit;
  if (typeof body.storageLocation === 'string') data.storageLocation = body.storageLocation;
  if (typeof body.storageLat === 'number') data.storageLat = body.storageLat;
  if (body.storageLat === null) data.storageLat = null;
  if (typeof body.storageLng === 'number') data.storageLng = body.storageLng;
  if (body.storageLng === null) data.storageLng = null;
  if (typeof body.expiryDate === 'string') data.expiryDate = new Date(body.expiryDate);
  if (body.expiryDate === null) data.expiryDate = null;
  if (typeof body.acquisitionDate === 'string') data.acquisitionDate = new Date(body.acquisitionDate);
  if (typeof body.notes === 'string') data.notes = body.notes;
  if (body.notes === null) data.notes = null;

  const item = await prisma.retardantProduct.update({ where: { id }, data });

  return NextResponse.json({ item });
});

export const DELETE = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const existing = await prisma.retardantProduct.findUnique({ where: { id } });
  if (!existing) throw new AppError(11001);

  await prisma.retardantProduct.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
