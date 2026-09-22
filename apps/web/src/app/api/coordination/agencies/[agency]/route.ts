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

  const params = await (context as unknown as { params: Promise<{ agency: string }> }).params;
  const agencyKey = params.agency;
  const body = await request.json();

  const existing = await prisma.agencyStatus.findUnique({
    where: { agency: agencyKey as never },
  });
  if (!existing) throw new AppError(9000);

  const updated = await prisma.agencyStatus.update({
    where: { agency: agencyKey as never },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.unitsAvailable !== undefined && { unitsAvailable: body.unitsAvailable }),
      ...(body.unitsDeployed !== undefined && { unitsDeployed: body.unitsDeployed }),
      ...(body.aviationStatus !== undefined && { aviationStatus: body.aviationStatus }),
      ...(body.reserveStatus !== undefined && { reserveStatus: body.reserveStatus }),
      ...(body.contactName !== undefined && { contactName: body.contactName }),
      ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
      ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
      ...(body.notes !== undefined && { notes: body.notes }),
      lastHeartbeat: new Date(),
      updatedBy: user.userId,
    },
  });

  // Auto-create comm log entry for status changes
  if (body.status && body.status !== existing.status) {
    await prisma.communicationLog.create({
      data: {
        category: 'STATUS_UPDATE',
        fromAgency: agencyKey as never,
        message: `Agency ${agencyKey} status changed: ${existing.status} → ${body.status}`,
        authorId: user.userId,
        authorCin: user.cin,
      },
    });
  }

  return NextResponse.json({ agency: updated });
});
