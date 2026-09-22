export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Prisma } from '@prisma/client';

export const GET = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const debriefing = await prisma.debriefing.findUnique({ where: { id } });
  if (!debriefing) throw new AppError(1000, { message: 'Debriefing not found' });

  return NextResponse.json(debriefing);
});

export const PATCH = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const existing = await prisma.debriefing.findUnique({ where: { id } });
  if (!existing) throw new AppError(1000, { message: 'Debriefing not found' });

  const body = await request.json();

  const stringFields = [
    'heureDeclenchement', 'typeEssence', 'alertePrecoceDetail',
    'premiereIntervention', 'premiereInterventionDetail', 'vegetationSecondaire',
    'fonctionnaliteVPIDetail', 'incidentLutte',
    'quAvaitEtePlanifie', 'quEstCeQuiEstArrive', 'pourquoi', 'prochaineFois',
    'observationsParticulieres', 'animateurNom', 'animateurQualite', 'status',
  ] as const;

  const booleanFields = [
    'alertePrecoce', 'pistesForestieres', 'pistesAmenagees',
    'trancheesPF', 'trancheesPFAmenagees',
    'pointsEau', 'pointsEauAccessible', 'pointsEauRempli', 'pointsEauUtilise',
    'fonctionnaliteVPI',
  ] as const;

  const data: Record<string, unknown> = {};

  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.superficieIncendiee !== undefined) data.superficieIncendiee = Number(body.superficieIncendiee);

  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  for (const field of booleanFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }

  if (body.topographie !== undefined) data.topographie = body.topographie;
  if (body.participants !== undefined) data.participants = body.participants as Prisma.InputJsonValue;

  const updated = await prisma.debriefing.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
});
