import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildMessage, escapeHtml, mapsLink, reportDeepLink } from '@/lib/notifications/templates';
import type { NotificationEvent } from '@/lib/notifications/events';

describe('notification templates', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'http://localhost:3000' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('escapeHtml', () => {
    it('escapes the five reserved HTML characters', () => {
      expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
        '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;'
      );
    });
  });

  describe('report.submitted', () => {
    const report = {
      id: 'report-1',
      referenceNumber: 'RPT-20260421-ABCD',
      latitude: 33.55,
      longitude: -5.06,
      description: '<img src=x onerror=alert(1)>Smoke near the cedar trail',
    };

    const event: NotificationEvent = { type: 'report.submitted', report: report as never };

    it('includes the reference number, coordinates, a maps link, and the deep link', () => {
      const message = buildMessage(event, { channel: 'WHATSAPP' });
      expect(message.text).toContain(report.referenceNumber);
      expect(message.text).toContain('33.5500');
      expect(message.text).toContain('-5.0600');
      expect(message.text).toContain(mapsLink(report.latitude, report.longitude));
      expect(message.text).toContain(reportDeepLink(report.id));
    });

    it('keeps the WhatsApp body under 1000 characters even with a long description', () => {
      const longReport = { ...report, description: 'x'.repeat(5000) };
      const message = buildMessage({ type: 'report.submitted', report: longReport as never }, { channel: 'WHATSAPP' });
      expect(message.text.length).toBeLessThanOrEqual(1000);
    });

    it('escapes user-supplied content in the email HTML', () => {
      const message = buildMessage(event, { channel: 'EMAIL' });
      expect(message.html).toBeDefined();
      expect(message.html).not.toContain('<img src=x onerror=alert(1)>');
      expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(message.html).toContain(report.referenceNumber);
    });

    it('defaults to French copy', () => {
      const message = buildMessage(event, { channel: 'WHATSAPP' });
      expect(message.text).toContain('ALERTE INCENDIE');
    });

    it('supports English and Arabic locales', () => {
      const en = buildMessage(event, { channel: 'WHATSAPP', locale: 'en' });
      expect(en.text).toContain('FIRE ALERT');
      const ar = buildMessage(event, { channel: 'WHATSAPP', locale: 'ar' });
      expect(ar.text).toContain('تنبيه حريق');
    });
  });

  describe('report.status_changed', () => {
    it('includes the reference number and the deep link', () => {
      const event: NotificationEvent = {
        type: 'report.status_changed',
        report: { id: 'report-2', referenceNumber: 'RPT-20260421-EFGH', status: 'IN_PROGRESS' } as never,
        previousStatus: 'PENDING',
      };
      const message = buildMessage(event, { channel: 'EMAIL' });
      expect(message.text).toContain('RPT-20260421-EFGH');
      expect(message.text).toContain('IN_PROGRESS');
      expect(message.text).toContain(reportDeepLink('report-2'));
    });
  });

  describe('dispatch.assigned', () => {
    it('mentions the unit label and ETA', () => {
      const event: NotificationEvent = {
        type: 'dispatch.assigned',
        dispatchId: 'dispatch-1',
        incidentId: 'incident-1',
        unitLabel: 'Team Alpha',
        etaMinutes: 12,
      };
      const message = buildMessage(event, { channel: 'WHATSAPP' });
      expect(message.text).toContain('Team Alpha');
      expect(message.text).toContain('12');
    });
  });

  describe('official_request.decided', () => {
    it('reflects approval and escapes the note', () => {
      const event: NotificationEvent = {
        type: 'official_request.decided',
        userId: 'user-1',
        approved: true,
        note: '<b>congrats</b>',
      };
      const message = buildMessage(event, { channel: 'EMAIL' });
      expect(message.html).not.toContain('<b>congrats</b>');
      expect(message.html).toContain('&lt;b&gt;congrats&lt;/b&gt;');
    });

    it('reflects rejection', () => {
      const event: NotificationEvent = { type: 'official_request.decided', userId: 'user-1', approved: false };
      const message = buildMessage(event, { channel: 'WHATSAPP', locale: 'en' });
      expect(message.text).toContain('rejected');
    });
  });
});
