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
  const status = url.searchParams.get('status') || undefined;

  const where: Record<string, string> = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const items = await prisma.infrastructure.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
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

  const { type, name, latitude, longitude, status, capacity, capacityUnit, lastInspectionDate, notes } = body;

  const fields = [];
  if (!type || typeof type !== 'string') fields.push({ field: 'type', code: 'required' });
  if (!name || typeof name !== 'string') fields.push({ field: 'name', code: 'required' });
  if (fields.length) throw new AppError(11003, { fields });

  const item = await prisma.infrastructure.create({
    data: {
      type: type as string,
      name: name as string,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      status: typeof status === 'string' ? status : 'OPERATIONNEL',
      capacity: typeof capacity === 'number' ? capacity : undefined,
      capacityUnit: typeof capacityUnit === 'string' ? capacityUnit : undefined,
      lastInspectionDate: typeof lastInspectionDate === 'string' ? new Date(lastInspectionDate) : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
});
