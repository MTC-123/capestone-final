import { create } from 'zustand';
import type {
  Campaign,
  PhaseChecklistItem,
  PhaseSummary,
  OperationalPhase,
} from '@/types/operations';
import { PHASE_ORDER } from '@/types/operations';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface OperationsState {
  // Campaign
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  campaignsLoading: boolean;
  fetchCampaigns: () => Promise<void>;
  setActiveCampaign: (c: Campaign) => void;
  createCampaign: (year: number, label: string) => Promise<void>;
  advancePhase: () => Promise<void>;

  // Checklists (per-phase)
  tasks: PhaseChecklistItem[];
  tasksLoading: boolean;
  fetchTasks: (phase: OperationalPhase) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  addTask: (phase: OperationalPhase, task: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Summary (for stepper)
  phaseSummary: PhaseSummary[];
  fetchSummary: () => Promise<void>;

  // Active phase tab
  viewingPhase: OperationalPhase;
  setViewingPhase: (p: OperationalPhase) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  campaigns: [] as Campaign[],
  activeCampaign: null as Campaign | null,
  campaignsLoading: false,
  tasks: [] as PhaseChecklistItem[],
  tasksLoading: false,
  phaseSummary: PHASE_ORDER.map((phase) => ({ phase, total: 0, done: 0 })),
  viewingPhase: 'PREPARATION' as OperationalPhase,
};

export const useOperationsStore = create<OperationsState>((set, get) => ({
  ...INITIAL_STATE,

  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    try {
      const res = await fetchWithAuth('/api/operations/campaigns');
      if (res.ok) {
        const data = await res.json();
        const campaigns: Campaign[] = data.campaigns ?? [];
        set({ campaigns });
        // Auto-select the most recent campaign if none selected
        if (!get().activeCampaign && campaigns.length > 0) {
          set({ activeCampaign: campaigns[0], viewingPhase: campaigns[0].activePhase });
        }
      }
    } catch {
      // silently ignore
    } finally {
      set({ campaignsLoading: false });
    }
  },

  setActiveCampaign: (c) => set({ activeCampaign: c, viewingPhase: c.activePhase }),

  createCampaign: async (year, label) => {
    const res = await fetchWithAuth('/api/operations/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, label }),
    });
    if (res.ok) {
      const data = await res.json();
      set((s) => ({
        campaigns: [data.campaign, ...s.campaigns],
        activeCampaign: data.campaign,
        viewingPhase: data.campaign.activePhase,
      }));
      // Fetch summary for the new campaign
      get().fetchSummary();
    }
  },

  advancePhase: async () => {
    const campaign = get().activeCampaign;
    if (!campaign) return;

    const res = await fetchWithAuth(`/api/operations/campaigns/${campaign.id}/advance`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      set((s) => ({
        activeCampaign: data.campaign,
        viewingPhase: data.campaign.activePhase,
        campaigns: s.campaigns.map((c) => (c.id === data.campaign.id ? data.campaign : c)),
      }));
      get().fetchSummary();
    }
  },

  fetchTasks: async (phase) => {
    const campaign = get().activeCampaign;
    if (!campaign) return;

    set({ tasksLoading: true });
    try {
      const res = await fetchWithAuth(
        `/api/operations/checklists?campaignId=${campaign.id}&phase=${phase}`
      );
      if (res.ok) {
        const data = await res.json();
        set({ tasks: data.items ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ tasksLoading: false });
    }
  },

  toggleTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'DONE' ? 'PENDING' : 'DONE';
    // Optimistic update
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus } : t
      ),
    }));

    const res = await fetchWithAuth(`/api/operations/checklists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const data = await res.json();
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? data.item : t)),
      }));
      get().fetchSummary();
    } else {
      // Revert
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, status: task.status } : t
        ),
      }));
    }
  },

  addTask: async (phase, task) => {
    const campaign = get().activeCampaign;
    if (!campaign) return;

    const res = await fetchWithAuth('/api/operations/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id, phase, task }),
    });
    if (res.ok) {
      const data = await res.json();
      set((s) => ({ tasks: [...s.tasks, data.item] }));
      get().fetchSummary();
    }
  },

  deleteTask: async (id) => {
    const res = await fetchWithAuth(`/api/operations/checklists/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      get().fetchSummary();
    }
  },

  fetchSummary: async () => {
    const campaign = get().activeCampaign;
    if (!campaign) return;

    try {
      const res = await fetchWithAuth(
        `/api/operations/summary?campaignId=${campaign.id}`
      );
      if (res.ok) {
        const data = await res.json();
        const summary = data.summary as Record<string, { total: number; done: number }>;
        set({
          phaseSummary: PHASE_ORDER.map((phase) => ({
            phase,
            total: summary[phase]?.total ?? 0,
            done: summary[phase]?.done ?? 0,
          })),
        });
      }
    } catch {
      // silently ignore
    }
  },

  setViewingPhase: (p) => set({ viewingPhase: p }),

  reset: () => set(INITIAL_STATE),
}));
