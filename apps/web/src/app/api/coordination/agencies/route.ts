export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

const ALL_AGENCIES = [
  'DEF',
  'PROTECTION_CIVILE',
  'GENDARMERIE_ROYALE',
  'FORCES_AUXILIAIRES',
  'FORCES_ROYALES_AIR',
  'FAR',
  'AUTORITES_LOCALES',
] as const;

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  let agencies = await prisma.agencyStatus.findMany({
    orderBy: { agency: 'asc' },
  });

  // Auto-seed if empty
  if (agencies.length === 0) {
    await prisma.$transaction(
      ALL_AGENCIES.map((agency) =>
        prisma.agencyStatus.create({
          data: { agency, status: 'OFFLINE', unitsAvailable: 0, unitsDeployed: 0 },
        })
      )
    );
    agencies = await prisma.agencyStatus.findMany({
      orderBy: { agency: 'asc' },
    });
  }

  return NextResponse.json({ agencies });
});
