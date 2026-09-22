import { create } from 'zustand';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // ms; 0 = persist until dismissed
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let _nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (message, type, duration = 4000) => {
    const id = String(++_nextId);
    set((state) => {
      // Cap at 3 visible toasts; drop the oldest if exceeded
      const trimmed = state.toasts.length >= 3 ? state.toasts.slice(1) : state.toasts;
      return { toasts: [...trimmed, { id, message, type, duration }] };
    });
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),
}));
