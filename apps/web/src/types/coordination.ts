// ============================================
// Coordination & Communication Types
// ============================================

export type MoroccanAgency =
  | 'DEF'
  | 'PROTECTION_CIVILE'
  | 'GENDARMERIE_ROYALE'
  | 'FORCES_AUXILIAIRES'
  | 'FORCES_ROYALES_AIR'
  | 'FAR'
  | 'AUTORITES_LOCALES';

export type AgencyPresenceStatus = 'ONLINE' | 'OFFLINE' | 'STANDBY';

export type CommLogCategory =
  | 'ALERT_SENT'
  | 'ORDER_GIVEN'
  | 'STATUS_UPDATE'
  | 'RESOURCE_REQUEST'
  | 'ESCALATION'
  | 'DE_ESCALATION'
  | 'AVIATION_REQUEST'
  | 'MUTUAL_AID'
  | 'GENERAL';

export type POIActivationLevel = 'POI_1' | 'POI_2' | 'POI_3';

export type ICSRoleType =
  | 'INCIDENT_COMMANDER'
  | 'OPERATIONS_CHIEF'
  | 'LOGISTICS_CHIEF'
  | 'PLANNING_CHIEF'
  | 'COMMUNICATIONS_OFFICER'
  | 'SAFETY_OFFICER'
  | 'LIAISON_OFFICER';

export type MutualAidStatusType = 'REQUESTED' | 'APPROVED' | 'EN_ROUTE' | 'ON_SCENE' | 'COMPLETED' | 'DENIED';

export type PMAStepType =
  | 'DETECTION'
  | 'VERIFICATION'
  | 'ASSESSMENT'
  | 'POI_ACTIVATION'
  | 'PMA_REQUEST'
  | 'PROVINCIAL_APPROVAL'
  | 'NATIONAL_RELAY'
  | 'AIRCRAFT_DISPATCH'
  | 'AIRCRAFT_ON_SCENE';

export interface AgencyStatusRecord {
  id: string;
  agency: MoroccanAgency;
  status: AgencyPresenceStatus;
  unitsAvailable: number;
  unitsDeployed: number;
  aviationStatus?: string | null;
  reserveStatus?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  lastHeartbeat?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommLogEntry {
  id: string;
  incidentId?: string | null;
  category: CommLogCategory;
  fromAgency?: MoroccanAgency | null;
  toAgency?: MoroccanAgency | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  authorId: string;
  authorCin: string;
  createdAt: string;
}

export interface POIActivationRecord {
  id: string;
  incidentId: string;
  level: POIActivationLevel;
  activatedBy: string;
  activatedAt: string;
  deactivatedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICSAssignmentRecord {
  id: string;
  incidentId: string;
  role: ICSRoleType;
  assigneeName: string;
  assigneeAgency?: MoroccanAgency | null;
  assigneePhone?: string | null;
  assigneeUserId?: string | null;
  assignedBy: string;
  assignedAt: string;
  relievedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MutualAidRequestRecord {
  id: string;
  incidentId: string;
  requestingProvince: string;
  targetProvince: string;
  resourceType: string;
  justification: string;
  status: MutualAidStatusType;
  respondedAt?: string | null;
  respondedBy?: string | null;
  responseNotes?: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PMAStepEntry {
  step: PMAStepType;
  timestamp: string;
  actor: string;
  notes?: string;
}

export interface PMAWorkflowRecord {
  id: string;
  incidentId: string;
  currentStep: PMAStepType;
  steps: PMAStepEntry[];
  aircraftType?: string | null;
  aircraftCount?: number | null;
  requestedBy: string;
  approvedBy?: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

// Input types

export interface UpdateAgencyStatusInput {
  status?: AgencyPresenceStatus;
  unitsAvailable?: number;
  unitsDeployed?: number;
  aviationStatus?: string;
  reserveStatus?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

export interface CreateCommLogInput {
  incidentId?: string;
  category: CommLogCategory;
  fromAgency?: MoroccanAgency;
  toAgency?: MoroccanAgency;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ActivatePOIInput {
  incidentId: string;
  level: POIActivationLevel;
  notes?: string;
}

export interface CreateICSAssignmentInput {
  incidentId: string;
  role: ICSRoleType;
  assigneeName: string;
  assigneeAgency?: MoroccanAgency;
  assigneePhone?: string;
  notes?: string;
}

export interface CreateMutualAidInput {
  incidentId: string;
  requestingProvince: string;
  targetProvince: string;
  resourceType: string;
  justification: string;
}

export interface UpdateMutualAidInput {
  status: MutualAidStatusType;
  responseNotes?: string;
}

export interface CreatePMAInput {
  incidentId: string;
  notes?: string;
}

export interface AdvancePMAInput {
  notes?: string;
  aircraftType?: string;
  aircraftCount?: number;
}

export type CoordinationTab = 'agencies' | 'commLog' | 'poi' | 'ics' | 'mutualAid' | 'pma';
