import type { NotificationChannel } from '@prisma/client';
import { logger } from '@/lib/observability/logger';

/**
 * Channel adapters for the notifications subsystem. Each adapter knows how
 * to reach exactly one channel (in-app / email / WhatsApp) through exactly
 * one provider. Adapters are intentionally dumb: they don't decide who gets
 * notified or what the message says (see recipients.ts / templates.ts) —
 * they just try to deliver an already-built message and report the outcome.
 */

export interface OutgoingMessage {
  /** Ably channel name, email address, or `whatsapp:+E164` address. */
  recipient: string;
  subject?: string;
  text: string;
  html?: string;
  meta?: Record<string, unknown>;
}

export interface NotificationAdapter {
  channel: NotificationChannel;
  name: string;
  isConfigured(): boolean;
  send(msg: OutgoingMessage): Promise<{ ok: boolean; providerId?: string; error?: string }>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* ------------------------------------------------------------------ */
/* Ably (IN_APP)                                                      */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */
let ablyClient: any = null;

async function getAblyClient(): Promise<any> {
  if (!process.env.ABLY_API_KEY) return null;
  if (!ablyClient) {
    try {
      const Ably = await import('ably');
      const AblyRest = (Ably as any).default?.Rest ?? (Ably as any).Rest;
      if (AblyRest) {
        ablyClient = new AblyRest({ key: process.env.ABLY_API_KEY });
      }
    } catch {
      return null;
    }
  }
  return ablyClient;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const ablyAdapter: NotificationAdapter = {
  channel: 'IN_APP',
  name: 'ably',
  isConfigured(): boolean {
    return !!process.env.ABLY_API_KEY;
  },
  async send(msg) {
    try {
      const client = await getAblyClient();
      if (!client) return { ok: false, error: 'ably_not_configured' };
      const channel = client.channels.get(msg.recipient);
      await channel.publish('notification', {
        subject: msg.subject,
        text: msg.text,
        meta: msg.meta,
      });
      return { ok: true };
    } catch (error) {
      logger.error({ event: 'ably_send_failed', meta: { recipient: msg.recipient }, error: { message: errorMessage(error) } });
      return { ok: false, error: errorMessage(error) };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Resend (EMAIL)                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_RESEND_FROM = 'RICER Ifrane <onboarding@resend.dev>';

export const resendAdapter: NotificationAdapter = {
  channel: 'EMAIL',
  name: 'resend',
  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  },
  async send(msg) {
    if (!process.env.RESEND_API_KEY) return { ok: false, error: 'resend_not_configured' };
    try {
      const { Resend } = await import('resend');
      const client = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM || DEFAULT_RESEND_FROM;
      const { data, error } = await client.emails.send({
        from,
        to: msg.recipient,
        subject: msg.subject ?? 'RICER Ifrane',
        html: msg.html ?? `<p>${msg.text}</p>`,
        text: msg.text,
      });
      if (error) {
        return { ok: false, error: error.message ?? 'resend_error' };
      }
      return { ok: true, providerId: data?.id };
    } catch (error) {
      logger.error({ event: 'resend_send_failed', meta: { recipient: msg.recipient }, error: { message: errorMessage(error) } });
      return { ok: false, error: errorMessage(error) };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Twilio (WHATSAPP)                                                   */
/* ------------------------------------------------------------------ */

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_NUMBER
  );
}

export const twilioAdapter: NotificationAdapter = {
  channel: 'WHATSAPP',
  name: 'twilio',
  isConfigured: isTwilioConfigured,
  async send(msg) {
    if (!isTwilioConfigured()) return { ok: false, error: 'twilio_not_configured' };
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
      const result = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER!,
        to: msg.recipient,
        body: msg.text,
      });
      return { ok: true, providerId: result.sid };
    } catch (error) {
      logger.error({ event: 'twilio_send_failed', meta: { recipient: msg.recipient }, error: { message: errorMessage(error) } });
      return { ok: false, error: errorMessage(error) };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Test adapter                                                        */
/* ------------------------------------------------------------------ */

export interface TestDelivery extends OutgoingMessage {
  channel: NotificationChannel;
}

/** In-memory record of everything "sent" while NOTIFICATIONS_MODE=test / NODE_ENV=test. */
export const testOutbox: TestDelivery[] = [];

export function resetTestOutbox(): void {
  testOutbox.length = 0;
}

function makeTestAdapter(channel: NotificationChannel): NotificationAdapter {
  return {
    channel,
    name: 'test',
    isConfigured() {
      return true;
    },
    async send(msg) {
      testOutbox.push({ ...msg, channel });
      return { ok: true, providerId: `test-${testOutbox.length}` };
    },
  };
}

const testAdapters: Record<NotificationChannel, NotificationAdapter> = {
  IN_APP: makeTestAdapter('IN_APP'),
  EMAIL: makeTestAdapter('EMAIL'),
  WHATSAPP: makeTestAdapter('WHATSAPP'),
};

const realAdapters: Record<NotificationChannel, NotificationAdapter> = {
  IN_APP: ablyAdapter,
  EMAIL: resendAdapter,
  WHATSAPP: twilioAdapter,
};

export function isTestMode(): boolean {
  return process.env.NOTIFICATIONS_MODE === 'test' || process.env.NODE_ENV === 'test';
}

/** Returns the adapter that should handle a given channel, honoring test mode. */
export function getAdapter(channel: NotificationChannel): NotificationAdapter {
  return isTestMode() ? testAdapters[channel] : realAdapters[channel];
}
