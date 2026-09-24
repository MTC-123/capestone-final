import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import { getClientIp } from '@/lib/errors/rateLimit';
import type { AccessTokenPayload } from '@/lib/auth';

export type AuditAction =
  | 'auth.signin'
  | 'auth.signin_failed'
  | 'auth.locked'
  | 'auth.signup'
  | 'auth.logout'
  | 'official_request.create'
  | 'official_request.approve'
  | 'official_request.reject'
  | 'report.create'
  | 'report.status_change'
  | 'incident.create'
  | 'incident.update'
  | 'dispatch.assign'
  | 'dispatch.assign_conflict'
  | 'dispatch.status_change'
  | 'fire_record.verify'
  | 'fire_record.approve'
  | 'fire_record.lock'
  | 'upload.create'
  | 'upload.rejected';

export type AuditEntry = {
  action: AuditAction;
  actor?: Pick<AccessTokenPayload, 'userId' | 'cin' | 'role'> | null;
  targetType?: string;
  targetId?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
  meta?: Record<string, unknown>;
  request?: Request;
};

/**
 * Appends an audit record. Auditing must never break the action being
 * audited, so failures are logged and swallowed.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actor?.userId,
        actorCin: entry.actor?.cin,
        actorRole: entry.actor?.role,
        targetType: entry.targetType,
        targetId: entry.targetId,
        outcome: entry.outcome ?? 'SUCCESS',
        meta: entry.meta as object | undefined,
        ip: entry.request ? getClientIp(entry.request) : undefined,
        userAgent: entry.request?.headers.get('user-agent')?.slice(0, 256) ?? undefined,
      },
    });
  } catch (error) {
    logger.error({
      event: 'audit_write_failed',
      meta: { action: entry.action, targetType: entry.targetType, targetId: entry.targetId },
      error: { name: (error as Error)?.name, message: (error as Error)?.message },
    });
  }
}
