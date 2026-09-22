import { describe, it, expect, beforeEach } from 'vitest';
import { useDispatchStore } from '@/store/useDispatchStore';
import type { SelectedVehicle } from '@/store/useDispatchStore';

function makeVehicle(id: string): SelectedVehicle {
  return {
    id,
    callSign: `FT-${id}`,
    type: 'FIRE_TRUCK',
    status: 'AVAILABLE',
    location: { type: 'Point', coordinates: [-5.1, 33.5] },
    capacity: 5000,
  };
}

describe('Dispatch Store - Vehicle Selection', () => {
  beforeEach(() => {
    useDispatchStore.getState().reset();
  });

  it('addVehicle adds a vehicle', () => {
    useDispatchStore.getState().addVehicle(makeVehicle('v-1'));
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(1);
    expect(useDispatchStore.getState().selectedVehicles[0].id).toBe('v-1');
  });

  it('addVehicle prevents duplicates', () => {
    const store = useDispatchStore.getState();
    store.addVehicle(makeVehicle('v-1'));
    store.addVehicle(makeVehicle('v-1'));
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(1);
  });

  it('addVehicle enforces max 5 cap', () => {
    const store = useDispatchStore.getState();
    for (let i = 1; i <= 6; i++) {
      store.addVehicle(makeVehicle(`v-${i}`));
    }
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(5);
  });

  it('removeVehicle removes a vehicle', () => {
    const store = useDispatchStore.getState();
    store.addVehicle(makeVehicle('v-1'));
    store.addVehicle(makeVehicle('v-2'));
    store.removeVehicle('v-1');
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(1);
    expect(useDispatchStore.getState().selectedVehicles[0].id).toBe('v-2');
  });

  it('isVehicleSelected returns correct value', () => {
    useDispatchStore.getState().addVehicle(makeVehicle('v-1'));
    expect(useDispatchStore.getState().isVehicleSelected('v-1')).toBe(true);
    expect(useDispatchStore.getState().isVehicleSelected('v-2')).toBe(false);
  });

  it('setSelectedIncidentId clears vehicles', () => {
    const store = useDispatchStore.getState();
    store.addVehicle(makeVehicle('v-1'));
    store.setSelectedIncidentId('inc-new');
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(0);
  });

  it('reset clears vehicles', () => {
    useDispatchStore.getState().addVehicle(makeVehicle('v-1'));
    useDispatchStore.getState().reset();
    expect(useDispatchStore.getState().selectedVehicles).toHaveLength(0);
  });
});
