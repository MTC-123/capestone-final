import { create } from 'zustand';
import type { FireEventRecord, RecordStatus, AlertSource } from '@/types';
import type { CauseCategory } from '@/types/fire-record';
import type { FireDatabaseStats } from '@/types/fire-record';

export interface FireRecordFilters {
  status: RecordStatus | null;
  alertSource: AlertSource | null;
  dateFrom: string | null;
  dateTo: string | null;
  minArea: number | null;
  maxArea: number | null;
  commune: string | null;
  cause: CauseCategory | null;
  search: string;
  sortBy: 'createdAt' | 'burnAreaHa' | 'alertReceivedAt';
  sortOrder: 'asc' | 'desc';
}

export type ViewMode = 'table' | 'map';

export interface FireRecordState {
  records: FireEventRecord[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total: number;
  };
  filters: FireRecordFilters;
  activeRecord: FireEventRecord | null;
  isEditing: boolean;

  // Stats
  stats: FireDatabaseStats | null;
  statsLoading: boolean;

  // View mode
  viewMode: ViewMode;

  // Comparison
  comparisonIds: string[];
  comparisonRecords: FireEventRecord[];
  comparisonLoading: boolean;

  // Actions
  setFilters: (filters: Partial<FireRecordFilters>) => void;
  clearFilters: () => void;
  setActiveRecord: (record: FireEventRecord | null) => void;
  setIsEditing: (editing: boolean) => void;
  fetchRecords: (append?: boolean) => Promise<void>;
  fetchRecord: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  toggleComparison: (id: string) => void;
  fetchComparison: () => Promise<void>;
  clearComparison: () => void;
  updateRecordStatus: (id: string, status: RecordStatus) => Promise<void>;
  reset: () => void;
}

const defaultFilters: FireRecordFilters = {
  status: null,
  alertSource: null,
  dateFrom: null,
  dateTo: null,
  minArea: null,
  maxArea: null,
  commune: null,
  cause: null,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const initialState = {
  records: [] as FireEventRecord[],
  isLoading: false,
  error: null as string | null,
  pagination: { cursor: null as string | null, hasMore: false, total: 0 },
  filters: { ...defaultFilters },
  activeRecord: null as FireEventRecord | null,
  isEditing: false,
  stats: null as FireDatabaseStats | null,
  statsLoading: false,
  viewMode: 'table' as ViewMode,
  comparisonIds: [] as string[],
  comparisonRecords: [] as FireEventRecord[],
  comparisonLoading: false,
};

export const useFireRecordStore = create<FireRecordState>()((set, get) => ({
  ...initialState,

  setFilters: (updates) =>
    set((state) => ({
      filters: { ...state.filters, ...updates },
    })),

  clearFilters: () => set({ filters: { ...defaultFilters } }),

  setActiveRecord: (activeRecord) => set({ activeRecord }),

  setIsEditing: (isEditing) => set({ isEditing }),

  fetchRecords: async (append = false) => {
    const { filters, pagination } = get();
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.alertSource) params.set('alertSource', filters.alertSource);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.minArea != null) params.set('minArea', String(filters.minArea));
      if (filters.maxArea != null) params.set('maxArea', String(filters.maxArea));
      if (filters.commune) params.set('commune', filters.commune);
      if (filters.cause) params.set('cause', filters.cause);
      if (filters.search) params.set('search', filters.search);
      params.set('sortBy', filters.sortBy);
      params.set('sortOrder', filters.sortOrder);
      if (append && pagination.cursor) params.set('cursor', pagination.cursor);

      const res = await fetch(`/api/fire-records?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch fire records');

      const json = await res.json();
      set((state) => ({
        records: append ? [...state.records, ...json.data] : json.data,
        pagination: json.pagination,
        isLoading: false,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  fetchRecord: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`/api/fire-records/${id}`);
      if (!res.ok) throw new Error('Failed to fetch fire record');

      const json = await res.json();
      set({ activeRecord: json.record, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const res = await fetch('/api/fire-records/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const stats = await res.json();
      set({ stats, statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  setViewMode: (viewMode) => set({ viewMode }),

  toggleComparison: (id) =>
    set((state) => {
      const exists = state.comparisonIds.includes(id);
      if (exists) {
        return {
          comparisonIds: state.comparisonIds.filter((i) => i !== id),
          comparisonRecords: state.comparisonRecords.filter((r) => r.id !== id),
        };
      }
      if (state.comparisonIds.length >= 5) return state;
      return { comparisonIds: [...state.comparisonIds, id] };
    }),

  fetchComparison: async () => {
    const { comparisonIds } = get();
    if (comparisonIds.length < 2) return;

    set({ comparisonLoading: true });
    try {
      const res = await fetch('/api/fire-records/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: comparisonIds }),
      });
      if (!res.ok) throw new Error('Failed to compare records');
      const json = await res.json();
      set({ comparisonRecords: json.records, comparisonLoading: false });
    } catch {
      set({ comparisonLoading: false });
    }
  },

  clearComparison: () => set({ comparisonIds: [], comparisonRecords: [] }),

  updateRecordStatus: async (id, status) => {
    try {
      const endpoint = status === 'VERIFIED'
        ? `/api/fire-records/${id}/verify`
        : `/api/fire-records/${id}/approve`;

      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to update status');

      const json = await res.json();
      // Update the record in the list
      set((state) => ({
        records: state.records.map((r) =>
          r.id === id ? { ...r, ...json.record } : r
        ),
        activeRecord: state.activeRecord?.id === id
          ? { ...state.activeRecord, ...json.record }
          : state.activeRecord,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  reset: () => set(initialState),
}));
