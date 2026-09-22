import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { translations, type TranslationKey } from '@/i18n/translations';

export const REPORT_PDF_LANGUAGES = ['ar', 'fr', 'en'] as const;
export type ReportPdfLanguage = (typeof REPORT_PDF_LANGUAGES)[number];

type ReportStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ReportPdfData {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  description: string;
  images: string[];
  status: ReportStatus;
  cause?: string | null;
  anonymous?: boolean | null;
  contactPhone?: string | null;
  characteristics?: unknown;
  referenceNumber?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  user?: {
    cin?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
}

const FONT_FILE = 'NotoSansArabic-Regular.ttf';
const FONT_NAME = 'NotoSansArabic';
const FILE_BASES: Record<ReportPdfLanguage, string> = {
  ar: 'بلاغ',
  fr: 'signalement',
  en: 'report',
};
const ASCII_FILE_BASES: Record<ReportPdfLanguage, string> = {
  ar: 'report',
  fr: 'signalement',
  en: 'report',
};

const STATUS_KEYS: Record<ReportStatus, TranslationKey> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
};

const CAUSE_KEYS: Record<string, TranslationKey> = {
  CAMPFIRE_UNATTENDED: 'campfireUnattended',
  CIGARETTE: 'cigarette',
  AGRICULTURAL_BURNING: 'agriculturalBurning',
  ELECTRICAL: 'electrical',
  LIGHTNING: 'lightning',
  ARSON: 'arson',
  EQUIPMENT_MALFUNCTION: 'equipmentMalfunction',
  OTHER: 'other',
  UNKNOWN: 'unknown',
};

const CHARACTERISTIC_KEYS: Record<string, Record<string, TranslationKey>> = {
  fireSize: {
    small: 'sizeSmall',
    medium: 'sizeMedium',
    large: 'sizeLarge',
    very_large: 'sizeVeryLarge',
  },
  smokeLevel: {
    none: 'smokeNone',
    light: 'smokeLight',
    moderate: 'smokeModerate',
    heavy: 'smokeHeavy',
  },
  fireType: {
    ground: 'typeGround',
    surface: 'typeSurface',
    crown: 'typeCrown',
    unknown: 'typeUnknown',
  },
  windCondition: {
    calm: 'windCalm',
    light: 'windLight',
    moderate: 'windModerate',
    strong: 'windStrong',
  },
  nearbyThreats: {
    structures: 'threatStructures',
    roads: 'threatRoads',
    powerlines: 'threatPowerlines',
    forest: 'threatForest',
    people: 'threatPeople',
  },
};

function isReportPdfLanguage(value: string | null | undefined): value is ReportPdfLanguage {
  return value === 'ar' || value === 'fr' || value === 'en';
}

export function normalizeReportPdfLanguage(value: string | null | undefined): ReportPdfLanguage {
  return isReportPdfLanguage(value) ? value : 'fr';
}

function t(language: ReportPdfLanguage, key: TranslationKey): string {
  return translations[language][key] ?? translations.fr[key] ?? translations.en[key] ?? key;
}

function localeFor(language: ReportPdfLanguage): string {
  if (language === 'ar') return 'ar-MA';
  if (language === 'fr') return 'fr-FR';
  return 'en-US';
}

function formatDate(value: string | Date | null | undefined, language: ReportPdfLanguage): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(localeFor(language), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCoordinates(report: ReportPdfData): string {
  return `${Number(report.latitude).toFixed(6)}, ${Number(report.longitude).toFixed(6)}`;
}

function labelValue(
  language: ReportPdfLanguage,
  labelKey: TranslationKey,
  value: string | number | null | undefined
): string {
  const normalized = value === null || typeof value === 'undefined' || value === '' ? '-' : String(value);
  return `${t(language, labelKey)}: ${normalized}`;
}

function translateCause(language: ReportPdfLanguage, cause: string | null | undefined): string {
  if (!cause) return t(language, 'unknown');
  return t(language, CAUSE_KEYS[cause] ?? 'unknown');
}

function translateCharacteristic(
  language: ReportPdfLanguage,
  group: keyof typeof CHARACTERISTIC_KEYS,
  value: unknown
): string {
  if (typeof value !== 'string') return '-';
  const key = CHARACTERISTIC_KEYS[group]?.[value];
  return key ? t(language, key) : value;
}

function translateThreats(language: ReportPdfLanguage, value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value
    .map((threat) => translateCharacteristic(language, 'nearbyThreats', threat))
    .join(', ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function registerArabicFont(doc: jsPDF): boolean {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', FONT_FILE);
  if (!existsSync(fontPath)) return false;
  const font = readFileSync(fontPath).toString('base64');
  doc.addFileToVFS(FONT_FILE, font);
  doc.addFont(FONT_FILE, FONT_NAME, 'normal');
  return true;
}

const ARABIC_TEXT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_RUN_PATTERN = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s،؛؟.!-]*)/g;

function containsArabicText(value: string): boolean {
  return ARABIC_TEXT_PATTERN.test(value);
}

function safeReference(report: ReportPdfData): string {
  return report.referenceNumber || `RPT-${report.id.slice(-8).toUpperCase()}`;
}

export function buildReportPdfFilename(report: ReportPdfData, language: ReportPdfLanguage): string {
  const ref = safeReference(report).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${FILE_BASES[language]}-${ref}-${language}.pdf`;
}

export function buildReportPdfAsciiFilename(report: ReportPdfData, language: ReportPdfLanguage): string {
  const ref = safeReference(report).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${ASCII_FILE_BASES[language]}-${ref}-${language}.pdf`;
}

export function buildReportPdfContentDisposition(report: ReportPdfData, language: ReportPdfLanguage): string {
  const filename = buildReportPdfFilename(report, language);
  const fallback = buildReportPdfAsciiFilename(report, language);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function generateReportPdf(report: ReportPdfData, languageInput: string | null | undefined): ArrayBuffer {
  const language = normalizeReportPdfLanguage(languageInput);
  const rtl = language === 'ar';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const hasUnicodeFont = registerArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const left = margin;
  const right = pageWidth - margin;
  let y = 18;

  const setBodyFont = (bold = false, forceUnicode = false) => {
    if (forceUnicode && hasUnicodeFont) {
      doc.setFont(FONT_NAME, 'normal');
      return;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  };

  setBodyFont();

  const prepare = (value: string) => (containsArabicText(value) && hasUnicodeFont ? doc.processArabic(value) : value);
  const textX = rtl ? right : left;
  const align = rtl ? 'right' as const : 'left' as const;

  const ensureSpace = (height = 12) => {
    if (y + height < pageHeight - 18) return;
    doc.addPage();
    setBodyFont();
    y = 18;
  };

  const addText = (text: string, size = 10, gap = 6, bold = false) => {
    ensureSpace(gap + 4);
    doc.setFontSize(size);

    if (!rtl && hasUnicodeFont && containsArabicText(text)) {
      const parts = text.split(ARABIC_RUN_PATTERN).filter(Boolean);
      for (const part of parts) {
        const isArabic = containsArabicText(part);
        const normalized = part.trim();
        if (!normalized) continue;
        setBodyFont(bold, isArabic);
        const lines = doc.splitTextToSize(isArabic ? doc.processArabic(normalized) : normalized, contentWidth);
        doc.text(lines, isArabic ? right : left, y, { align: isArabic ? 'right' : 'left' });
        y += lines.length * gap;
      }
      return;
    }

    setBodyFont(bold, containsArabicText(text));
    const lines = doc.splitTextToSize(prepare(text), contentWidth);
    doc.text(lines, textX, y, { align });
    y += lines.length * gap;
  };

  const addRtlValue = (value: string, size = 10, gap = 5.5, x = textX, width = contentWidth) => {
    if (!rtl) {
      addText(value, size, gap);
      return;
    }

    const hasArabic = containsArabicText(value);
    const hasLatin = /[A-Za-z]/.test(value);
    const parts = hasArabic && hasLatin
      ? value.split(ARABIC_RUN_PATTERN).map((part) => part.trim()).filter(Boolean)
      : [value];

    for (const part of parts) {
      ensureSpace(gap + 4);
      const isArabic = containsArabicText(part);
      doc.setFontSize(size);
      setBodyFont(false, isArabic);
      const prepared = isArabic ? doc.processArabic(part) : part;
      const lines = doc.splitTextToSize(prepared, width);
      doc.text(lines, x, y, { align });
      y += lines.length * gap;
    }
  };

  const addSection = (titleKey: TranslationKey) => {
    ensureSpace(16);
    y += 4;
    doc.setDrawColor(33, 150, 83);
    doc.setLineWidth(0.4);
    doc.line(left, y, right, y);
    y += 6;
    addText(t(language, titleKey), 12, 6, true);
  };

  const addField = (labelKey: TranslationKey, value: string | number | null | undefined) => {
    if (rtl) {
      const normalized = value === null || typeof value === 'undefined' || value === '' ? '-' : String(value);
      ensureSpace(10);
      doc.setFontSize(10);
      doc.setTextColor(12, 22, 38);
      setBodyFont(false, true);
      doc.text(prepare(`${t(language, labelKey)}:`), right, y, { align: 'right' });
      addRtlValue(normalized, 10, 5.5, right - 50, contentWidth - 54);
      return;
    }
    addText(labelValue(language, labelKey, value), 10, 5);
  };

  doc.setTextColor(12, 22, 38);
  addText(t(language, 'reportPdfTitle'), 18, 8, true);
  addText(t(language, 'reportPdfSubtitle'), 10, 6);
  y += 2;
  addField('referenceNumberLabel', safeReference(report));
  addField('reportPdfStatus', t(language, STATUS_KEYS[report.status]));
  addField('reportPdfSubmittedAt', formatDate(report.createdAt, language));

  addSection('reportPdfReporterSection');
  addField('reporter', report.anonymous ? t(language, 'anonymousReport') : report.user?.cin || report.userId);
  addField('contactPhone', report.contactPhone || report.user?.phone || '-');

  addSection('reportPdfLocationSection');
  addField('reportPdfCoordinates', formatCoordinates(report));

  addSection('reportPdfIncidentSection');
  addField('cause', translateCause(language, report.cause));
  addField('description', report.description);

  const characteristics = isRecord(report.characteristics) ? report.characteristics : {};
  addSection('reportPdfCharacteristicsSection');
  addField('fireSize', translateCharacteristic(language, 'fireSize', characteristics.fireSize));
  addField('smokeLevel', translateCharacteristic(language, 'smokeLevel', characteristics.smokeLevel));
  addField('fireType', translateCharacteristic(language, 'fireType', characteristics.fireType));
  addField('windCondition', translateCharacteristic(language, 'windCondition', characteristics.windCondition));
  addField('nearbyThreats', translateThreats(language, characteristics.nearbyThreats));

  if (report.images.length > 0) {
    addSection('reportPdfPhotosSection');
    const imageSize = 42;
    const gap = 5;
    let x = rtl ? right - imageSize : left;
    const images = report.images.slice(0, 3);
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      ensureSpace(imageSize + 12);
      try {
        const format = image.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(image, format, x, y, imageSize, imageSize);
        doc.setFontSize(8);
        doc.text(String(index + 1), x + 2, y + imageSize - 2);
        x = rtl ? x - imageSize - gap : x + imageSize + gap;
      } catch {
        addText(`${t(language, 'addPhotos')} ${index + 1}: -`, 9, 5);
      }
    }
    y += imageSize + 6;
  }

  ensureSpace(24);
  y = Math.max(y, pageHeight - 28);
  doc.setDrawColor(220, 38, 38);
  doc.line(left, y, right, y);
  y += 6;
  doc.setTextColor(170, 24, 24);
  addText(`${t(language, 'emergencyReminder')} - ${t(language, 'emergencyNumber')}`, 9, 5);
  doc.setTextColor(110, 118, 129);
  addText(labelValue(language, 'reportPdfGeneratedAt', formatDate(new Date(), language)), 8, 4);

  return doc.output('arraybuffer');
}
