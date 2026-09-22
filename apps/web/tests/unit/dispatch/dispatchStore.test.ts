import { describe, it, expect, beforeEach } from 'vitest';
import { useDispatchStore } from '@/store/useDispatchStore';
import type { SelectedTeam, ActiveRoute } from '@/store/useDispatchStore';
import type { RouteResponse } from '@/lib/routing/types';

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makeTeam(overrides: Partial<SelectedTeam> = {}): SelectedTeam {
  return {
    id: 'team-1',
    name: 'Station Alpha',
    type: 'GROUND_CREW',
    status: 'AVAILABLE',
    location: { type: 'Point', coordinates: [-5.1, 33.5] },
    capacity: 5,
    ...overrides,
  };
}

const mockRoute: RouteResponse = {
  primary: {
    coordinates: [
      [-5.1, 33.5],
      [-5.08, 33.55],
    ],
    distance_km: 3.2,
    duration_min: 6,
  },
  alternatives: [],
  metadata: { provider: 'graphhopper', cached: false, computed_at: new Date().toISOString() },
};

function makeActiveRoute(overrides: Partial<ActiveRoute> = {}): ActiveRoute {
  return {
    routeId: 'route-1',
    teamId: 'team-1',
    incidentId: 'incident-1',
    route: mockRoute,
    selected: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDispatchStore', () => {
  beforeEach(() => {
    // Reset store to initial state before every test
    useDispatchStore.getState().reset();
  });

  // -----------------------------------------------------------------------
  // 1. addTeam / removeTeam basic operations
  // -----------------------------------------------------------------------
  describe('addTeam / removeTeam', () => {
    it('adds a team to the selectedTeams list', () => {
      const team = makeTeam();
      useDispatchStore.getState().addTeam(team);

      const { selectedTeams } = useDispatchStore.getState();
      expect(selectedTeams).toHaveLength(1);
      expect(selectedTeams[0]).toEqual(team);
    });

    it('adds multiple distinct teams', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1', name: 'Alpha' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-2', name: 'Bravo' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-3', name: 'Charlie' }));

      expect(useDispatchStore.getState().selectedTeams).toHaveLength(3);
    });

    it('removes a team by id', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-2' }));
      useDispatchStore.getState().removeTeam('team-1');

      const { selectedTeams } = useDispatchStore.getState();
      expect(selectedTeams).toHaveLength(1);
      expect(selectedTeams[0].id).toBe('team-2');
    });

    it('removeTeam also removes associated routes for that team', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-2' }));
      useDispatchStore.getState().setActiveRoutes([
        makeActiveRoute({ routeId: 'r1', teamId: 'team-1' }),
        makeActiveRoute({ routeId: 'r2', teamId: 'team-2' }),
      ]);

      useDispatchStore.getState().removeTeam('team-1');

      const { activeRoutes } = useDispatchStore.getState();
      expect(activeRoutes).toHaveLength(1);
      expect(activeRoutes[0].teamId).toBe('team-2');
    });

    it('removeTeam with non-existent id is a harmless no-op', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().removeTeam('nonexistent');

      expect(useDispatchStore.getState().selectedTeams).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Max 5 teams enforcement
  // -----------------------------------------------------------------------
  describe('max 5 teams enforcement', () => {
    it('allows up to 5 teams', () => {
      for (let i = 1; i <= 5; i++) {
        useDispatchStore.getState().addTeam(makeTeam({ id: `team-${i}`, name: `Team ${i}` }));
      }

      expect(useDispatchStore.getState().selectedTeams).toHaveLength(5);
    });

    it('adding a 6th team is a no-op', () => {
      for (let i = 1; i <= 5; i++) {
        useDispatchStore.getState().addTeam(makeTeam({ id: `team-${i}` }));
      }

      const stateBefore = useDispatchStore.getState().selectedTeams;
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-6', name: 'Overflow' }));
      const stateAfter = useDispatchStore.getState().selectedTeams;

      expect(stateAfter).toHaveLength(5);
      expect(stateAfter).toEqual(stateBefore);
    });

    it('adding a 6th team does not modify the existing list', () => {
      for (let i = 1; i <= 5; i++) {
        useDispatchStore.getState().addTeam(makeTeam({ id: `team-${i}` }));
      }

      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-6' }));

      const ids = useDispatchStore.getState().selectedTeams.map((t) => t.id);
      expect(ids).toEqual(['team-1', 'team-2', 'team-3', 'team-4', 'team-5']);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Duplicate prevention
  // -----------------------------------------------------------------------
  describe('duplicate prevention', () => {
    it('adding the same team ID twice is a no-op', () => {
      const team = makeTeam({ id: 'team-1' });
      useDispatchStore.getState().addTeam(team);
      useDispatchStore.getState().addTeam(team);

      expect(useDispatchStore.getState().selectedTeams).toHaveLength(1);
    });

    it('adding a team with same id but different name is still a no-op', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1', name: 'Alpha' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1', name: 'Alpha Renamed' }));

      const { selectedTeams } = useDispatchStore.getState();
      expect(selectedTeams).toHaveLength(1);
      expect(selectedTeams[0].name).toBe('Alpha');
    });

    it('isTeamSelected returns true for an added team', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));

      expect(useDispatchStore.getState().isTeamSelected('team-1')).toBe(true);
    });

    it('isTeamSelected returns false for a team not in the list', () => {
      expect(useDispatchStore.getState().isTeamSelected('nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Incident change clears teams and routes
  // -----------------------------------------------------------------------
  describe('setSelectedIncidentId clears teams and routes', () => {
    it('setting an incident id clears selectedTeams', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-2' }));

      useDispatchStore.getState().setSelectedIncidentId('incident-99');

      expect(useDispatchStore.getState().selectedTeams).toEqual([]);
    });

    it('setting an incident id clears activeRoutes', () => {
      useDispatchStore.getState().setActiveRoutes([
        makeActiveRoute({ routeId: 'r1' }),
        makeActiveRoute({ routeId: 'r2' }),
      ]);

      useDispatchStore.getState().setSelectedIncidentId('incident-99');

      expect(useDispatchStore.getState().activeRoutes).toEqual([]);
    });

    it('setting an incident id clears routeError and assignmentError', () => {
      useDispatchStore.getState().setRouteError('some route error');
      useDispatchStore.getState().setAssignmentError('some assignment error');

      useDispatchStore.getState().setSelectedIncidentId('incident-99');

      expect(useDispatchStore.getState().routeError).toBeNull();
      expect(useDispatchStore.getState().assignmentError).toBeNull();
    });

    it('stores the new incident id', () => {
      useDispatchStore.getState().setSelectedIncidentId('incident-42');

      expect(useDispatchStore.getState().selectedIncidentId).toBe('incident-42');
    });

    it('setting incident to null also clears teams and routes', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().setActiveRoutes([makeActiveRoute()]);

      useDispatchStore.getState().setSelectedIncidentId(null);

      expect(useDispatchStore.getState().selectedIncidentId).toBeNull();
      expect(useDispatchStore.getState().selectedTeams).toEqual([]);
      expect(useDispatchStore.getState().activeRoutes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Route selection
  // -----------------------------------------------------------------------
  describe('selectRoute', () => {
    it('marks the correct route as selected', () => {
      useDispatchStore.getState().setActiveRoutes([
        makeActiveRoute({ routeId: 'r1', selected: false }),
        makeActiveRoute({ routeId: 'r2', selected: false }),
        makeActiveRoute({ routeId: 'r3', selected: false }),
      ]);

      useDispatchStore.getState().selectRoute('r2');

      const routes = useDispatchStore.getState().activeRoutes;
      expect(routes.find((r) => r.routeId === 'r1')!.selected).toBe(false);
      expect(routes.find((r) => r.routeId === 'r2')!.selected).toBe(true);
      expect(routes.find((r) => r.routeId === 'r3')!.selected).toBe(false);
    });

    it('deselects previously selected route when a new one is chosen', () => {
      useDispatchStore.getState().setActiveRoutes([
        makeActiveRoute({ routeId: 'r1', selected: true }),
        makeActiveRoute({ routeId: 'r2', selected: false }),
      ]);

      useDispatchStore.getState().selectRoute('r2');

      const routes = useDispatchStore.getState().activeRoutes;
      expect(routes.find((r) => r.routeId === 'r1')!.selected).toBe(false);
      expect(routes.find((r) => r.routeId === 'r2')!.selected).toBe(true);
    });

    it('selecting a non-existent routeId deselects all routes', () => {
      useDispatchStore.getState().setActiveRoutes([
        makeActiveRoute({ routeId: 'r1', selected: true }),
      ]);

      useDispatchStore.getState().selectRoute('nonexistent');

      const routes = useDispatchStore.getState().activeRoutes;
      expect(routes.every((r) => !r.selected)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. setSelectedTeamsEnRoute
  // -----------------------------------------------------------------------
  describe('setSelectedTeamsEnRoute', () => {
    it('marks all selected teams as EN_ROUTE', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1', status: 'AVAILABLE' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-2', status: 'AVAILABLE' }));
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-3', status: 'AVAILABLE' }));

      useDispatchStore.getState().setSelectedTeamsEnRoute();

      const { selectedTeams } = useDispatchStore.getState();
      expect(selectedTeams).toHaveLength(3);
      expect(selectedTeams.every((t) => t.status === 'EN_ROUTE')).toBe(true);
    });

    it('preserves other team properties when changing status', () => {
      const original = makeTeam({ id: 'team-1', name: 'Alpha', capacity: 8, status: 'AVAILABLE' });
      useDispatchStore.getState().addTeam(original);

      useDispatchStore.getState().setSelectedTeamsEnRoute();

      const team = useDispatchStore.getState().selectedTeams[0];
      expect(team.id).toBe('team-1');
      expect(team.name).toBe('Alpha');
      expect(team.capacity).toBe(8);
      expect(team.type).toBe('GROUND_CREW');
      expect(team.location).toEqual(original.location);
      expect(team.status).toBe('EN_ROUTE');
    });

    it('is a no-op on an empty teams list', () => {
      useDispatchStore.getState().setSelectedTeamsEnRoute();

      expect(useDispatchStore.getState().selectedTeams).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 7. reset() returns to initial state
  // -----------------------------------------------------------------------
  describe('reset', () => {
    it('returns all state values to their initial defaults', () => {
      // Dirty up every piece of state
      useDispatchStore.getState().setIsPanelOpen(true);
      useDispatchStore.getState().setSelectedIncidentId('incident-1');
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().setActiveRoutes([makeActiveRoute()]);
      useDispatchStore.getState().setIsGeneratingRoute(true);
      useDispatchStore.getState().setRouteError('route broke');
      useDispatchStore.getState().setIsAssigning(true);
      useDispatchStore.getState().setAssignmentError('assign broke');

      useDispatchStore.getState().reset();

      const state = useDispatchStore.getState();
      expect(state.isPanelOpen).toBe(false);
      expect(state.selectedIncidentId).toBeNull();
      expect(state.selectedTeams).toEqual([]);
      expect(state.activeRoutes).toEqual([]);
      expect(state.isGeneratingRoute).toBe(false);
      expect(state.routeError).toBeNull();
      expect(state.isAssigning).toBe(false);
      expect(state.assignmentError).toBeNull();
    });

    it('allows adding teams again after reset', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().reset();
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-new' }));

      const { selectedTeams } = useDispatchStore.getState();
      expect(selectedTeams).toHaveLength(1);
      expect(selectedTeams[0].id).toBe('team-new');
    });
  });

  // -----------------------------------------------------------------------
  // Bonus: clearTeams / clearRoutes
  // -----------------------------------------------------------------------
  describe('clearTeams / clearRoutes', () => {
    it('clearTeams empties teams, routes, and routeError', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().setActiveRoutes([makeActiveRoute()]);
      useDispatchStore.getState().setRouteError('error');

      useDispatchStore.getState().clearTeams();

      expect(useDispatchStore.getState().selectedTeams).toEqual([]);
      expect(useDispatchStore.getState().activeRoutes).toEqual([]);
      expect(useDispatchStore.getState().routeError).toBeNull();
    });

    it('clearRoutes empties only activeRoutes', () => {
      useDispatchStore.getState().addTeam(makeTeam({ id: 'team-1' }));
      useDispatchStore.getState().setActiveRoutes([makeActiveRoute()]);

      useDispatchStore.getState().clearRoutes();

      expect(useDispatchStore.getState().selectedTeams).toHaveLength(1);
      expect(useDispatchStore.getState().activeRoutes).toEqual([]);
    });
  });
});
