import { describe, expect, it, beforeEach } from 'vitest';
import { useFireRecordStore } from '@/store/useFireRecordStore';

describe('useFireRecordStore', () => {
  beforeEach(() => {
    useFireRecordStore.getState().reset();
  });

  it('sets filters', () => {
    const store = useFireRecordStore.getState();
    store.setFilters({ status: 'DRAFT', search: 'test' });

    const state = useFireRecordStore.getState();
    expect(state.filters.status).toBe('DRAFT');
    expect(state.filters.search).toBe('test');
  });

  it('clears filters to defaults', () => {
    const store = useFireRecordStore.getState();
    store.setFilters({ status: 'LOCKED', minArea: 10 });
    store.clearFilters();

    const state = useFireRecordStore.getState();
    expect(state.filters.status).toBeNull();
    expect(state.filters.minArea).toBeNull();
    expect(state.filters.search).toBe('');
  });

  it('sets and clears active record', () => {
    const store = useFireRecordStore.getState();
    const mockRecord = {
      id: 'rec-1',
      incidentId: 'inc-1',
      alertSource: 'OTHER' as const,
      recordStatus: 'DRAFT' as const,
      lockedSections: [],
      auditTrail: [],
      createdAt: '2026-01-15T09:00:00Z',
      updatedAt: '2026-01-15T09:00:00Z',
    };

    store.setActiveRecord(mockRecord);
    expect(useFireRecordStore.getState().activeRecord).toEqual(mockRecord);

    store.setActiveRecord(null);
    expect(useFireRecordStore.getState().activeRecord).toBeNull();
  });

  it('toggles editing state', () => {
    const store = useFireRecordStore.getState();
    store.setIsEditing(true);
    expect(useFireRecordStore.getState().isEditing).toBe(true);
    store.setIsEditing(false);
    expect(useFireRecordStore.getState().isEditing).toBe(false);
  });

  it('resets all state', () => {
    const store = useFireRecordStore.getState();
    store.setFilters({ status: 'LOCKED' });
    store.setIsEditing(true);
    store.reset();

    const state = useFireRecordStore.getState();
    expect(state.filters.status).toBeNull();
    expect(state.isEditing).toBe(false);
    expect(state.records).toEqual([]);
  });
});
