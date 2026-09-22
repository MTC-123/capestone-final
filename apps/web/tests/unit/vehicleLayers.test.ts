import { describe, it, expect, vi } from 'vitest';
import {
  createVehicleLayer,
  transformVehicleToLayerData,
  type VehicleLayerData,
} from '@/lib/map/dispatchLayers';

// Mock deck.gl layers
vi.mock('@deck.gl/layers', () => ({
  PathLayer: class PathLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
  IconLayer: class IconLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
  ArcLayer: class ArcLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
}));

vi.mock('@/lib/map/helpers', () => ({ circleIcon: (color: string) => `data:svg,${color}` }));

const mockVehicle: VehicleLayerData = {
  vehicleId: 'v-1',
  callSign: 'FT-001',
  type: 'FIRE_TRUCK',
  status: 'EN_ROUTE',
  coordinates: [-5.1, 33.5],
};

describe('createVehicleLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createVehicleLayer([mockVehicle], false)).toBeNull();
  });

  it('returns null when vehicles array is empty', () => {
    expect(createVehicleLayer([], true)).toBeNull();
  });

  it('returns an IconLayer when vehicles exist and isActive=true', () => {
    const layer = createVehicleLayer([mockVehicle], true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('vehicles');
  });

  it('IconLayer has pickable=true', () => {
    const layer = createVehicleLayer([mockVehicle], true) as any;
    expect(layer.props.pickable).toBe(true);
  });

  it('uses correct status colors', () => {
    const vehicles: VehicleLayerData[] = [
      { ...mockVehicle, vehicleId: 'v-a', status: 'AVAILABLE' },
      { ...mockVehicle, vehicleId: 'v-e', status: 'EN_ROUTE' },
      { ...mockVehicle, vehicleId: 'v-o', status: 'ON_SCENE' },
      { ...mockVehicle, vehicleId: 'v-r', status: 'RETURNING' },
      { ...mockVehicle, vehicleId: 'v-s', status: 'OUT_OF_SERVICE' },
    ];
    const layer = createVehicleLayer(vehicles, true) as any;
    const data = layer.props.data;
    expect(data[0].color).toBe('#22c55e'); // AVAILABLE = green
    expect(data[1].color).toBe('#eab308'); // EN_ROUTE = yellow
    expect(data[2].color).toBe('#3b82f6'); // ON_SCENE = blue
    expect(data[3].color).toBe('#6b7280'); // RETURNING = gray
    expect(data[4].color).toBe('#dc2626'); // OUT_OF_SERVICE = red
  });
});

describe('transformVehicleToLayerData', () => {
  it('maps vehicle fields correctly', () => {
    const result = transformVehicleToLayerData({
      id: 'v-1',
      callSign: 'FT-001',
      type: 'FIRE_TRUCK',
      status: 'AVAILABLE',
      location: { type: 'Point', coordinates: [-5.0, 33.4] },
    });
    expect(result.vehicleId).toBe('v-1');
    expect(result.callSign).toBe('FT-001');
    expect(result.type).toBe('FIRE_TRUCK');
    expect(result.status).toBe('AVAILABLE');
    expect(result.coordinates).toEqual([-5.0, 33.4]);
  });
});
