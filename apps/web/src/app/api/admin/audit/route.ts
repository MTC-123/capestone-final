export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { requireOfficial } from '@/lib/security/guards';

/** Cursor-paginated audit trail with action/actor/target filters. OFFICIAL only. */
export const GET = withApiHandler(async (request: Request) => {
  await requireOfficial(request);
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const cursor = url.searchParams.get('cursor');
  const action = url.searchParams.get('action');
  const actor = url.searchParams.get('actor');
  const outcome = url.searchParams.get('outcome');
  const targetId = url.searchParams.get('targetId');

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action.endsWith('*') ? { startsWith: action.slice(0, -1) } : action;
  if (actor) where.actorCin = actor.toUpperCase();
  if (outcome === 'SUCCESS' || outcome === 'DENIED' || outcome === 'FAILURE') where.outcome = outcome;
  if (targetId) where.targetId = targetId;
  if (cursor && /^[a-f0-9]{24}$/.test(cursor)) where.id = { lt: cursor };

  const rows = await prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: limit + 1 });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
