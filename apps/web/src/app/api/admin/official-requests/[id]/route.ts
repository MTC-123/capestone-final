export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { unset } from '@/lib/database/unset';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { requireOfficial } from '@/lib/security/guards';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { parseJsonBody } from '@/lib/validation/parse';
import { audit } from '@/lib/audit/log';
import { notifyEvent } from '@/lib/notifications/events';

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
});

/**
 * Approve or reject a request for official access. Approval promotes the
 * account to OFFICIAL and revokes its refresh tokens so the new role takes
 * effect on the next sign-in rather than lingering in old sessions.
 */
export const PATCH = withApiHandler(async (request: Request, context?: { params?: Record<string, string> }) => {
  const reviewer = await requireOfficial(request);
  await enforceRateLimit('mutation', request, reviewer.userId);
  const id = context?.params?.id ?? '';
  if (!/^[a-f0-9]{24}$/.test(id)) throw new AppError(1003);
  const { decision, note } = await parseJsonBody(request, decisionSchema);

  const existing = await prisma.officialRequest.findUnique({ where: { id } });
  if (!existing) throw new AppError(1003);
  if (existing.userId === reviewer.userId) {
    throw new AppError(2001, { message: 'Officials cannot review their own request' });
  }

  // Conditional update: only one reviewer can decide a pending request.
  const decided = await prisma.officialRequest.updateMany({
    where: { id, status: 'PENDING' },
    data: {
      status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
  if (decided.count === 0) throw new AppError(3000, { message: 'Request already decided' });

  if (decision === 'APPROVE') {
    await prisma.user.update({
      where: { id: existing.userId },
      data: { role: 'OFFICIAL', department: existing.department, position: existing.position ?? undefined },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, ...unset('revokedAt') },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    action: decision === 'APPROVE' ? 'official_request.approve' : 'official_request.reject',
    actor: reviewer,
    targetType: 'user',
    targetId: existing.userId,
    meta: { requestId: id, department: existing.department, note },
    request,
  });
  void notifyEvent({ type: 'official_request.decided', userId: existing.userId, approved: decision === 'APPROVE', note }).catch(() => undefined);

  const updated = await prisma.officialRequest.findUnique({ where: { id } });
  return NextResponse.json({ request: updated });
});
