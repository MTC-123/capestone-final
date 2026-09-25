import type { TranslationKey } from '@/i18n/translations';

/**
 * Masks a phone number, keeping a short recognisable prefix and suffix.
 * e.g. "+212600000678" -> "+2126•••••678"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const value = phone.trim();
  if (value.length <= 8) return value;
  const prefix = value.slice(0, 5);
  const suffix = value.slice(-3);
  return `${prefix}•••••${suffix}`;
}

/**
 * Masks an email address, keeping the first character of the local part
 * and the full domain. e.g. "jsmith@mail.com" -> "j•••@mail.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const value = email.trim();
  const at = value.indexOf('@');
  if (at <= 0) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return `${local[0]}•••@${domain}`;
}

/** Masks a recipient string based on whether it looks like a phone number or an email. */
export function maskRecipient(recipient: string | null | undefined): string {
  if (!recipient) return '—';
  if (recipient.includes('@')) return maskEmail(recipient);
  return maskPhone(recipient);
}

/**
 * Escapes a single CSV field per RFC 4180: wraps in quotes whenever the
 * value contains a comma, quote or newline, doubling any embedded quotes.
 */
export function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a CSV document (with header row and a UTF-8 BOM for Excel/Arabic support). */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  return `﻿${lines.join('\r\n')}`;
}

/** Human-readable label keys for known audit action prefixes/exact actions. */
const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  'auth.signin': 'auditActionAuthSignin',
  'auth.signin_failed': 'auditActionAuthSigninFailed',
  'auth.locked': 'auditActionAuthLocked',
  'auth.signup': 'auditActionAuthSignup',
  'auth.logout': 'auditActionAuthLogout',
  'official_request.create': 'auditActionOfficialRequestCreate',
  'official_request.approve': 'auditActionOfficialRequestApprove',
  'official_request.reject': 'auditActionOfficialRequestReject',
  'report.create': 'auditActionReportCreate',
  'report.status_change': 'auditActionReportStatusChange',
  'incident.create': 'auditActionIncidentCreate',
  'incident.update': 'auditActionIncidentUpdate',
  'dispatch.assign': 'auditActionDispatchAssign',
  'dispatch.assign_conflict': 'auditActionDispatchAssignConflict',
  'dispatch.status_change': 'auditActionDispatchStatusChange',
  'fire_record.verify': 'auditActionFireRecordVerify',
  'fire_record.approve': 'auditActionFireRecordApprove',
  'fire_record.lock': 'auditActionFireRecordLock',
  'upload.create': 'auditActionUploadCreate',
  'upload.rejected': 'auditActionUploadRejected',
};

/**
 * Returns a localized human label for a raw audit action string, falling
 * back to the raw string (title-cased) when no mapping exists.
 */
export function getActionLabel(action: string, t: (key: TranslationKey) => string): string {
  const key = ACTION_LABEL_KEYS[action];
  if (key) return t(key);
  return action;
}

const RTF_LOCALE: Record<string, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' };

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

/** Formats a date as a relative-time string ("3 hours ago") in the given language. */
export function formatRelativeTime(date: Date | string, language: string, now: Date = new Date()): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return '—';
  let duration = (target.getTime() - now.getTime()) / 1000;

  const rtf = new Intl.RelativeTimeFormat(RTF_LOCALE[language] ?? 'en-US', { numeric: 'auto' });
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), 'years');
}

const DATE_LOCALE: Record<string, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' };

/** Formats a date for display in the local timezone, in the given language. */
export function formatLocalDateTime(date: Date | string, language: string): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return '—';
  return target.toLocaleString(DATE_LOCALE[language] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
