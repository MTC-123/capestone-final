import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * RouteViewer unit test — verifies vehicle route cards render correctly
 */

// Mock useTranslation
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock Icon component
vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

// We need to mock the store to control state
const mockStoreState = {
  activeRoutes: [] as any[],
  selectedTeams: [] as any[],
  selectedVehicles: [] as any[],
  selectRoute: vi.fn(),
};

vi.mock('@/store/useDispatchStore', () => ({
  useDispatchStore: () => mockStoreState,
}));

import { RouteViewer } from '@/components/dispatch/RouteViewer';

function makeRoute(overrides?: Partial<any>) {
  return {
    routeId: 'route-v-1',
    teamId: 'v-1', // Vehicle ID stored in teamId for layer compat
    incidentId: 'inc-1',
    route: {
      primary: { coordinates: [[-5.1, 33.5], [-5.08, 33.55]], distance_km: 5.2, duration_min: 12, instructions: [] },
      alternatives: [],
      metadata: { provider: 'graphhopper', cached: false, computed_at: '2026-02-19T10:00:00Z' },
    },
    selected: false,
    ...overrides,
  };
}

describe('RouteViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.activeRoutes = [];
    mockStoreState.selectedTeams = [];
    mockStoreState.selectedVehicles = [];
  });

  it('returns null when no active routes', () => {
    const { container } = render(<RouteViewer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders route card for a team route', () => {
    mockStoreState.activeRoutes = [makeRoute({ routeId: 'route-t-1', teamId: 'team-1' })];
    mockStoreState.selectedTeams = [
      { id: 'team-1', name: 'Station 1 Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5 },
    ];

    render(<RouteViewer />);

    expect(screen.getByText('Station 1 Alpha')).toBeInTheDocument();
    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByTestId('route-card')).toBeInTheDocument();
  });

  it('renders route card for a vehicle route using callSign', () => {
    mockStoreState.activeRoutes = [makeRoute()];
    mockStoreState.selectedVehicles = [
      { id: 'v-1', callSign: 'FT-001', type: 'FIRE_TRUCK', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5000 },
    ];

    render(<RouteViewer />);

    expect(screen.getByText('FT-001')).toBeInTheDocument();
    expect(screen.getByText('5.2 km')).toBeInTheDocument();
    expect(screen.getByTestId('route-card')).toBeInTheDocument();
  });

  it('drops route card when entity not found in teams or vehicles', () => {
    mockStoreState.activeRoutes = [makeRoute({ teamId: 'unknown-id' })];

    render(<RouteViewer />);

    expect(screen.queryByTestId('route-card')).not.toBeInTheDocument();
  });

  it('renders mixed team and vehicle route cards', () => {
    mockStoreState.activeRoutes = [
      makeRoute({ routeId: 'route-t-1', teamId: 'team-1' }),
      makeRoute({ routeId: 'route-v-1', teamId: 'v-1' }),
    ];
    mockStoreState.selectedTeams = [
      { id: 'team-1', name: 'Station 1 Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5 },
    ];
    mockStoreState.selectedVehicles = [
      { id: 'v-1', callSign: 'FT-001', type: 'FIRE_TRUCK', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5000 },
    ];

    render(<RouteViewer />);

    const cards = screen.getAllByTestId('route-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Station 1 Alpha')).toBeInTheDocument();
    expect(screen.getByText('FT-001')).toBeInTheDocument();
  });
});
