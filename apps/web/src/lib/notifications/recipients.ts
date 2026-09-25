import type { NotificationChannel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import type { Locale } from './templates';
import type { NotificationEvent } from './events';

/**
 * Recipient resolution for the notifications subsystem: given a domain
 * event, work out who should be notified on which channel and with what
 * address. Nothing here sends anything — see adapters.ts / deliver.ts.
 */

export interface ResolvedRecipient {
  channel: NotificationChannel;
  /** Ably channel name, email address, or `whatsapp:+E164` address. */
  address: string;
  locale: Locale;
  targetType?: string;
  targetId?: string;
}

const DEFAULT_LOCALE: Locale = 'fr';

/** Basic E.164 check: `+` followed by 7-15 digits, no leading zero. */
export function isE164(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

function toWhatsappAddress(phone: string): string {
  return `whatsapp:${phone}`;
}

/* ------------------------------------------------------------------ */
/* Officials cache (60s)                                               */
/* ------------------------------------------------------------------ */

interface OfficialContact {
  id: string;
  phone: string | null;
  email: string | null;
}

const OFFICIALS_TTL_MS = 60_000;
let officialsCache: { data: OfficialContact[]; expiresAt: number } | null = null;

async function getOfficials(): Promise<OfficialContact[]> {
  if (officialsCache && officialsCache.expiresAt > Date.now()) {
    return officialsCache.data;
  }
  const officials = await prisma.user.findMany({
    where: { role: 'OFFICIAL' },
    select: { id: true, phone: true, email: true },
  });
  officialsCache = { data: officials, expiresAt: Date.now() + OFFICIALS_TTL_MS };
  return officials;
}

/** Test-only: clears the cached officials list so tests can control lookups. */
export function resetOfficialsCache(): void {
  officialsCache = null;
}

function officialsWhatsappRecipients(officials: OfficialContact[]): string[] {
  const numbers = new Set<string>();
  for (const official of officials) {
    if (isE164(official.phone)) numbers.add(official.phone);
  }
  if (isE164(process.env.TEST_PHONE_NUMBER)) {
    numbers.add(process.env.TEST_PHONE_NUMBER as string);
  }
  return [...numbers].map(toWhatsappAddress);
}

function officialsEmailRecipients(officials: OfficialContact[]): string[] {
  return officials.filter((o) => !!o.email).map((o) => o.email as string);
}

/* ------------------------------------------------------------------ */
/* Per-event resolvers                                                 */
/* ------------------------------------------------------------------ */

async function resolveReportSubmitted(reportId: string): Promise<ResolvedRecipient[]> {
  const officials = await getOfficials();
  const recipients: ResolvedRecipient[] = [
    { channel: 'IN_APP', address: 'ricer:officials', locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId },
  ];
  for (const email of officialsEmailRecipients(officials)) {
    recipients.push({ channel: 'EMAIL', address: email, locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId });
  }
  for (const whatsapp of officialsWhatsappRecipients(officials)) {
    recipients.push({ channel: 'WHATSAPP', address: whatsapp, locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId });
  }
  return recipients;
}

async function resolveReportStatusChanged(reportId: string, userId: string): Promise<ResolvedRecipient[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, email: true } });
  if (!user) return [];
  const recipients: ResolvedRecipient[] = [
    { channel: 'IN_APP', address: `ricer:user:${user.id}`, locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId },
  ];
  if (user.email) {
    recipients.push({ channel: 'EMAIL', address: user.email, locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId });
  }
  if (isE164(user.phone)) {
    recipients.push({ channel: 'WHATSAPP', address: toWhatsappAddress(user.phone), locale: DEFAULT_LOCALE, targetType: 'report', targetId: reportId });
  }
  return recipients;
}

async function resolveDispatchAssigned(dispatchId: string): Promise<ResolvedRecipient[]> {
  const officials = await getOfficials();
  const recipients: ResolvedRecipient[] = [
    { channel: 'IN_APP', address: 'ricer:officials', locale: DEFAULT_LOCALE, targetType: 'dispatch', targetId: dispatchId },
  ];
  for (const email of officialsEmailRecipients(officials)) {
    recipients.push({ channel: 'EMAIL', address: email, locale: DEFAULT_LOCALE, targetType: 'dispatch', targetId: dispatchId });
  }
  for (const whatsapp of officialsWhatsappRecipients(officials)) {
    recipients.push({ channel: 'WHATSAPP', address: whatsapp, locale: DEFAULT_LOCALE, targetType: 'dispatch', targetId: dispatchId });
  }
  return recipients;
}

async function resolveOfficialRequestDecided(userId: string): Promise<ResolvedRecipient[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, email: true } });
  if (!user) return [];
  const recipients: ResolvedRecipient[] = [
    { channel: 'IN_APP', address: `ricer:user:${user.id}`, locale: DEFAULT_LOCALE, targetType: 'user', targetId: userId },
  ];
  if (user.email) {
    recipients.push({ channel: 'EMAIL', address: user.email, locale: DEFAULT_LOCALE, targetType: 'user', targetId: userId });
  }
  if (isE164(user.phone)) {
    recipients.push({ channel: 'WHATSAPP', address: toWhatsappAddress(user.phone), locale: DEFAULT_LOCALE, targetType: 'user', targetId: userId });
  }
  return recipients;
}

/** Resolves the recipient list for a domain event. Never throws. */
export async function resolveRecipientsForEvent(event: NotificationEvent): Promise<ResolvedRecipient[]> {
  try {
    switch (event.type) {
      case 'report.submitted':
        return await resolveReportSubmitted(event.report.id);
      case 'report.status_changed':
        return await resolveReportStatusChanged(event.report.id, event.report.userId);
      case 'dispatch.assigned':
        return await resolveDispatchAssigned(event.dispatchId);
      case 'official_request.decided':
        return await resolveOfficialRequestDecided(event.userId);
      default: {
        const exhaustive: never = event;
        throw new Error(`Unhandled notification event: ${JSON.stringify(exhaustive)}`);
      }
    }
  } catch (error) {
    logger.error({
      event: 'notification_recipients_failed',
      meta: { type: event.type },
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    return [];
  }
}
