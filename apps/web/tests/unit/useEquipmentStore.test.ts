import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useEquipmentStore } from '@/store/useEquipmentStore';

// Mock fetchWithAuth
const mockFetch = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => mockFetch(...args),
}));

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe('useEquipmentStore', () => {
  beforeEach(() => {
    useEquipmentStore.getState().reset();
    mockFetch.mockReset();
  });

  // ============================================
  // Tab switching
  // ============================================

  it('setActiveTab switches tab', () => {
    expect(useEquipmentStore.getState().activeTab).toBe('equipment');
    useEquipmentStore.getState().setActiveTab('retardant');
    expect(useEquipmentStore.getState().activeTab).toBe('retardant');
  });

  // ============================================
  // Equipment
  // ============================================

  it('fetchEquipment populates equipment list', async () => {
    const items = [
      { id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 1 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ items }));

    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toEqual(items);
    expect(useEquipmentStore.getState().equipmentLoading).toBe(false);
  });

  it('createEquipment calls POST and refreshes', async () => {
    // POST response
    mockFetch.mockResolvedValueOnce(jsonResponse({ item: { id: 'eq-new' } }, 201));
    // Refresh GET response
    const items = [{ id: 'eq-new', type: 'VPI', name: 'Test', status: 'OPERATIONNEL', quantity: 1 }];
    mockFetch.mockResolvedValueOnce(jsonResponse({ items }));

    await useEquipmentStore.getState().createEquipment({ type: 'VPI', name: 'Test' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/equipment', expect.objectContaining({ method: 'POST' }));
    expect(useEquipmentStore.getState().equipment).toEqual(items);
  });

  it('updateEquipment calls PATCH and updates local state', async () => {
    useEquipmentStore.setState({
      equipment: [{ id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 1, createdAt: '', updatedAt: '' }],
    });

    const updated = { id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 5, createdAt: '', updatedAt: '' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ item: updated }));

    await useEquipmentStore.getState().updateEquipment('eq-1', { quantity: 5 });
    expect(useEquipmentStore.getState().equipment[0].quantity).toBe(5);
  });

  it('deleteEquipment calls DELETE and removes from list', async () => {
    useEquipmentStore.setState({
      equipment: [{ id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 1, createdAt: '', updatedAt: '' }],
    });

    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    await useEquipmentStore.getState().deleteEquipment('eq-1');
    expect(useEquipmentStore.getState().equipment).toHaveLength(0);
  });

  // ============================================
  // Retardant
  // ============================================

  it('fetchRetardant populates retardant list', async () => {
    const items = [
      { id: 'ret-1', name: 'Mousse A', type: 'MOUSSE', quantity: 500, unit: 'L', storageLocation: 'Ifrane', acquisitionDate: '2025-01-01' },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ items }));

    await useEquipmentStore.getState().fetchRetardant();
    expect(useEquipmentStore.getState().retardant).toEqual(items);
  });

  it('createRetardant calls POST and refreshes', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ item: { id: 'ret-new' } }, 201));
    mockFetch.mockResolvedValueOnce(jsonResponse({ items: [{ id: 'ret-new' }] }));

    await useEquipmentStore.getState().createRetardant({ name: 'Test', quantity: 100, storageLocation: 'X', acquisitionDate: '2025-01-01' });
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/retardant', expect.objectContaining({ method: 'POST' }));
  });

  it('deleteRetardant removes from list', async () => {
    useEquipmentStore.setState({
      retardant: [{ id: 'ret-1', name: 'A', type: 'MOUSSE', quantity: 500, unit: 'L', storageLocation: 'X', acquisitionDate: '2025-01-01', createdAt: '', updatedAt: '' }],
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    await useEquipmentStore.getState().deleteRetardant('ret-1');
    expect(useEquipmentStore.getState().retardant).toHaveLength(0);
  });

  // ============================================
  // Infrastructure
  // ============================================

  it('fetchInfrastructure populates infrastructure list', async () => {
    const items = [
      { id: 'infra-1', type: 'WATCHTOWER', name: 'Tour Nord', status: 'OPERATIONNEL' },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ items }));

    await useEquipmentStore.getState().fetchInfrastructure();
    expect(useEquipmentStore.getState().infrastructure).toEqual(items);
  });

  it('deleteInfrastructure removes from list', async () => {
    useEquipmentStore.setState({
      infrastructure: [{ id: 'infra-1', type: 'WATCHTOWER', name: 'Tour', status: 'OPERATIONNEL', createdAt: '', updatedAt: '' }],
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    await useEquipmentStore.getState().deleteInfrastructure('infra-1');
    expect(useEquipmentStore.getState().infrastructure).toHaveLength(0);
  });

  // ============================================
  // Reset
  // ============================================

  it('reset clears all state', async () => {
    useEquipmentStore.setState({
      activeTab: 'infrastructure',
      equipment: [{ id: 'eq-1' }] as any,
      retardant: [{ id: 'ret-1' }] as any,
      infrastructure: [{ id: 'infra-1' }] as any,
      pickingLocation: true,
    });

    useEquipmentStore.getState().reset();
    const state = useEquipmentStore.getState();
    expect(state.activeTab).toBe('equipment');
    expect(state.equipment).toHaveLength(0);
    expect(state.retardant).toHaveLength(0);
    expect(state.infrastructure).toHaveLength(0);
    expect(state.pickingLocation).toBe(false);
  });
});
