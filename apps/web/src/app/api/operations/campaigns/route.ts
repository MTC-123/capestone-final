export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { OperationalPhase } from '@prisma/client';

const DEFAULT_TASKS: Record<OperationalPhase, string[]> = {
  PREPARATION: [
    'Mettre a jour le contrat programme annuel',
    'Verifier et reparer les VPI et camions',
    'Inventorier le petit materiel de lutte (EPI, outils)',
    'Tester les moyens de communication (GSM, radio, GPS)',
    'Verifier les points d\'eau et citernes',
    'Entretenir les pistes forestieres et tranchees pare-feu',
    'Former les equipes d\'alerte et d\'intervention',
    'Organiser les reunions de coordination avec les partenaires',
  ],
  PREPOSITIONNEMENT: [
    'Consulter la carte de risque journaliere (application web)',
    'Positionner les VPI dans les massifs a haut risque',
    'Activer les postes de guet et postes avances',
    'Verifier quotidiennement l\'etat du materiel et des equipements',
    'Etablir les listes de patrouille et de permanence',
    'Verifier le taux de remplissage des points d\'eau',
  ],
  ALERTE: [
    'Confirmer le fonctionnement du reseau de surveillance',
    'Tester le circuit d\'alerte (guetteur → SF → CCDRF → DPEFLCD)',
    'Verifier la disponibilite des produits retardants',
    'Activer la surveillance satellite (FIRMS/EFFIS)',
    'Diffuser les consignes d\'alerte aux equipes de terrain',
  ],
  LUTTE: [
    'Designer le chef de l\'extinction (Homme du feu)',
    'Mettre en place la structure ICS',
    'Planifier le systeme de roulement des equipes',
    'Verifier les mesures de securite (issues de secours, EPI)',
    'Coordonner avec la Protection Civile et les FAR',
    'Activer le dispositif aerien si necessaire (PMA)',
  ],
  EXTINCTION: [
    'Evaluer l\'etat du feu (fixe → circonscrit → maitrise → eteint)',
    'Verifier les VPI et le materiel apres extinction',
    'Organiser le debriefing (Revue Apres Incendie)',
    'Mettre en place la permanence 24h post-extinction',
    'Ouvrir l\'enquete sur les causes avec la Gendarmerie',
    'Transmettre la fiche rose au HCEFLCD (delai: 14 jours)',
    'Documenter les lecons apprises',
  ],
  POST_CAMPAGNE: [
    'Synthetiser les donnees des fiches roses (bilan statistique)',
    'Organiser les reunions de debriefing de fin de campagne',
    'Evaluer les besoins en materiels et equipements',
    'Elaborer le programme de reconstitution des zones sinistrees',
    'Rediger et transmettre le rapport annuel',
    'Lancer la planification de la campagne suivante (n+1)',
  ],
};

export const GET = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const campaigns = await prisma.campaign.findMany({
    orderBy: { year: 'desc' },
  });

  return NextResponse.json({ campaigns });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const body = await request.json();
  const year = Number(body.year);
  const label = String(body.label || '').trim();

  if (!year || !label) throw new AppError(1000);

  // Check duplicate year
  const existing = await prisma.campaign.findUnique({ where: { year } });
  if (existing) throw new AppError(10001);

  // Create campaign
  const campaign = await prisma.campaign.create({
    data: {
      year,
      label,
      createdBy: user.cin,
    },
  });

  // Seed default tasks
  const checklistData: Array<{
    campaignId: string;
    phase: OperationalPhase;
    task: string;
    sortOrder: number;
  }> = [];

  for (const [phase, tasks] of Object.entries(DEFAULT_TASKS)) {
    tasks.forEach((task, index) => {
      checklistData.push({
        campaignId: campaign.id,
        phase: phase as OperationalPhase,
        task,
        sortOrder: index,
      });
    });
  }

  await prisma.phaseChecklist.createMany({ data: checklistData });

  return NextResponse.json({ campaign }, { status: 201 });
});
