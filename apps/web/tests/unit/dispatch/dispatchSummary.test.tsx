import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * DispatchSummary unit test — verifies vehicle-only dispatch renders summary
 */

// Mock useTranslation
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock Icon component
vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

// Control store state via mock
const mockStoreState = {
  selectedTeams: [] as any[],
  selectedVehicles: [] as any[],
  activeRoutes: [] as any[],
};

vi.mock('@/store/useDispatchStore', () => ({
  useDispatchStore: () => mockStoreState,
}));

import { DispatchSummary } from '@/components/dispatch/DispatchSummary';

describe('DispatchSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.selectedTeams = [];
    mockStoreState.selectedVehicles = [];
    mockStoreState.activeRoutes = [];
  });

  it('returns null when no teams and no vehicles selected', () => {
    const { container } = render(<DispatchSummary />);
    expect(container.firstChild).toBeNull();
  });

  it('renders summary with team-only selection', () => {
    mockStoreState.selectedTeams = [
      { id: 'team-1', name: 'Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5 },
    ];

    render(<DispatchSummary />);

    expect(screen.getByText('dispatchSummary')).toBeInTheDocument();
    // Team count displayed
    expect(screen.getByText('1/5')).toBeInTheDocument();
    // Personnel capacity
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders summary with vehicle-only selection', () => {
    mockStoreState.selectedVehicles = [
      { id: 'v-1', callSign: 'FT-001', type: 'FIRE_TRUCK', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5000 },
      { id: 'v-2', callSign: 'WT-001', type: 'WATER_TANKER', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.12, 33.52] }, capacity: 10000 },
    ];

    render(<DispatchSummary />);

    // Summary should be visible (not null)
    expect(screen.getByText('dispatchSummary')).toBeInTheDocument();
    // Vehicle count
    expect(screen.getByText('2/5')).toBeInTheDocument();
    // Total vehicle capacity: 15000
    expect(screen.getByText('15,000 L')).toBeInTheDocument();
  });

  it('renders summary with mixed teams + vehicles', () => {
    mockStoreState.selectedTeams = [
      { id: 'team-1', name: 'Alpha', type: 'GROUND_CREW', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5 },
    ];
    mockStoreState.selectedVehicles = [
      { id: 'v-1', callSign: 'FT-001', type: 'FIRE_TRUCK', status: 'AVAILABLE', location: { type: 'Point', coordinates: [-5.1, 33.5] }, capacity: 5000 },
    ];

    render(<DispatchSummary />);

    expect(screen.getByText('dispatchSummary')).toBeInTheDocument();
  });
});
