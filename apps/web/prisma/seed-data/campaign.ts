export interface ChecklistItemSeed {
  phase: 'PREPARATION' | 'PREPOSITIONNEMENT' | 'ALERTE' | 'LUTTE' | 'EXTINCTION' | 'POST_CAMPAGNE';
  task: string;
  responsibleUnit?: string;
  deadline: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  notes?: string;
  completedBy?: string;
  completedAt?: string;
  sortOrder: number;
}

export const CAMPAIGN_2026 = {
  year: 2026,
  label: 'Campagne de Prévention et de Lutte contre les Incendies de Forêt 2026',
  status: 'ACTIVE' as const,
  activePhase: 'LUTTE' as const,
  seasonStart: '2026-06-01',
  seasonEnd: '2026-10-15',
  notes: "Saison à risque élevé — déficit pluviométrique persistant depuis mars, indice FWI moyen supérieur à la médiane décennale sur le Moyen Atlas.",
};

export const CHECKLIST_ITEMS: ChecklistItemSeed[] = [
  // PREPARATION — done, closed before the season opened
  { phase: 'PREPARATION', task: 'Révision et test des VPI et camions-citernes de la province', responsibleUnit: 'DPEFLCD', deadline: '2026-05-15', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-05-10T09:00:00Z', sortOrder: 1 },
  { phase: 'PREPARATION', task: 'Formation annuelle des équipes de première intervention (CEDEFO)', responsibleUnit: 'DPEFLCD', deadline: '2026-05-20', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-05-18T16:00:00Z', sortOrder: 2 },
  { phase: 'PREPARATION', task: 'Vérification du stock de retardant et mousse (dépôts Ifrane / Azrou / Aïn Leuh)', responsibleUnit: 'DPEFLCD', deadline: '2026-05-25', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-05-22T11:20:00Z', sortOrder: 3 },
  { phase: 'PREPARATION', task: 'Signature de la convention provinciale de coordination (Protection Civile / Gendarmerie / FAR)', responsibleUnit: 'Autorités locales', deadline: '2026-05-28', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-05-27T14:00:00Z', sortOrder: 4 },

  // PREPOSITIONNEMENT — done
  { phase: 'PREPOSITIONNEMENT', task: 'Déploiement des VPI sur les postes avancés (Aïn Leuh, Tighboula)', responsibleUnit: 'Protection Civile', deadline: '2026-06-01', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-05-31T10:00:00Z', sortOrder: 1 },
  { phase: 'PREPOSITIONNEMENT', task: 'Activation des postes vigies (Jbel Hebri, Tighboula, Michlifen, Aïn Leuh)', responsibleUnit: 'DPEFLCD', deadline: '2026-06-01', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-06-01T07:00:00Z', sortOrder: 2 },
  { phase: 'PREPOSITIONNEMENT', task: "Mise en astreinte 24/7 du centre provincial de gestion des risques", responsibleUnit: 'HCEFLCD', deadline: '2026-06-01', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-06-01T08:00:00Z', sortOrder: 3 },
  { phase: 'PREPOSITIONNEMENT', task: "Prépositionnement du CL-415 à la base aérienne de Meknès", responsibleUnit: 'DEF', deadline: '2026-06-05', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-06-03T12:00:00Z', sortOrder: 4 },

  // ALERTE — done (season is well underway)
  { phase: 'ALERTE', task: 'Diffusion du bulletin de risque hebdomadaire (indice FWI) aux communes', responsibleUnit: 'DPEFLCD', deadline: '2026-06-15', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-06-14T09:00:00Z', sortOrder: 1 },
  { phase: 'ALERTE', task: 'Campagne de sensibilisation estivale auprès des campeurs et estivants (Michlifen, Dayet Aoua, Aïn Vittel)', responsibleUnit: 'DPEFLCD / Autorités locales', deadline: '2026-06-30', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-06-28T15:00:00Z', sortOrder: 2 },
  { phase: 'ALERTE', task: 'Test mensuel de la chaîne d\'alerte FIRMS satellite → COS', responsibleUnit: 'DPEFLCD', deadline: '2026-07-01', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-07-01T08:30:00Z', sortOrder: 3 },

  // LUTTE — the current phase: mixed statuses
  { phase: 'LUTTE', task: 'Débriefing systématique après chaque intervention majeure (> 2 ha)', responsibleUnit: 'DPEFLCD', deadline: '2026-09-30', status: 'IN_PROGRESS', notes: '2 débriefings réalisés sur 3 incendies majeurs à ce jour', sortOrder: 1 },
  { phase: 'LUTTE', task: 'Rotation hebdomadaire des équipes sol pour éviter la fatigue opérationnelle', responsibleUnit: 'Protection Civile', deadline: '2026-09-24', status: 'IN_PROGRESS', sortOrder: 2 },
  { phase: 'LUTTE', task: "Point de situation quotidien avec le Wali de la province d'Ifrane", responsibleUnit: 'Autorités locales', deadline: '2026-09-24', status: 'DONE', completedBy: 'CD789012', completedAt: '2026-09-24T08:00:00Z', sortOrder: 3 },
  { phase: 'LUTTE', task: 'Renouvellement du stock de retardant après la campagne de juillet-août', responsibleUnit: 'DPEFLCD', deadline: '2026-09-20', status: 'BLOCKED', notes: 'Livraison fournisseur retardée — nouvelle date estimée début octobre', sortOrder: 4 },
  { phase: 'LUTTE', task: 'Audit inopiné des VPI en poste avancé (Annexe 2)', responsibleUnit: 'DPEFLCD', deadline: '2026-09-30', status: 'PENDING', sortOrder: 5 },

  // EXTINCTION / POST_CAMPAGNE — not started yet
  { phase: 'EXTINCTION', task: 'Levée progressive de l\'astreinte 24/7 après la première pluie utile', responsibleUnit: 'HCEFLCD', deadline: '2026-10-15', status: 'PENDING', sortOrder: 1 },
  { phase: 'POST_CAMPAGNE', task: 'Bilan de campagne et retour d\'expérience consolidé pour la Région Fès-Meknès', responsibleUnit: 'HCEFLCD', deadline: '2026-11-15', status: 'PENDING', sortOrder: 1 },
  { phase: 'POST_CAMPAGNE', task: 'Programme de reboisement des surfaces incendiées (Michlifen, Cèdre Gouraud)', responsibleUnit: 'DPEFLCD', deadline: '2026-12-01', status: 'PENDING', sortOrder: 2 },
];
