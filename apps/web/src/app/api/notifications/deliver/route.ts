export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { withApiHandler } from '@/lib/errors/withApiHandler';
import { AppError } from '@/lib/errors/AppError';
import { deliver } from '@/lib/notifications/deliver';
import { logger } from '@/lib/observability/logger';

/**
 * QStash webhook: delivers one NotificationDelivery row. QStash calls this
 * with a signed request (`upstash-signature` header) after notifyEvent()
 * published a message for it. We verify the signature before doing
 * anything, then hand off to deliver(). A 5xx response tells QStash to
 * retry; a 2xx (including "nothing left to retry") tells it to stop.
 */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const POST = withApiHandler(async (request: Request) => {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    logger.error({ event: 'qstash_signing_keys_missing' });
    throw new AppError(2000, { message: 'QStash signing keys are not configured' });
  }

  const signature = request.headers.get('upstash-signature');
  const rawBody = await request.text();

  if (!signature) {
    throw new AppError(2000, { message: 'Missing upstash-signature header' });
  }

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });

  let valid = false;
  try {
    valid = await receiver.verify({ signature, body: rawBody });
  } catch (error) {
    logger.warn({ event: 'qstash_signature_invalid', error: { message: errorMessage(error) } });
    throw new AppError(2000, { message: 'Invalid QStash signature', cause: error });
  }

  if (!valid) {
    throw new AppError(2000, { message: 'Invalid QStash signature' });
  }

  let body: { deliveryId?: unknown };
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    throw new AppError(1000, { message: 'Malformed JSON body', cause: error });
  }

  const deliveryId = typeof body.deliveryId === 'string' ? body.deliveryId : undefined;
  if (!deliveryId) {
    throw new AppError(1000, { message: 'deliveryId is required' });
  }

  const result = await deliver(deliveryId);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  // Terminal outcomes (nothing found, or attempts exhausted) shouldn't be
  // retried by QStash; everything else is a transient send failure.
  const terminal = result.error === 'not_found' || result.error === 'max_attempts_exceeded';
  if (terminal) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  throw new AppError(5000, { message: `Notification delivery failed: ${result.error ?? 'unknown error'}` });
});
