export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || undefined;

  const where: Record<string, string> = {};
  if (type) where.type = type;

  const items = await prisma.retardantProduct.findMany({
    where,
    orderBy: [{ name: 'asc' }],
  });

  return NextResponse.json({ items });
});

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError(1000, { cause: error });
  }

  const { name, type, quantity, unit, storageLocation, storageLat, storageLng, expiryDate, acquisitionDate, notes } = body;

  const fields = [];
  if (!name || typeof name !== 'string') fields.push({ field: 'name', code: 'required' });
  if (typeof quantity !== 'number') fields.push({ field: 'quantity', code: 'required' });
  if (!storageLocation || typeof storageLocation !== 'string') fields.push({ field: 'storageLocation', code: 'required' });
  if (!acquisitionDate || typeof acquisitionDate !== 'string') fields.push({ field: 'acquisitionDate', code: 'required' });
  if (fields.length) throw new AppError(11003, { fields });

  const item = await prisma.retardantProduct.create({
    data: {
      name: name as string,
      type: typeof type === 'string' ? type : 'MOUSSE',
      quantity: quantity as number,
      unit: typeof unit === 'string' ? unit : 'L',
      storageLocation: storageLocation as string,
      storageLat: typeof storageLat === 'number' ? storageLat : undefined,
      storageLng: typeof storageLng === 'number' ? storageLng : undefined,
      expiryDate: typeof expiryDate === 'string' ? new Date(expiryDate) : undefined,
      acquisitionDate: new Date(acquisitionDate as string),
      notes: typeof notes === 'string' ? notes : undefined,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
});
