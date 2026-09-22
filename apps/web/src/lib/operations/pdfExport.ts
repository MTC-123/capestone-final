import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { translations, type TranslationKey } from '@/i18n/translations';
import type { CampaignStatus, ChecklistItemStatus, OperationalPhase } from '@/types/operations';

export const OPERATION_PDF_LANGUAGES = ['ar', 'fr', 'en'] as const;
export type OperationPdfLanguage = (typeof OPERATION_PDF_LANGUAGES)[number];

export interface OperationPhasePdfCampaign {
  id: string;
  year: number;
  label: string;
  status: CampaignStatus;
  activePhase: OperationalPhase;
  seasonStart?: string | Date | null;
  seasonEnd?: string | Date | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OperationPhasePdfItem {
  id: string;
  campaignId: string;
  phase: OperationalPhase;
  task: string;
  responsibleUnit?: string | null;
  deadline?: string | Date | null;
  status: ChecklistItemStatus;
  notes?: string | null;
  completedBy?: string | null;
  completedAt?: string | Date | null;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface OperationPhasePdfData {
  campaign: OperationPhasePdfCampaign;
  phase: OperationalPhase;
  items: OperationPhasePdfItem[];
  generatedBy?: string | null;
}

const FONT_FILE = 'NotoSansArabic-Regular.ttf';
const FONT_NAME = 'NotoSansArabic';

const PHASE_ORDER: OperationalPhase[] = [
  'PREPARATION',
  'PREPOSITIONNEMENT',
  'ALERTE',
  'LUTTE',
  'EXTINCTION',
  'POST_CAMPAGNE',
];

const PHASE_KEYS: Record<OperationalPhase, TranslationKey> = {
  PREPARATION: 'phasePreparation',
  PREPOSITIONNEMENT: 'phasePrepositionnement',
  ALERTE: 'phaseAlerte',
  LUTTE: 'phaseLutte',
  EXTINCTION: 'phaseExtinction',
  POST_CAMPAGNE: 'phasePostCampagne',
};

const CAMPAIGN_STATUS_KEYS: Record<CampaignStatus, TranslationKey> = {
  PLANNING: 'campaignPlanning',
  ACTIVE: 'campaignActive',
  CLOSED: 'campaignClosed',
};

const CHECKLIST_STATUS_KEYS: Record<ChecklistItemStatus, TranslationKey> = {
  PENDING: 'checklistStatusPending',
  IN_PROGRESS: 'checklistStatusInProgress',
  DONE: 'checklistStatusDone',
  BLOCKED: 'checklistStatusBlocked',
};

const FILE_BASES: Record<OperationPdfLanguage, string> = {
  ar: 'مرحلة-تشغيلية',
  fr: 'phase-operationnelle',
  en: 'operational-phase',
};

const ASCII_FILE_BASES: Record<OperationPdfLanguage, string> = {
  ar: 'operational-phase',
  fr: 'phase-operationnelle',
  en: 'operational-phase',
};

const ARABIC_TEXT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function isOperationalPhase(value: string | null | undefined): value is OperationalPhase {
  return PHASE_ORDER.includes(value as OperationalPhase);
}

function isOperationPdfLanguage(value: string | null | undefined): value is OperationPdfLanguage {
  return value === 'ar' || value === 'fr' || value === 'en';
}

export function normalizeOperationPdfLanguage(value: string | null | undefined): OperationPdfLanguage {
  return isOperationPdfLanguage(value) ? value : 'fr';
}

function t(language: OperationPdfLanguage, key: TranslationKey): string {
  return translations[language][key] ?? translations.fr[key] ?? translations.en[key] ?? key;
}

function registerArabicFont(doc: jsPDF): boolean {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', FONT_FILE);
  if (!existsSync(fontPath)) return false;
  const font = readFileSync(fontPath).toString('base64');
  doc.addFileToVFS(FONT_FILE, font);
  doc.addFont(FONT_FILE, FONT_NAME, 'normal');
  return true;
}

function localeFor(language: OperationPdfLanguage): string {
  if (language === 'ar') return 'ar-MA';
  if (language === 'fr') return 'fr-FR';
  return 'en-US';
}

function formatDate(value: string | Date | null | undefined, language: OperationPdfLanguage): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(value: string | Date | null | undefined, language: OperationPdfLanguage): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function containsArabicText(value: string): boolean {
  return ARABIC_TEXT_PATTERN.test(value);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function asciiFilenamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function phaseReference(data: OperationPhasePdfData): string {
  return `${data.campaign.year}-${data.phase}`;
}

export function buildOperationPhasePdfFilename(
  data: OperationPhasePdfData,
  language: OperationPdfLanguage
): string {
  const phase = sanitizeFilenamePart(data.phase.toLowerCase());
  const label = sanitizeFilenamePart(data.campaign.label) || String(data.campaign.year);
  return `${FILE_BASES[language]}-${label}-${phase}-${language}.pdf`;
}

export function buildOperationPhasePdfAsciiFilename(
  data: OperationPhasePdfData,
  language: OperationPdfLanguage
): string {
  const phase = asciiFilenamePart(data.phase.toLowerCase());
  const label = asciiFilenamePart(data.campaign.label) || String(data.campaign.year);
  return `${ASCII_FILE_BASES[language]}-${label}-${phase}-${language}.pdf`;
}

export function buildOperationPhasePdfContentDisposition(
  data: OperationPhasePdfData,
  language: OperationPdfLanguage
): string {
  const filename = buildOperationPhasePdfFilename(data, language);
  const fallback = buildOperationPhasePdfAsciiFilename(data, language);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function generateOperationPhasePdf(
  data: OperationPhasePdfData,
  languageInput: string | null | undefined
): ArrayBuffer {
  const language = normalizeOperationPdfLanguage(languageInput);
  const rtl = language === 'ar';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const hasUnicodeFont = registerArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const left = margin;
  const right = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;
  const textX = rtl ? right : left;
  const align = rtl ? 'right' as const : 'left' as const;
  let y = 52;

  const sortedItems = [...data.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = sortedItems.filter((item) => item.status === 'DONE').length;
  const total = sortedItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const setBodyFont = (bold = false, forceUnicode = false) => {
    if (forceUnicode && hasUnicodeFont) {
      doc.setFont(FONT_NAME, 'normal');
      return;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  };

  const prepare = (value: string) => {
    if (containsArabicText(value) && hasUnicodeFont) return doc.processArabic(value);
    return value;
  };

  const drawHeader = () => {
    doc.setFillColor(12, 22, 38);
    doc.rect(0, 0, pageWidth, 42, 'F');
    doc.setFillColor(34, 197, 94);
    doc.rect(rtl ? pageWidth - 5 : 0, 0, 5, 42, 'F');
    doc.setTextColor(255, 255, 255);
    setBodyFont(true, rtl);
    doc.setFontSize(17);
    doc.text(prepare(t(language, 'operationPdfTitle')), textX, 17, { align });
    setBodyFont(false, rtl);
    doc.setFontSize(9);
    doc.text(prepare(t(language, 'operationPdfSubtitle')), textX, 26, { align });
    doc.setTextColor(188, 198, 211);
    if (rtl) {
      doc.text(prepare(`${t(language, 'operationPdfReference')}:`), textX, 34, { align });
      setBodyFont(false);
      doc.text(phaseReference(data), textX - 34, 34, { align });
      return;
    }
    doc.text(`${t(language, 'operationPdfReference')}: ${phaseReference(data)}`, textX, 34, { align });
  };

  const drawFooter = () => {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(222, 226, 232);
      doc.line(left, pageHeight - 14, right, pageHeight - 14);
      setBodyFont(false, rtl);
      doc.setFontSize(7.5);
      doc.setTextColor(108, 117, 125);
      const footer = `${t(language, 'operationPdfGeneratedAt')}: ${formatDate(new Date(), language)}`;
      doc.text(prepare(footer), textX, pageHeight - 8, { align });
      doc.text(String(page), rtl ? left : right, pageHeight - 8, { align: rtl ? 'left' : 'right' });
    }
  };

  const ensureSpace = (height = 16) => {
    if (y + height < pageHeight - 20) return;
    doc.addPage();
    drawHeader();
    y = 52;
  };

  const drawText = (
    text: string,
    x: number,
    yy: number,
    options: { size?: number; color?: [number, number, number]; bold?: boolean; maxWidth?: number; align?: 'left' | 'right' | 'center' } = {}
  ) => {
    doc.setFontSize(options.size ?? 9);
    doc.setTextColor(...(options.color ?? [12, 22, 38]));
    setBodyFont(options.bold ?? false, containsArabicText(text));
    const prepared = prepare(text);
    const lines = options.maxWidth ? doc.splitTextToSize(prepared, options.maxWidth) : [prepared];
    doc.text(lines, x, yy, { align: options.align ?? align });
    return lines.length;
  };

  const drawSection = (titleKey: TranslationKey) => {
    ensureSpace(18);
    y += 4;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(left, y - 4, contentWidth, 10, 2, 2, 'F');
    drawText(t(language, titleKey), textX, y + 2.5, {
      size: 10,
      color: [22, 101, 52],
      bold: true,
      align,
    });
    y += 13;
  };

  const drawMeta = (labelKey: TranslationKey, value: string) => {
    const label = `${t(language, labelKey)}:`;
    const xLabel = rtl ? right : left;
    const xValue = rtl ? right - 58 : left + 58;
    drawText(label, xLabel, y, { size: 8, color: [100, 116, 139], bold: true, align });
    drawText(value || '-', xValue, y, {
      size: 8.5,
      color: [15, 23, 42],
      maxWidth: contentWidth - 62,
      align,
    });
    y += 7;
  };

  const drawMetric = (x: number, width: number, label: string, value: string, tone: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, width, 22, 3, 3, 'FD');
    doc.setFillColor(...tone);
    doc.roundedRect(rtl ? x + width - 3 : x, y, 3, 22, 2, 2, 'F');
    drawText(value, rtl ? x + width - 7 : x + 7, y + 9, {
      size: 12,
      color: [15, 23, 42],
      bold: true,
      align: rtl ? 'right' : 'left',
      maxWidth: width - 14,
    });
    drawText(label, rtl ? x + width - 7 : x + 7, y + 17, {
      size: 7.5,
      color: [100, 116, 139],
      align: rtl ? 'right' : 'left',
      maxWidth: width - 14,
    });
  };

  const drawTask = (item: OperationPhasePdfItem, index: number) => {
    const taskLines = doc.splitTextToSize(prepare(item.task), contentWidth - 34);
    const notesLines = item.notes ? doc.splitTextToSize(prepare(item.notes), contentWidth - 34) : [];
    const rtlMetaHeight = rtl ? 20 + (item.notes ? 7 : 0) : 0;
    const ltrMetaHeight = rtl ? 0 : 7 + notesLines.length * 4.2;
    const rowHeight = Math.max(25, 18 + taskLines.length * 4.7 + rtlMetaHeight + ltrMetaHeight);
    ensureSpace(rowHeight + 5);

    doc.setFillColor(item.status === 'DONE' ? 249 : 255, item.status === 'DONE' ? 253 : 251, item.status === 'DONE' ? 251 : 235);
    doc.setDrawColor(item.status === 'DONE' ? 187 : 253, item.status === 'DONE' ? 247 : 186, item.status === 'DONE' ? 208 : 116);
    doc.roundedRect(left, y, contentWidth, rowHeight, 2.5, 2.5, 'FD');

    const badgeWidth = 26;
    const badgeX = rtl ? left + 6 : right - badgeWidth - 6;
    doc.setFillColor(item.status === 'DONE' ? 22 : 245, item.status === 'DONE' ? 163 : 158, item.status === 'DONE' ? 74 : 11);
    doc.roundedRect(badgeX, y + 5, badgeWidth, 7, 2, 2, 'F');
    drawText(t(language, CHECKLIST_STATUS_KEYS[item.status]), badgeX + badgeWidth / 2, y + 9.8, {
      size: 6.5,
      color: [255, 255, 255],
      align: 'center',
    });

    const numberX = rtl ? right - 8 : left + 8;
    doc.setFillColor(15, 23, 42);
    doc.circle(numberX, y + 9, 4, 'F');
    drawText(String(index + 1), numberX, y + 10.4, {
      size: 6.5,
      color: [255, 255, 255],
      align: 'center',
    });

    const taskX = rtl ? right - 17 : left + 17;
    drawText(item.task, taskX, y + 9, {
      size: 9.2,
      color: [15, 23, 42],
      bold: true,
      maxWidth: contentWidth - 48,
      align,
    });

    const metaY = y + 13 + taskLines.length * 4.7;

    if (rtl) {
      const pairs: Array<[TranslationKey, string]> = [
        ['operationPdfResponsibleUnit', item.responsibleUnit || '-'],
        ['operationPdfDeadline', formatShortDate(item.deadline, language)],
        ['operationPdfCompletedBy', item.completedBy || '-'],
        ['operationPdfCompletedAt', formatDate(item.completedAt, language)],
      ];
      let lineY = metaY;
      for (const [key, value] of pairs) {
        drawText(`${t(language, key)}:`, taskX, lineY, {
          size: 7.3,
          color: [100, 116, 139],
          align,
        });
        drawText(value, taskX - 44, lineY, {
          size: 7.3,
          color: [71, 85, 105],
          maxWidth: contentWidth - 88,
          align,
        });
        lineY += 4.4;
      }
      if (item.notes) {
        drawText(`${t(language, 'operationPdfNotes')}:`, taskX, lineY, {
          size: 7.8,
          color: [100, 116, 139],
          align,
        });
        drawText(item.notes, taskX - 44, lineY, {
          size: 7.8,
          color: [71, 85, 105],
          maxWidth: contentWidth - 88,
          align,
        });
      }
    } else {
      const metaParts = [
        `${t(language, 'operationPdfResponsibleUnit')}: ${item.responsibleUnit || '-'}`,
        `${t(language, 'operationPdfDeadline')}: ${formatShortDate(item.deadline, language)}`,
        `${t(language, 'operationPdfCompletedBy')}: ${item.completedBy || '-'}`,
        `${t(language, 'operationPdfCompletedAt')}: ${formatDate(item.completedAt, language)}`,
      ];
      drawText(metaParts.join('   |   '), taskX, metaY, {
        size: 7.3,
        color: [100, 116, 139],
        maxWidth: contentWidth - 34,
        align,
      });
    }

    if (!rtl && item.notes) {
      drawText(`${t(language, 'operationPdfNotes')}: ${item.notes}`, taskX, metaY + 5.2, {
        size: 7.8,
        color: [71, 85, 105],
        maxWidth: contentWidth - 34,
        align,
      });
    }

    y += rowHeight + 4;
  };

  drawHeader();

  drawSection('operationPdfSummary');
  const metricGap = 4;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  const metricXs = rtl
    ? [
        right - metricWidth,
        right - metricWidth * 2 - metricGap,
        right - metricWidth * 3 - metricGap * 2,
        left,
      ]
    : [
        left,
        left + metricWidth + metricGap,
        left + (metricWidth + metricGap) * 2,
        left + (metricWidth + metricGap) * 3,
      ];
  drawMetric(metricXs[0], metricWidth, t(language, 'operationPdfPhase'), t(language, PHASE_KEYS[data.phase]), [34, 197, 94]);
  drawMetric(metricXs[1], metricWidth, t(language, 'operationPdfProgress'), `${pct}%`, [59, 130, 246]);
  drawMetric(metricXs[2], metricWidth, t(language, 'operationPdfTasksCompleted'), `${done}/${total}`, [245, 158, 11]);
  drawMetric(metricXs[3], metricWidth, t(language, 'operationPdfStatus'), t(language, CAMPAIGN_STATUS_KEYS[data.campaign.status]), [100, 116, 139]);
  y += 28;

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(left, y, contentWidth, 4, 2, 2, 'F');
  doc.setFillColor(34, 197, 94);
  const progressWidth = contentWidth * (pct / 100);
  doc.roundedRect(rtl ? right - progressWidth : left, y, progressWidth, 4, 2, 2, 'F');
  y += 12;

  drawMeta('operationPdfCampaign', `${data.campaign.label} (${data.campaign.year})`);
  drawMeta('operationPdfCurrentPhase', t(language, PHASE_KEYS[data.campaign.activePhase]));
  drawMeta('operationPdfPreparedFor', data.generatedBy || data.campaign.createdBy);
  drawMeta('operationPdfGeneratedAt', formatDate(new Date(), language));
  if (data.campaign.notes) {
    drawMeta('operationPdfNotes', data.campaign.notes);
  }

  drawSection('operationPdfTasks');
  if (sortedItems.length === 0) {
    drawText('-', textX, y, { size: 10, color: [100, 116, 139], align });
    y += 8;
  } else {
    sortedItems.forEach((item, index) => drawTask(item, index));
  }

  drawFooter();
  return doc.output('arraybuffer');
}
