import { create } from 'zustand';
import type {
  AgencyStatusRecord,
  CommLogEntry,
  POIActivationRecord,
  ICSAssignmentRecord,
  MutualAidRequestRecord,
  PMAWorkflowRecord,
  CoordinationTab,
  CommLogCategory,
  MoroccanAgency,
} from '@/types/coordination';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface CommLogFilter {
  incidentId?: string;
  category?: CommLogCategory;
  fromAgency?: MoroccanAgency;
}

interface CoordinationState {
  // Tab
  activeTab: CoordinationTab;
  setActiveTab: (tab: CoordinationTab) => void;

  // Agencies
  agencies: AgencyStatusRecord[];
  agenciesLoading: boolean;
  fetchAgencies: () => Promise<void>;
  setAgencies: (agencies: AgencyStatusRecord[]) => void;

  // Comm Log
  commLog: CommLogEntry[];
  commLogLoading: boolean;
  commLogHasMore: boolean;
  commLogCursor: string | null;
  commLogFilter: CommLogFilter;
  setCommLogFilter: (filter: CommLogFilter) => void;
  fetchCommLog: (reset?: boolean) => Promise<void>;
  prependCommLogEntry: (entry: CommLogEntry) => void;

  // POI
  poiActivations: POIActivationRecord[];
  poiLoading: boolean;
  fetchPOIActivations: (incidentId?: string) => Promise<void>;

  // ICS
  icsAssignments: ICSAssignmentRecord[];
  icsLoading: boolean;
  fetchICSAssignments: (incidentId: string) => Promise<void>;

  // Mutual Aid
  mutualAidRequests: MutualAidRequestRecord[];
  mutualAidLoading: boolean;
  fetchMutualAid: (incidentId?: string) => Promise<void>;

  // PMA
  pmaWorkflows: PMAWorkflowRecord[];
  pmaLoading: boolean;
  fetchPMAWorkflows: (incidentId?: string) => Promise<void>;

  // Selected incident for tabs that need it
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  activeTab: 'agencies' as CoordinationTab,
  agencies: [],
  agenciesLoading: false,
  commLog: [],
  commLogLoading: false,
  commLogHasMore: true,
  commLogCursor: null as string | null,
  commLogFilter: {} as CommLogFilter,
  poiActivations: [],
  poiLoading: false,
  icsAssignments: [],
  icsLoading: false,
  mutualAidRequests: [],
  mutualAidLoading: false,
  pmaWorkflows: [],
  pmaLoading: false,
  selectedIncidentId: null as string | null,
};

export const useCoordinationStore = create<CoordinationState>((set, get) => ({
  ...INITIAL_STATE,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Agencies
  fetchAgencies: async () => {
    set({ agenciesLoading: true });
    try {
      const res = await fetchWithAuth('/api/coordination/agencies');
      if (res.ok) {
        const data = await res.json();
        set({ agencies: data.agencies ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ agenciesLoading: false });
    }
  },
  setAgencies: (agencies) => set({ agencies }),

  // Comm Log
  setCommLogFilter: (filter) => set({ commLogFilter: filter, commLog: [], commLogCursor: null, commLogHasMore: true }),
  fetchCommLog: async (reset) => {
    const state = get();
    if (state.commLogLoading) return;
    if (!reset && !state.commLogHasMore) return;

    set({ commLogLoading: true });
    if (reset) set({ commLog: [], commLogCursor: null, commLogHasMore: true });

    try {
      const params = new URLSearchParams();
      const cursor = reset ? null : state.commLogCursor;
      if (cursor) params.set('cursor', cursor);
      if (state.commLogFilter.incidentId) params.set('incidentId', state.commLogFilter.incidentId);
      if (state.commLogFilter.category) params.set('category', state.commLogFilter.category);
      if (state.commLogFilter.fromAgency) params.set('fromAgency', state.commLogFilter.fromAgency);
      params.set('limit', '20');

      const res = await fetchWithAuth(`/api/coordination/comm-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        const items: CommLogEntry[] = data.items ?? [];
        set((s) => ({
          commLog: reset ? items : [...s.commLog, ...items],
          commLogCursor: data.nextCursor ?? null,
          commLogHasMore: !!data.nextCursor,
        }));
      }
    } catch {
      // silently ignore
    } finally {
      set({ commLogLoading: false });
    }
  },
  prependCommLogEntry: (entry) => set((s) => ({ commLog: [entry, ...s.commLog] })),

  // POI
  fetchPOIActivations: async (incidentId) => {
    set({ poiLoading: true });
    try {
      const params = incidentId ? `?incidentId=${incidentId}` : '';
      const res = await fetchWithAuth(`/api/coordination/poi${params}`);
      if (res.ok) {
        const data = await res.json();
        set({ poiActivations: data.activations ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ poiLoading: false });
    }
  },

  // ICS
  fetchICSAssignments: async (incidentId) => {
    set({ icsLoading: true });
    try {
      const res = await fetchWithAuth(`/api/coordination/ics?incidentId=${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        set({ icsAssignments: data.assignments ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ icsLoading: false });
    }
  },

  // Mutual Aid
  fetchMutualAid: async (incidentId) => {
    set({ mutualAidLoading: true });
    try {
      const params = incidentId ? `?incidentId=${incidentId}` : '';
      const res = await fetchWithAuth(`/api/coordination/mutual-aid${params}`);
      if (res.ok) {
        const data = await res.json();
        set({ mutualAidRequests: data.requests ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ mutualAidLoading: false });
    }
  },

  // PMA
  fetchPMAWorkflows: async (incidentId) => {
    set({ pmaLoading: true });
    try {
      const params = incidentId ? `?incidentId=${incidentId}` : '';
      const res = await fetchWithAuth(`/api/coordination/pma${params}`);
      if (res.ok) {
        const data = await res.json();
        set({ pmaWorkflows: data.workflows ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ pmaLoading: false });
    }
  },

  selectedIncidentId: null,
  setSelectedIncidentId: (id) => set({ selectedIncidentId: id }),

  reset: () => set(INITIAL_STATE),
}));
