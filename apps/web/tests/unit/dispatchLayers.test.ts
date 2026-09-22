import { describe, it, expect, vi } from 'vitest';
import {
  createRouteLayer,
  createActiveTeamsLayer,
  createDispatchArcLayer,
  transformRouteToLayerData,
  transformTeamToLayerData,
  type RouteLayerData,
  type ActiveTeamLayerData,
} from '@/lib/map/dispatchLayers';
import type { RouteResponse } from '@/lib/routing/types';

// Mock deck.gl layers — they have WebGL deps that won't run in Node
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

const mockRoute: RouteResponse = {
  primary: {
    coordinates: [[-5.1, 33.5], [-5.2, 33.6]],
    distance_km: 5.2,
    duration_min: 8,
  },
  alternatives: [],
  metadata: { provider: 'graphhopper', cached: false, computed_at: new Date().toISOString() },
};

const mockRouteLayerData: RouteLayerData = {
  route: mockRoute,
  routeId: 'route-1',
  isPrimary: true,
};

const mockTeam: ActiveTeamLayerData = {
  teamId: 'team-1',
  teamName: 'Alpha',
  status: 'EN_ROUTE',
  coordinates: [-5.1, 33.5],
};

describe('createRouteLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createRouteLayer([mockRouteLayerData], false)).toBeNull();
  });

  it('returns null when routes array is empty', () => {
    expect(createRouteLayer([], true)).toBeNull();
  });

  it('returns a PathLayer when routes exist and isActive=true', () => {
    const layer = createRouteLayer([mockRouteLayerData], true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('dispatch-routes');
  });

  it('PathLayer has updateTriggers set', () => {
    const layer = createRouteLayer([mockRouteLayerData], true) as any;
    expect(layer.props.updateTriggers).toBeDefined();
    expect(layer.props.updateTriggers.getPath).toBeDefined();
  });
});

describe('createActiveTeamsLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createActiveTeamsLayer([mockTeam], false)).toBeNull();
  });

  it('returns null when teams array is empty', () => {
    expect(createActiveTeamsLayer([], true)).toBeNull();
  });

  it('returns an IconLayer when teams exist and isActive=true', () => {
    const layer = createActiveTeamsLayer([mockTeam], true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('active-teams');
  });

  it('IconLayer has updateTriggers set', () => {
    const layer = createActiveTeamsLayer([mockTeam], true) as any;
    expect(layer.props.updateTriggers).toBeDefined();
    expect(layer.props.updateTriggers.getPosition).toBeDefined();
  });
});

describe('transformRouteToLayerData', () => {
  it('wraps route with routeId and default isPrimary=true', () => {
    const result = transformRouteToLayerData(mockRoute, 'r1');
    expect(result.routeId).toBe('r1');
    expect(result.isPrimary).toBe(true);
    expect(result.route).toBe(mockRoute);
  });

  it('respects explicit isPrimary=false', () => {
    const result = transformRouteToLayerData(mockRoute, 'r2', false);
    expect(result.isPrimary).toBe(false);
  });
});

describe('createDispatchArcLayer', () => {
  it('returns null when isActive=false', () => {
    expect(createDispatchArcLayer([mockRouteLayerData], false)).toBeNull();
  });

  it('returns null when routes array is empty', () => {
    expect(createDispatchArcLayer([], true)).toBeNull();
  });

  it('returns an ArcLayer for valid primary routes', () => {
    const layer = createDispatchArcLayer([mockRouteLayerData], true);
    expect(layer).not.toBeNull();
    expect((layer as any).props.id).toBe('dispatch-arcs');
  });

  it('returns null when only non-primary routes provided', () => {
    const nonPrimary: RouteLayerData = { ...mockRouteLayerData, isPrimary: false };
    expect(createDispatchArcLayer([nonPrimary], true)).toBeNull();
  });
});

describe('transformTeamToLayerData', () => {
  it('maps team fields correctly', () => {
    const result = transformTeamToLayerData({
      id: 't1',
      name: 'Bravo',
      status: 'AVAILABLE',
      location: { type: 'Point', coordinates: [-5.0, 33.4] },
    });
    expect(result.teamId).toBe('t1');
    expect(result.teamName).toBe('Bravo');
    expect(result.status).toBe('AVAILABLE');
    expect(result.coordinates).toEqual([-5.0, 33.4]);
  });
});
