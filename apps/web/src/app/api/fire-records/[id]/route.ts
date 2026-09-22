export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withApiHandler, type ApiHandlerContext } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import type { Prisma } from '@prisma/client';
import {
  isAlertSource,
  validateAgencyArrivals,
  validateMeansEngaged,
  validateEconomicLoss,
  validateLocationDetail,
  validateCauseDetail,
  validateDamageDetail,
  validateResponseDetail,
  validateWeatherAtTime,
  validatePostFire,
  createAuditEntry,
  isSectionLocked,
} from '@/lib/fire-records/validation';

export const GET = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const record = await prisma.fireEventRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(8000);

  const incident = await prisma.incident.findUnique({ where: { id: record.incidentId } });

  return NextResponse.json({ record, incident });
});

export const PATCH = withApiHandler(async (request: Request, context?: ApiHandlerContext) => {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) throw new AppError(2000);
  if (currentUser.role !== 'OFFICIAL') throw new AppError(2001);

  const id = context?.params?.id;
  if (!id || typeof id !== 'string') throw new AppError(1000);

  const record = await prisma.fireEventRecord.findUnique({ where: { id } });
  if (!record) throw new AppError(8000);

  if (record.recordStatus === 'LOCKED') throw new AppError(8005);

  const body = await request.json();

  // Handle inline status update
  if (body.recordStatus !== undefined) {
    if (body.recordStatus === 'VERIFIED' && record.recordStatus === 'DRAFT') {
      const auditEntry = createAuditEntry(currentUser.userId, currentUser.cin, 'VERIFY');
      const currentTrail = (record.auditTrail as Prisma.JsonValue[]) || [];
      const updated = await prisma.fireEventRecord.update({
        where: { id },
        data: {
          recordStatus: 'VERIFIED',
          auditTrail: [...currentTrail, JSON.parse(JSON.stringify(auditEntry))],
        },
      });
      return NextResponse.json({ record: updated });
    }
    throw new AppError(8007);
  }

  const updateFields = Object.keys(body);

  // Check locked sections
  const lockCheck = isSectionLocked(record.lockedSections, updateFields);
  if (lockCheck.locked) {
    throw new AppError(8002, { meta: { lockedSection: lockCheck.section } });
  }

  const data: Record<string, unknown> = {};

  // Validate & build update
  if (body.alertSource !== undefined) {
    if (!isAlertSource(body.alertSource)) {
      throw new AppError(1001, { fields: [{ field: 'alertSource', code: 'invalid' }] });
    }
    data.alertSource = body.alertSource;
  }

  const dateFields = ['ignitionAt', 'alertReceivedAt', 'verifiedAt', 'firstResponseAt', 'onSceneAt', 'containedAt', 'extinguishedAt'];
  for (const field of dateFields) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? new Date(body[field]) : null;
    }
  }

  if (body.agencyArrivals !== undefined) {
    const result = validateAgencyArrivals(body.agencyArrivals);
    if (!result.valid) {
      throw new AppError(1001, { fields: [{ field: 'agencyArrivals', code: 'invalid', message: result.error }] });
    }
    data.agencyArrivals = body.agencyArrivals;
  }

  if (body.meansEngaged !== undefined) {
    const result = validateMeansEngaged(body.meansEngaged);
    if (!result.valid) {
      throw new AppError(1001, { fields: [{ field: 'meansEngaged', code: 'invalid', message: result.error }] });
    }
    data.meansEngaged = body.meansEngaged;
  }

  if (body.economicLoss !== undefined) {
    const result = validateEconomicLoss(body.economicLoss);
    if (!result.valid) {
      throw new AppError(1001, { fields: [{ field: 'economicLoss', code: 'invalid', message: result.error }] });
    }
    data.economicLoss = body.economicLoss;
  }

  // New Json field validators
  const jsonValidators: [string, (v: unknown) => { valid: boolean; error?: string }][] = [
    ['locationDetail', validateLocationDetail],
    ['causeDetail', validateCauseDetail],
    ['damageDetail', validateDamageDetail],
    ['responseDetail', validateResponseDetail],
    ['weatherAtTime', validateWeatherAtTime],
    ['postFire', validatePostFire],
  ];

  for (const [field, validator] of jsonValidators) {
    if (body[field] !== undefined) {
      if (body[field] === null) {
        data[field] = null;
      } else {
        const result = validator(body[field]);
        if (!result.valid) {
          throw new AppError(1001, { fields: [{ field, code: 'invalid', message: result.error }] });
        }
        data[field] = body[field];
      }
    }
  }

  // Audit entry
  const auditEntry = createAuditEntry(
    currentUser.userId,
    currentUser.cin,
    'UPDATE',
    undefined,
    body
  );

  // Read-modify-write for auditTrail (Json[] workaround)
  const currentTrail = (record.auditTrail as unknown[]) || [];
  data.auditTrail = [...currentTrail, auditEntry];

  const updated = await prisma.fireEventRecord.update({
    where: { id },
    data,
  });

  return NextResponse.json({ record: updated });
});
