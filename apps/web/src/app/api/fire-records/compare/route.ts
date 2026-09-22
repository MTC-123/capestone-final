export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 5) {
    throw new AppError(8010);
  }

  for (const id of ids) {
    if (typeof id !== 'string') throw new AppError(8010);
  }

  const records = await prisma.fireEventRecord.findMany({
    where: { id: { in: ids } },
  });

  if (records.length !== ids.length) {
    throw new AppError(8010, { message: 'One or more records not found' });
  }

  // Fetch associated incidents
  const incidentIds = records.map((r) => r.incidentId);
  const incidents = await prisma.incident.findMany({
    where: { id: { in: incidentIds } },
  });
  const incidentMap = new Map(incidents.map((i) => [i.id, i]));

  const enriched = records.map((r) => ({
    ...r,
    incident: incidentMap.get(r.incidentId) ?? null,
  }));

  return NextResponse.json({ records: enriched });
});
