import type { Report } from '@prisma/client';
import { logger } from '@/lib/observability/logger';

/**
 * Domain events that fan out to notification channels (in-app, email,
 * WhatsApp). Callers only describe what happened; channel selection,
 * recipients, retries and delivery logging live behind notifyEvent.
 */
export type NotificationEvent =
  | { type: 'report.submitted'; report: Report & { user?: { cin: string; phone: string; role: string } } }
  | { type: 'report.status_changed'; report: Report; previousStatus: string; actorId?: string }
  | { type: 'dispatch.assigned'; dispatchId: string; incidentId: string; unitLabel: string; etaMinutes?: number | null }
  | { type: 'official_request.decided'; userId: string; approved: boolean; note?: string | null };

export async function notifyEvent(event: NotificationEvent): Promise<void> {
  logger.info({ event: 'notification_event', meta: { type: event.type } });
}
