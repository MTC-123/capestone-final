/**
 * Dispatch State Management - MVP Phase
 * Manages dispatch panel state, selected teams, and active routes
 */

import { create } from 'zustand';
import type { RouteResponse } from '@/lib/routing/types';

export interface SelectedTeam {
  id: string;
  name: string;
  type: string;
  status: string;
  location: { type: 'Point'; coordinates: [number, number] };
  capacity: number;
}

export interface ActiveRoute {
  routeId: string;
  teamId: string;
  incidentId: string;
  route: RouteResponse;
  selected: boolean; // True if this route is currently highlighted
}

export interface SelectedVehicle {
  id: string;
  callSign: string;
  type: string;
  status: string;
  location: { type: 'Point'; coordinates: [number, number] };
  capacity: number;
}

export interface DispatchState {
  // Panel state
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;

  // Selected incident for dispatch
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;

  // Team selection
  selectedTeams: SelectedTeam[];
  addTeam: (team: SelectedTeam) => void;
  removeTeam: (teamId: string) => void;
  clearTeams: () => void;
  isTeamSelected: (teamId: string) => boolean;
  /** Marks all currently selected teams as EN_ROUTE (called after successful dispatch) */
  setSelectedTeamsEnRoute: () => void;

  // Vehicle selection
  selectedVehicles: SelectedVehicle[];
  addVehicle: (vehicle: SelectedVehicle) => void;
  removeVehicle: (vehicleId: string) => void;
  clearVehicles: () => void;
  isVehicleSelected: (vehicleId: string) => boolean;

  // Active routes (calculated for selected teams)
  activeRoutes: ActiveRoute[];
  setActiveRoutes: (routes: ActiveRoute[]) => void;
  selectRoute: (routeId: string) => void;
  clearRoutes: () => void;

  // Route generation state
  isGeneratingRoute: boolean;
  setIsGeneratingRoute: (generating: boolean) => void;
  routeError: string | null;
  setRouteError: (error: string | null) => void;

  // Assignment state
  isAssigning: boolean;
  setIsAssigning: (assigning: boolean) => void;
  assignmentError: string | null;
  setAssignmentError: (error: string | null) => void;

  // Reset all state
  reset: () => void;
}

const initialState = {
  isPanelOpen: false,
  selectedIncidentId: null,
  selectedTeams: [],
  selectedVehicles: [] as SelectedVehicle[],
  activeRoutes: [],
  isGeneratingRoute: false,
  routeError: null,
  isAssigning: false,
  assignmentError: null,
};

export const useDispatchStore = create<DispatchState>()((set, get) => ({
  ...initialState,

  setIsPanelOpen: (isPanelOpen) => set({ isPanelOpen }),

  setSelectedIncidentId: (selectedIncidentId) =>
    set({
      selectedIncidentId,
      // Clear teams, vehicles and routes when incident changes
      selectedTeams: [],
      selectedVehicles: [],
      activeRoutes: [],
      routeError: null,
      assignmentError: null,
    }),

  addTeam: (team) =>
    set((state) => {
      // Prevent duplicates
      if (state.selectedTeams.some((t) => t.id === team.id)) {
        return state;
      }
      // Prevent exceeding max teams (5)
      if (state.selectedTeams.length >= 5) {
        return state;
      }
      return {
        selectedTeams: [...state.selectedTeams, team],
      };
    }),

  removeTeam: (teamId) =>
    set((state) => ({
      selectedTeams: state.selectedTeams.filter((t) => t.id !== teamId),
      // Also remove route for this team
      activeRoutes: state.activeRoutes.filter((r) => r.teamId !== teamId),
    })),

  clearTeams: () =>
    set({
      selectedTeams: [],
      activeRoutes: [],
      routeError: null,
    }),

  isTeamSelected: (teamId) => {
    return get().selectedTeams.some((t) => t.id === teamId);
  },

  setSelectedTeamsEnRoute: () =>
    set((state) => ({
      selectedTeams: state.selectedTeams.map((team) => ({ ...team, status: 'EN_ROUTE' })),
    })),

  // Vehicle selection
  addVehicle: (vehicle) =>
    set((state) => {
      if (state.selectedVehicles.some((v) => v.id === vehicle.id)) return state;
      if (state.selectedVehicles.length >= 5) return state;
      return { selectedVehicles: [...state.selectedVehicles, vehicle] };
    }),

  removeVehicle: (vehicleId) =>
    set((state) => ({
      selectedVehicles: state.selectedVehicles.filter((v) => v.id !== vehicleId),
    })),

  clearVehicles: () => set({ selectedVehicles: [] }),

  isVehicleSelected: (vehicleId) => {
    return get().selectedVehicles.some((v) => v.id === vehicleId);
  },

  setActiveRoutes: (activeRoutes) => set({ activeRoutes }),

  selectRoute: (routeId) =>
    set((state) => ({
      activeRoutes: state.activeRoutes.map((r) => ({
        ...r,
        selected: r.routeId === routeId,
      })),
    })),

  clearRoutes: () => set({ activeRoutes: [] }),

  setIsGeneratingRoute: (isGeneratingRoute) => set({ isGeneratingRoute }),

  setRouteError: (routeError) => set({ routeError }),

  setIsAssigning: (isAssigning) => set({ isAssigning }),

  setAssignmentError: (assignmentError) => set({ assignmentError }),

  reset: () => set(initialState),
}));

// Expose store to window for E2E testing
if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
  (window as unknown as Record<string, unknown>).__DISPATCH_STORE__ = useDispatchStore;
}
