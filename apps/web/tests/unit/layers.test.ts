/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { createIncidentPulseLayer, createResourceLayer, createInfrastructureLayers, createRetardantLayer } from '@/lib/map/layers';
import type { GeoFeatureCollection, GeoIncidentProps, GeoResourceProps, GeoInfrastructureProps } from '@/types';

// Mock deck.gl layers — WebGL deps can't run in Node
vi.mock('@deck.gl/layers', () => ({
  IconLayer: class IconLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
  PathLayer: class PathLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
  ScatterplotLayer: class ScatterplotLayer {
    constructor(public props: any) {}
    get id() { return this.props.id; }
  },
}));

vi.mock('@/lib/map/helpers', () => ({
  circleIcon: (color: string) => `data:svg,${color}`,
  shapeIcon: (_shape: string, color: string) => `data:svg,${color}`,
  hexToRgba: (hex: string, alpha = 255) => [255, 100, 0, alpha],
  RESOURCE_SHAPE: { TRUCK: 'circle', AIRCRAFT: 'diamond', PERSONNEL: 'triangle', EQUIPMENT: 'square' },
  INFRA_SHAPE: { WATCHTOWER: 'triangle', WATER_POINT: 'circle', STATION: 'square', HELIPAD: 'diamond', FIREBREAK: 'circle' },
}));

vi.mock('@/lib/map/colors', () => ({
  RESOURCE_TYPE_COLORS: { TRUCK: '#22c55e', AIRCRAFT: '#3b82f6', PERSONNEL: '#f59e0b', EQUIPMENT: '#ec4899' },
  INCIDENT_STATUS_COLORS: {
    VIGILANCE: '#f59e0b',
    ALERTE: '#f97316',
    INTERVENTION: '#ef4444',
    MAITRISE: '#8b5cf6',
    ETEINT: '#6b7280',
  },
  INFRASTRUCTURE_TYPE_COLORS: {
    WATCHTOWER: '#7c3aed',
    WATER_POINT: '#0ea5e9',
    STATION: '#14b8a6',
    FIREBREAK: '#8b5cf6',
    HELIPAD: '#6366f1',
  },
  RETARDANT_COLOR: '#f43f5e',
}));

const activeIncidents: GeoFeatureCollection<GeoIncidentProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
      properties: {
        id: 'inc-1',
        cause: 'Lightning',
        severity: 3,
        status: 'INTERVENTION',
        createdAt: new Date().toISOString(),
      },
    },
  ],
};

const extinctIncidents: GeoFeatureCollection<GeoIncidentProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
      properties: {
        id: 'inc-2',
        cause: 'Human',
        severity: 1,
        status: 'ETEINT',
        createdAt: new Date().toISOString(),
      },
    },
  ],
};

const emptyCollection: GeoFeatureCollection<GeoIncidentProps> = {
  type: 'FeatureCollection',
  features: [],
};

describe('createIncidentPulseLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createIncidentPulseLayer(activeIncidents, 0, false)).toBeNull();
  });

  it('returns null when all incidents are ETEINT', () => {
    expect(createIncidentPulseLayer(extinctIncidents, 0, true)).toBeNull();
  });

  it('returns null when feature collection is empty', () => {
    expect(createIncidentPulseLayer(emptyCollection, 0, true)).toBeNull();
  });

  it('returns a ScatterplotLayer with correct id for active incidents', () => {
    const layer = createIncidentPulseLayer(activeIncidents, 0.5, true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('incident-pulse');
  });

  it('has updateTriggers for pulsePhase', () => {
    const layer = createIncidentPulseLayer(activeIncidents, 0.3, true) as any;
    expect(layer.props.updateTriggers).toBeDefined();
    expect(layer.props.updateTriggers.getRadius).toContain(0.3);
    expect(layer.props.updateTriggers.getFillColor).toContain(0.3);
  });
});

/* ────────────────────────────────────────────────────────────
 * createResourceLayer
 * ──────────────────────────────────────────────────────────── */

const resourceFC: GeoFeatureCollection<GeoResourceProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
      properties: { id: 'r-1', type: 'TRUCK', name: 'Truck 1', status: 'AVAILABLE' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
      properties: { id: 'r-2', type: 'AIRCRAFT', name: 'Heli 1', status: 'EN_ROUTE' },
    },
  ],
};

const emptyResourceFC: GeoFeatureCollection<GeoResourceProps> = {
  type: 'FeatureCollection',
  features: [],
};

describe('createResourceLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createResourceLayer(resourceFC, false)).toBeNull();
  });

  it('returns null when features empty', () => {
    expect(createResourceLayer(emptyResourceFC, true)).toBeNull();
  });

  it('returns IconLayer with id "resource-icons"', () => {
    const layer = createResourceLayer(resourceFC, true) as any;
    expect(layer).not.toBeNull();
    expect(layer.props.id).toBe('resource-icons');
  });

  it('maps RESOURCE_TYPE_COLORS via circleIcon', () => {
    const layer = createResourceLayer(resourceFC, true) as any;
    const data = layer.props.data;
    // TRUCK → '#22c55e' from mocked RESOURCE_TYPE_COLORS
    expect(data[0].color).toBe('#22c55e');
    // AIRCRAFT → '#3b82f6'
    expect(data[1].color).toBe('#3b82f6');
  });

  it('has updateTriggers keyed on data.length', () => {
    const layer = createResourceLayer(resourceFC, true) as any;
    expect(layer.props.updateTriggers.getPosition).toContain(2);
    expect(layer.props.updateTriggers.getIcon).toContain(2);
  });
});

/* ────────────────────────────────────────────────────────────
 * createInfrastructureLayers
 * ──────────────────────────────────────────────────────────── */

const pointInfra: GeoFeatureCollection<GeoInfrastructureProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
      properties: { id: 'i-1', type: 'WATCHTOWER', name: 'Tower A', status: 'ACTIVE', description: '' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
      properties: { id: 'i-2', type: 'WATER_POINT', name: 'Reservoir B', status: 'ACTIVE', description: '' },
    },
  ],
};

const firebreakInfra: GeoFeatureCollection<GeoInfrastructureProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-5.1, 33.5], [-5.2, 33.6]] } as any,
      properties: { id: 'i-3', type: 'FIREBREAK', name: 'Break 1', status: 'ACTIVE', description: '' },
    },
  ],
};

const mixedInfra: GeoFeatureCollection<GeoInfrastructureProps> = {
  type: 'FeatureCollection',
  features: [...pointInfra.features, ...firebreakInfra.features],
};

const emptyInfraFC: GeoFeatureCollection<GeoInfrastructureProps> = {
  type: 'FeatureCollection',
  features: [],
};

describe('createInfrastructureLayers', () => {
  it('returns [] when isActive=false', () => {
    expect(createInfrastructureLayers(mixedInfra, false)).toEqual([]);
  });

  it('returns [] when features empty', () => {
    expect(createInfrastructureLayers(emptyInfraFC, true)).toEqual([]);
  });

  it('returns only IconLayer for point-type features', () => {
    const layers = createInfrastructureLayers(pointInfra, true);
    expect(layers).toHaveLength(1);
    expect((layers[0] as any).props.id).toBe('infra-icons');
  });

  it('returns only PathLayer for FIREBREAK features', () => {
    const layers = createInfrastructureLayers(firebreakInfra, true);
    expect(layers).toHaveLength(1);
    expect((layers[0] as any).props.id).toBe('firebreak-paths');
  });

  it('returns both IconLayer + PathLayer for mixed infrastructure', () => {
    const layers = createInfrastructureLayers(mixedInfra, true);
    expect(layers).toHaveLength(2);
    const ids = layers.map((l: any) => l.props.id);
    expect(ids).toContain('infra-icons');
    expect(ids).toContain('firebreak-paths');
  });

  it('PathLayer getColor returns [139, 92, 246] (purple)', () => {
    const layers = createInfrastructureLayers(firebreakInfra, true);
    const pathLayer = layers[0] as any;
    expect(pathLayer.props.getColor()).toEqual([139, 92, 246]);
  });
});

/* ────────────────────────────────────────────────────────────
 * createRetardantLayer
 * ──────────────────────────────────────────────────────────── */

describe('createRetardantLayer', () => {
  const retardantData = [
    { coordinates: [-5.1, 33.5] as [number, number], name: 'Depot A' },
    { coordinates: [-5.2, 33.6] as [number, number], name: 'Depot B' },
  ];

  it('returns null when isActive=false', () => {
    expect(createRetardantLayer(retardantData, false)).toBeNull();
  });

  it('returns null when data is empty', () => {
    expect(createRetardantLayer([], true)).toBeNull();
  });

  it('returns IconLayer with id "retardant-icons"', () => {
    const layer = createRetardantLayer(retardantData, true) as any;
    expect(layer).not.toBeNull();
    expect(layer.props.id).toBe('retardant-icons');
  });

  it('has updateTriggers keyed on data.length', () => {
    const layer = createRetardantLayer(retardantData, true) as any;
    expect(layer.props.updateTriggers.getPosition).toContain(2);
  });
});

/* ────────────────────────────────────────────────────────────
 * Edge cases — empty data handling
 * ──────────────────────────────────────────────────────────── */

describe('layer edge cases', () => {
  it('createIncidentPulseLayer with 0 pulsePhase still returns layer for active incidents', () => {
    const layer = createIncidentPulseLayer(activeIncidents, 0, true);
    expect(layer).not.toBeNull();
  });

  it('createIncidentPulseLayer with pulsePhase=1.0 (boundary) returns layer', () => {
    const layer = createIncidentPulseLayer(activeIncidents, 1.0, true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('incident-pulse');
  });

  it('createResourceLayer with activeTypes filtering all types returns null', () => {
    const allOff = { TRUCK: false, AIRCRAFT: false, PERSONNEL: false, EQUIPMENT: false };
    expect(createResourceLayer(resourceFC, true, allOff)).toBeNull();
  });

  it('createResourceLayer with some activeTypes filters correctly', () => {
    const onlyTruck = { TRUCK: true, AIRCRAFT: false, PERSONNEL: false, EQUIPMENT: false };
    const layer = createResourceLayer(resourceFC, true, onlyTruck) as any;
    expect(layer).not.toBeNull();
    expect(layer.props.data).toHaveLength(1);
    expect(layer.props.data[0].type).toBe('TRUCK');
  });

  it('createInfrastructureLayers with only HELIPAD features returns IconLayer', () => {
    const helipadFC: GeoFeatureCollection<GeoInfrastructureProps> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
        properties: { id: 'h-1', type: 'HELIPAD', name: 'Pad A', status: 'ACTIVE', description: '' },
      }],
    };
    const layers = createInfrastructureLayers(helipadFC, true);
    expect(layers).toHaveLength(1);
    expect((layers[0] as any).props.id).toBe('infra-icons');
  });

  it('createIncidentPulseLayer filters out ETEINT incidents in mixed collection', () => {
    const mixed: GeoFeatureCollection<GeoIncidentProps> = {
      type: 'FeatureCollection',
      features: [
        ...activeIncidents.features,
        ...extinctIncidents.features,
      ],
    };
    const layer = createIncidentPulseLayer(mixed, 0.5, true) as any;
    expect(layer).not.toBeNull();
    // Only active (non-ETEINT) incidents should be in data
    expect(layer.props.data).toHaveLength(1);
  });
});
