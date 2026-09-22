export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import {
  buildOperationPhasePdfContentDisposition,
  generateOperationPhasePdf,
  isOperationalPhase,
  normalizeOperationPdfLanguage,
  type OperationPhasePdfData,
} from '@/lib/operations/pdfExport';

export const GET = withApiHandler(async (request: Request, context) => {
  const user = await getCurrentUser(request);
  if (!user) throw new AppError(2000);
  if (user.role !== 'OFFICIAL') throw new AppError(2001);

  const params = await (context as unknown as { params: Promise<{ id: string }> }).params;
  const id = params.id;
  const url = new URL(request.url);
  const language = normalizeOperationPdfLanguage(url.searchParams.get('lang'));
  const phaseParam = url.searchParams.get('phase');

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      checklists: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!campaign) throw new AppError(10000);

  const phase = isOperationalPhase(phaseParam) ? phaseParam : campaign.activePhase;
  const pdfData: OperationPhasePdfData = {
    campaign: {
      id: campaign.id,
      year: campaign.year,
      label: campaign.label,
      status: campaign.status,
      activePhase: campaign.activePhase,
      seasonStart: campaign.seasonStart,
      seasonEnd: campaign.seasonEnd,
      notes: campaign.notes,
      createdBy: campaign.createdBy,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    },
    phase,
    generatedBy: user.cin,
    items: campaign.checklists
      .filter((item) => item.phase === phase)
      .map((item) => ({
        id: item.id,
        campaignId: item.campaignId,
        phase: item.phase,
        task: item.task,
        responsibleUnit: item.responsibleUnit,
        deadline: item.deadline,
        status: item.status,
        notes: item.notes,
        completedBy: item.completedBy,
        completedAt: item.completedAt,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
  };

  const pdf = generateOperationPhasePdf(pdfData, language);

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': buildOperationPhasePdfContentDisposition(pdfData, language),
      'Cache-Control': 'private, no-store',
    },
  });
});
