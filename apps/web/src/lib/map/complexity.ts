import type { IncidentStatus } from '@/types';

export interface SACILevel {
  level: 1 | 2 | 3;
  label: string;
  labelKey: string;
  color: string;
}

/**
 * Compute SACI complexity level (1-3) from incident data.
 * - Level 1 (Simple): < 3 resources, single agency, contained
 * - Level 2 (Moderate): 3-10 resources, multi-agency
 * - Level 3 (Complex): > 10 resources, inter-regional
 */
export function computeSACILevel(
  severity: number,
  status: IncidentStatus,
  assignedResourceCount: number,
): SACILevel {
  if (
    assignedResourceCount > 10 ||
    severity >= 5
  ) {
    return { level: 3, label: 'Complex', labelKey: 'complexity3', color: '#991b1b' };
  }
  if (
    assignedResourceCount >= 3 ||
    severity >= 3 ||
    status === 'INTERVENTION'
  ) {
    return { level: 2, label: 'Moderate', labelKey: 'complexity2', color: '#f59e0b' };
  }
  return { level: 1, label: 'Simple', labelKey: 'complexity1', color: '#22c55e' };
}
