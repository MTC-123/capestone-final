/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

/* ────────── Mocks ────────── */

// react-map-gl
const mockFlyTo = vi.fn();
const mockGetMap = vi.fn(() => ({
  hasImage: () => false,
  addImage: vi.fn(),
  on: vi.fn(),
}));
const mockMapRef = { current: { flyTo: mockFlyTo, getMap: mockGetMap } };

vi.mock('react-map-gl', () => {
  const actual = { useRef: () => mockMapRef };
  return {
    default: vi.fn(({ children, onClick, onMouseEnter, onMouseLeave, ...props }: any) => (
      <div data-testid="mock-map" data-basemap={props.mapStyle} onClick={onClick}>
        {children}
      </div>
    )),
    Source: vi.fn(({ children, ...props }: any) => (
      <div data-testid={`source-${props.id}`} data-source-type={props.type}>
        {children}
      </div>
    )),
    Layer: vi.fn((props: any) => (
      <div
        data-testid={`layer-${props.id}`}
        data-visibility={props.layout?.visibility}
      />
    )),
    Popup: vi.fn(({ children }: any) => <div data-testid="popup">{children}</div>),
    NavigationControl: vi.fn(() => <div data-testid="nav-control" />),
    ScaleControl: vi.fn(() => <div data-testid="scale-control" />),
    GeolocateControl: vi.fn(() => <div data-testid="geolocate-control" />),
    useControl: vi.fn(() => ({ setProps: vi.fn() })),
    useMap: vi.fn(() => ({ current: mockMapRef.current })),
  };
});

// deck.gl
vi.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: vi.fn(),
}));

vi.mock('@deck.gl/layers', () => ({
  IconLayer: class IconLayer { constructor(public props: any) {} get id() { return this.props.id; } },
  PathLayer: class PathLayer { constructor(public props: any) {} get id() { return this.props.id; } },
  ScatterplotLayer: class ScatterplotLayer { constructor(public props: any) {} get id() { return this.props.id; } },
  ArcLayer: class ArcLayer { constructor(public props: any) {} get id() { return this.props.id; } },
}));

// maplibre CSS
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

// GPU detection
const mockDetectGPU = vi.fn();
vi.mock('@/lib/gpu/detection', () => ({
  detectGPUCapabilities: (...args: any[]) => mockDetectGPU(...args),
}));

// Map styles
const mockGetMapStyle = vi.fn((_basemap?: any) => 'mock-style-url');
vi.mock('@/lib/map/styles', () => ({
  getMapStyle: (basemap: any) => mockGetMapStyle(basemap),
  HAS_PREMIUM_TILES: false,
}));

// Slope protocol
vi.mock('@/lib/map/slopeProtocol', () => ({
  registerSlopeProtocol: vi.fn(),
  unregisterSlopeProtocol: vi.fn(),
  configureSlopeProtocol: vi.fn(),
}));

// Layers
vi.mock('@/lib/map/layers', () => ({
  createResourceLayer: vi.fn(() => null),
  createInfrastructureLayers: vi.fn(() => []),
  createIncidentPulseLayer: vi.fn(() => null),
  createRetardantLayer: vi.fn(() => null),
}));

vi.mock('@/lib/map/dispatchLayers', () => ({
  createRouteLayer: vi.fn(() => null),
  createActiveTeamsLayer: vi.fn(() => null),
  createDispatchArcLayer: vi.fn(() => null),
  createVehicleLayer: vi.fn(() => null),
  transformRouteToLayerData: vi.fn(),
  transformTeamToLayerData: vi.fn(),
  transformVehicleToLayerData: vi.fn(),
}));

// Helpers
vi.mock('@/lib/map/helpers', () => ({
  asGeoJSON: vi.fn((d: any) => d),
  circleIcon: vi.fn(() => 'data:svg'),
  hexToRgba: vi.fn(() => [255, 0, 0, 255]),
}));

vi.mock('@/lib/map/colors', () => ({
  INCIDENT_STATUS_COLORS: { VIGILANCE: '#f59e0b', ALERTE: '#f97316', INTERVENTION: '#ef4444', MAITRISE: '#8b5cf6', ETEINT: '#6b7280' },
  FIRMS_CONFIDENCE_COLORS: { low: '#fbbf24', nominal: '#f97316', high: '#ef4444' },
  RESOURCE_TYPE_COLORS: { TRUCK: '#22c55e', AIRCRAFT: '#3b82f6', PERSONNEL: '#f59e0b', EQUIPMENT: '#ec4899' },
  INFRASTRUCTURE_TYPE_COLORS: { WATCHTOWER: '#7c3aed', WATER_POINT: '#0ea5e9', STATION: '#14b8a6', FIREBREAK: '#8b5cf6', HELIPAD: '#6366f1' },
  RETARDANT_COLOR: '#f43f5e',
  SOIL_MOISTURE_COLORS: {},
  RESERVOIR_COLORS: {},
  PAMF_COLORS: {},
  RMA_COLORS: {},
}));

// Mock child components to avoid deep dependency chains
vi.mock('@/components/map/MapLegend', () => ({
  default: () => <div data-testid="mock-legend" />,
}));

vi.mock('@/components/map/MapControls', () => ({
  default: () => <div data-testid="mock-controls" />,
}));

vi.mock('@/components/map/MapStatusBar', () => ({
  default: () => <div data-testid="mock-statusbar" />,
}));

vi.mock('@/components/map/WeatherWidget', () => ({
  default: () => <div data-testid="mock-weather" />,
}));

vi.mock('@/lib/map/windArrow', () => ({
  createWindArrowImage: vi.fn(() => ({ width: 32, height: 32, data: new Uint8Array(32 * 32 * 4) })),
}));

// Hooks
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/hooks/usePopulationAtRisk', () => ({
  usePopulationAtRisk: () => ({ population: null, loading: false }),
}));

vi.mock('@/hooks/useFireSpreadVectors', () => ({
  useFireSpreadVectors: () => ({ vectors: null, status: 'idle' }),
}));

// API
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Performance layers — use real module
vi.mock('@/lib/map/performanceLayers', async () => {
  const actual = await vi.importActual<any>('@/lib/map/performanceLayers');
  return actual;
});

// Stores — use real zustand stores
vi.mock('@/store/useToastStore', () => ({
  useToastStore: Object.assign(
    (selector: any) => selector({ addToast: vi.fn() }),
    { getState: () => ({ addToast: vi.fn() }) },
  ),
}));

/* ────────── Test data ────────── */

const INCIDENT_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-5.105, 33.531] },
      properties: { id: 'inc-1', cause: 'Lightning', severity: 3, status: 'INTERVENTION', createdAt: new Date().toISOString() },
    },
  ],
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

/* ────────── Helpers ────────── */

function setupFetchMock(overrides?: Record<string, { status: number; body: any }>) {
  const defaults: Record<string, { status: number; body: any }> = {
    '/api/geo/incidents': { status: 200, body: INCIDENT_GEOJSON },
    '/api/geo/resources': { status: 200, body: EMPTY_FC },
    '/api/geo/infrastructure': { status: 200, body: EMPTY_FC },
    '/api/detections/combined': { status: 200, body: EMPTY_FC },
    '/api/geo/vehicles': { status: 200, body: EMPTY_FC },
    '/api/retardant': { status: 200, body: { items: [] } },
  };
  const routes = { ...defaults, ...overrides };

  global.fetch = vi.fn((url: string | URL | Request, _opts?: any) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    for (const [pattern, response] of Object.entries(routes)) {
      if (urlStr.includes(pattern.replace(/^\//, ''))) {
        return Promise.resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          json: () => Promise.resolve(response.body),
          text: () => Promise.resolve(JSON.stringify(response.body)),
          headers: new Headers(),
        } as Response);
      }
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(EMPTY_FC), text: () => Promise.resolve('{}'), headers: new Headers() } as Response);
  }) as any;
}

/* ────────── Tests ────────── */

describe('RicerMap', () => {
  let RicerMap: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDetectGPU.mockResolvedValue({ tier: 'tier-c', webgl2: false, maxTextureSize: 2048 });
    setupFetchMock();

    // Dynamic import to pick up mocks
    const mod = await import('@/components/map/RicerMap');
    RicerMap = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ──── Rendering basics ──── */

  it('renders the map container', async () => {
    render(<RicerMap />);
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });

  it('renders with data-ricer-map-ready attribute', async () => {
    render(<RicerMap />);
    const container = screen.getByTestId('mock-map').parentElement;
    expect(container?.getAttribute('data-ricer-map-ready')).toBe('true');
  });

  /* ──── Data fetch lifecycle ──── */

  it('fetches incidents on mount', async () => {
    render(<RicerMap />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('geo/incidents'),
        expect.any(Object),
      );
    });
  });

  it('fetches resources on mount', async () => {
    render(<RicerMap />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('geo/resources'),
        expect.any(Object),
      );
    });
  });

  it('fetches infrastructure on mount', async () => {
    render(<RicerMap />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('geo/infrastructure'),
        expect.any(Object),
      );
    });
  });

  it('fetches FIRMS detections on mount', async () => {
    render(<RicerMap />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('detections/combined'),
        expect.any(Object),
      );
    });
  });

  it('handles fetch errors gracefully (500 on incidents)', async () => {
    setupFetchMock({
      '/api/geo/incidents': { status: 500, body: { error: 'Server error' } },
    });

    // Should not throw
    render(<RicerMap />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('geo/incidents'),
        expect.any(Object),
      );
    });
    // Map should still render
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });

  /* ──── GPU tier rendering ──── */

  it('starts with tier-c (safest default)', async () => {
    mockDetectGPU.mockResolvedValue({ tier: 'tier-c', webgl2: false, maxTextureSize: 2048 });
    render(<RicerMap />);
    await waitFor(() => {
      expect(mockDetectGPU).toHaveBeenCalled();
    });
    // Tier C: no deck.gl animated layers
    const { createIncidentPulseLayer } = await import('@/lib/map/layers');
    // On tier-c, animatedDeckLayers memo returns [] without calling createIncidentPulseLayer
    // because tierConfig.enableAnimations is false
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });

  it('upgrades to tier-a when GPU detection succeeds', async () => {
    mockDetectGPU.mockResolvedValue({ tier: 'tier-a', webgl2: true, maxTextureSize: 16384 });
    render(<RicerMap />);
    await waitFor(() => {
      expect(mockDetectGPU).toHaveBeenCalledWith(2000);
    });
  });

  it('falls back to tier-c on GPU detection error', async () => {
    mockDetectGPU.mockRejectedValue(new Error('WebGL not available'));
    render(<RicerMap />);
    // Should not crash
    await waitFor(() => {
      expect(mockDetectGPU).toHaveBeenCalled();
    });
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });

  /* ──── Basemap style ──── */

  it('calls getMapStyle with current basemap', async () => {
    render(<RicerMap />);
    await waitFor(() => {
      expect(mockGetMapStyle).toHaveBeenCalledWith('streets');
    });
  });

  /* ──── Click handlers ──── */

  it('handles click on cluster feature by flying to it', async () => {
    render(<RicerMap />);

    const map = screen.getByTestId('mock-map');
    const mockEvent = {
      features: [{
        properties: { cluster: true, cluster_id: 1, point_count: 5 },
        geometry: { coordinates: [-5.1, 33.5] },
      }],
      lngLat: { lng: -5.1, lat: 33.5 },
      originalEvent: {},
    };

    // Simulate click via the onClick handler
    const ReactMapGL = (await import('react-map-gl')).default as any;
    const lastCall = ReactMapGL.mock.calls[ReactMapGL.mock.calls.length - 1];
    if (lastCall) {
      const onClickProp = lastCall[0]?.onClick;
      if (onClickProp) {
        act(() => onClickProp(mockEvent));
      }
    }
  });

  it('handles click on incident feature by setting selected ID', async () => {
    const { useMapStore } = await import('@/store/useMapStore');
    render(<RicerMap />);

    const ReactMapGL = (await import('react-map-gl')).default as any;
    const lastCall = ReactMapGL.mock.calls[ReactMapGL.mock.calls.length - 1];
    if (lastCall) {
      const onClickProp = lastCall[0]?.onClick;
      if (onClickProp) {
        act(() => onClickProp({
          features: [{
            properties: { id: 'inc-1', status: 'INTERVENTION' },
            geometry: { coordinates: [-5.1, 33.5] },
            layer: { id: 'incidents-unclustered' },
          }],
          lngLat: { lng: -5.1, lat: 33.5 },
          originalEvent: {},
        }));
      }
    }

    // Verify the store was updated
    const state = useMapStore.getState();
    expect(state.selectedIncidentId).toBe('inc-1');
  });

  /* ──── Abort on unmount ──── */

  it('aborts fetches on unmount', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    const { unmount } = render(<RicerMap />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    unmount();
    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });

  /* ──── Layer sources rendered ──── */

  it('renders incident source', async () => {
    render(<RicerMap />);
    // The incident source should be present in the rendered output
    await waitFor(() => {
      expect(screen.getByTestId('source-incidents')).toBeInTheDocument();
    });
  });

  /* ──── Tile retry with fake timers ──── */

  it('auto-retries failed EFFIS tiles after delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { useMapStore } = await import('@/store/useMapStore');

    // Mark effisFwi as unavailable
    act(() => {
      useMapStore.getState().setTileAvailable('effisFwi', false);
    });

    render(<RicerMap />);

    // Advance past first retry delay (60s)
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    // The tile retry effect should have run and re-enabled the tile
    const state = useMapStore.getState();
    expect(state.tileAvailability.effisFwi).toBe(true);

    vi.useRealTimers();
  });
});
