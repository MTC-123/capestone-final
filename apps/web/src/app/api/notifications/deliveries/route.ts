export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireOfficial } from '@/lib/security/guards';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';

/**
 * GET /api/notifications/deliveries — OFFICIAL-only. Lists recent
 * NotificationDelivery rows so the demo can show per-channel status
 * (QUEUED/SENT/FAILED/SKIPPED) live.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const VALID_STATUSES = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED'] as const;
const VALID_CHANNELS = ['IN_APP', 'EMAIL', 'WHATSAPP'] as const;

export const GET = withApiHandler(async (request: Request) => {
  await requireOfficial(request);

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') ?? undefined;
  const channelParam = url.searchParams.get('channel') ?? undefined;
  const limitParam = url.searchParams.get('limit');

  if (statusParam && !VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])) {
    throw new AppError(1001, { fields: [{ field: 'status', code: 'invalid' }] });
  }
  if (channelParam && !VALID_CHANNELS.includes(channelParam as (typeof VALID_CHANNELS)[number])) {
    throw new AppError(1001, { fields: [{ field: 'channel', code: 'invalid' }] });
  }

  const parsedLimit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where: Prisma.NotificationDeliveryWhereInput = {};
  if (statusParam) where.status = statusParam as Prisma.NotificationDeliveryWhereInput['status'];
  if (channelParam) where.channel = channelParam as Prisma.NotificationDeliveryWhereInput['channel'];

  const deliveries = await prisma.notificationDelivery.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const response = NextResponse.json({ deliveries });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
