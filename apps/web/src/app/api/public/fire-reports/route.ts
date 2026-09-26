export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { parseJsonBody } from '@/lib/validation/parse';
import { guestReportSchema } from '@/lib/validation/guestReport';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { guestReceipt, requireGuestToken } from '@/lib/security/guestReport';
import { notifyEvent } from '@/lib/notifications/events';
import { audit } from '@/lib/audit/log';

export const POST = withApiHandler(async (request: Request) => {
  await enforceRateLimit('guestReport', request);
  const input = await parseJsonBody(request, guestReportSchema);
  await requireGuestToken(request, input.clientSubmissionId);

  const responseFor = (report: { id: string; clientSubmissionId: string; referenceNumber: string }) => ({
    report: { id: report.id },
    referenceNumber: report.referenceNumber,
    receipt: guestReceipt(report.id, report.clientSubmissionId),
  });
  const existing = await prisma.report.findUnique({ where: { clientSubmissionId: input.clientSubmissionId } });
  if (existing) {
    if (existing.source !== 'GUEST') throw new AppError(3001);
    return NextResponse.json({ ...responseFor(existing), duplicate: true });
  }

  const uploadIds = input.images.map((url) => url.split('/').pop() as string);
  if (uploadIds.length) {
    const owned = await prisma.upload.count({ where: { id: { in: uploadIds }, guestSubmissionId: input.clientSubmissionId } });
    if (owned !== uploadIds.length) throw new AppError(1001, { fields: [{ field: 'images', code: 'invalid_photo' }] });
  }

  let report;
  try {
    report = await prisma.report.create({
      data: {
        clientSubmissionId: input.clientSubmissionId,
        referenceNumber: `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        source: 'GUEST', observation: input.observation, locationBasis: input.locationBasis,
        locationText: input.locationText, latitude: input.latitude, longitude: input.longitude, accuracyMeters: input.accuracyMeters,
        capturedAt: input.capturedAt, description: input.description,
        contactPhone: input.contactPhone, images: input.images, anonymous: true, status: 'PENDING',
      },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      const winner = await prisma.report.findUnique({ where: { clientSubmissionId: input.clientSubmissionId } });
      if (winner?.source === 'GUEST') return NextResponse.json({ ...responseFor(winner), duplicate: true });
    }
    throw error;
  }
  await audit({ action: 'report.create', targetType: 'report', targetId: report.id, meta: { source: 'GUEST' }, request });
  await notifyEvent({ type: 'report.submitted', report });
  return NextResponse.json({ ...responseFor(report), duplicate: false }, { status: 201 });
});
