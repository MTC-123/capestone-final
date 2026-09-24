export type MoroccanAgencySeed =
  | 'DEF'
  | 'PROTECTION_CIVILE'
  | 'GENDARMERIE_ROYALE'
  | 'FORCES_AUXILIAIRES'
  | 'FORCES_ROYALES_AIR'
  | 'FAR'
  | 'AUTORITES_LOCALES';

export interface AgencyStatusSeed {
  agency: MoroccanAgencySeed;
  status: 'ONLINE' | 'OFFLINE' | 'STANDBY';
  unitsAvailable: number;
  unitsDeployed: number;
  aviationStatus?: string;
  reserveStatus?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  notes?: string;
}

// One row per MoroccanAgency enum value (required — the coordination board
// renders a card per agency and a missing row shows as "OFFLINE / unknown").
export const AGENCY_STATUSES: AgencyStatusSeed[] = [
  {
    agency: 'DEF',
    status: 'STANDBY',
    unitsAvailable: 3,
    unitsDeployed: 1,
    aviationStatus: 'Un Canadair CL-415 et un hélicoptère Kamov prépositionnés à la base aérienne de Meknès',
    contactName: 'Colonel Mustapha Alami',
    contactPhone: '+212537568200',
    contactEmail: 'coord.def@eauxetforets.gov.ma',
    notes: 'Prêt pour intervention PMA sur demande préfectorale ; 1 hélicoptère déjà engagé sur Cèdre Gouraud',
  },
  {
    agency: 'PROTECTION_CIVILE',
    status: 'ONLINE',
    unitsAvailable: 6,
    unitsDeployed: 4,
    contactName: 'Commandant Hassan Alaoui',
    contactPhone: '+212537566000',
    contactEmail: 'commandement@pc-ifrane.ma',
    notes: '2 VPI en intervention active, 1 VPI en maintenance planifiée',
  },
  {
    agency: 'GENDARMERIE_ROYALE',
    status: 'ONLINE',
    unitsAvailable: 5,
    unitsDeployed: 2,
    contactName: 'Commandant Rachid Tazi',
    contactPhone: '+212537567100',
    contactEmail: 'brigade.ifrane@gendarmerie.gov.ma',
    notes: 'Sécurisation du périmètre RN8 et de la piste Aïn Leuh–Azrou',
  },
  {
    agency: 'FORCES_AUXILIAIRES',
    status: 'STANDBY',
    unitsAvailable: 4,
    unitsDeployed: 0,
    contactName: 'Capitaine Abdelillah Sabir',
    contactPhone: '+212537569300',
    notes: 'Renfort logistique disponible sur préavis de 2 heures',
  },
  {
    agency: 'FORCES_ROYALES_AIR',
    status: 'OFFLINE',
    unitsAvailable: 0,
    unitsDeployed: 0,
    aviationStatus: 'Aucun appareil affecté à la province actuellement',
    contactName: 'Base aérienne de Meknès',
    contactPhone: '+212535520100',
  },
  {
    agency: 'FAR',
    status: 'STANDBY',
    unitsAvailable: 2,
    unitsDeployed: 0,
    contactName: 'Commandant Youssef Berrada',
    contactPhone: '+212537569900',
    notes: "Réserve d'appui logistique lourd (génie) mobilisable sur ordre du Wali",
  },
  {
    agency: 'AUTORITES_LOCALES',
    status: 'ONLINE',
    unitsAvailable: 3,
    unitsDeployed: 1,
    contactName: 'Fatima-Zahra Mernissi',
    contactPhone: '+212535660234',
    contactEmail: 'fz.mernissi@interieur.gov.ma',
    notes: "Cellule de crise provinciale activée au Cercle d'Ifrane",
  },
];

export interface CommLogSeed {
  category:
    | 'ALERT_SENT'
    | 'ORDER_GIVEN'
    | 'STATUS_UPDATE'
    | 'RESOURCE_REQUEST'
    | 'ESCALATION'
    | 'DE_ESCALATION'
    | 'AVIATION_REQUEST'
    | 'MUTUAL_AID'
    | 'GENERAL';
  fromAgency?: MoroccanAgencySeed;
  toAgency?: MoroccanAgencySeed;
  message: string;
  minutesOffset: number; // minutes after the incident's createdAt
  /** which active incident this belongs to: 0=parcCentral campfire,
   * 1=cedreGouraud lightning (the primary/most severe), 2=jbelHebri alerte */
  activeSlot: number;
}

export const COMMUNICATION_LOGS: CommLogSeed[] = [
  // Primary active incident (Cèdre Gouraud lightning, slot 1) — full command timeline
  { activeSlot: 1, category: 'ALERT_SENT', fromAgency: 'PROTECTION_CIVILE', toAgency: 'DEF', message: 'Alerte incendie de cime — Cèdre Gouraud, impact de foudre nocturne confirmé. Surface estimée 3 ha au premier survol, vent modéré. VPI-03 Azrou en route.', minutesOffset: 5 },
  { activeSlot: 1, category: 'ORDER_GIVEN', fromAgency: 'DEF', toAgency: 'PROTECTION_CIVILE', message: 'Engagement de FT-AZR-02 et CCF-AZR-01. COS désigné : Commandant Hassan Alaoui. Équipe Sol Azrou Bravo déployée en renfort.', minutesOffset: 22 },
  { activeSlot: 1, category: 'RESOURCE_REQUEST', fromAgency: 'PROTECTION_CIVILE', toAgency: 'DEF', message: "Demande d'appui aérien — progression en cime rapide, accès terrestre limité côté nord de la cédraie.", minutesOffset: 48 },
  { activeSlot: 1, category: 'AVIATION_REQUEST', fromAgency: 'DEF', toAgency: 'FORCES_ROYALES_AIR', message: "Requête PMA transmise — 1 hélicoptère bombardier d'eau demandé en complément du CL-415 prépositionné à Meknès.", minutesOffset: 55 },
  { activeSlot: 1, category: 'ESCALATION', fromAgency: 'DEF', toAgency: 'AUTORITES_LOCALES', message: 'Escalade POI 1 → POI 2 : superficie réévaluée à 8 ha, propagation vers versant nord confirmée par drone.', minutesOffset: 90 },
  { activeSlot: 1, category: 'MUTUAL_AID', fromAgency: 'AUTORITES_LOCALES', toAgency: 'DEF', message: 'Demande de renfort mutuel adressée à la province de Meknès — 2 camions-citernes et 1 équipe sol supplémentaire.', minutesOffset: 105 },
  { activeSlot: 1, category: 'STATUS_UPDATE', fromAgency: 'PROTECTION_CIVILE', message: 'SITREP 06h00 — HELI-DEF-01 en route (ETA 18 min). Ligne de défense établie le long de la tranchée pare-feu Cèdre Gouraud. Pas de blessé signalé.', minutesOffset: 175 },
  { activeSlot: 1, category: 'GENERAL', fromAgency: 'GENDARMERIE_ROYALE', toAgency: 'AUTORITES_LOCALES', message: 'Périmètre de sécurité établi sur la piste forestière Michlifen–Dayet Aoua ; accès public restreint dans un rayon de 2 km.', minutesOffset: 200 },

  // Parc National campfire incident (slot 0)
  { activeSlot: 0, category: 'ALERT_SENT', fromAgency: 'PROTECTION_CIVILE', toAgency: 'DEF', message: "Alerte feu de camp non maîtrisé — secteur central du Parc National d'Ifrane, vent soutenu poussant vers le nord. Équipe Sol Ifrane Bravo dépêchée.", minutesOffset: 8 },
  { activeSlot: 0, category: 'ORDER_GIVEN', fromAgency: 'DEF', toAgency: 'PROTECTION_CIVILE', message: 'Engagement de FT-IFR-03 et CCF-IFR-02. Poste de Commandement Avancé Ifrane activé sur zone.', minutesOffset: 20 },
  { activeSlot: 0, category: 'STATUS_UPDATE', fromAgency: 'PROTECTION_CIVILE', message: 'SITREP 07h30 — propagation ralentie, 40% du périmètre maîtrisé. Poursuite des opérations de noyage.', minutesOffset: 1050 },

  // Jbel Hebri alerte (slot 2) — pre-confirmation
  { activeSlot: 2, category: 'ALERT_SENT', fromAgency: 'PROTECTION_CIVILE', toAgency: 'DEF', message: 'Départ de fumée signalé par le poste vigie Jbel Hebri. Équipe Reconnaissance Jbel Hebri envoyée pour confirmation visuelle.', minutesOffset: 6 },
  { activeSlot: 2, category: 'STATUS_UPDATE', fromAgency: 'PROTECTION_CIVILE', message: "SITREP — équipe en approche, ETA 12 minutes. Aucune flamme visible depuis la vigie, alerte maintenue par prudence.", minutesOffset: 25 },
];

export interface ICSAssignmentSeed {
  role:
    | 'INCIDENT_COMMANDER'
    | 'OPERATIONS_CHIEF'
    | 'LOGISTICS_CHIEF'
    | 'PLANNING_CHIEF'
    | 'COMMUNICATIONS_OFFICER'
    | 'SAFETY_OFFICER'
    | 'LIAISON_OFFICER';
  assigneeName: string;
  assigneeAgency?: MoroccanAgencySeed;
  assigneePhone?: string;
  notes?: string;
  activeSlot: number;
}

export const ICS_ASSIGNMENTS: ICSAssignmentSeed[] = [
  { activeSlot: 1, role: 'INCIDENT_COMMANDER', assigneeName: 'Commandant Hassan Alaoui', assigneeAgency: 'PROTECTION_CIVILE', assigneePhone: '+212537566000', notes: 'COS désigné à 02h32' },
  { activeSlot: 1, role: 'OPERATIONS_CHIEF', assigneeName: 'Khalid Benali', assigneeAgency: 'DEF', assigneePhone: '+212661112233' },
  { activeSlot: 1, role: 'LOGISTICS_CHIEF', assigneeName: 'Youssef Idrissi', assigneeAgency: 'DEF' },
  { activeSlot: 1, role: 'SAFETY_OFFICER', assigneeName: 'Fatima Marzouki', assigneeAgency: 'PROTECTION_CIVILE' },
  { activeSlot: 1, role: 'LIAISON_OFFICER', assigneeName: 'Commandant Rachid Tazi', assigneeAgency: 'GENDARMERIE_ROYALE' },
  { activeSlot: 0, role: 'INCIDENT_COMMANDER', assigneeName: 'Karim Benali', assigneeAgency: 'PROTECTION_CIVILE', notes: 'COS désigné depuis le Poste de Commandement Avancé Ifrane' },
  { activeSlot: 0, role: 'OPERATIONS_CHIEF', assigneeName: 'Nabil Cherkaoui', assigneeAgency: 'DEF' },
];

export const POI_ACTIVATION_SLOT = 1; // Cèdre Gouraud — matches the POI 2 escalation above
export const MUTUAL_AID_SLOT = 1;
