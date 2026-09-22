export type FireSize = 'small' | 'medium' | 'large' | 'very_large';
export type SmokeLevel = 'none' | 'light' | 'moderate' | 'heavy';
export type FireType = 'ground' | 'surface' | 'crown' | 'unknown';
export type WindCondition = 'calm' | 'light' | 'moderate' | 'strong';
export type NearbyThreat = 'structures' | 'roads' | 'powerlines' | 'forest' | 'people';

export interface FireCharacteristics {
  fireSize: FireSize;
  smokeLevel: SmokeLevel;
  fireType: FireType;
  windCondition: WindCondition;
  nearbyThreats: NearbyThreat[];
}

export interface ReportFormData {
  latitude: number | null;
  longitude: number | null;
  description: string;
  cause: string;
  characteristics: FireCharacteristics;
  contactPhone: string;
  anonymous: boolean;
  images: string[]; // base64 data URIs
}

export type WizardStep = 'location' | 'details' | 'review';

export const DEFAULT_CHARACTERISTICS: FireCharacteristics = {
  fireSize: 'small',
  smokeLevel: 'light',
  fireType: 'unknown',
  windCondition: 'calm',
  nearbyThreats: [],
};

export const DEFAULT_FORM_DATA: ReportFormData = {
  latitude: null,
  longitude: null,
  description: '',
  cause: '',
  characteristics: { ...DEFAULT_CHARACTERISTICS },
  contactPhone: '',
  anonymous: false,
  images: [],
};

export const FIRE_SIZE_OPTIONS: FireSize[] = ['small', 'medium', 'large', 'very_large'];
export const SMOKE_LEVEL_OPTIONS: SmokeLevel[] = ['none', 'light', 'moderate', 'heavy'];
export const FIRE_TYPE_OPTIONS: FireType[] = ['ground', 'surface', 'crown', 'unknown'];
export const WIND_CONDITION_OPTIONS: WindCondition[] = ['calm', 'light', 'moderate', 'strong'];
export const NEARBY_THREAT_OPTIONS: NearbyThreat[] = ['structures', 'roads', 'powerlines', 'forest', 'people'];
