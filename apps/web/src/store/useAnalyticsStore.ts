import { create } from 'zustand';
import type {
  DateRangePreset,
  AnalyticsTab,
  EnhancedAnalyticsData,
} from '@/types/analytics';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

export interface AnalyticsState {
  dateRange: DateRangePreset;
  customFrom: string;
  customTo: string;
  activeTab: AnalyticsTab;
  data: EnhancedAnalyticsData | null;
  loading: boolean;
  error: string | null;

  setDateRange: (preset: DateRangePreset) => void;
  setCustomFrom: (from: string) => void;
  setCustomTo: (to: string) => void;
  setActiveTab: (tab: AnalyticsTab) => void;
  fetchData: () => Promise<void>;
  reset: () => void;
}

/** Compute ISO from/to strings from a preset. */
export function computeDateRange(
  preset: DateRangePreset,
  customFrom: string,
  customTo: string
): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString(), to };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString(), to };
    }
    case 'season': {
      // Fire season: Jun 1 – Oct 31 current year
      const year = now.getFullYear();
      const seasonStart = new Date(year, 5, 1); // June 1
      const seasonEnd = new Date(year, 10, 1); // Nov 1 (exclusive)
      return { from: seasonStart.toISOString(), to: seasonEnd.toISOString() };
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from: d.toISOString(), to };
    }
    case 'custom': {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : new Date(0).toISOString(),
        to: customTo ? new Date(customTo + 'T23:59:59').toISOString() : to,
      };
    }
    case 'all':
    default:
      return { from: new Date(0).toISOString(), to };
  }
}

const initialState = {
  dateRange: '30d' as DateRangePreset,
  customFrom: '',
  customTo: '',
  activeTab: 'overview' as AnalyticsTab,
  data: null as EnhancedAnalyticsData | null,
  loading: false,
  error: null as string | null,
};

export const useAnalyticsStore = create<AnalyticsState>()((set, get) => ({
  ...initialState,

  setDateRange: (dateRange) => set({ dateRange }),
  setCustomFrom: (customFrom) => set({ customFrom }),
  setCustomTo: (customTo) => set({ customTo }),
  setActiveTab: (activeTab) => set({ activeTab }),

  fetchData: async () => {
    const { dateRange, customFrom, customTo } = get();
    const range = computeDateRange(dateRange, customFrom, customTo);

    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetchWithAuth(`/api/analytics?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        set({ data: null, error: 'Failed to load analytics', loading: false });
        return;
      }
      set({ data: json as EnhancedAnalyticsData, loading: false });
    } catch {
      set({ data: null, error: 'Connection error', loading: false });
    }
  },

  reset: () => set(initialState),
}));
