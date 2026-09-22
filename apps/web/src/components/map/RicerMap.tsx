'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactMapGL, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  ScaleControl,
  GeolocateControl,
  useControl,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { MapboxOverlayProps } from '@deck.gl/mapbox/typed';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/store/useMapStore';
import { useDispatchStore } from '@/store/useDispatchStore';
import { useToastStore } from '@/store/useToastStore';
import MapControls from '@/components/map/MapControls';
import MapLegend from './MapLegend';
import WeatherWidget from '@/components/map/WeatherWidget';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/i18n/translations';
import { getMapStyle, HAS_PREMIUM_TILES } from '@/lib/map/styles';
import { INCIDENT_STATUS_COLORS, FIRMS_CONFIDENCE_COLORS, SOIL_MOISTURE_COLORS, RESERVOIR_COLORS, PAMF_COLORS, RMA_COLORS } from '@/lib/map/colors';
import { usePopulationAtRisk } from '@/hooks/usePopulationAtRisk';
import { useFireSpreadVectors } from '@/hooks/useFireSpreadVectors';
import { registerSlopeProtocol, unregisterSlopeProtocol, configureSlopeProtocol } from '@/lib/map/slopeProtocol';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { asGeoJSON } from '@/lib/map/helpers';
import { logger } from '@/lib/observability/logger';
import { createResourceLayer, createInfrastructureLayers, createIncidentPulseLayer, createRetardantLayer } from '@/lib/map/layers';
import {
  createRouteLayer,
  createActiveTeamsLayer,
  createDispatchArcLayer,
  createVehicleLayer,
  transformRouteToLayerData,
  transformTeamToLayerData,
  transformVehicleToLayerData,
} from '@/lib/map/dispatchLayers';
import { detectGPUCapabilities, type GPUTier } from '@/lib/gpu/detection';
import { getLayerConfigForTier } from '@/lib/map/performanceLayers';
import { createWindArrowImage } from '@/lib/map/windArrow';
import type {
  GeoFeatureCollection,
  GeoIncidentProps,
  GeoResourceProps,
  GeoInfrastructureProps,
  GeoFirmsDetectionProps,
  GeoVehicleProps,
  GeoWindPointProps,
  WeatherData,
} from '@/types';

/* ────────── helpers ────────── */

const INTERACTIVE_LAYER_IDS: string[] = [
  'incidents-unclustered',
  'incidents-cluster',
  'firms-detections-unclustered',
  'firms-cluster',
  'wind-arrows',
  'soil-moisture-circles',
  'effis-burned-vector-fill',
  'reservoir-circles',
  'pamf-fill',
  'rma-fill',
];

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' } as const;
const TOOLTIP_STYLE = 'pointer-events-none fixed z-50 hidden rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-elev-3';
const TOOLTIP_TRANSFORM = 'translate(-50%, -100%) translateY(-8px)';

/* ────────── stable empty refs ────────── */

const EMPTY_RESOURCES: GeoFeatureCollection<GeoResourceProps> = { type: 'FeatureCollection', features: [] };
const EMPTY_INFRASTRUCTURE: GeoFeatureCollection<GeoInfrastructureProps> = { type: 'FeatureCollection', features: [] };
const EMPTY_FIRMS: GeoFeatureCollection<GeoFirmsDetectionProps> = { type: 'FeatureCollection', features: [] };
const EMPTY_VEHICLES: GeoFeatureCollection<GeoVehicleProps> = { type: 'FeatureCollection', features: [] };
const EMPTY_WIND: GeoFeatureCollection<GeoWindPointProps> = { type: 'FeatureCollection', features: [] };
const EMPTY_GEOJSON: any = { type: 'FeatureCollection', features: [] };

/* ────────── population at risk badge ────────── */

function PopulationAtRiskBadge({ center }: { center: [number, number] }) {
  const { population, loading } = usePopulationAtRisk(center);
  if (loading) return <div className="text-[10px] text-muted-foreground animate-pulse mt-1">...</div>;
  if (population === null || population === 0) return null;
  const formatted = population >= 1000
    ? `~${(population / 1000).toFixed(1).replace(/\.0$/, '')}K`
    : `~${population}`;
  const isHighRisk = population > 5000;
  return (
    <div className={`mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${
      isHighRisk
        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
    }`}>
      <span className="text-xs">&#x1F465;</span>
      <span>{formatted} people at risk (5km)</span>
    </div>
  );
}

/* ────────── component ────────── */

function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new (MapboxOverlay as any)(props));
  overlay.setProps(props);
  return null;
}

type MobileMapPanel = 'layers' | 'weather' | 'legend' | null;

interface RicerMapProps {
  weather?: WeatherData | null;
  weatherLoading?: boolean;
}

export default function RicerMap({ weather = null, weatherLoading = false }: RicerMapProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* store */
  const viewState = useMapStore((s) => s.viewState);
  const setViewState = useMapStore((s) => s.setViewState);
  const layers = useMapStore((s) => s.layers);
  const selectedIncidentId = useMapStore((s) => s.selectedIncidentId);
  const setSelectedIncidentId = useMapStore((s) => s.setSelectedIncidentId);
  const basemap = useMapStore((s) => s.basemap);
  const isHeatmapEnabled = useMapStore((s) => s.isHeatmapEnabled);
  const setDataError = useMapStore((s) => s.setDataError);
  const storeIncidents = useMapStore((s) => s.incidents);
  const setStoreIncidents = useMapStore((s) => s.setIncidents);
  const setLastSuccessfulSync = useMapStore((s) => s.setLastSuccessfulSync);

  /* dispatch store */
  const activeRoutes = useDispatchStore((s) => s.activeRoutes);
  const selectedTeams = useDispatchStore((s) => s.selectedTeams);

  /* local state — incidents live in the store (shared with map/page.tsx) */
  const incidents = storeIncidents;
  const setIncidents = setStoreIncidents;
  const [resources, setResources] = useState(EMPTY_RESOURCES);
  const [infrastructure, setInfrastructure] = useState(EMPTY_INFRASTRUCTURE);
  const [retardantData, setRetardantData] = useState<{ coordinates: [number, number]; name: string }[]>([]);
  const [firmsDetections, setFirmsDetections] = useState(EMPTY_FIRMS);
  const setFirmsLastUpdate = useMapStore((s) => s.setFirmsLastUpdate);
  const [hoveredIncident, setHoveredIncident] = useState<{
    id: string;
    properties: GeoIncidentProps;
    coordinates: [number, number];
  } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    layer: string;
    feature: any;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobileMapPanel>(null);
  const [gpuTier, setGpuTier] = useState<GPUTier>('tier-c'); // Start with safest tier
  const [isochroneData, setIsochroneData] = useState<any | null>(null);
  const [vehiclesData, setVehiclesData] = useState(EMPTY_VEHICLES);
  const [windData, setWindData] = useState(EMPTY_WIND);
  const setWindLastUpdate = useMapStore((s) => s.setWindLastUpdate);
  const [soilMoistureData, setSoilMoistureData] = useState(EMPTY_GEOJSON);
  const [burnedAreasVector, setBurnedAreasVector] = useState(EMPTY_GEOJSON);

  /* NDVI state */
  const [ndviDate, setNdviDate] = useState<string | null>(null);
  const ndviOpacity = useMapStore((s) => s.ndviOpacity);

  /* Reservoir state */
  const [reservoirData, setReservoirData] = useState<any | null>(null);

  /* Population grid state */
  const [populationGridData, setPopulationGridData] = useState<any | null>(null);

  /* PAMF/RMA state */
  const [communesData, setCommunesData] = useState<any | null>(null);
  const [pamfRmaStats, setPamfRmaStats] = useState<any | null>(null);
  const setPamfRmaHasData = useMapStore((s) => s.setPamfRmaHasData);

  /* EFFIS / Soil Moisture store controls */
  const effisFwiDay = useMapStore((s) => s.effisFwiDay);
  const effisFwiOpacity = useMapStore((s) => s.effisFwiOpacity);
  const effisFwiMode = useMapStore((s) => s.effisFwiMode);
  const effisBurnedAreaMode = useMapStore((s) => s.effisBurnedAreaMode);
  const soilMoistureDepth = useMapStore((s) => s.soilMoistureDepth);

  /* CAMS Aerosol store controls */
  const camsAerosolMode = useMapStore((s) => s.camsAerosolMode);
  const camsAerosolOpacity = useMapStore((s) => s.camsAerosolOpacity);

  /* OWM Weather Tiles store controls */
  const owmWeatherLayer = useMapStore((s) => s.owmWeatherLayer);
  const owmWeatherOpacity = useMapStore((s) => s.owmWeatherOpacity);

  /* Population Density store controls */
  const populationDensityOpacity = useMapStore((s) => s.populationDensityOpacity);

  /* Toast notifications */
  const addToast = useToastStore((s) => s.addToast);

  /* Tile availability state — lives in store so MapControls/MapLegend can read it */
  const tileAvailability = useMapStore((s) => s.tileAvailability);
  const setTileAvailable = useMapStore((s) => s.setTileAvailable);
  const tileRetryCount = useMapStore((s) => s.tileRetryCount);
  const incrementTileRetry = useMapStore((s) => s.incrementTileRetry);
  const resetTileRetry = useMapStore((s) => s.resetTileRetry);

  // Convenience aliases matching old variable names
  const jrcTilesAvailable = tileAvailability.jrcWater;
  const popTilesAvailable = tileAvailability.worldpop;
  const landCoverTilesAvailable = tileAvailability.landCover;
  const effisFwiTilesAvailable = tileAvailability.effisFwi;
  const effisBurnedTilesAvailable = tileAvailability.effisBurned;
  const camsTilesAvailable = tileAvailability.cams;

  /* Land Cover store controls */
  const landCoverOpacity = useMapStore((s) => s.landCoverOpacity);

  /* Fire Spread controls */
  const fireSpreadOpacity = useMapStore((s) => s.fireSpreadOpacity);
  const fireSpreadSimPoint = useMapStore((s) => s.fireSpreadSimPoint);
  const setFireSpreadSimPoint = useMapStore((s) => s.setFireSpreadSimPoint);

  /* Terrain layer controls */
  const slopeOpacity = useMapStore((s) => s.slopeOpacity);
  const hillshadeExaggeration = useMapStore((s) => s.hillshadeExaggeration);

  // Memoize the GPU tier config so it doesn't recompute on every render
  const tierConfig = useMemo(() => getLayerConfigForTier(gpuTier), [gpuTier]);

  // Animation state — phase flushed to React state at 3fps (was 10fps).
  // For a 2.5s sinusoidal pulse, 3fps is visually identical but 3x fewer re-renders.
  const [pulsePhase, setPulsePhase] = useState(0);
  const phaseRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  /* ═══════════ GPU Detection (non-blocking) ═══════════ */

  useEffect(() => {
    // Detect GPU capabilities asynchronously, never blocks map boot
    detectGPUCapabilities(2000).then((capabilities) => {
      setGpuTier(capabilities.tier);
      console.info('[Map] GPU tier set:', capabilities.tier, capabilities);
    }).catch((error) => {
      console.error('[Map] GPU detection error, using Tier C:', error);
      setGpuTier('tier-c');
    });
  }, []);

  /* ═══════════ Slope protocol lifecycle ═══════════ */

  useEffect(() => {
    const tileUrl = HAS_PREMIUM_TILES
      ? `https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`
      : 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
    configureSlopeProtocol(tileUrl, HAS_PREMIUM_TILES ? 'mapbox' : 'terrarium');
    registerSlopeProtocol();
    return () => unregisterSlopeProtocol();
  }, []);

  /* ═══════════ Animation loop (Tier A/B only) ═══════════ */
  // Phase stored in ref, flushed to state at 3fps — smooth enough for 2.5s sinusoidal pulse,
  // but ~3x fewer re-renders than the previous 10fps flush.

  useEffect(() => {
    if (!tierConfig.enableAnimations) return;
    const CYCLE = 2500;
    const tick = () => {
      phaseRef.current = (Date.now() % CYCLE) / CYCLE;
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    const flushInterval = setInterval(() => setPulsePhase(phaseRef.current), 333);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      clearInterval(flushInterval);
    };
  }, [tierConfig.enableAnimations]);

  /* ═══════════ Isochrone fetch ═══════════ */

  useEffect(() => {
    // Clear isochrones when layer is toggled off or incident is deselected
    if (!layers.isochrones || !selectedIncidentId) {
      setIsochroneData(null);
      return;
    }

    const feature = incidents.features.find(
      (f) => f.properties.id === selectedIncidentId,
    );
    if (!feature) {
      setIsochroneData(null);
      return;
    }

    const coords = feature.geometry.coordinates as [number, number];
    let cancelled = false;

    fetch('/api/dispatch/isochrones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: coords,
        profile: 'fire_truck',
        times: [10, 20, 30],
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setIsochroneData(data);
      })
      .catch(() => {
        if (!cancelled) setIsochroneData(null);
      });

    return () => {
      cancelled = true;
    };
  // Only refetch when incident selection or layer visibility changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId, layers.isochrones]);

  /* ═══════════ Data fetching — per-source intervals, tier-aware ═══════════ */

  useEffect(() => {
    let cancelled = false;
    let resourcesDisabled = false;
    const abortController = new AbortController();

    async function fetchIncidents() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/geo/incidents', { signal: abortController.signal });
        if (!res.ok) {
          setDataError('incidents', `HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        setIncidents(data);
        setLastSuccessfulSync(new Date());
        setDataError('incidents', null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDataError('incidents', 'Network error');
      }
    }

    async function fetchResources() {
      if (cancelled || resourcesDisabled) return;
      try {
        const res = await fetch('/api/geo/resources', { signal: abortController.signal });
        if (!res.ok) {
          if (res.status === 403) {
            setDataError('resources', null);
            resourcesDisabled = true;
            return;
          }
          setDataError('resources', `HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        setResources(data);
        setLastSuccessfulSync(new Date());
        setDataError('resources', null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDataError('resources', 'Network error');
      }
    }

    async function fetchStatic() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/geo/infrastructure', { signal: abortController.signal });
        if (res.ok) {
          setInfrastructure(await res.json());
          setDataError('infrastructure', null);
        } else {
          setDataError('infrastructure', `HTTP ${res.status}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDataError('infrastructure', 'Network error');
      }
    }

    async function fetchFirms() {
      if (cancelled) return;
      try {
        // If there was a previous FIRMS error, ask the server to reset the circuit breaker
        const hadError = useMapStore.getState().dataErrors.firmsDetections !== null;
        const firmsUrl = hadError ? '/api/detections/combined?reset=true' : '/api/detections/combined';
        const res = await fetch(firmsUrl, { signal: abortController.signal });
        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          setDataError('firmsDetections', `HTTP ${res.status}: ${errorText.slice(0, 50)}`);
          logger.warn({ event: 'firms_fetch_error', meta: { status: res.status, error: errorText.slice(0, 100) } });
          return;
        }
        const data = await res.json();
        setFirmsDetections(data);
        setFirmsLastUpdate(new Date());
        setLastSuccessfulSync(new Date());
        setDataError('firmsDetections', null);
        logger.info({ event: 'firms_fetch_success_frontend', meta: { detections: data.features?.length || 0 } });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        const errorMsg = error instanceof Error ? error.message : 'Network error';
        setDataError('firmsDetections', errorMsg);
        logger.error({ event: 'firms_fetch_exception', meta: { error: errorMsg } });
      }
    }

    let vehiclesDisabled = false;
    async function fetchVehicles() {
      if (cancelled || vehiclesDisabled) return;
      try {
        const res = await fetch('/api/geo/vehicles', { signal: abortController.signal });
        if (!res.ok) {
          if (res.status === 403) { vehiclesDisabled = true; return; }
          return;
        }
        const data = await res.json();
        setVehiclesData(data);
        setLastSuccessfulSync(new Date());
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }

    let retardantDisabled = false;
    async function fetchRetardant() {
      if (cancelled || retardantDisabled) return;
      try {
        const res = await fetch('/api/retardant', { signal: abortController.signal });
        if (!res.ok) {
          if (res.status === 403) { retardantDisabled = true; return; }
          return;
        }
        const json = await res.json();
        const items = (json.items ?? [])
          .filter((r: { storageLat?: number; storageLng?: number }) => r.storageLat != null && r.storageLng != null)
          .map((r: { storageLat: number; storageLng: number; name: string }) => ({
            coordinates: [r.storageLng, r.storageLat] as [number, number],
            name: r.name,
          }));
        setRetardantData(items);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }

    // Initial fetch
    fetchIncidents();
    fetchResources();
    fetchVehicles();
    fetchStatic();
    fetchFirms();
    fetchRetardant();

    // Per-source intervals using tier-aware durations
    const incidentInterval = setInterval(fetchIncidents, tierConfig.pollingInterval.incidents);
    const resourceInterval = setInterval(fetchResources, tierConfig.pollingInterval.resources);
    const vehicleInterval = setInterval(fetchVehicles, tierConfig.pollingInterval.resources);
    const firmsInterval = setInterval(fetchFirms, tierConfig.pollingInterval.firms);

    return () => {
      cancelled = true;
      abortController.abort();
      clearInterval(incidentInterval);
      clearInterval(resourceInterval);
      clearInterval(vehicleInterval);
      clearInterval(firmsInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDataError, setLastSuccessfulSync, tierConfig.pollingInterval.incidents, tierConfig.pollingInterval.resources, tierConfig.pollingInterval.firms]);

  /* ═══════════ Wind vectors fetch (30-min refresh) ═══════════ */

  useEffect(() => {
    if (!layers.windVectors && !layers.fireSpread) {
      setWindData(EMPTY_WIND);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchWind() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/weather/wind', { signal: controller.signal });
        if (!res.ok) {
          setDataError('wind', `HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        setWindData(data);
        setWindLastUpdate(new Date());
        setDataError('wind', null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setDataError('wind', error instanceof Error ? error.message : 'Network error');
      }
    }

    fetchWind();
    const interval = setInterval(fetchWind, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.windVectors, layers.fireSpread, setDataError]);

  /* ═══════════ Soil moisture fetch (5-min refresh) ═══════════ */

  useEffect(() => {
    if (!layers.soilMoisture && !layers.fireSpread) {
      setSoilMoistureData(EMPTY_GEOJSON);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchSoilMoisture() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/weather/soil-moisture', { signal: controller.signal });
        if (!res.ok) {
          const { useToastStore } = await import('@/store/useToastStore');
          useToastStore.getState().addToast('Soil moisture data temporarily unavailable.', 'warning');
          return;
        }
        const data = await res.json();
        if (data.features) {
          setSoilMoistureData(data);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.warn('[SoilMoisture] Fetch failed:', error);
      }
    }

    fetchSoilMoisture();
    const interval = setInterval(fetchSoilMoisture, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.soilMoisture, layers.fireSpread]);

  /* ═══════════ EFFIS Burned Areas vector fetch ═══════════ */

  useEffect(() => {
    if (!layers.effisBurnedAreas) {
      setBurnedAreasVector(EMPTY_GEOJSON);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchBurnedAreas() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/effis/burned-areas', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
          setBurnedAreasVector(data);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }

    fetchBurnedAreas();
    const interval = setInterval(fetchBurnedAreas, 60 * 60 * 1000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.effisBurnedAreas]);

  /* ═══════════ NDVI date probe (fetch latest available date) ═══════════ */

  useEffect(() => {
    if (!layers.ndvi) {
      setNdviDate(null);
      return;
    }

    let cancelled = false;

    function fallbackDate(): string {
      const d = new Date();
      d.setDate(d.getDate() - 10);
      // Round down to nearest 8-day period start (Jan 1 = day 1)
      const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
      const rounded = dayOfYear - (dayOfYear % 8) + 1;
      const result = new Date(d.getFullYear(), 0, rounded);
      return result.toISOString().split('T')[0];
    }

    fetch('/api/ndvi/latest-date')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setNdviDate(data?.date ?? fallbackDate());
        }
      })
      .catch(() => {
        if (!cancelled) setNdviDate(fallbackDate());
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.ndvi]);

  /* ═══════════ Reservoir data fetch ═══════════ */

  useEffect(() => {
    if (!layers.reservoirs) {
      setReservoirData(null);
      return;
    }

    let cancelled = false;
    fetch('/data/reservoirs.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`Reservoir GeoJSON: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setReservoirData(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[Reservoirs] Failed to load reservoir data', err);
          addToast('Reservoir data unavailable', 'warning');
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.reservoirs]);

  /* ═══════════ Population grid data fetch (for usePopulationAtRisk hook) ═══════════ */

  useEffect(() => {
    if (!layers.populationDensity) {
      setPopulationGridData(null);
      return;
    }

    let cancelled = false;
    fetch('/data/ifrane-population-grid.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Population grid: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setPopulationGridData(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[Population] Failed to load population grid', err);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.populationDensity]);

  /* ═══════════ PAMF/RMA data fetch ═══════════ */

  useEffect(() => {
    if (!layers.pamfCommunes && !layers.rmaCommunes) {
      setCommunesData(null);
      setPamfRmaStats(null);
      return;
    }

    let cancelled = false;

    const fetchGeojson = fetch('/data/communes-ifrane.geojson').then((r) => {
      if (!r.ok) throw new Error(`GeoJSON fetch failed: ${r.status}`);
      return r.json();
    });

    const fetchStats = fetchWithAuth('/api/analytics/pamf-rma').then((r) => {
      if (!r.ok) throw new Error(`PAMF-RMA API failed: ${r.status}`);
      return r.json();
    });

    Promise.all([
      fetchGeojson.catch((err) => {
        console.error('[PAMF/RMA] Failed to load communes GeoJSON:', err);
        if (!cancelled) addToast(t('pamfGeoJsonError' as TranslationKey), 'error', 6000);
        return null;
      }),
      fetchStats.catch((err) => {
        console.error('[PAMF/RMA] Failed to fetch fire pressure data:', err);
        if (!cancelled) addToast(t('pamfApiError' as TranslationKey), 'error', 6000);
        return null;
      }),
    ])
      .then(([geojson, stats]) => {
        if (cancelled) return;

        if (!geojson) {
          setPamfRmaHasData(false);
          return;
        }

        setCommunesData(geojson);

        if (stats) {
          setPamfRmaStats(stats);
          const hasData = stats.hasData ?? false;
          setPamfRmaHasData(hasData);

          // Merge stats into GeoJSON properties with area normalization
          if (stats.communes && geojson.features) {
            const statsMap = new Map(stats.communes.map((c: any) => [c.name, c]));
            const geojsonNames = new Set<string>();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (geojson.features as any[]).forEach((f: any) => {
              const name = f.properties?.name;
              geojsonNames.add(name);
              const s: any = statsMap.get(name);
              const areaKm2 = f.properties?.areaKm2 ?? 0;
              const forestedHa = f.properties?.forestedAreaHa ?? 0;

              if (s) {
                // PAMF = fires per year / commune area (km²)
                f.properties['pamf'] = areaKm2 > 0
                  ? +(s.pamf / areaKm2).toFixed(4) : 0;
                // RMA = (burned ha per year / forested ha) × 100 (percentage)
                if (forestedHa > 0) {
                  f.properties['rma'] = +((s.rma / forestedHa) * 100).toFixed(4);
                } else {
                  console.warn(`[PAMF/RMA] Commune "${name}" has 0 forested area, setting RMA to 0`);
                  f.properties['rma'] = 0;
                }
              } else {
                // No fire records for this commune — default to 0
                f.properties['pamf'] = 0;
                f.properties['rma'] = 0;
              }
            });

            // Warn about name mismatches
            Array.from(statsMap.keys()).forEach((apiName) => {
              if (!geojsonNames.has(apiName as string)) {
                console.warn(`[PAMF/RMA] API commune "${apiName}" not found in GeoJSON`);
              }
            });
          }

          // Empty dataset: show note
          if (!hasData && !cancelled) {
            addToast(t('pamfNoRecords' as TranslationKey), 'info', 5000);
          }
        } else {
          setPamfRmaHasData(false);
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.pamfCommunes, layers.rmaCommunes]);

  /* ═══════════ Fly-to on incident selection ═══════════ */

  useEffect(() => {
    if (!selectedIncidentId || !mapRef.current) return;
    const feature = incidents.features.find(
      (f) => f.properties.id === selectedIncidentId,
    );
    if (!feature) return;
    const coords = feature.geometry.coordinates as [number, number];
    mapRef.current.flyTo({
      center: coords,
      zoom: Math.max(viewState.zoom ?? 13, 15),
      duration: 1500,
      essential: true,
    });
    // Only react to selection changes, not incident data refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId]);

  /* ═══════════ Fullscreen ═══════════ */

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  /* ═══════════ Dynamic WMS tile URLs ═══════════ */

  const effisFwiTileUrl = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + effisFwiDay);
    const timeParam = d.toISOString().slice(0, 10);
    const layerName = effisFwiMode === 'ranking' ? 'mf010.ranking' : 'mf010.fwi';
    return `/api/effis/tiles?layer=${layerName}&time=${timeParam}&bbox={bbox-epsg-3857}`;
  }, [effisFwiDay, effisFwiMode]);

  // EFFIS Burned Areas WMS tile URL.
  // Available layers: modis.ba (cumulative), modis.ba.season (full season),
  // modis.ba.week (last 7 days), modis.ba.month (last 30 days).
  // Note: effis.nrt.ba is deprecated (PostGIS query errors as of 2026).
  const effisBurnedTileUrl = useMemo(() => {
    const layerName = effisBurnedAreaMode === 'recent' ? 'modis.ba' : 'modis.ba.season';
    return `/api/effis/tiles?layer=${layerName}&bbox={bbox-epsg-3857}`;
  }, [effisBurnedAreaMode]);

  /* ═══════════ NDVI tile URL ═══════════ */

  const ndviTileUrl = useMemo(() => {
    if (!ndviDate) return null;
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
  }, [ndviDate]);

  /* ═══════════ JRC Surface Water tile URL ═══════════ */
  // Source: JRC Global Surface Water dataset (free, no key). Max zoom: 13.
  // Layers available: occurrence, transitions, seasonality, recurrence, change, extent.
  // Error tile: https://storage.googleapis.com/global-surface-water/downloads_ancillary/blank.png

  const jrcWaterTileUrl = 'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png';

  /* ═══════════ WorldPop Population Density tile URL ═══════════ */
  // Source: WorldPop ArcGIS ImageServer (free, no key). 1km resolution, 2000-2020.
  // Uses bbox-based WMS-style fetching via {bbox-epsg-3857} template.
  // Fallback: local heatmap from ifrane-population-grid.json (synthetic census data).
  // Alternative endpoints if this breaks:
  //   - NASA SEDAC GPW v4: https://sedac.ciesin.columbia.edu/geoserver/wms (may be unreliable)
  //   - Pre-processed WorldPop GeoTIFF: https://hub.worldpop.org/geodata/summary?id=49659

  const worldPopTileUrl = '/api/population/tiles?bbox={bbox-epsg-3857}';

  /* ═══════════ CAMS Aerosol WMS tile URL ═══════════ */

  const camsWmsLayer = useMemo(() =>
    camsAerosolMode === 'dust' ? 'composition_duaod550'
      : camsAerosolMode === 'smoke' ? 'composition_bbaod550'
      : 'composition_aod550',
    [camsAerosolMode],
  );

  const camsAerosolTileUrl = useMemo(() => {
    // Use the Next.js proxy to avoid CORS issues and handle CRS conversion
    return `/api/cams/tiles?layer=${camsWmsLayer}&bbox={bbox-epsg-3857}`;
  }, [camsWmsLayer]);

  /* ═══════════ OWM Weather tile URL ═══════════ */

  const owmTileUrl = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_OWM_API_KEY;
    if (!key) return null;
    return `https://tile.openweathermap.org/map/${owmWeatherLayer}/{z}/{x}/{y}.png?appid=${key}`;
  }, [owmWeatherLayer]);

  /* ═══════════ CAMS health check (probe proxy on toggle/mode change) ═══════════ */

  useEffect(() => {
    if (!layers.camsAerosol) return;

    let cancelled = false;
    // Probe with a bbox covering Ifrane Province (EPSG:3857)
    const testBbox = '-612835,3895304,-534072,3962893';
    fetch(`/api/cams/tiles?layer=${camsWmsLayer}&bbox=${testBbox}`)
      .then((res) => {
        if (cancelled) return;
        const error = res.headers.get('X-CAMS-Error');
        if (error) {
          console.warn('[CAMS] Health check failed:', error);
          setTileAvailable('cams', false);
          addToast('CAMS aerosol data temporarily unavailable (ECMWF service may be down).', 'warning');
        } else {
          setTileAvailable('cams', true);
          resetTileRetry('cams');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTileAvailable('cams', false);
          addToast('CAMS aerosol data temporarily unavailable.', 'warning');
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.camsAerosol, camsWmsLayer]);

  /* ═══════════ Soil moisture depth property ═══════════ */

  const { soilMoistureProperty, soilMoistureClassProp } = useMemo(() => {
    if (soilMoistureDepth === 'surface') return { soilMoistureProperty: 'surface' as const, soilMoistureClassProp: 'surfaceClass' as const };
    if (soilMoistureDepth === 'root') return { soilMoistureProperty: 'root' as const, soilMoistureClassProp: 'rootClass' as const };
    return { soilMoistureProperty: 'deep' as const, soilMoistureClassProp: 'deepClass' as const };
  }, [soilMoistureDepth]);

  /* ═══════════ Prepared GeoJSON ═══════════ */

  const incidentSourceData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (layers.incidents ? incidents.features : []).map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        ...f.properties,
        color: INCIDENT_STATUS_COLORS[f.properties.status] ?? '#6b7280',
        isActive: f.properties.status !== 'ETEINT' ? 1 : 0,
      },
    })),
  }), [incidents.features, layers.incidents]);

  const firmsSourceData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: layers.firmsDetections ? firmsDetections.features : [],
  }), [firmsDetections.features, layers.firmsDetections]);

  const heatmapData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: incidents.features.map((f) => ({
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: { severity: f.properties.severity },
    })),
  }), [incidents.features]);

  /* ═══════════ Deck.gl layers — split into static + dispatch ═══════════ */

  // Shared route transform — used by both dispatchDeckLayers and animatedDeckLayers
  const routeLayerData = useMemo(
    () => activeRoutes.map((r) => transformRouteToLayerData(r.route, r.routeId, true)),
    [activeRoutes]
  );

  // Static layers: resources + infrastructure — only recomputes when data or tier changes
  const staticDeckLayers = useMemo(() => {
    // Tier C: use MapLibre native layers only; skip deck.gl
    if (!tierConfig.useDeckGL) return [];

    const list: any[] = [];
    const resourceActiveTypes: Record<string, boolean> = {
      TRUCK: layers.rscTrucks,
      AIRCRAFT: layers.rscAircraft,
      PERSONNEL: layers.rscPersonnel,
      EQUIPMENT: layers.rscEquipment,
    };
    const resourceLayer = createResourceLayer(resources, layers.resources, resourceActiveTypes);
    if (resourceLayer) list.push(resourceLayer);
    const infraLayers = createInfrastructureLayers(infrastructure, layers.infrastructure);
    list.push(...infraLayers);
    const retardantLayer = createRetardantLayer(retardantData, layers.retardant);
    if (retardantLayer) list.push(retardantLayer);
    return list;
  }, [tierConfig.useDeckGL, resources, infrastructure, retardantData, layers.resources, layers.infrastructure, layers.retardant, layers.rscTrucks, layers.rscAircraft, layers.rscPersonnel, layers.rscEquipment]);

  // Dispatch layers: routes + teams — recomputes only when dispatch state changes
  const dispatchDeckLayers = useMemo(() => {
    const list: any[] = [];

    const routeLayer = createRouteLayer(routeLayerData, layers.routes, pulsePhase);
    if (routeLayer) list.push(routeLayer);

    const activeTeamsData = selectedTeams
      .filter((team) => team.location && team.location.coordinates)
      .map((team) => transformTeamToLayerData(team));
    const activeTeamsLayer = createActiveTeamsLayer(activeTeamsData, layers.activeTeams);
    if (activeTeamsLayer) list.push(activeTeamsLayer);

    // Vehicle layer
    const vehicleLayerData = vehiclesData.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => transformVehicleToLayerData({
        id: f.properties.id,
        callSign: f.properties.callSign,
        type: f.properties.type,
        status: f.properties.status,
        location: f.geometry as { type: 'Point'; coordinates: [number, number] },
      }));
    const vehicleLayer = createVehicleLayer(vehicleLayerData, layers.vehicles);
    if (vehicleLayer) list.push(vehicleLayer);

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.routes, layers.activeTeams, layers.vehicles, routeLayerData, selectedTeams, vehiclesData, pulsePhase]);

  // Animated layers: pulse + arcs — only on Tier A/B
  const animatedDeckLayers = useMemo(() => {
    if (!tierConfig.enableAnimations || !tierConfig.useDeckGL) return [];
    const list: any[] = [];

    const pulseLayer = createIncidentPulseLayer(incidents, pulsePhase, layers.incidents);
    if (pulseLayer) list.push(pulseLayer);

    const arcLayer = createDispatchArcLayer(routeLayerData, layers.routes);
    if (arcLayer) list.push(arcLayer);

    return list;
  }, [incidents, pulsePhase, layers.incidents, layers.routes, routeLayerData, tierConfig.enableAnimations, tierConfig.useDeckGL]);

  const deckLayers = useMemo(
    () => [...staticDeckLayers, ...dispatchDeckLayers, ...animatedDeckLayers],
    [staticDeckLayers, dispatchDeckLayers, animatedDeckLayers]
  );

  /* ═══════════ Click handler ═══════════ */

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      // Shift+click places a fire spread simulation point
      if (layers.fireSpread && event.originalEvent?.shiftKey) {
        const { lng, lat } = event.lngLat;
        setFireSpreadSimPoint({ lon: lng, lat });
        return;
      }

      const features = event.features;
      if (!features || features.length === 0) return;
      const feature = features[0];
      if (!feature?.properties) return;

      if (feature.properties.cluster) {
        const geom = feature.geometry as { coordinates?: number[] };
        const coords = geom?.coordinates;
        if (
          coords &&
          typeof coords[0] === 'number' &&
          typeof coords[1] === 'number'
        ) {
          mapRef.current?.flyTo({
            center: [coords[0], coords[1]],
            zoom: (viewState.zoom ?? 13) + 2,
            duration: 800,
          });
        }
        return;
      }

      if (feature.properties.id) {
        setSelectedIncidentId(feature.properties.id as string);
        setHoveredIncident(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewState, setSelectedIncidentId, layers.fireSpread, setFireSpreadSimPoint],
  );

  /* ═══════════ Hover handlers with debouncing ═══════════ */

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback((event: MapLayerMouseEvent) => {
    // Clear any pending hover updates
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Debounce hover state updates by 100ms
    hoverTimeoutRef.current = setTimeout(() => {
      const features = event.features;
      if (!features || features.length === 0) {
        setHoverInfo(null);
        setHoveredIncident(null);
        return;
      }
      const feature = features[0];
      if (!feature?.properties) return;

      const geom = feature.geometry as { coordinates?: number[] };
      const coords = geom?.coordinates;
      if (
        !coords ||
        typeof coords[0] !== 'number' ||
        typeof coords[1] !== 'number'
      )
        return;

      // Handle cluster hover
      if (feature.properties.cluster) {
        setHoverInfo({
          longitude: coords[0],
          latitude: coords[1],
          layer: feature.layer?.id || '',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle FIRMS detections
      if (feature.layer?.id === 'firms-detections-unclustered') {
        setHoverInfo({
          longitude: coords[0],
          latitude: coords[1],
          layer: 'firms-detections-unclustered',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle wind arrow hover
      if (feature.layer?.id === 'wind-arrows') {
        setHoverInfo({
          longitude: coords[0],
          latitude: coords[1],
          layer: 'wind-arrows',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle soil moisture hover
      if (feature.layer?.id === 'soil-moisture-circles') {
        setHoverInfo({
          longitude: coords[0],
          latitude: coords[1],
          layer: 'soil-moisture-circles',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle burned areas vector click/hover
      if (feature.layer?.id === 'effis-burned-vector-fill') {
        setHoverInfo({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          layer: 'effis-burned-vector-fill',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle reservoir hover
      if (feature.layer?.id === 'reservoir-circles') {
        setHoverInfo({
          longitude: coords[0],
          latitude: coords[1],
          layer: 'reservoir-circles',
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle PAMF/RMA commune hover
      if (feature.layer?.id === 'pamf-fill' || feature.layer?.id === 'rma-fill') {
        setHoverInfo({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          layer: feature.layer.id,
          feature,
        });
        setHoveredIncident(null);
        return;
      }

      // Handle incident hover (existing logic)
      if (feature.properties.id && feature.layer?.id === 'incidents-unclustered') {
        setHoveredIncident({
          id: feature.properties.id as string,
          properties: feature.properties as unknown as GeoIncidentProps,
          coordinates: [coords[0], coords[1]],
        });
        setHoverInfo(null);
      }
    }, 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Clear pending hover updates
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Immediately clear hover state on leave
    setHoveredIncident(null);
    setHoverInfo(null);
  }, []);

  /* ═══════════ Fire Spread Vectors ═══════════ */

  const { vectors: fireSpreadVectors, status: fireSpreadStatus } = useFireSpreadVectors(
    firmsDetections,
    incidents,
    windData,
    soilMoistureData,
    layers.fireSpread,
    fireSpreadSimPoint,
  );

  const setFireSpreadStatus = useMapStore((s) => s.setFireSpreadStatus);

  // Sync fire spread status to store (so MapControls/MapLegend can read it)
  useEffect(() => {
    setFireSpreadStatus(fireSpreadStatus);
  }, [fireSpreadStatus, setFireSpreadStatus]);

  // Clear simulation point when fire spread layer is turned off
  useEffect(() => {
    if (!layers.fireSpread && fireSpreadSimPoint) {
      setFireSpreadSimPoint(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.fireSpread]);

  /* ═══════════ Register SDF wind arrow on map load ═══════════ */

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap() as any;
    if (map && !map.hasImage('wind-arrow')) {
      const img = createWindArrowImage(32);
      map.addImage('wind-arrow', img, { sdf: true });
    }
    if (map) {
      map.on('error', (e: any) => {
        const srcId = e.sourceId || e.source?.id;
        // Suppress broken-tile icons for NDVI raster source
        if (srcId === 'ndvi-tiles') {
          console.warn('[NDVI] Tile load error — GIBS may not have data for this date', e.error?.message);
          e.preventDefault?.();
          return;
        }
        // Map source IDs → store tile availability keys
        const SRC_TO_TILE_KEY: Record<string, keyof typeof tileAvailability> = {
          'jrc-water': 'jrcWater',
          'worldpop-density': 'worldpop',
          'esa-landcover': 'landCover',
          'effis-fwi': 'effisFwi',
          'effis-burned-areas': 'effisBurned',
          'cams-aerosol': 'cams',
        };
        const tileKey = SRC_TO_TILE_KEY[srcId];
        if (tileKey) {
          console.warn(`[${srcId}] Tile load error`, e.error?.message);
          setTileAvailable(tileKey, false);
          e.preventDefault?.();
          return;
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════ Unified WMS tile auto-retry with exponential backoff ═══════════ */
  // Backoff schedule: 60s → 120s → 300s, max 3 auto-retries per service.

  const RETRY_DELAYS = [60_000, 120_000, 300_000]; // 1min, 2min, 5min
  const MAX_AUTO_RETRIES = 3;

  const tileServices: { key: keyof typeof tileAvailability; label: string }[] = useMemo(() => [
    { key: 'effisFwi', label: 'EFFIS FWI' },
    { key: 'effisBurned', label: 'EFFIS Burned' },
    { key: 'worldpop', label: 'WorldPop' },
    { key: 'cams', label: 'CAMS' },
    { key: 'landCover', label: 'LandCover' },
    { key: 'jrcWater', label: 'JRC Water' },
  ], []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const svc of tileServices) {
      if (tileAvailability[svc.key]) continue; // already available
      const retries = tileRetryCount[svc.key] || 0;
      if (retries >= MAX_AUTO_RETRIES) continue; // stop after 3

      const delay = RETRY_DELAYS[Math.min(retries, RETRY_DELAYS.length - 1)];
      const timer = setTimeout(() => {
        console.info(`[${svc.label}] Auto-retrying (attempt ${retries + 1}/${MAX_AUTO_RETRIES}) after ${delay / 1000}s`);
        incrementTileRetry(svc.key);
        setTileAvailable(svc.key, true);
      }, delay);
      timers.push(timer);
    }

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileAvailability, tileRetryCount]);

  /* ═══════════ Map style ═══════════ */

  const mapStyle = useMemo(() => getMapStyle(basemap), [basemap]);

  /* ═══════════ Render ═══════════ */

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      data-ricer-map-ready="true"
    >
      <ReactMapGL
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapStyle={mapStyle as any}
        onLoad={handleMapLoad}
        onClick={handleClick}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={MAP_CONTAINER_STYLE}
        maxPitch={85}
        attributionControl={true}
      >
        {/* ═══ Terrain DEM source ═══ */}
        <Source
          id="terrain-dem"
          type="raster-dem"
          tiles={[
            HAS_PREMIUM_TILES
              ? `https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`
              : 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
          ]}
          tileSize={256}
          encoding={HAS_PREMIUM_TILES ? 'mapbox' : 'terrarium'}
        />

        {/* ═══ Hillshade layer (native MapLibre, zero extra cost) ═══ */}
        <Layer
          id="hillshade-layer"
          type="hillshade"
          source="terrain-dem"
          layout={{ visibility: layers.hillshade ? 'visible' : 'none' }}
          paint={{
            'hillshade-exaggeration': hillshadeExaggeration,
            'hillshade-shadow-color': '#473B24',
            'hillshade-highlight-color': '#FFFFFF',
            'hillshade-illumination-direction': 315,
          }}
        />

        {/* ═══ Slope overlay (Tier A/B only — custom protocol) ═══ */}
        {tierConfig.dataLimits.enableWMSOverlays && (
          <Source id="slope-tiles" type="raster" tiles={['slope://{z}/{x}/{y}']} tileSize={256}>
            <Layer
              id="slope-layer"
              type="raster"
              layout={{ visibility: layers.slope ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': slopeOpacity }}
            />
          </Source>
        )}

        {/* ═══ Heatmap layer ═══ */}
        {incidents.features.length > 0 && (
            <Source
              id="incidents-heat"
              type="geojson"
              data={heatmapData as any}
            >
              <Layer
                id="incidents-heatmap"
                type="heatmap"
                maxzoom={16}
                layout={{ visibility: isHeatmapEnabled && layers.incidents ? 'visible' : 'none' }}
                paint={{
                  'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'severity'],
                    1,
                    0.2,
                    5,
                    1,
                  ],
                  'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0,
                    1,
                    15,
                    3,
                  ],
                  'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0,
                    'rgba(0,0,0,0)',
                    0.15,
                    'rgb(255,255,204)',
                    0.3,
                    'rgb(255,237,160)',
                    0.45,
                    'rgb(254,178,76)',
                    0.6,
                    'rgb(253,141,60)',
                    0.75,
                    'rgb(240,59,32)',
                    0.9,
                    'rgb(189,0,38)',
                    1,
                    'rgb(128,0,38)',
                  ],
                  'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0,
                    4,
                    9,
                    30,
                    15,
                    50,
                  ],
                  'heatmap-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    7,
                    0.8,
                    15,
                    0.4,
                  ],
                }}
              />
            </Source>
          )}

        {/* ═══ Population density — WorldPop raster tiles (primary) ═══ */}
        {/* WorldPop ArcGIS ImageServer: 1km resolution, bbox-based WMS-style. */}
        {/* Restricted to Ifrane Province bounding box to limit tile fetching. */}
        {popTilesAvailable && (
          <Source
            id="worldpop-density"
            type="raster"
            tiles={[worldPopTileUrl]}
            tileSize={256}
            maxzoom={14}
            bounds={[-5.6, 33.0, -4.8, 33.8]}
          >
            <Layer
              id="worldpop-density-layer"
              type="raster"
              layout={{ visibility: layers.populationDensity ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': populationDensityOpacity * 0.5 }}
            />
          </Source>
        )}

        {/* ═══ Population density — local heatmap (fallback + popAtRisk data) ═══ */}
        {populationGridData && populationGridData.features?.length > 0 && (
          <Source id="population-density" type="geojson" data={populationGridData}>
            <Layer
              id="population-density-heatmap"
              type="heatmap"
              maxzoom={16}
              layout={{ visibility: (layers.populationDensity && (!popTilesAvailable || !tierConfig.dataLimits.enableWMSOverlays)) ? 'visible' : 'none' }}
              paint={{
                // Ifrane grid: min=1, median=16, P75=130, P95=726, max=1545
                'heatmap-weight': [
                  'interpolate', ['linear'], ['get', 'pop'],
                  0, 0,
                  5, 0.05,     // Very rural: barely visible
                  25, 0.15,    // Small villages
                  100, 0.3,    // Small towns
                  500, 0.55,   // Ifrane outskirts
                  1000, 0.8,   // Dense urban
                  1545, 1.0,   // Peak density
                ],
                'heatmap-intensity': [
                  'interpolate', ['linear'], ['zoom'],
                  7, 0.3,      // Low when zoomed out (prevents purple wash)
                  10, 0.8,
                  13, 1.5,
                ],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,0,0)',
                  0.05, 'rgba(255,255,178,0.4)', // Faint yellow for very rural
                  0.2, '#fecc5c',                 // Yellow for villages
                  0.4, '#fd8d3c',                 // Orange for towns
                  0.6, '#f03b20',                 // Red-orange for urban
                  0.8, '#bd0026',                 // Deep red for dense urban
                  1.0, '#800026',                 // Dark red for peak
                ],
                'heatmap-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  7, 8,        // Small radius when zoomed out
                  10, 18,
                  13, 35,
                ],
                'heatmap-opacity': [
                  'interpolate', ['linear'], ['zoom'],
                  7, populationDensityOpacity * 0.9,
                  14, populationDensityOpacity * 0.4,
                ],
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            WMS RASTER OVERLAYS — grouped below vector layers for z-order
            Order: raster base → vectors → markers (later = higher z)
            ════════════════════════════════════════════════════════════ */}

        {/* ─── EFFIS FWI: day-aware WMS with dynamic TIME parameter ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && effisFwiTilesAvailable && (
          <Source
            key={`effis-fwi-${effisFwiDay}-${effisFwiMode}`}
            id="effis-fwi"
            type="raster"
            tiles={[effisFwiTileUrl]}
            tileSize={256}
          >
            <Layer id="effis-fwi-layer" type="raster" layout={{ visibility: layers.effisFWI ? 'visible' : 'none' }} paint={{ 'raster-opacity': effisFwiOpacity, 'raster-brightness-min': 0.05, 'raster-contrast': 0.15 }} />
          </Source>
        )}
        {/* ─── EFFIS Burned Areas WMS ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && effisBurnedTilesAvailable && (
          <Source
            key={`effis-burned-${effisBurnedAreaMode}`}
            id="effis-burned-areas"
            type="raster"
            tiles={[effisBurnedTileUrl]}
            tileSize={256}
          >
            <Layer id="effis-burned-areas-layer" type="raster" layout={{ visibility: layers.effisBurnedAreas ? 'visible' : 'none' }} paint={{ 'raster-opacity': 0.5 }} />
          </Source>
        )}
        {/* ─── EFFIS Burned Areas WFS vector overlay ─── */}
        {burnedAreasVector.features.length > 0 && (
          <Source id="effis-burned-vector" type="geojson" data={burnedAreasVector}>
            <Layer
              id="effis-burned-vector-fill"
              type="fill"
              layout={{ visibility: layers.effisBurnedAreas ? 'visible' : 'none' }}
              paint={{ 'fill-color': '#7f1d1d', 'fill-opacity': 0.35 }}
            />
            <Layer
              id="effis-burned-vector-outline"
              type="line"
              layout={{ visibility: layers.effisBurnedAreas ? 'visible' : 'none' }}
              paint={{ 'line-color': '#991b1b', 'line-width': 1.5, 'line-opacity': 0.7 }}
            />
          </Source>
        )}
        {/* ─── CAMS Aerosol ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && camsTilesAvailable && (
          <Source
            key={`cams-aerosol-${camsAerosolMode}`}
            id="cams-aerosol"
            type="raster"
            tiles={[camsAerosolTileUrl]}
            tileSize={256}
          >
            <Layer
              id="cams-aerosol-layer"
              type="raster"
              layout={{ visibility: layers.camsAerosol ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': camsAerosolOpacity }}
            />
          </Source>
        )}
        {/* ─── OWM Weather Tiles (precipitation, clouds, wind, temp, pressure) ─── */}
        {owmTileUrl && (
          <Source
            key={`owm-weather-${owmWeatherLayer}`}
            id="owm-weather"
            type="raster"
            tiles={[owmTileUrl]}
            tileSize={256}
          >
            <Layer
              id="owm-weather-layer"
              type="raster"
              layout={{ visibility: layers.owmWeather ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': owmWeatherOpacity }}
            />
          </Source>
        )}
        {/* ─── ESA WorldCover Land Cover ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && landCoverTilesAvailable && (
          <Source
            id="esa-landcover"
            type="raster"
            tiles={['https://services.terrascope.be/wmts/v2?layer=WORLDCOVER_2021_MAP&style=&tilematrixset=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:3857:{z}&TileCol={x}&TileRow={y}']}
            tileSize={256}
            minzoom={6}
            maxzoom={14}
          >
            <Layer
              id="esa-landcover-layer"
              type="raster"
              layout={{ visibility: layers.landCover ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': landCoverOpacity }}
            />
          </Source>
        )}
        {/* ─── NDVI — NASA GIBS MODIS Terra ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && ndviTileUrl && (
          <Source
            key={`ndvi-${ndviDate}`}
            id="ndvi-tiles"
            type="raster"
            tiles={[ndviTileUrl]}
            tileSize={256}
            maxzoom={9}
          >
            <Layer
              id="ndvi-layer"
              type="raster"
              layout={{ visibility: layers.ndvi ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': ndviOpacity }}
            />
          </Source>
        )}
        {/* ─── JRC Surface Water raster ─── */}
        {tierConfig.dataLimits.enableWMSOverlays && jrcTilesAvailable && (
          <Source
            id="jrc-water"
            type="raster"
            tiles={[jrcWaterTileUrl]}
            tileSize={256}
            maxzoom={13}
          >
            <Layer
              id="jrc-water-layer"
              type="raster"
              layout={{ visibility: layers.reservoirs ? 'visible' : 'none' }}
              paint={{ 'raster-opacity': 0.5 }}
            />
          </Source>
        )}

        {/* ═══ Isochrone reachability polygons ═══ */}
        {isochroneData && isochroneData.features?.length > 0 && (
          <Source id="isochrones" type="geojson" data={isochroneData}>
            <Layer
              id="isochrone-fill"
              type="fill"
              layout={{ visibility: layers.isochrones ? 'visible' : 'none' }}
              paint={{
                'fill-color': [
                  'step',
                  ['get', 'time'],
                  '#22c55e', // 0–10 min: green
                  11, '#f59e0b', // 11–20 min: amber
                  21, '#ef4444', // 21+ min: red
                ],
                'fill-opacity': [
                  'step',
                  ['get', 'time'],
                  0.25,
                  11, 0.18,
                  21, 0.12,
                ],
              }}
            />
            <Layer
              id="isochrone-border"
              type="line"
              layout={{ visibility: layers.isochrones ? 'visible' : 'none' }}
              paint={{
                'line-color': [
                  'step',
                  ['get', 'time'],
                  '#22c55e',
                  11, '#f59e0b',
                  21, '#ef4444',
                ],
                'line-width': 1.5,
                'line-opacity': 0.7,
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            WIND VECTORS — rotated, color-coded arrows
            ════════════════════════════════════════════════════════════ */}
        {windData.features.length > 0 && (
          <Source id="wind-vectors" type="geojson" data={asGeoJSON(windData)}>
            <Layer
              id="wind-arrows"
              type="symbol"
              layout={{
                visibility: layers.windVectors ? 'visible' : 'none',
                'icon-image': 'wind-arrow',
                'icon-size': 0.8,
                'icon-rotate': ['get', 'direction'],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
              }}
              paint={{
                'icon-color': [
                  'interpolate', ['linear'], ['get', 'speed'],
                  0, '#22c55e',
                  10, '#22c55e',
                  15, '#f97316',
                  25, '#ef4444',
                ],
                'icon-opacity': 0.85,
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            FIRE SPREAD PREDICTION VECTORS — Rothermel model arrows
            ════════════════════════════════════════════════════════════ */}
        {fireSpreadVectors && fireSpreadVectors.features.length > 0 && (
          <Source id="fire-spread-vectors" type="geojson" data={fireSpreadVectors as any}>
            {/* Spread direction lines */}
            <Layer
              id="fire-spread-lines"
              type="line"
              filter={['==', '$type', 'LineString']}
              layout={{
                visibility: layers.fireSpread ? 'visible' : 'none',
                'line-cap': 'round',
              }}
              paint={{
                'line-color': ['match', ['get', 'riskLevel'],
                  'low', '#4caf50', 'moderate', '#ffeb3b',
                  'high', '#ff9800', 'extreme', '#f44336', '#808080'],
                'line-width': ['interpolate', ['linear'], ['get', 'relativeRate'],
                  0, 2, 0.5, 3, 1, 6],
                'line-opacity': fireSpreadOpacity,
              }}
            />
            {/* Arrowhead dots at endpoints */}
            <Layer
              id="fire-spread-tips"
              type="circle"
              filter={['==', ['get', 'isTip'], true]}
              layout={{ visibility: layers.fireSpread ? 'visible' : 'none' }}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'relativeRate'],
                  0, 3, 1, 7],
                'circle-color': ['match', ['get', 'riskLevel'],
                  'low', '#4caf50', 'moderate', '#ffeb3b',
                  'high', '#ff9800', 'extreme', '#f44336', '#808080'],
                'circle-opacity': fireSpreadOpacity,
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(0,0,0,0.3)',
              }}
            />
          </Source>
        )}

        {reservoirData && reservoirData.features?.length > 0 && (
          <Source id="reservoirs" type="geojson" data={reservoirData}>
            <Layer
              id="reservoir-circles"
              type="circle"
              layout={{ visibility: layers.reservoirs ? 'visible' : 'none' }}
              paint={{
                'circle-radius': 8,
                'circle-color': RESERVOIR_COLORS.marker,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9,
              }}
            />
            <Layer
              id="reservoir-labels"
              type="symbol"
              layout={{
                visibility: layers.reservoirs ? 'visible' : 'none',
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold', 'sans-serif'],
                'text-size': 11,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
                'text-optional': true,
              }}
              paint={{
                'text-color': RESERVOIR_COLORS.label,
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            PAMF/RMA — commune choropleth
            ════════════════════════════════════════════════════════════ */}
        {communesData && communesData.features?.length > 0 && (
          <Source id="communes-pamf-rma" type="geojson" data={communesData}>
            {/* PAMF fill — fires per km² per year */}
            <Layer
              id="pamf-fill"
              type="fill"
              layout={{ visibility: layers.pamfCommunes ? 'visible' : 'none' }}
              paint={{
                'fill-color': pamfRmaStats?.hasData
                  ? [
                      'interpolate', ['linear'], ['coalesce', ['get', 'pamf'], 0],
                      0, PAMF_COLORS.low,
                      0.5, PAMF_COLORS.moderate,
                      1.5, PAMF_COLORS.high,
                      3.0, PAMF_COLORS.extreme,
                    ]
                  : PAMF_COLORS.noData,
                'fill-opacity': 0.45,
              }}
            />
            {/* RMA fill — burned area / forested area percentage */}
            <Layer
              id="rma-fill"
              type="fill"
              layout={{ visibility: layers.rmaCommunes ? 'visible' : 'none' }}
              paint={{
                'fill-color': pamfRmaStats?.hasData
                  ? [
                      'interpolate', ['linear'], ['coalesce', ['get', 'rma'], 0],
                      0, RMA_COLORS.low,
                      0.1, RMA_COLORS.moderate,
                      0.5, RMA_COLORS.high,
                      1.0, RMA_COLORS.extreme,
                    ]
                  : RMA_COLORS.noData,
                'fill-opacity': 0.45,
              }}
            />
            {/* Shared commune outlines */}
            <Layer
              id="communes-outline"
              type="line"
              layout={{ visibility: layers.pamfCommunes || layers.rmaCommunes ? 'visible' : 'none' }}
              paint={{
                'line-color': '#374151',
                'line-width': 1.5,
                'line-opacity': 0.6,
              }}
            />
            {/* Commune labels */}
            <Layer
              id="communes-labels"
              type="symbol"
              layout={{
                visibility: layers.pamfCommunes || layers.rmaCommunes ? 'visible' : 'none',
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold', 'sans-serif'],
                'text-size': 11,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#1f2937',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            SOIL MOISTURE — circle layer from Open-Meteo grid
            ════════════════════════════════════════════════════════════ */}
        {soilMoistureData.features.length > 0 && (
          <Source id="soil-moisture" type="geojson" data={soilMoistureData}>
            <Layer
              id="soil-moisture-circles"
              type="circle"
              layout={{ visibility: layers.soilMoisture ? 'visible' : 'none' }}
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  8, 8,
                  12, 16,
                  15, 24,
                ],
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['get', soilMoistureProperty],
                  0, SOIL_MOISTURE_COLORS.dry,
                  0.1, SOIL_MOISTURE_COLORS.low,
                  0.2, SOIL_MOISTURE_COLORS.normal,
                  0.3, SOIL_MOISTURE_COLORS.wet,
                ],
                'circle-opacity': 0.7,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </Source>
        )}

        {/* ════════════════════════════════════════════════════════════
            FIRMS SATELLITE FIRE DETECTIONS
            ════════════════════════════════════════════════════════════ */}
        {firmsDetections.features.length > 0 && (
          <Source
            id="firms-detections"
            type="geojson"
            data={asGeoJSON(firmsSourceData)}
            cluster={true}
            clusterRadius={60}
            clusterMaxZoom={13}
          >
            {/* ═══ Cluster Glow (outer ring for visual prominence) ═══ */}
            <Layer
              id="firms-cluster-glow"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': '#f97316',
                'circle-radius': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  30,
                  5, 40,
                  10, 50,
                ],
                'circle-blur': 0.8,
                'circle-opacity': 0.2,
              }}
            />

            {/* ═══ Cluster Solid Marker ═══ */}
            <Layer
              id="firms-cluster"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  '#f59e0b',
                  10, '#f97316',
                  20, '#ef4444',
                ],
                'circle-radius': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  18,
                  5, 25,
                  10, 32,
                  20, 40,
                ],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9,
              }}
            />

            {/* ═══ Cluster Count Label ═══ */}
            <Layer
              id="firms-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['to-string', ['get', 'point_count']],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold', 'sans-serif'],
                'text-size': 13,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1,
              }}
            />

            {/* ═══ Unclustered - Outer Glow (FRP-based intensity) ═══ */}
            <Layer
              id="firms-detections-glow"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': [
                  'match',
                  ['get', 'confidence'],
                  'low', FIRMS_CONFIDENCE_COLORS.low,
                  'nominal', FIRMS_CONFIDENCE_COLORS.nominal,
                  'high', FIRMS_CONFIDENCE_COLORS.high,
                  FIRMS_CONFIDENCE_COLORS.nominal,
                ],
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['to-number', ['get', 'frp']],
                  0, 15,
                  25, 22,
                  50, 30,
                  100, 40,
                ],
                'circle-blur': 0.9,
                'circle-opacity': [
                  'case',
                  ['get', 'isRecent'], 0.3,
                  0.2,
                ],
              }}
            />

            {/* ═══ Unclustered - Pulsing Ring (recent detections only) ═══ */}
            <Layer
              id="firms-detections-pulse"
              type="circle"
              filter={['all', ['!', ['has', 'point_count']], ['get', 'isRecent']]}
              paint={{
                'circle-color': '#ef4444',
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['to-number', ['get', 'frp']],
                  0, 12,
                  50, 18,
                  100, 24,
                ],
                'circle-opacity': 0.25,
                'circle-blur': 0.5,
              }}
            />

            {/* ═══ Unclustered - Solid Marker (confidence-colored, FRP-sized) ═══ */}
            <Layer
              id="firms-detections-unclustered"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': [
                  'match',
                  ['get', 'confidence'],
                  'low', FIRMS_CONFIDENCE_COLORS.low,
                  'nominal', FIRMS_CONFIDENCE_COLORS.nominal,
                  'high', FIRMS_CONFIDENCE_COLORS.high,
                  FIRMS_CONFIDENCE_COLORS.nominal,
                ],
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['to-number', ['get', 'frp']],
                  0, 6,
                  25, 9,
                  50, 12,
                  100, 16,
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': [
                  'match',
                  ['get', 'confidence'],
                  'low', 0.6,
                  'nominal', 0.85,
                  'high', 1.0,
                  0.85,
                ],
              }}
            />
          </Source>
        )}

        {/* ═══ Incident clusters with glow effect ═══ */}
        <Source
          id="incidents"
          type="geojson"
          data={asGeoJSON(incidentSourceData)}
          cluster={true}
          clusterRadius={40}
          clusterMaxZoom={14}
        >
            {/* Cluster outer glow */}
            <Layer
              id="incidents-cluster-glow"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  '#f59e0b',
                  3,
                  '#f97316',
                  7,
                  '#ef4444',
                ],
                'circle-radius': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  30,
                  3,
                  38,
                  7,
                  48,
                ],
                'circle-blur': 0.7,
                'circle-opacity': 0.2,
              }}
            />
            {/* Cluster solid */}
            <Layer
              id="incidents-cluster"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  '#f59e0b',
                  3,
                  '#f97316',
                  7,
                  '#ef4444',
                ],
                'circle-radius': [
                  'step',
                  ['to-number', ['get', 'point_count']],
                  18,
                  3,
                  24,
                  7,
                  30,
                ],
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
              }}
            />
            {/* Cluster count label */}
            <Layer
              id="incidents-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['to-string', ['get', 'point_count']],
                'text-font': [
                  'Open Sans Bold',
                  'Arial Unicode MS Bold',
                  'sans-serif',
                ],
                'text-size': 13,
              }}
              paint={{ 'text-color': '#ffffff' }}
            />
            {/* Unclustered — outer glow for active incidents */}
            <Layer
              id="incidents-glow"
              type="circle"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', ['get', 'isActive'], 1],
              ]}
              paint={{
                'circle-color': ['get', 'color'],
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['to-number', ['get', 'severity']],
                  1,
                  18,
                  5,
                  30,
                ],
                'circle-blur': 0.7,
                'circle-opacity': 0.25,
              }}
            />
            {/* Unclustered — solid marker scaled by severity */}
            <Layer
              id="incidents-unclustered"
              type="circle"
              filter={['!', ['has', 'point_count']]}
              paint={{
                'circle-color': ['get', 'color'],
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['to-number', ['get', 'severity']],
                  1,
                  7,
                  3,
                  10,
                  5,
                  14,
                ],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff',
              }}
            />
        </Source>

        {/* ═══ Map controls ═══ */}
        <NavigationControl
          position="top-right"
          showCompass={true}
          visualizePitch={true}
        />
        <ScaleControl position="bottom-left" maxWidth={100} unit="metric" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showAccuracyCircle={false}
        />

        {/* ═══ Hover popup ═══ */}
        {hoveredIncident && (
          <Popup
            longitude={hoveredIncident.coordinates[0]}
            latitude={hoveredIncident.coordinates[1]}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="incident-popup"
          >
            <div className="min-w-[220px] overflow-hidden rounded-lg bg-surface/90 backdrop-blur-md">
              {/* Gradient header bar */}
              <div
                className="px-3 py-2"
                style={{
                  background: `linear-gradient(135deg, ${INCIDENT_STATUS_COLORS[hoveredIncident.properties.status] ?? '#6b7280'}dd, ${INCIDENT_STATUS_COLORS[hoveredIncident.properties.status] ?? '#6b7280'}88)`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-white/90">
                    <Icon name="fire" size={13} aria-hidden /> #{hoveredIncident.id.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">
                    {hoveredIncident.properties.status}
                  </span>
                </div>
              </div>
              {/* Body */}
              <div className="p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-muted-foreground">{t('severity')}:</span>
                  <span className="text-base leading-none">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ color: i < (hoveredIncident.properties.severity ?? 0) ? (INCIDENT_STATUS_COLORS[hoveredIncident.properties.status] ?? '#f59e0b') : '#d1d5db' }}>★</span>
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {hoveredIncident.properties.severity}/5
                  </span>
                </div>
                {hoveredIncident.properties.cause && (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {hoveredIncident.properties.cause}
                  </div>
                )}
                <PopulationAtRiskBadge center={hoveredIncident.coordinates} />
                <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground italic">
                  {t('clickForDetails')}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground/60">
                  {hoveredIncident.coordinates[1].toFixed(4)}°, {hoveredIncident.coordinates[0].toFixed(4)}°
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ FIRMS Detection Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'firms-detections-unclustered' && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="firms-popup"
          >
            <div className="p-2 min-w-[200px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="navigation" size={16} className="text-orange-500" aria-hidden />
                <span className="font-bold text-sm">{t('firmsSatelliteDetection')}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsFirePower')}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.frp} MW</span>
                </div>
                {/* FRP intensity bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (hoverInfo.feature.properties.frp / 200) * 100)}%`,
                      background: 'linear-gradient(to right, #fef3c7, #f59e0b, #dc2626)',
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsConfidence')}:</span>
                  <span
                    className="font-semibold capitalize"
                    style={{ color: FIRMS_CONFIDENCE_COLORS[hoverInfo.feature.properties.confidence] || FIRMS_CONFIDENCE_COLORS.nominal }}
                  >
                    {hoverInfo.feature.properties.confidence}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsTemperature')}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.brightness}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsTime')}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.acqDateTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsSatellite')}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.instrument}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('firmsDayNight')}:</span>
                  <span className="font-semibold">
                    {hoverInfo.feature.properties.daynight === 'D' ? '☀️ ' : '🌙 '}
                    {hoverInfo.feature.properties.daynight === 'D' ? t('firmsDay') : t('firmsNight')}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
                {hoverInfo.feature.properties.source === 'EFFIS'
                  ? 'Copernicus EFFIS'
                  : hoverInfo.feature.properties.source === 'FIRMS+EFFIS'
                    ? 'NASA FIRMS + Copernicus EFFIS'
                    : 'NASA FIRMS'}{' '}
                • {hoverInfo.feature.properties.satellite}
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ FIRMS Cluster Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'firms-cluster' && hoverInfo.feature?.properties?.point_count && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="cluster-popup"
          >
            <div className="p-2 text-center">
              <div className="font-bold text-lg text-orange-500">{hoverInfo.feature.properties.point_count}</div>
              <div className="text-xs text-muted-foreground">{t('firmsSatelliteDetections')}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{t('firmsZoomToSeeDetails')}</div>
            </div>
          </Popup>
        )}

        {/* ═══ Incident Cluster Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'incidents-cluster' && hoverInfo.feature?.properties?.point_count && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="cluster-popup"
          >
            <div className="p-2 text-center">
              <div className="font-bold text-lg text-red-500">{hoverInfo.feature.properties.point_count}</div>
              <div className="text-xs text-muted-foreground">Fire Incidents</div>
              <div className="text-[10px] text-muted-foreground mt-1">Zoom in to see details</div>
            </div>
          </Popup>
        )}

        {/* ═══ Wind Arrow Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'wind-arrows' && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="wind-popup"
          >
            <div className="p-2 min-w-[180px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="air" size={16} className="text-primary" aria-hidden />
                <span className="font-bold text-sm">{t('windVectors')}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('windSpeed')}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.speed} {t('windSpeedUnit')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('windDirectionDeg' as TranslationKey)}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.direction}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('windGusts' as TranslationKey)}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.gusts} {t('windSpeedUnit')}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ Soil Moisture Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'soil-moisture-circles' && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="soil-moisture-popup"
          >
            <div className="p-2 min-w-[180px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="droplet" size={16} className="text-primary" aria-hidden />
                <span className="font-bold text-sm">{t('soilMoistureValue' as TranslationKey)}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('soilMoistureDepthLabel' as TranslationKey)}:</span>
                  <span className="font-semibold">
                    {soilMoistureDepth === 'surface' ? '0-1 cm' : soilMoistureDepth === 'root' ? '9-27 cm' : '27-81 cm'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value:</span>
                  <span className="font-semibold">
                    {Number(hoverInfo.feature.properties[soilMoistureProperty] ?? 0).toFixed(3)} m&sup3;/m&sup3;
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold">
                    {hoverInfo.feature.properties[soilMoistureClassProp] ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ Burned Areas Vector Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'effis-burned-vector-fill' && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="burned-area-popup"
          >
            <div className="p-2 min-w-[180px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="fire" size={16} className="text-accent-fire" aria-hidden />
                <span className="font-bold text-sm">{t('burnedAreaName' as TranslationKey)}</span>
              </div>
              <div className="space-y-1 text-xs">
                {hoverInfo.feature.properties.area_ha != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('burnedAreaHa' as TranslationKey)}:</span>
                    <span className="font-semibold">{Number(hoverInfo.feature.properties.area_ha).toFixed(1)} ha</span>
                  </div>
                )}
                {hoverInfo.feature.properties.firedate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('burnedAreaDate' as TranslationKey)}:</span>
                    <span className="font-semibold">{hoverInfo.feature.properties.firedate}</span>
                  </div>
                )}
                {hoverInfo.feature.properties.country && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Country:</span>
                    <span className="font-semibold">{hoverInfo.feature.properties.country}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
                Copernicus EFFIS
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ Reservoir Popup ═══ */}
        {hoverInfo && hoverInfo.layer === 'reservoir-circles' && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="reservoir-popup"
          >
            <div className="p-2 min-w-[180px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="waves" size={16} className="text-primary" aria-hidden />
                <span className="font-bold text-sm">{hoverInfo.feature.properties.name}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('reservoirCapacity' as TranslationKey)}:</span>
                  <span className="font-semibold">{hoverInfo.feature.properties.capacity} {hoverInfo.feature.properties.capacityUnit}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* ═══ PAMF/RMA Commune Popup ═══ */}
        {hoverInfo && (hoverInfo.layer === 'pamf-fill' || hoverInfo.layer === 'rma-fill') && hoverInfo.feature?.properties && (
          <Popup
            longitude={hoverInfo.longitude}
            latitude={hoverInfo.latitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -12]}
            className="commune-popup"
          >
            <div className="p-2 min-w-[200px] rounded-lg bg-surface/90 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={hoverInfo.layer === 'pamf-fill' ? 'analytics' : 'trending_up'} size={16} className="text-primary" aria-hidden />
                <span className="font-bold text-sm">{hoverInfo.feature.properties.name}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {hoverInfo.layer === 'pamf-fill' && hoverInfo.feature.properties.pamf != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t('pamfValue' as TranslationKey)}:</span>
                    <span className="font-semibold">{Number(hoverInfo.feature.properties.pamf).toFixed(2)} {t('pamfFiresPerKm2' as TranslationKey)}</span>
                  </div>
                )}
                {hoverInfo.layer === 'rma-fill' && hoverInfo.feature.properties.rma != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t('rmaValue' as TranslationKey)}:</span>
                    <span className="font-semibold">{Number(hoverInfo.feature.properties.rma).toFixed(3)}%</span>
                  </div>
                )}
                {hoverInfo.feature.properties.pamf == null && hoverInfo.feature.properties.rma == null && (
                  <div className="text-muted-foreground">{t('insufficientFireData' as TranslationKey)}</div>
                )}
              </div>
            </div>
          </Popup>
        )}

        <DeckGLOverlay layers={deckLayers} />
      </ReactMapGL>

      {/* ═══ Overlay controls ═══ */}
      <MapControls
        mobileOpen={mobilePanel === 'layers'}
        onMobileOpenChange={(open) => setMobilePanel(open ? 'layers' : null)}
      />
      <WeatherWidget
        weather={weather}
        loading={weatherLoading}
        mobileOpen={mobilePanel === 'weather'}
        onMobileOpenChange={(open) => setMobilePanel(open ? 'weather' : null)}
      />
      <MapLegend
        mobileOpen={mobilePanel === 'legend'}
        onMobileOpenChange={(open) => setMobilePanel(open ? 'legend' : null)}
      />

      {/* Mobile map dock */}
      <div
        className="absolute bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-border/60 bg-surface/95 p-1.5 shadow-elev-3 backdrop-blur-xl md:hidden"
        data-testid="map-mobile-dock"
      >
        {([
          { panel: 'layers' as const, icon: 'layers' as IconName, label: t('layersPanel' as TranslationKey) },
          { panel: 'weather' as const, icon: 'thermostat' as IconName, label: t('weatherTitle' as TranslationKey) },
          { panel: 'legend' as const, icon: 'map' as IconName, label: t('mapLegend' as TranslationKey) },
        ]).map((item) => {
          const active = mobilePanel === item.panel;
          return (
            <button
              key={item.panel}
              type="button"
              onClick={() => setMobilePanel(active ? null : item.panel)}
              aria-label={item.label}
              aria-pressed={active}
              className={`grid h-11 w-11 place-items-center rounded-lg border text-muted-foreground transition ${
                active
                  ? 'border-primary/30 bg-primary text-primary-foreground shadow-elev-1'
                  : 'border-transparent bg-surface-2/80 hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon name={item.icon} size={19} aria-hidden />
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="grid h-11 w-11 place-items-center rounded-lg border border-transparent bg-surface-2/80 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <Icon name="open" size={18} aria-hidden />
        </button>
      </div>

      {/* Fullscreen toggle */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-14 left-3 z-10 hidden h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface shadow-elev-1 transition-colors hover:bg-surface-2 md:flex"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isFullscreen ? (
            <>
              <polyline points="4 14 8 14 8 18" />
              <polyline points="20 10 16 10 16 6" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          ) : (
            <>
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </>
          )}
        </svg>
      </button>

      {/* Tooltip for dispatch layers */}
      <div
        id="map-tooltip"
        className={TOOLTIP_STYLE}
        style={{ transform: TOOLTIP_TRANSFORM }}
      />
    </div>
  );
}
