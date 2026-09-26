export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { validGuestReceipt } from '@/lib/security/guestReport';
import { enforceRateLimit } from '@/lib/security/rateLimit';

export const GET = withApiHandler(async (request: Request, context?: { params?: Record<string, string> }) => {
  await enforceRateLimit('guestReceipt', request);
  const id = context?.params?.id ?? '';
  if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError(1003);
  const report = await prisma.report.findUnique({ where: { id } });
  const receipt = new URL(request.url).searchParams.get('receipt') ?? '';
  if (!report || report.source !== 'GUEST' || !validGuestReceipt(receipt, report.id, report.clientSubmissionId)) throw new AppError(1003);
  return NextResponse.json({ referenceNumber: report.referenceNumber, status: report.status, receivedAt: report.createdAt });
});
