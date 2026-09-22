export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import {
  buildReportPdfContentDisposition,
  generateReportPdf,
  normalizeReportPdfLanguage,
} from '@/lib/reports/pdfExport';

export const GET = withApiHandler(async (request: Request, context) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const id = context?.params?.id;
  if (!id) throw new AppError(1000);

  const url = new URL(request.url);
  const language = normalizeReportPdfLanguage(url.searchParams.get('lang'));

  const report = await prisma.report.findFirst({
    where: currentUser.role === 'OFFICIAL'
      ? { id }
      : { id, userId: currentUser.userId },
    include: {
      user: {
        select: {
          cin: true,
          phone: true,
          role: true,
        },
      },
    },
  });

  if (!report) throw new AppError(1003);

  const pdfData = {
    id: report.id,
    userId: report.userId,
    latitude: report.latitude,
    longitude: report.longitude,
    description: report.description,
    images: report.images,
    status: report.status,
    cause: report.cause,
    anonymous: report.anonymous,
    contactPhone: report.contactPhone,
    characteristics: report.characteristics,
    referenceNumber: report.referenceNumber,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    user: report.user,
  };
  const pdf = generateReportPdf(pdfData, language);

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': buildReportPdfContentDisposition(pdfData, language),
      'Cache-Control': 'private, no-store',
    },
  });
});
