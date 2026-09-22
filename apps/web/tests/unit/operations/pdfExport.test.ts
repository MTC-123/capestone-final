import { describe, expect, it } from 'vitest';
import {
  buildOperationPhasePdfAsciiFilename,
  buildOperationPhasePdfContentDisposition,
  buildOperationPhasePdfFilename,
  generateOperationPhasePdf,
  normalizeOperationPdfLanguage,
  type OperationPhasePdfData,
} from '@/lib/operations/pdfExport';

const phasePdf: OperationPhasePdfData = {
  campaign: {
    id: '65f000000000000000000010',
    year: 2026,
    label: 'Campagne 2026 Ifrane',
    status: 'ACTIVE',
    activePhase: 'LUTTE',
    notes: 'Coordination DPEFLCD / Protection Civile active.',
    createdBy: 'OFF001',
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-21T12:00:00.000Z',
  },
  phase: 'LUTTE',
  generatedBy: 'OFF001',
  items: [
    {
      id: 'task-1',
      campaignId: '65f000000000000000000010',
      phase: 'LUTTE',
      task: 'Mettre en place la structure ICS',
      responsibleUnit: 'Poste de commandement',
      deadline: '2026-04-21T14:00:00.000Z',
      status: 'DONE',
      notes: 'Commandement unifié installé au PC avancé.',
      completedBy: 'OFF001',
      completedAt: '2026-04-21T13:30:00.000Z',
      sortOrder: 0,
      createdAt: '2026-04-21T08:00:00.000Z',
    },
    {
      id: 'task-2',
      campaignId: '65f000000000000000000010',
      phase: 'LUTTE',
      task: 'Coordonner avec la Protection Civile et les FAR',
      responsibleUnit: 'Cellule opérations',
      deadline: '2026-04-21T15:00:00.000Z',
      status: 'DONE',
      completedBy: 'OFF002',
      completedAt: '2026-04-21T14:10:00.000Z',
      sortOrder: 1,
      createdAt: '2026-04-21T08:15:00.000Z',
    },
  ],
};

describe('generateOperationPhasePdf', () => {
  it.each(['ar', 'fr', 'en'] as const)('creates a valid %s PDF', (language) => {
    const pdf = generateOperationPhasePdf(phasePdf, language);
    const header = Buffer.from(pdf).subarray(0, 4).toString('latin1');
    expect(header).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('defaults invalid language input to French', () => {
    expect(normalizeOperationPdfLanguage('xx')).toBe('fr');
  });

  it('builds translated filenames with ASCII fallbacks', () => {
    expect(buildOperationPhasePdfFilename(phasePdf, 'ar')).toBe(
      'مرحلة-تشغيلية-Campagne-2026-Ifrane-lutte-ar.pdf'
    );
    expect(buildOperationPhasePdfFilename(phasePdf, 'fr')).toBe(
      'phase-operationnelle-Campagne-2026-Ifrane-lutte-fr.pdf'
    );
    expect(buildOperationPhasePdfFilename(phasePdf, 'en')).toBe(
      'operational-phase-Campagne-2026-Ifrane-lutte-en.pdf'
    );
    expect(buildOperationPhasePdfAsciiFilename(phasePdf, 'ar')).toBe(
      'operational-phase-Campagne-2026-Ifrane-lutte-ar.pdf'
    );

    const disposition = buildOperationPhasePdfContentDisposition(phasePdf, 'ar');
    expect(disposition).toContain('filename="operational-phase-Campagne-2026-Ifrane-lutte-ar.pdf"');
    expect(disposition).toContain("filename*=UTF-8''");
  });
});
