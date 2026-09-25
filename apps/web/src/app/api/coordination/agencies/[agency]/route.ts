export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/validation/parse';

const AGENCIES = ['DEF', 'PROTECTION_CIVILE', 'GENDARMERIE_ROYALE', 'FORCES_AUXILIAIRES', 'FORCES_ROYALES_AIR', 'FAR', 'AUTORITES_LOCALES'] as const;
const text = z.string().trim().max(500).nullable().optional();
const AgencyUpdate = z
  .object({
    status: z.enum(['ONLINE', 'OFFLINE', 'STANDBY']).optional(),
    unitsAvailable: z.number().int().min(0).max(10_000).optional(),
    unitsDeployed: z.number().int().min(0).max(10_000).optional(),
    aviationStatus: text,
    reserveStatus: text,
    contactName: text,
    contactPhone: text,
    contactEmail: z.string().trim().email().max(254).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const PATCH = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ agency: string }> }).params;
  if (!(AGENCIES as readonly string[]).includes(params.agency)) throw new AppError(9000);
  const agencyKey = params.agency as (typeof AGENCIES)[number];
  const body = await parseJsonBody(request, AgencyUpdate);

  const existing = await prisma.agencyStatus.findUnique({
    where: { agency: agencyKey },
  });
  if (!existing) throw new AppError(9000);

  const updated = await prisma.agencyStatus.update({
    where: { agency: agencyKey },
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
        fromAgency: agencyKey,
        message: `Agency ${agencyKey} status changed: ${existing.status} → ${body.status}`,
        authorId: user.userId,
        authorCin: user.cin,
      },
    });
  }

  return NextResponse.json({ agency: updated });
});
