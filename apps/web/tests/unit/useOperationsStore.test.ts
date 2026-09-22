import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useOperationsStore } from '@/store/useOperationsStore';
import type { Campaign } from '@/types/operations';

// Mock fetchWithAuth
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

const mockCampaign: Campaign = {
  id: 'camp-1',
  year: 2026,
  label: 'Campagne 2026',
  status: 'ACTIVE',
  activePhase: 'PREPARATION',
  seasonStart: null,
  seasonEnd: null,
  notes: null,
  createdBy: 'OFF001',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useOperationsStore', () => {
  beforeEach(() => {
    useOperationsStore.getState().reset();
    vi.clearAllMocks();
  });

  it('starts with empty state', () => {
    const state = useOperationsStore.getState();
    expect(state.campaigns).toEqual([]);
    expect(state.activeCampaign).toBeNull();
    expect(state.tasks).toEqual([]);
    expect(state.viewingPhase).toBe('PREPARATION');
  });

  it('fetchCampaigns populates campaigns list', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [mockCampaign] }),
    } as Response);

    await useOperationsStore.getState().fetchCampaigns();

    const state = useOperationsStore.getState();
    expect(state.campaigns).toHaveLength(1);
    expect(state.campaigns[0].id).toBe('camp-1');
    // Auto-selects the first campaign
    expect(state.activeCampaign?.id).toBe('camp-1');
  });

  it('setActiveCampaign updates state and viewing phase', () => {
    const campaign2: Campaign = { ...mockCampaign, id: 'camp-2', activePhase: 'ALERTE' };

    useOperationsStore.getState().setActiveCampaign(campaign2);

    const state = useOperationsStore.getState();
    expect(state.activeCampaign?.id).toBe('camp-2');
    expect(state.viewingPhase).toBe('ALERTE');
  });

  it('toggleTask switches PENDING to DONE and calls PATCH', async () => {
    // Setup: set active campaign and tasks
    useOperationsStore.setState({
      activeCampaign: mockCampaign,
      tasks: [
        {
          id: 'task-1',
          campaignId: 'camp-1',
          phase: 'PREPARATION',
          task: 'Test task',
          status: 'PENDING',
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00Z',
          responsibleUnit: null,
          deadline: null,
          notes: null,
          completedBy: null,
          completedAt: null,
        },
      ],
    });

    // Mock PATCH response
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        item: {
          id: 'task-1',
          campaignId: 'camp-1',
          phase: 'PREPARATION',
          task: 'Test task',
          status: 'DONE',
          sortOrder: 0,
          createdAt: '2026-01-01T00:00:00Z',
          completedBy: 'OFF001',
          completedAt: '2026-01-01T12:00:00Z',
        },
      }),
    } as Response);

    // Mock summary fetch
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary: { PREPARATION: { total: 1, done: 1 } } }),
    } as Response);

    await useOperationsStore.getState().toggleTask('task-1');

    // Verify PATCH was called
    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/api/operations/checklists/task-1',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('advancePhase calls POST and refreshes', async () => {
    useOperationsStore.setState({
      activeCampaign: mockCampaign,
      campaigns: [mockCampaign],
    });

    const advanced = { ...mockCampaign, activePhase: 'PREPOSITIONNEMENT' };

    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: advanced }),
    } as Response);

    // Mock summary fetch
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary: {} }),
    } as Response);

    await useOperationsStore.getState().advancePhase();

    const state = useOperationsStore.getState();
    expect(state.activeCampaign?.activePhase).toBe('PREPOSITIONNEMENT');
    expect(state.viewingPhase).toBe('PREPOSITIONNEMENT');
  });

  it('reset clears state', () => {
    useOperationsStore.setState({
      activeCampaign: mockCampaign,
      campaigns: [mockCampaign],
      viewingPhase: 'LUTTE',
    });

    useOperationsStore.getState().reset();

    const state = useOperationsStore.getState();
    expect(state.activeCampaign).toBeNull();
    expect(state.campaigns).toEqual([]);
    expect(state.viewingPhase).toBe('PREPARATION');
  });
});
