export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Prisma } from '@prisma/client';

export const GET = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const url = new URL(request.url);
  const fireRecordId = url.searchParams.get('fireRecordId');

  if (fireRecordId) {
    const debriefing = await prisma.debriefing.findUnique({
      where: { fireRecordId },
    });
    return NextResponse.json({ data: debriefing });
  }

  const debriefings = await prisma.debriefing.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: debriefings });
});

export const POST = withApiHandler(async (request: Request) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const { fireRecordId } = body;

  if (!fireRecordId || typeof fireRecordId !== 'string') {
    throw new AppError(1000, { message: 'fireRecordId is required' });
  }

  // Verify fire record exists
  const record = await prisma.fireEventRecord.findUnique({ where: { id: fireRecordId } });
  if (!record) throw new AppError(8000);

  // Check uniqueness — one debriefing per fire record
  const existing = await prisma.debriefing.findUnique({ where: { fireRecordId } });
  if (existing) {
    throw new AppError(8001, { message: 'A debriefing already exists for this fire record' });
  }

  const {
    date,
    superficieIncendiee,
    heureDeclenchement,
    typeEssence,
    alertePrecoce,
    alertePrecoceDetail,
    premiereIntervention,
    premiereInterventionDetail,
    vegetationSecondaire,
    topographie,
    pistesForestieres,
    pistesAmenagees,
    trancheesPF,
    trancheesPFAmenagees,
    pointsEau,
    pointsEauAccessible,
    pointsEauRempli,
    pointsEauUtilise,
    fonctionnaliteVPI,
    fonctionnaliteVPIDetail,
    incidentLutte,
    quAvaitEtePlanifie,
    quEstCeQuiEstArrive,
    pourquoi,
    prochaineFois,
    observationsParticulieres,
    animateurNom,
    animateurQualite,
    participants,
    status,
  } = body;

  const debriefing = await prisma.debriefing.create({
    data: {
      fireRecordId,
      date: date ? new Date(date) : new Date(),
      superficieIncendiee: superficieIncendiee != null ? Number(superficieIncendiee) : undefined,
      heureDeclenchement: heureDeclenchement || undefined,
      typeEssence: typeEssence || undefined,
      alertePrecoce: alertePrecoce ?? undefined,
      alertePrecoceDetail: alertePrecoceDetail || undefined,
      premiereIntervention: premiereIntervention || undefined,
      premiereInterventionDetail: premiereInterventionDetail || undefined,
      vegetationSecondaire: vegetationSecondaire || undefined,
      topographie: Array.isArray(topographie) ? topographie : [],
      pistesForestieres: pistesForestieres ?? undefined,
      pistesAmenagees: pistesAmenagees ?? undefined,
      trancheesPF: trancheesPF ?? undefined,
      trancheesPFAmenagees: trancheesPFAmenagees ?? undefined,
      pointsEau: pointsEau ?? undefined,
      pointsEauAccessible: pointsEauAccessible ?? undefined,
      pointsEauRempli: pointsEauRempli ?? undefined,
      pointsEauUtilise: pointsEauUtilise ?? undefined,
      fonctionnaliteVPI: fonctionnaliteVPI ?? undefined,
      fonctionnaliteVPIDetail: fonctionnaliteVPIDetail || undefined,
      incidentLutte: incidentLutte || undefined,
      quAvaitEtePlanifie: quAvaitEtePlanifie || undefined,
      quEstCeQuiEstArrive: quEstCeQuiEstArrive || undefined,
      pourquoi: pourquoi || undefined,
      prochaineFois: prochaineFois || undefined,
      observationsParticulieres: observationsParticulieres || undefined,
      animateurNom: animateurNom || undefined,
      animateurQualite: animateurQualite || undefined,
      participants: (participants ?? []) as Prisma.InputJsonValue,
      status: status || 'draft',
    },
  });

  return NextResponse.json(debriefing, { status: 201 });
});
