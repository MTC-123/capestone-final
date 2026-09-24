/**
 * Atomic resource claims for dispatch.
 *
 * Two officials can press "assign" on the same vehicle within milliseconds.
 * Reading the status and writing it back later lets both succeed, so the
 * claim is a single conditional update: MongoDB applies `updateMany` with a
 * `status: AVAILABLE` filter atomically per document, which means exactly one
 * request sees `count === 1` and every other sees `count === 0`.
 *
 * Claims are all-or-nothing for a request: if any resource is already taken,
 * the ones this request claimed are released before the conflict is thrown.
 */

import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { logger } from '@/lib/observability/logger';

type Kind = 'vehicle' | 'team';

async function claimOne(kind: Kind, id: string, incidentId: string): Promise<boolean> {
  const where = { id, status: 'AVAILABLE' as const };
  const data = { status: 'EN_ROUTE' as const, assignedTo: incidentId };
  const result =
    kind === 'vehicle'
      ? await prisma.vehicle.updateMany({ where, data })
      : await prisma.team.updateMany({ where, data });
  return result.count === 1;
}

async function releaseOne(kind: Kind, id: string, incidentId: string): Promise<void> {
  // Only undo our own claim: the resource must still be EN_ROUTE to this incident.
  const where = { id, status: 'EN_ROUTE' as const, assignedTo: incidentId };
  const data = { status: 'AVAILABLE' as const, assignedTo: null };
  if (kind === 'vehicle') await prisma.vehicle.updateMany({ where, data });
  else await prisma.team.updateMany({ where, data });
}

async function claimAll(kind: Kind, ids: string[], incidentId: string): Promise<void> {
  const claimed: string[] = [];
  for (const id of ids) {
    if (await claimOne(kind, id, incidentId)) {
      claimed.push(id);
      continue;
    }
    await Promise.all(claimed.map((c) => releaseOne(kind, c, incidentId)));
    logger.warn({ event: 'dispatch_claim_conflict', meta: { kind, id, incidentId, released: claimed } });
    throw new AppError(kind === 'vehicle' ? 7001 : 6003, { meta: { [`${kind}Id`]: id, reason: 'claimed_by_another_request' } });
  }
}

export const claimVehicles = (ids: string[], incidentId: string) => claimAll('vehicle', ids, incidentId);
export const claimTeams = (ids: string[], incidentId: string) => claimAll('team', ids, incidentId);

export const releaseVehicles = (ids: string[], incidentId: string) =>
  Promise.all(ids.map((id) => releaseOne('vehicle', id, incidentId))).then(() => undefined);
export const releaseTeams = (ids: string[], incidentId: string) =>
  Promise.all(ids.map((id) => releaseOne('team', id, incidentId))).then(() => undefined);
