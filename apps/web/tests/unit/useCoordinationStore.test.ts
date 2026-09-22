import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCoordinationStore } from '@/store/useCoordinationStore';

// Mock fetchWithAuth
const mockFetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetchWithAuth(...args),
}));

function makeOkResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function makeErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

describe('useCoordinationStore', () => {
  beforeEach(() => {
    useCoordinationStore.getState().reset();
    mockFetchWithAuth.mockReset();
  });

  describe('initial state', () => {
    it('has agencies tab as default', () => {
      expect(useCoordinationStore.getState().activeTab).toBe('agencies');
    });

    it('has empty arrays for all collections', () => {
      const state = useCoordinationStore.getState();
      expect(state.agencies).toEqual([]);
      expect(state.commLog).toEqual([]);
      expect(state.poiActivations).toEqual([]);
      expect(state.icsAssignments).toEqual([]);
      expect(state.mutualAidRequests).toEqual([]);
      expect(state.pmaWorkflows).toEqual([]);
    });

    it('has all loading flags as false', () => {
      const state = useCoordinationStore.getState();
      expect(state.agenciesLoading).toBe(false);
      expect(state.commLogLoading).toBe(false);
      expect(state.poiLoading).toBe(false);
      expect(state.icsLoading).toBe(false);
      expect(state.mutualAidLoading).toBe(false);
      expect(state.pmaLoading).toBe(false);
    });

    it('has commLogHasMore as true', () => {
      expect(useCoordinationStore.getState().commLogHasMore).toBe(true);
    });

    it('has commLogCursor as null', () => {
      expect(useCoordinationStore.getState().commLogCursor).toBeNull();
    });

    it('has selectedIncidentId as null', () => {
      expect(useCoordinationStore.getState().selectedIncidentId).toBeNull();
    });
  });

  describe('setActiveTab', () => {
    it('changes the active tab', () => {
      useCoordinationStore.getState().setActiveTab('commLog');
      expect(useCoordinationStore.getState().activeTab).toBe('commLog');
    });

    it('can switch to all valid tabs', () => {
      const tabs = ['agencies', 'commLog', 'poi', 'ics', 'mutualAid', 'pma'] as const;
      for (const tab of tabs) {
        useCoordinationStore.getState().setActiveTab(tab);
        expect(useCoordinationStore.getState().activeTab).toBe(tab);
      }
    });
  });

  describe('setSelectedIncidentId', () => {
    it('sets an incident ID', () => {
      useCoordinationStore.getState().setSelectedIncidentId('inc-42');
      expect(useCoordinationStore.getState().selectedIncidentId).toBe('inc-42');
    });

    it('clears to null', () => {
      useCoordinationStore.getState().setSelectedIncidentId('inc-42');
      useCoordinationStore.getState().setSelectedIncidentId(null);
      expect(useCoordinationStore.getState().selectedIncidentId).toBeNull();
    });
  });

  describe('setAgencies', () => {
    it('sets agencies directly', () => {
      const agencies = [{ id: '1', agency: 'DEF' as const }] as any[];
      useCoordinationStore.getState().setAgencies(agencies);
      expect(useCoordinationStore.getState().agencies).toEqual(agencies);
    });
  });

  describe('fetchAgencies', () => {
    it('sets loading true then false', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ agencies: [] }));
      const promise = useCoordinationStore.getState().fetchAgencies();
      expect(useCoordinationStore.getState().agenciesLoading).toBe(true);
      await promise;
      expect(useCoordinationStore.getState().agenciesLoading).toBe(false);
    });

    it('populates agencies from response', async () => {
      const agencies = [{ id: '1', agency: 'DEF', status: 'ONLINE' }];
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ agencies }));
      await useCoordinationStore.getState().fetchAgencies();
      expect(useCoordinationStore.getState().agencies).toEqual(agencies);
    });

    it('defaults to empty array when agencies field is missing', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({}));
      await useCoordinationStore.getState().fetchAgencies();
      expect(useCoordinationStore.getState().agencies).toEqual([]);
    });

    it('keeps loading false on fetch error', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('network'));
      await useCoordinationStore.getState().fetchAgencies();
      expect(useCoordinationStore.getState().agenciesLoading).toBe(false);
    });

    it('does not update agencies on non-ok response', async () => {
      const agencies = [{ id: '1' }] as any[];
      useCoordinationStore.getState().setAgencies(agencies);
      mockFetchWithAuth.mockResolvedValue(makeErrorResponse());
      await useCoordinationStore.getState().fetchAgencies();
      expect(useCoordinationStore.getState().agencies).toEqual(agencies);
    });
  });

  describe('comm log', () => {
    describe('setCommLogFilter', () => {
      it('sets filter and resets comm log state', () => {
        // Pre-populate some state
        useCoordinationStore.setState({
          commLog: [{ id: '1' }] as any[],
          commLogCursor: 'cur-1',
          commLogHasMore: false,
        });

        useCoordinationStore.getState().setCommLogFilter({ category: 'ALERT_SENT' });
        const state = useCoordinationStore.getState();
        expect(state.commLogFilter).toEqual({ category: 'ALERT_SENT' });
        expect(state.commLog).toEqual([]);
        expect(state.commLogCursor).toBeNull();
        expect(state.commLogHasMore).toBe(true);
      });
    });

    describe('fetchCommLog', () => {
      it('fetches and populates comm log items', async () => {
        const items = [{ id: 'cl-1', message: 'test' }];
        mockFetchWithAuth.mockResolvedValue(
          makeOkResponse({ items, nextCursor: 'cur-next' }),
        );
        await useCoordinationStore.getState().fetchCommLog();
        const state = useCoordinationStore.getState();
        expect(state.commLog).toEqual(items);
        expect(state.commLogCursor).toBe('cur-next');
        expect(state.commLogHasMore).toBe(true);
      });

      it('sets commLogHasMore to false when no nextCursor', async () => {
        mockFetchWithAuth.mockResolvedValue(
          makeOkResponse({ items: [{ id: '1' }] }),
        );
        await useCoordinationStore.getState().fetchCommLog();
        expect(useCoordinationStore.getState().commLogHasMore).toBe(false);
      });

      it('appends items on subsequent calls', async () => {
        mockFetchWithAuth.mockResolvedValue(
          makeOkResponse({ items: [{ id: '1' }], nextCursor: 'c1' }),
        );
        await useCoordinationStore.getState().fetchCommLog();

        mockFetchWithAuth.mockResolvedValue(
          makeOkResponse({ items: [{ id: '2' }], nextCursor: null }),
        );
        await useCoordinationStore.getState().fetchCommLog();
        expect(useCoordinationStore.getState().commLog).toHaveLength(2);
      });

      it('resets and replaces items when reset=true', async () => {
        // Fill with initial data
        useCoordinationStore.setState({
          commLog: [{ id: 'old' }] as any[],
          commLogCursor: 'old-cursor',
        });

        mockFetchWithAuth.mockResolvedValue(
          makeOkResponse({ items: [{ id: 'new' }] }),
        );
        await useCoordinationStore.getState().fetchCommLog(true);
        const state = useCoordinationStore.getState();
        expect(state.commLog).toEqual([{ id: 'new' }]);
      });

      it('does not fetch if already loading', async () => {
        useCoordinationStore.setState({ commLogLoading: true });
        await useCoordinationStore.getState().fetchCommLog();
        expect(mockFetchWithAuth).not.toHaveBeenCalled();
      });

      it('does not fetch if no more items and not resetting', async () => {
        useCoordinationStore.setState({ commLogHasMore: false });
        await useCoordinationStore.getState().fetchCommLog();
        expect(mockFetchWithAuth).not.toHaveBeenCalled();
      });

      it('includes filter params in the request URL', async () => {
        useCoordinationStore.setState({
          commLogFilter: {
            incidentId: 'inc-1',
            category: 'ESCALATION',
            fromAgency: 'DEF',
          },
        });
        mockFetchWithAuth.mockResolvedValue(makeOkResponse({ items: [] }));
        await useCoordinationStore.getState().fetchCommLog();
        const url = mockFetchWithAuth.mock.calls[0][0] as string;
        expect(url).toContain('incidentId=inc-1');
        expect(url).toContain('category=ESCALATION');
        expect(url).toContain('fromAgency=DEF');
        expect(url).toContain('limit=20');
      });

      it('handles fetch error gracefully', async () => {
        mockFetchWithAuth.mockRejectedValue(new Error('network'));
        await useCoordinationStore.getState().fetchCommLog();
        expect(useCoordinationStore.getState().commLogLoading).toBe(false);
      });
    });

    describe('prependCommLogEntry', () => {
      it('adds entry to the beginning of the log', () => {
        useCoordinationStore.setState({
          commLog: [{ id: 'existing' }] as any[],
        });
        useCoordinationStore.getState().prependCommLogEntry({ id: 'new', message: 'hello' } as any);
        const log = useCoordinationStore.getState().commLog;
        expect(log).toHaveLength(2);
        expect(log[0].id).toBe('new');
        expect(log[1].id).toBe('existing');
      });

      it('works on empty log', () => {
        useCoordinationStore.getState().prependCommLogEntry({ id: 'first' } as any);
        expect(useCoordinationStore.getState().commLog).toHaveLength(1);
      });
    });
  });

  describe('fetchPOIActivations', () => {
    it('fetches and populates POI activations', async () => {
      const activations = [{ id: 'poi-1', level: 'POI_1' }];
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ activations }));
      await useCoordinationStore.getState().fetchPOIActivations();
      expect(useCoordinationStore.getState().poiActivations).toEqual(activations);
    });

    it('passes incidentId as query param when provided', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ activations: [] }));
      await useCoordinationStore.getState().fetchPOIActivations('inc-5');
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toContain('incidentId=inc-5');
    });

    it('does not include query param when no incidentId', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ activations: [] }));
      await useCoordinationStore.getState().fetchPOIActivations();
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toBe('/api/coordination/poi');
    });

    it('sets loading correctly', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ activations: [] }));
      const promise = useCoordinationStore.getState().fetchPOIActivations();
      expect(useCoordinationStore.getState().poiLoading).toBe(true);
      await promise;
      expect(useCoordinationStore.getState().poiLoading).toBe(false);
    });

    it('handles error gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('fail'));
      await useCoordinationStore.getState().fetchPOIActivations();
      expect(useCoordinationStore.getState().poiLoading).toBe(false);
    });

    it('defaults to empty array when activations missing from response', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({}));
      await useCoordinationStore.getState().fetchPOIActivations();
      expect(useCoordinationStore.getState().poiActivations).toEqual([]);
    });
  });

  describe('fetchICSAssignments', () => {
    it('fetches and populates ICS assignments', async () => {
      const assignments = [{ id: 'ics-1', role: 'INCIDENT_COMMANDER' }];
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ assignments }));
      await useCoordinationStore.getState().fetchICSAssignments('inc-1');
      expect(useCoordinationStore.getState().icsAssignments).toEqual(assignments);
    });

    it('passes incidentId in the URL', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ assignments: [] }));
      await useCoordinationStore.getState().fetchICSAssignments('inc-99');
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toContain('incidentId=inc-99');
    });

    it('sets loading correctly', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ assignments: [] }));
      const promise = useCoordinationStore.getState().fetchICSAssignments('inc-1');
      expect(useCoordinationStore.getState().icsLoading).toBe(true);
      await promise;
      expect(useCoordinationStore.getState().icsLoading).toBe(false);
    });

    it('handles error gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('fail'));
      await useCoordinationStore.getState().fetchICSAssignments('inc-1');
      expect(useCoordinationStore.getState().icsLoading).toBe(false);
    });
  });

  describe('fetchMutualAid', () => {
    it('fetches and populates mutual aid requests', async () => {
      const requests = [{ id: 'ma-1', status: 'REQUESTED' }];
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ requests }));
      await useCoordinationStore.getState().fetchMutualAid();
      expect(useCoordinationStore.getState().mutualAidRequests).toEqual(requests);
    });

    it('passes incidentId when provided', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ requests: [] }));
      await useCoordinationStore.getState().fetchMutualAid('inc-7');
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toContain('incidentId=inc-7');
    });

    it('does not include query param without incidentId', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ requests: [] }));
      await useCoordinationStore.getState().fetchMutualAid();
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toBe('/api/coordination/mutual-aid');
    });

    it('sets loading correctly', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ requests: [] }));
      const promise = useCoordinationStore.getState().fetchMutualAid();
      expect(useCoordinationStore.getState().mutualAidLoading).toBe(true);
      await promise;
      expect(useCoordinationStore.getState().mutualAidLoading).toBe(false);
    });

    it('handles error gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('fail'));
      await useCoordinationStore.getState().fetchMutualAid();
      expect(useCoordinationStore.getState().mutualAidLoading).toBe(false);
    });
  });

  describe('fetchPMAWorkflows', () => {
    it('fetches and populates PMA workflows', async () => {
      const workflows = [{ id: 'pma-1', currentStep: 'DETECTION' }];
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ workflows }));
      await useCoordinationStore.getState().fetchPMAWorkflows();
      expect(useCoordinationStore.getState().pmaWorkflows).toEqual(workflows);
    });

    it('passes incidentId when provided', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ workflows: [] }));
      await useCoordinationStore.getState().fetchPMAWorkflows('inc-3');
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toContain('incidentId=inc-3');
    });

    it('does not include query param without incidentId', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ workflows: [] }));
      await useCoordinationStore.getState().fetchPMAWorkflows();
      const url = mockFetchWithAuth.mock.calls[0][0] as string;
      expect(url).toBe('/api/coordination/pma');
    });

    it('sets loading correctly', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({ workflows: [] }));
      const promise = useCoordinationStore.getState().fetchPMAWorkflows();
      expect(useCoordinationStore.getState().pmaLoading).toBe(true);
      await promise;
      expect(useCoordinationStore.getState().pmaLoading).toBe(false);
    });

    it('handles error gracefully', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('fail'));
      await useCoordinationStore.getState().fetchPMAWorkflows();
      expect(useCoordinationStore.getState().pmaLoading).toBe(false);
    });

    it('defaults to empty array when workflows missing', async () => {
      mockFetchWithAuth.mockResolvedValue(makeOkResponse({}));
      await useCoordinationStore.getState().fetchPMAWorkflows();
      expect(useCoordinationStore.getState().pmaWorkflows).toEqual([]);
    });
  });

  describe('reset', () => {
    it('restores all state to initial values', async () => {
      // Modify state
      useCoordinationStore.getState().setActiveTab('pma');
      useCoordinationStore.getState().setSelectedIncidentId('inc-1');
      useCoordinationStore.getState().setAgencies([{ id: '1' }] as any[]);
      useCoordinationStore.getState().prependCommLogEntry({ id: 'cl-1' } as any);

      // Reset
      useCoordinationStore.getState().reset();

      const state = useCoordinationStore.getState();
      expect(state.activeTab).toBe('agencies');
      expect(state.selectedIncidentId).toBeNull();
      expect(state.agencies).toEqual([]);
      expect(state.commLog).toEqual([]);
      expect(state.agenciesLoading).toBe(false);
      expect(state.commLogHasMore).toBe(true);
      expect(state.commLogCursor).toBeNull();
    });
  });
});
