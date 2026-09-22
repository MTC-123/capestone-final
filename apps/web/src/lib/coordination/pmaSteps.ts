import type { PMAStepType } from '@/types/coordination';

export const PMA_STEP_ORDER: PMAStepType[] = [
  'DETECTION',
  'VERIFICATION',
  'ASSESSMENT',
  'POI_ACTIVATION',
  'PMA_REQUEST',
  'PROVINCIAL_APPROVAL',
  'NATIONAL_RELAY',
  'AIRCRAFT_DISPATCH',
  'AIRCRAFT_ON_SCENE',
];

export function getStepIndex(step: PMAStepType): number {
  return PMA_STEP_ORDER.indexOf(step);
}

export function getNextStep(current: PMAStepType): PMAStepType | null {
  const idx = getStepIndex(current);
  if (idx < 0 || idx >= PMA_STEP_ORDER.length - 1) return null;
  return PMA_STEP_ORDER[idx + 1];
}

export function canAdvance(current: PMAStepType, next: PMAStepType): boolean {
  const currentIdx = getStepIndex(current);
  const nextIdx = getStepIndex(next);
  return nextIdx === currentIdx + 1;
}

const STEP_LABEL_KEYS: Record<PMAStepType, string> = {
  DETECTION: 'pmaDetection',
  VERIFICATION: 'pmaVerification',
  ASSESSMENT: 'pmaAssessment',
  POI_ACTIVATION: 'pmaPOIActivation',
  PMA_REQUEST: 'pmaPMARequest',
  PROVINCIAL_APPROVAL: 'pmaProvincialApproval',
  NATIONAL_RELAY: 'pmaNationalRelay',
  AIRCRAFT_DISPATCH: 'pmaAircraftDispatch',
  AIRCRAFT_ON_SCENE: 'pmaAircraftOnScene',
};

export function getStepLabelKey(step: PMAStepType): string {
  return STEP_LABEL_KEYS[step];
}
