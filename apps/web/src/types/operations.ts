export type OperationalPhase =
  | 'PREPARATION'
  | 'PREPOSITIONNEMENT'
  | 'ALERTE'
  | 'LUTTE'
  | 'EXTINCTION'
  | 'POST_CAMPAGNE';

export type CampaignStatus = 'PLANNING' | 'ACTIVE' | 'CLOSED';

export type ChecklistItemStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

export interface Campaign {
  id: string;
  year: number;
  label: string;
  status: CampaignStatus;
  activePhase: OperationalPhase;
  seasonStart?: string | null;
  seasonEnd?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseChecklistItem {
  id: string;
  campaignId: string;
  phase: OperationalPhase;
  task: string;
  responsibleUnit?: string | null;
  deadline?: string | null;
  status: ChecklistItemStatus;
  notes?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface PhaseSummary {
  phase: OperationalPhase;
  total: number;
  done: number;
}

export const PHASE_ORDER: OperationalPhase[] = [
  'PREPARATION',
  'PREPOSITIONNEMENT',
  'ALERTE',
  'LUTTE',
  'EXTINCTION',
  'POST_CAMPAGNE',
];
