import { create } from 'zustand';
import type {
  Equipment,
  RetardantProduct,
  Infrastructure,
  EquipmentTab,
} from '@/types/equipment';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface EquipmentState {
  activeTab: EquipmentTab;
  setActiveTab: (tab: EquipmentTab) => void;

  // Equipment
  equipment: Equipment[];
  equipmentLoading: boolean;
  fetchEquipment: () => Promise<void>;
  createEquipment: (data: Partial<Equipment>) => Promise<void>;
  updateEquipment: (id: string, data: Partial<Equipment>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;

  // Retardant
  retardant: RetardantProduct[];
  retardantLoading: boolean;
  fetchRetardant: () => Promise<void>;
  createRetardant: (data: Partial<RetardantProduct>) => Promise<void>;
  updateRetardant: (id: string, data: Partial<RetardantProduct>) => Promise<void>;
  deleteRetardant: (id: string) => Promise<void>;

  // Infrastructure
  infrastructure: Infrastructure[];
  infrastructureLoading: boolean;
  fetchInfrastructure: () => Promise<void>;
  createInfrastructure: (data: Partial<Infrastructure>) => Promise<void>;
  updateInfrastructure: (id: string, data: Partial<Infrastructure>) => Promise<void>;
  deleteInfrastructure: (id: string) => Promise<void>;

  // Location picker
  pickingLocation: boolean;
  pickingCategory: 'equipment' | 'retardant' | 'infrastructure' | null;
  pickingItemId: string | null;
  setPickingLocation: (picking: boolean) => void;
  startPicking: (category: 'equipment' | 'retardant' | 'infrastructure', itemId?: string) => void;
  stopPicking: () => void;
  applyPickedLocation: (lat: number, lng: number) => Promise<void>;

  reset: () => void;
}

const INITIAL_STATE = {
  activeTab: 'equipment' as EquipmentTab,
  equipment: [] as Equipment[],
  equipmentLoading: false,
  retardant: [] as RetardantProduct[],
  retardantLoading: false,
  infrastructure: [] as Infrastructure[],
  infrastructureLoading: false,
  pickingLocation: false,
  pickingCategory: null as 'equipment' | 'retardant' | 'infrastructure' | null,
  pickingItemId: null as string | null,
};

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  ...INITIAL_STATE,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Equipment
  fetchEquipment: async () => {
    set({ equipmentLoading: true });
    try {
      const res = await fetchWithAuth('/api/equipment');
      if (res.ok) {
        const data = await res.json();
        set({ equipment: data.items ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ equipmentLoading: false });
    }
  },
  createEquipment: async (data) => {
    const res = await fetchWithAuth('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to create equipment');
    }
    await get().fetchEquipment();
  },
  updateEquipment: async (id, data) => {
    const res = await fetchWithAuth(`/api/equipment/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to update equipment');
    }
    const result = await res.json();
    set((s) => ({
      equipment: s.equipment.map((e) => (e.id === id ? result.item : e)),
    }));
  },
  deleteEquipment: async (id) => {
    const res = await fetchWithAuth(`/api/equipment/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to delete equipment');
    }
    set((s) => ({ equipment: s.equipment.filter((e) => e.id !== id) }));
  },

  // Retardant
  fetchRetardant: async () => {
    set({ retardantLoading: true });
    try {
      const res = await fetchWithAuth('/api/retardant');
      if (res.ok) {
        const data = await res.json();
        set({ retardant: data.items ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ retardantLoading: false });
    }
  },
  createRetardant: async (data) => {
    const res = await fetchWithAuth('/api/retardant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to create retardant');
    }
    await get().fetchRetardant();
  },
  updateRetardant: async (id, data) => {
    const res = await fetchWithAuth(`/api/retardant/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to update retardant');
    }
    const result = await res.json();
    set((s) => ({
      retardant: s.retardant.map((r) => (r.id === id ? result.item : r)),
    }));
  },
  deleteRetardant: async (id) => {
    const res = await fetchWithAuth(`/api/retardant/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to delete retardant');
    }
    set((s) => ({ retardant: s.retardant.filter((r) => r.id !== id) }));
  },

  // Infrastructure
  fetchInfrastructure: async () => {
    set({ infrastructureLoading: true });
    try {
      const res = await fetchWithAuth('/api/infrastructure');
      if (res.ok) {
        const data = await res.json();
        set({ infrastructure: data.items ?? [] });
      }
    } catch {
      // silently ignore
    } finally {
      set({ infrastructureLoading: false });
    }
  },
  createInfrastructure: async (data) => {
    const res = await fetchWithAuth('/api/infrastructure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to create infrastructure');
    }
    await get().fetchInfrastructure();
  },
  updateInfrastructure: async (id, data) => {
    const res = await fetchWithAuth(`/api/infrastructure/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to update infrastructure');
    }
    const result = await res.json();
    set((s) => ({
      infrastructure: s.infrastructure.map((i) => (i.id === id ? result.item : i)),
    }));
  },
  deleteInfrastructure: async (id) => {
    const res = await fetchWithAuth(`/api/infrastructure/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.userMessage ?? 'Failed to delete infrastructure');
    }
    set((s) => ({ infrastructure: s.infrastructure.filter((i) => i.id !== id) }));
  },

  setPickingLocation: (picking) => set({ pickingLocation: picking }),

  startPicking: (category, itemId) =>
    set({ pickingLocation: true, pickingCategory: category, pickingItemId: itemId ?? null }),

  stopPicking: () =>
    set({ pickingLocation: false, pickingCategory: null, pickingItemId: null }),

  applyPickedLocation: async (lat, lng) => {
    const { pickingCategory, pickingItemId } = get();
    if (!pickingCategory || !pickingItemId) {
      get().stopPicking();
      return;
    }

    const urlMap = {
      equipment: `/api/equipment/${pickingItemId}`,
      retardant: `/api/retardant/${pickingItemId}`,
      infrastructure: `/api/infrastructure/${pickingItemId}`,
    };

    const bodyMap = {
      equipment: { latitude: lat, longitude: lng },
      retardant: { storageLat: lat, storageLng: lng },
      infrastructure: { latitude: lat, longitude: lng },
    };

    try {
      const res = await fetchWithAuth(urlMap[pickingCategory], {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyMap[pickingCategory]),
      });
      if (res.ok) {
        const result = await res.json();
        if (pickingCategory === 'equipment') {
          set((s) => ({
            equipment: s.equipment.map((e) => (e.id === pickingItemId ? result.item : e)),
          }));
        } else if (pickingCategory === 'retardant') {
          set((s) => ({
            retardant: s.retardant.map((r) => (r.id === pickingItemId ? result.item : r)),
          }));
        } else {
          set((s) => ({
            infrastructure: s.infrastructure.map((i) => (i.id === pickingItemId ? result.item : i)),
          }));
        }
      }
    } catch {
      // silently ignore
    } finally {
      get().stopPicking();
    }
  },

  reset: () => set(INITIAL_STATE),
}));
