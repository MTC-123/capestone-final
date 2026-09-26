import type { Report, NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import { getAdapter } from './adapters';
import { buildMessage } from './templates';
import { resolveRecipientsForEvent } from './recipients';
import { deliver } from './deliver';

/**
 * Domain events that fan out to notification channels (in-app, email,
 * WhatsApp). Callers only describe what happened; channel selection,
 * recipients, retries and delivery logging live behind notifyEvent.
 */
export type NotificationEvent =
  | { type: 'report.submitted'; report: Report & { user?: { cin: string; phone: string; role: string } | null } }
  | { type: 'report.status_changed'; report: Report; previousStatus: string; actorId?: string }
  | { type: 'dispatch.assigned'; dispatchId: string; incidentId: string; unitLabel: string; etaMinutes?: number | null }
  | { type: 'official_request.decided'; userId: string; approved: boolean; note?: string | null };

/** Inline delivery gets this long before we give up waiting on it (ms). */
const INLINE_DELIVERY_TIMEOUT_MS = 4000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resolves recipients for `event`, creates a NotificationDelivery row per
 * recipient/channel (QUEUED, or SKIPPED when that channel's adapter isn't
 * configured), and fans delivery out — via QStash when configured,
 * otherwise inline with a short timeout. In-app (Ably) is always delivered
 * inline since it's cheap and latency-sensitive. Never throws.
 */
export async function notifyEvent(event: NotificationEvent): Promise<void> {
  logger.info({ event: 'notification_event', meta: { type: event.type } });

  let recipients: Awaited<ReturnType<typeof resolveRecipientsForEvent>> = [];
  try {
    recipients = await resolveRecipientsForEvent(event);
  } catch (error) {
    logger.error({
      event: 'notify_event_resolve_failed',
      meta: { type: event.type },
      error: { message: errorMessage(error) },
    });
    return;
  }

  if (!recipients.length) return;

  const inAppIds: string[] = [];
  const otherIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const adapter = getAdapter(recipient.channel);
      const configured = adapter.isConfigured();
      const message = buildMessage(event, recipient);

      const row = await prisma.notificationDelivery.create({
        data: {
          event: event.type,
          channel: recipient.channel,
          recipient: recipient.address,
          status: configured ? 'QUEUED' : 'SKIPPED',
          adapter: adapter.name,
          payload: { text: message.text, html: message.html ?? null, subject: message.subject ?? null },
          targetType: recipient.targetType,
          targetId: recipient.targetId,
        },
      });

      if (!configured) continue;

      if (recipient.channel === 'IN_APP') {
        inAppIds.push(row.id);
      } else {
        otherIds.push(row.id);
      }
    } catch (error) {
      logger.error({
        event: 'notification_delivery_create_failed',
        meta: { type: event.type, channel: recipient.channel },
        error: { message: errorMessage(error) },
      });
    }
  }

  // In-app is always delivered inline: it's just a realtime publish.
  await Promise.all(inAppIds.map((id) => safeDeliver(id)));

  if (!otherIds.length) return;

  if (process.env.QSTASH_TOKEN) {
    await Promise.all(otherIds.map((id) => safePublishToQStash(id)));
  } else {
    await Promise.all(otherIds.map((id) => safeDeliverWithTimeout(id)));
  }
}

async function safeDeliver(deliveryId: string): Promise<void> {
  try {
    await deliver(deliveryId);
  } catch (error) {
    logger.error({
      event: 'notification_inline_deliver_failed',
      meta: { deliveryId },
      error: { message: errorMessage(error) },
    });
  }
}

async function safeDeliverWithTimeout(deliveryId: string): Promise<void> {
  await Promise.race([
    safeDeliver(deliveryId),
    new Promise<void>((resolve) => setTimeout(resolve, INLINE_DELIVERY_TIMEOUT_MS)),
  ]);
}

async function safePublishToQStash(deliveryId: string): Promise<void> {
  try {
    const { Client } = await import('@upstash/qstash');
    const client = new Client({ token: process.env.QSTASH_TOKEN as string });
    const base = process.env.BASE_URL || 'http://localhost:3000';
    await client.publishJSON({
      url: `${base}/api/notifications/deliver`,
      body: { deliveryId },
      retries: 3,
    });
  } catch (error) {
    logger.error({
      event: 'notification_qstash_publish_failed',
      meta: { deliveryId },
      error: { message: errorMessage(error) },
    });
    // Fall back to inline delivery so the message isn't silently dropped.
    await safeDeliverWithTimeout(deliveryId);
  }
}

// Re-exported so callers that only import from events.ts (as before) still
// have access to the channel type used in delivery rows, if needed.
export type { NotificationChannel };
