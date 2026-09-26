import type { NotificationChannel } from '@prisma/client';
import type { NotificationEvent } from './events';

/**
 * Message builders for the notifications subsystem. One function per
 * (event type) that renders localized copy for whichever channel the
 * recipient resolves to. WhatsApp bodies are kept under 1,000 characters;
 * email bodies are simple branded HTML; everything user-supplied is
 * HTML-escaped before being interpolated.
 */

export type Locale = 'fr' | 'en' | 'ar';

export interface BuiltMessage {
  subject?: string;
  text: string;
  html?: string;
}

const BRAND_GREEN = '#166432';

function baseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

export function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function reportDeepLink(reportId: string): string {
  return `${baseUrl()}/reports-list?focus=${reportId}`;
}

export function incidentDeepLink(incidentId: string): string {
  return `${baseUrl()}/map?selected=${incidentId}`;
}

/** Escapes text before it is interpolated into HTML. */
export function escapeHtml(input: string): string {
  return String(input).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_GREEN};padding:16px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">RICER Ifrane</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="font-size:18px;margin:0 0 12px 0;color:${BRAND_GREEN};">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;">
                <span style="font-size:12px;color:#6b7280;">RICER Ifrane &mdash; Ifrane wildfire prevention and response.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* report.submitted                                                    */
/* ------------------------------------------------------------------ */

const REPORT_SUBMITTED_TEXT: Record<Locale, (ref: string, coords: string, link: string, maps: string, description: string) => string> = {
  fr: (ref, coords, link, maps, description) =>
    `ALERTE INCENDIE\nSignalement ${ref}\nPosition: ${coords}\nCarte: ${maps}\n${description}\nDetails: ${link}\nAction requise.`,
  en: (ref, coords, link, maps, description) =>
    `FIRE ALERT\nReport ${ref}\nLocation: ${coords}\nMap: ${maps}\n${description}\nDetails: ${link}\nAction required.`,
  ar: (ref, coords, link, maps, description) =>
    `تنبيه حريق\nبلاغ ${ref}\nالموقع: ${coords}\nالخريطة: ${maps}\n${description}\nالتفاصيل: ${link}\nمطلوب اتخاذ إجراء.`,
};

const REPORT_SUBMITTED_SUBJECT: Record<Locale, (ref: string) => string> = {
  fr: (ref) => `Nouveau signalement ${ref}`,
  en: (ref) => `New report ${ref}`,
  ar: (ref) => `بلاغ جديد ${ref}`,
};

interface ReportSubmittedInput {
  id: string;
  referenceNumber: string;
  latitude: number | null;
  longitude: number | null;
  locationBasis?: string | null;
  accuracyMeters?: number | null;
  locationText?: string | null;
  description: string;
}

function buildReportSubmitted(report: ReportSubmittedInput, locale: Locale): BuiltMessage {
  const ref = report.referenceNumber;
  const hasCoords = report.latitude != null && report.longitude != null;
  const coords = [report.locationBasis === 'OBSERVER' ? 'Observer position' : 'Reported fire area',
    hasCoords ? `${report.latitude!.toFixed(4)}, ${report.longitude!.toFixed(4)}${report.accuracyMeters ? ` (±${Math.round(report.accuracyMeters)} m)` : ''}` : report.locationText || 'Location to verify'].join(': ');
  const maps = hasCoords ? mapsLink(report.latitude!, report.longitude!) : '';
  const link = reportDeepLink(report.id);
  const description = truncate(report.description ?? '', 200);

  const text = REPORT_SUBMITTED_TEXT[locale](ref, coords, link, maps, description);
  const subject = REPORT_SUBMITTED_SUBJECT[locale](ref);

  const html = emailShell(
    subject,
    `<p style="margin:0 0 8px 0;"><strong>${escapeHtml(ref)}</strong></p>
     <p style="margin:0 0 8px 0;">${escapeHtml(description)}</p>
     <p style="margin:0 0 8px 0;">${escapeHtml(coords)}</p>
     ${maps ? `<p style="margin:0 0 16px 0;"><a href="${maps}" style="color:${BRAND_GREEN};">Google Maps</a></p>` : ''}
     <p style="margin:0;"><a href="${link}" style="background-color:${BRAND_GREEN};color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">RICER Ifrane</a></p>`
  );

  return { subject, text: clampWhatsapp(text), html };
}

/* ------------------------------------------------------------------ */
/* report.status_changed                                               */
/* ------------------------------------------------------------------ */

const STATUS_CHANGED_TEXT: Record<Locale, (ref: string, status: string, link: string) => string> = {
  fr: (ref, status, link) => `RICER Ifrane\nVotre signalement ${ref} est maintenant: ${status}.\nDetails: ${link}`,
  en: (ref, status, link) => `RICER Ifrane\nYour report ${ref} is now: ${status}.\nDetails: ${link}`,
  ar: (ref, status, link) => `RICER Ifrane\nبلاغك ${ref} أصبح الآن: ${status}.\nالتفاصيل: ${link}`,
};

const STATUS_CHANGED_SUBJECT: Record<Locale, (ref: string) => string> = {
  fr: (ref) => `Mise a jour du signalement ${ref}`,
  en: (ref) => `Update on report ${ref}`,
  ar: (ref) => `تحديث بشأن البلاغ ${ref}`,
};

interface ReportStatusChangedInput {
  id: string;
  referenceNumber: string;
  status: string;
}

function buildReportStatusChanged(report: ReportStatusChangedInput, locale: Locale): BuiltMessage {
  const link = reportDeepLink(report.id);
  const text = STATUS_CHANGED_TEXT[locale](report.referenceNumber, report.status, link);
  const subject = STATUS_CHANGED_SUBJECT[locale](report.referenceNumber);
  const html = emailShell(
    subject,
    `<p style="margin:0 0 8px 0;">${escapeHtml(report.referenceNumber)} &rarr; <strong>${escapeHtml(report.status)}</strong></p>
     <p style="margin:0;"><a href="${link}" style="background-color:${BRAND_GREEN};color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">RICER Ifrane</a></p>`
  );
  return { subject, text: clampWhatsapp(text), html };
}

/* ------------------------------------------------------------------ */
/* dispatch.assigned                                                    */
/* ------------------------------------------------------------------ */

const DISPATCH_ASSIGNED_TEXT: Record<Locale, (unit: string, eta: string, link: string) => string> = {
  fr: (unit, eta, link) => `RICER Ifrane\nUnite(s) affectee(s): ${unit}.${eta}\nCarte: ${link}`,
  en: (unit, eta, link) => `RICER Ifrane\nUnit(s) assigned: ${unit}.${eta}\nMap: ${link}`,
  ar: (unit, eta, link) => `RICER Ifrane\nتم تعيين الوحدة/الوحدات: ${unit}.${eta}\nالخريطة: ${link}`,
};

const DISPATCH_ASSIGNED_SUBJECT: Record<Locale, string> = {
  fr: 'Unite affectee a un incident',
  en: 'Unit assigned to an incident',
  ar: 'تم تعيين وحدة لحادث',
};

interface DispatchAssignedInput {
  incidentId: string;
  unitLabel: string;
  etaMinutes?: number | null;
}

function buildDispatchAssigned(input: DispatchAssignedInput, locale: Locale): BuiltMessage {
  const link = incidentDeepLink(input.incidentId);
  const etaText =
    typeof input.etaMinutes === 'number'
      ? locale === 'fr'
        ? ` ETA: ${input.etaMinutes} min.`
        : locale === 'ar'
          ? ` الوصول المتوقع: ${input.etaMinutes} دقيقة.`
          : ` ETA: ${input.etaMinutes} min.`
      : '';
  const text = DISPATCH_ASSIGNED_TEXT[locale](input.unitLabel, etaText, link);
  const subject = DISPATCH_ASSIGNED_SUBJECT[locale];
  const html = emailShell(
    subject,
    `<p style="margin:0 0 8px 0;">${escapeHtml(input.unitLabel)}</p>
     <p style="margin:0 0 8px 0;">${escapeHtml(etaText.trim())}</p>
     <p style="margin:0;"><a href="${link}" style="background-color:${BRAND_GREEN};color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">RICER Ifrane</a></p>`
  );
  return { subject, text: clampWhatsapp(text), html };
}

/* ------------------------------------------------------------------ */
/* official_request.decided                                            */
/* ------------------------------------------------------------------ */

const OFFICIAL_REQUEST_TEXT: Record<Locale, (approved: boolean, note: string, link: string) => string> = {
  fr: (approved, note, link) =>
    `RICER Ifrane\nVotre demande de compte officiel a ete ${approved ? 'approuvee' : 'refusee'}.${note}\n${link}`,
  en: (approved, note, link) =>
    `RICER Ifrane\nYour official account request was ${approved ? 'approved' : 'rejected'}.${note}\n${link}`,
  ar: (approved, note, link) =>
    `RICER Ifrane\nتم ${approved ? 'قبول' : 'رفض'} طلب الحساب الرسمي الخاص بك.${note}\n${link}`,
};

const OFFICIAL_REQUEST_SUBJECT: Record<Locale, (approved: boolean) => string> = {
  fr: (approved) => (approved ? 'Demande approuvee' : 'Demande refusee'),
  en: (approved) => (approved ? 'Request approved' : 'Request rejected'),
  ar: (approved) => (approved ? 'تم قبول الطلب' : 'تم رفض الطلب'),
};

interface OfficialRequestDecidedInput {
  approved: boolean;
  note?: string | null;
}

function buildOfficialRequestDecided(input: OfficialRequestDecidedInput, locale: Locale): BuiltMessage {
  const link = `${baseUrl()}/signin`;
  const note = input.note ? ` ${input.note}` : '';
  const text = OFFICIAL_REQUEST_TEXT[locale](input.approved, note, link);
  const subject = OFFICIAL_REQUEST_SUBJECT[locale](input.approved);
  const html = emailShell(
    subject,
    `<p style="margin:0 0 8px 0;">${escapeHtml(subject)}</p>
     ${input.note ? `<p style="margin:0 0 8px 0;">${escapeHtml(input.note)}</p>` : ''}
     <p style="margin:0;"><a href="${link}" style="background-color:${BRAND_GREEN};color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block;">RICER Ifrane</a></p>`
  );
  return { subject, text: clampWhatsapp(text), html };
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                             */
/* ------------------------------------------------------------------ */

export interface BuildMessageRecipient {
  channel: NotificationChannel;
  locale?: Locale;
}

const DEFAULT_LOCALE: Locale = 'fr';

/** Builds the localized message for one (event, recipient/channel) pair. */
export function buildMessage(event: NotificationEvent, recipient: BuildMessageRecipient): BuiltMessage {
  const locale = recipient.locale ?? DEFAULT_LOCALE;

  switch (event.type) {
    case 'report.submitted':
      return buildReportSubmitted(event.report, locale);
    case 'report.status_changed':
      return buildReportStatusChanged(event.report, locale);
    case 'dispatch.assigned':
      return buildDispatchAssigned(event, locale);
    case 'official_request.decided':
      return buildOfficialRequestDecided(event, locale);
    default: {
      const exhaustive: never = event;
      throw new Error(`Unhandled notification event: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength - 1)}…`;
}

const WHATSAPP_MAX_LENGTH = 1000;

function clampWhatsapp(text: string): string {
  return text.length <= WHATSAPP_MAX_LENGTH ? text : `${text.slice(0, WHATSAPP_MAX_LENGTH - 1)}…`;
}
