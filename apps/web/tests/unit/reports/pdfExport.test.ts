import { describe, expect, it } from 'vitest';
import {
  buildReportPdfAsciiFilename,
  buildReportPdfContentDisposition,
  buildReportPdfFilename,
  generateReportPdf,
  normalizeReportPdfLanguage,
} from '@/lib/reports/pdfExport';

const report = {
  id: '65f000000000000000000001',
  userId: 'user-1',
  latitude: 33.531,
  longitude: -5.105,
  description: 'Smoke visible from the road near the forest.',
  images: [],
  status: 'PENDING' as const,
  cause: 'CIGARETTE',
  anonymous: false,
  contactPhone: '+212600000000',
  characteristics: {
    fireSize: 'medium',
    smokeLevel: 'moderate',
    fireType: 'surface',
    windCondition: 'light',
    nearbyThreats: ['forest', 'roads'],
  },
  referenceNumber: 'RPT-20260421-ABCD',
  createdAt: '2026-04-21T12:00:00.000Z',
  user: {
    cin: 'CIV123',
    phone: '+212600000001',
    role: 'CIVILIAN',
  },
};

describe('generateReportPdf', () => {
  it.each(['ar', 'fr', 'en'] as const)('creates a valid %s PDF', (language) => {
    const pdf = generateReportPdf(report, language);
    const header = Buffer.from(pdf).subarray(0, 4).toString('latin1');
    expect(header).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('defaults invalid language input to French', () => {
    expect(normalizeReportPdfLanguage('xx')).toBe('fr');
  });

  it('builds translated filenames with safe ASCII fallbacks', () => {
    expect(buildReportPdfFilename(report, 'ar')).toBe('بلاغ-RPT-20260421-ABCD-ar.pdf');
    expect(buildReportPdfFilename(report, 'fr')).toBe('signalement-RPT-20260421-ABCD-fr.pdf');
    expect(buildReportPdfFilename(report, 'en')).toBe('report-RPT-20260421-ABCD-en.pdf');
    expect(buildReportPdfAsciiFilename(report, 'ar')).toBe('report-RPT-20260421-ABCD-ar.pdf');

    const disposition = buildReportPdfContentDisposition(report, 'ar');
    expect(disposition).toContain('filename="report-RPT-20260421-ABCD-ar.pdf"');
    expect(disposition).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1])).toBe(
      'بلاغ-RPT-20260421-ABCD-ar.pdf'
    );
  });
});
