export const FIRE_CAUSE_KEYS = [
  'CAMPFIRE_UNATTENDED',
  'CIGARETTE',
  'AGRICULTURAL_BURNING',
  'ELECTRICAL',
  'LIGHTNING',
  'ARSON',
  'EQUIPMENT_MALFUNCTION',
  'OTHER',
  'UNKNOWN',
] as const;

export type FireCauseKey = (typeof FIRE_CAUSE_KEYS)[number];

export const DEPARTMENTS = {
  ADM: 'الطرق السيارة بالمغرب',
  CCDRF: 'مركز الحفاظ على الموارد الغابوية',
  CEDEFO: 'مركز الدفاع عن الغابات',
  DFCI: 'الدفاع عن الغابات ضد الحرائق',
  DPEFLCD: 'المديرية الإقليمية للمياه والغابات',
  DREFLCD: 'المديرية الجهوية للمياه والغابات',
  FA: 'القوات المساعدة',
  FAR: 'القوات المسلحة الملكية',
  GR: 'الدرك الملكي',
  HCEFLCD: 'المندوبية السامية للمياه والغابات',
  MET: 'وزارة التجهيز والنقل',
  MI: 'وزارة الداخلية',
  MJS: 'وزارة الشباب والرياضة',
  ONCE: 'المكتب الوطني للسكك الحديدية',
  ONDA: 'المكتب الوطني للمطارات',
  ONEEP: 'المكتب الوطني للكهرباء والماء',
  PN: 'الإنعاش الوطني',
} as const;

// NEW: Bilingual department names
export const DEPARTMENTS_FR = {
  ADM: 'Autoroutes du Maroc',
  CCDRF: 'Centre Conservation des Ressources Forestières',
  CEDEFO: 'Centre de Défense Forestière',
  DFCI: 'Défense des Forêts Contre les Incendies',
  DPEFLCD: 'Direction Provinciale des Eaux et Forêts',
  DREFLCD: 'Direction Régionale des Eaux et Forêts',
  FA: 'Forces Auxiliaires',
  FAR: 'Forces Armées Royales',
  GR: 'Gendarmerie Royale',
  HCEFLCD: 'Haut-Commissariat aux Eaux et Forêts',
  MET: 'Ministère de l\'Équipement et du Transport',
  MI: 'Ministère de l\'Intérieur',
  MJS: 'Ministère de la Jeunesse et des Sports',
  ONCE: 'Office National des Chemins de Fer',
  ONDA: 'Office National des Aéroports',
  ONEEP: 'Office National de l\'Électricité et de l\'Eau Potable',
  PN: 'Promotion Nationale',
} as const;

export function getDepartmentName(code: keyof typeof DEPARTMENTS, language: 'ar' | 'fr' | 'en'): string {
  if (language === 'fr') {
    return DEPARTMENTS_FR[code];
  }
  return DEPARTMENTS[code];
}

export const STATUS_KEYS = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_COLORS = {
  PENDING: '#ef4444', // red
  IN_PROGRESS: '#f97316', // orange
  COMPLETED: '#22c55e', // green
} as const;

export const IFRANE_COORDINATES = {
  lat: 33.5275,
  lng: -5.1056,
} as const;

export function windDirectionIndexFromDegrees(degrees: number): number {
  return Math.round(degrees / 45) % 8;
}

export function formatDateTime(date: Date | string, language: 'ar' | 'fr' | 'en'): string {
  const d = new Date(date);
  return d.toLocaleString(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
