import type { NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import { getAdapter } from './adapters';

/**
 * Delivers a single NotificationDelivery row: loads it, sends it through
 * its channel adapter, and writes back status/attempts/lastError/sentAt.
 * Called either inline (no QStash configured) or from the QStash webhook.
 */

export const MAX_DELIVERY_ATTEMPTS = 3;

type DeliveryPayload = {
  text?: string;
  html?: string;
  subject?: string;
} | null;

export interface DeliverResult {
  ok: boolean;
  error?: string;
}

export async function deliver(deliveryId: string): Promise<DeliverResult> {
  const row = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
  if (!row) {
    logger.warn({ event: 'notification_delivery_not_found', meta: { deliveryId } });
    return { ok: false, error: 'not_found' };
  }

  if (row.status === 'SENT' || row.status === 'SKIPPED') {
    return { ok: true };
  }

  if (row.attempts >= MAX_DELIVERY_ATTEMPTS) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastError: 'max_attempts_exceeded' },
    });
    return { ok: false, error: 'max_attempts_exceeded' };
  }

  const adapter = getAdapter(row.channel as NotificationChannel);
  const attempts = row.attempts + 1;

  if (!adapter.isConfigured()) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SKIPPED', attempts, lastError: 'adapter_not_configured' },
    });
    return { ok: true };
  }

  const payload = row.payload as DeliveryPayload;

  try {
    const result = await adapter.send({
      recipient: row.recipient,
      text: payload?.text ?? '',
      html: payload?.html,
      subject: payload?.subject,
    });

    if (result.ok) {
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'SENT', attempts, sentAt: new Date(), lastError: null },
      });
      return { ok: true };
    }

    const status = attempts >= MAX_DELIVERY_ATTEMPTS ? 'FAILED' : 'QUEUED';
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status, attempts, lastError: result.error ?? 'send_failed' },
    });
    return { ok: false, error: result.error ?? 'send_failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = attempts >= MAX_DELIVERY_ATTEMPTS ? 'FAILED' : 'QUEUED';
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status, attempts, lastError: message },
    });
    logger.error({
      event: 'notification_deliver_failed',
      meta: { deliveryId, attempts },
      error: { message },
    });
    return { ok: false, error: message };
  }
}
