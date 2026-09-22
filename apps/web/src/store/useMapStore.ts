import { create } from 'zustand';
import type { ViewState } from 'react-map-gl';
import type { Basemap } from '@/lib/map/styles';
import type { GeoFeatureCollection, GeoIncidentProps, WeatherData } from '@/types';
import type { FireSpreadStatus } from '@/hooks/useFireSpreadVectors';

type ActiveLayer =
  | 'incidents'
  | 'infrastructure'
  | 'resources'
  | 'firmsDetections'
  | 'routes'
  | 'activeTeams'
  | 'isochrones'
  | 'vehicles'
  | 'rscTrucks'
  | 'rscAircraft'
  | 'rscPersonnel'
  | 'rscEquipment'
  | 'effisFWI'
  | 'effisBurnedAreas'
  | 'infraWatchtowers'
  | 'infraWaterPoints'
  | 'infraFireStations'
  | 'infraFirebreaks'
  | 'forestRoads'
  | 'windVectors'
  | 'pamfCommunes'
  | 'rmaCommunes'
  | 'ndvi'
  | 'soilMoisture'
  | 'reservoirs'
  | 'camsAerosol'
  | 'landCover'
  | 'hillshade'
  | 'slope'
  | 'populationDensity'
  | 'fireSpread'
  | 'retardant'
  | 'owmWeather';

const EMPTY_INCIDENTS: GeoFeatureCollection<GeoIncidentProps> = { type: 'FeatureCollection', features: [] };

export type EffisFwiMode = 'fwi' | 'ranking';
export type EffisBurnedAreaMode = 'recent' | 'season';
export type SoilMoistureDepth = 'surface' | 'root' | 'deep';
export type CamsAerosolMode = 'aod' | 'dust' | 'smoke';
export type OwmWeatherLayer = 'precipitation_new' | 'clouds_new' | 'wind_new' | 'temp_new' | 'pressure_new';

const HEAVY_RASTER_LAYERS: ActiveLayer[] = ['ndvi', 'soilMoisture', 'effisFWI', 'camsAerosol', 'landCover'];

interface MapState {
  viewState: ViewState;
  setViewState: (vs: ViewState) => void;
  layers: {
    incidents: boolean;
    infrastructure: boolean;
    resources: boolean;
    firmsDetections: boolean;
    effisFWI: boolean;
    effisBurnedAreas: boolean;
    routes: boolean;
    activeTeams: boolean;
    isochrones: boolean;
    vehicles: boolean;
    rscTrucks: boolean;
    rscAircraft: boolean;
    rscPersonnel: boolean;
    rscEquipment: boolean;
    infraWatchtowers: boolean;
    infraWaterPoints: boolean;
    infraFireStations: boolean;
    infraFirebreaks: boolean;
    forestRoads: boolean;
    windVectors: boolean;
    pamfCommunes: boolean;
    rmaCommunes: boolean;
    ndvi: boolean;
    soilMoisture: boolean;
    reservoirs: boolean;
    camsAerosol: boolean;
    landCover: boolean;
    hillshade: boolean;
    slope: boolean;
    populationDensity: boolean;
    fireSpread: boolean;
    retardant: boolean;
    owmWeather: boolean;
  };
  toggleLayer: (layer: ActiveLayer) => void;
  setLayerEnabled: (layer: ActiveLayer, enabled: boolean) => void;
  /* EFFIS FWI controls */
  effisFwiDay: number; // 0=today, 1=+1, ..., 5=+5
  setEffisFwiDay: (day: number) => void;
  effisFwiOpacity: number; // 0.3–1.0
  setEffisFwiOpacity: (opacity: number) => void;
  effisFwiMode: EffisFwiMode;
  setEffisFwiMode: (mode: EffisFwiMode) => void;
  /* EFFIS Burned Areas controls */
  effisBurnedAreaMode: EffisBurnedAreaMode;
  setEffisBurnedAreaMode: (mode: EffisBurnedAreaMode) => void;
  /* Soil Moisture controls */
  soilMoistureDepth: SoilMoistureDepth;
  setSoilMoistureDepth: (depth: SoilMoistureDepth) => void;
  /* NDVI controls */
  ndviOpacity: number;
  setNdviOpacity: (opacity: number) => void;
  /* CAMS Aerosol controls */
  camsAerosolMode: CamsAerosolMode;
  setCamsAerosolMode: (mode: CamsAerosolMode) => void;
  camsAerosolOpacity: number;
  setCamsAerosolOpacity: (opacity: number) => void;
  /* Land Cover controls */
  landCoverOpacity: number;
  setLandCoverOpacity: (opacity: number) => void;
  /* Population Density controls */
  populationDensityOpacity: number;
  setPopulationDensityOpacity: (opacity: number) => void;
  /* OWM Weather Tiles controls */
  owmWeatherLayer: OwmWeatherLayer;
  setOwmWeatherLayer: (layer: OwmWeatherLayer) => void;
  owmWeatherOpacity: number;
  setOwmWeatherOpacity: (opacity: number) => void;
  /* Fire Spread controls */
  fireSpreadOpacity: number;
  setFireSpreadOpacity: (opacity: number) => void;
  fireSpreadSimPoint: { lon: number; lat: number } | null;
  setFireSpreadSimPoint: (point: { lon: number; lat: number } | null) => void;
  fireSpreadStatus: FireSpreadStatus;
  setFireSpreadStatus: (status: FireSpreadStatus) => void;
  /* Terrain controls */
  slopeOpacity: number;
  setSlopeOpacity: (opacity: number) => void;
  hillshadeExaggeration: number;
  setHillshadeExaggeration: (exaggeration: number) => void;
  /* PAMF/RMA data state */
  pamfRmaHasData: boolean | null;
  setPamfRmaHasData: (hasData: boolean | null) => void;
  /* WMS tile availability (false = service down, using fallback) */
  tileAvailability: {
    effisFwi: boolean;
    effisBurned: boolean;
    cams: boolean;
    worldpop: boolean;
    landCover: boolean;
    jrcWater: boolean;
  };
  setTileAvailable: (key: keyof MapState['tileAvailability'], available: boolean) => void;
  resetAllTileAvailability: () => void;
  /* Retry counts for exponential backoff (reset on manual retry or toggle) */
  tileRetryCount: Record<string, number>;
  incrementTileRetry: (key: string) => void;
  resetTileRetry: (key: string) => void;
  resetAllTileRetries: () => void;
  /* Raster loading indicators */
  rasterLoading: Record<string, boolean>;
  setRasterLoading: (key: string, loading: boolean) => void;
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  basemap: Basemap;
  setBasemap: (basemap: Basemap) => void;
  isHeatmapEnabled: boolean;
  setIsHeatmapEnabled: (enabled: boolean) => void;
  dataErrors: {
    incidents: string | null;
    resources: string | null;
    infrastructure: string | null;
    firmsDetections: string | null;
    effisDetections: string | null;
    wind: string | null;
  };
  setDataError: (layer: keyof MapState['dataErrors'], error: string | null) => void;
  clearAllErrors: () => void;
  incidents: GeoFeatureCollection<GeoIncidentProps>;
  setIncidents: (incidents: GeoFeatureCollection<GeoIncidentProps>) => void;
  lastSuccessfulSync: Date | null;
  setLastSuccessfulSync: (date: Date) => void;
  weather: WeatherData | null;
  setWeather: (w: WeatherData | null) => void;
  firmsLastUpdate: Date | null;
  setFirmsLastUpdate: (date: Date) => void;
  windLastUpdate: Date | null;
  setWindLastUpdate: (d: Date | null) => void;
}

const DEFAULT_VIEW: ViewState = {
  longitude: -5.1056,
  latitude: 33.5275,
  zoom: 13,
  pitch: 0,
  bearing: 0,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
};

export const useMapStore = create<MapState>()((set) => ({
  incidents: EMPTY_INCIDENTS,
  setIncidents: (incidents) => set({ incidents }),
  lastSuccessfulSync: null,
  setLastSuccessfulSync: (lastSuccessfulSync) => set({ lastSuccessfulSync }),
  viewState: DEFAULT_VIEW,
  setViewState: (viewState) => set({ viewState }),
  layers: {
    incidents: true,
    infrastructure: true,
    resources: true,
    firmsDetections: true,
    effisFWI: false,
    effisBurnedAreas: false,
    routes: true,
    activeTeams: true,
    isochrones: true,
    vehicles: true,
    rscTrucks: true,
    rscAircraft: true,
    rscPersonnel: true,
    rscEquipment: true,
    infraWatchtowers: true,
    infraWaterPoints: true,
    infraFireStations: true,
    infraFirebreaks: true,
    forestRoads: false,
    windVectors: false,
    pamfCommunes: false,
    rmaCommunes: false,
    ndvi: false,
    soilMoisture: false,
    reservoirs: false,
    camsAerosol: false,
    landCover: false,
    hillshade: false,
    slope: false,
    populationDensity: false,
    fireSpread: false,
    retardant: false,
    owmWeather: false,
  },
  toggleLayer: (layer) =>
    set((state) => {
      const newVal = !state.layers[layer];
      const updates: Partial<typeof state.layers> = { [layer]: newVal };
      // Heavy raster mutual exclusivity: turning one on turns others off
      if (newVal && HEAVY_RASTER_LAYERS.includes(layer)) {
        for (const other of HEAVY_RASTER_LAYERS) {
          if (other !== layer) updates[other] = false;
        }
      }
      return { layers: { ...state.layers, ...updates } };
    }),
  setLayerEnabled: (layer, enabled) =>
    set((state) => {
      const updates: Partial<typeof state.layers> = { [layer]: enabled };
      if (enabled && HEAVY_RASTER_LAYERS.includes(layer)) {
        for (const other of HEAVY_RASTER_LAYERS) {
          if (other !== layer) updates[other] = false;
        }
      }
      return { layers: { ...state.layers, ...updates } };
    }),
  selectedIncidentId: null,
  setSelectedIncidentId: (id) => set({ selectedIncidentId: id }),
  basemap: 'streets' as Basemap,
  setBasemap: (basemap) => set({ basemap }),
  isHeatmapEnabled: false,
  setIsHeatmapEnabled: (isHeatmapEnabled) => set({ isHeatmapEnabled }),
  dataErrors: {
    incidents: null,
    resources: null,
    infrastructure: null,
    firmsDetections: null,
    effisDetections: null,
    wind: null,
  },
  setDataError: (layer, error) =>
    set((state) => ({
      dataErrors: { ...state.dataErrors, [layer]: error },
    })),
  clearAllErrors: () =>
    set({
      dataErrors: {
        incidents: null,
        resources: null,
        infrastructure: null,
        firmsDetections: null,
        effisDetections: null,
        wind: null,
      },
    }),
  weather: null,
  setWeather: (weather) => set({ weather }),
  firmsLastUpdate: null,
  setFirmsLastUpdate: (firmsLastUpdate) => set({ firmsLastUpdate }),
  windLastUpdate: null,
  setWindLastUpdate: (windLastUpdate) => set({ windLastUpdate }),
  /* EFFIS FWI controls */
  effisFwiDay: 0,
  setEffisFwiDay: (effisFwiDay) => set({ effisFwiDay }),
  effisFwiOpacity: 0.6,
  setEffisFwiOpacity: (effisFwiOpacity) => set({ effisFwiOpacity }),
  effisFwiMode: 'fwi' as EffisFwiMode,
  setEffisFwiMode: (effisFwiMode) => set({ effisFwiMode }),
  /* EFFIS Burned Areas controls */
  effisBurnedAreaMode: 'recent' as EffisBurnedAreaMode,
  setEffisBurnedAreaMode: (effisBurnedAreaMode) => set({ effisBurnedAreaMode }),
  /* Soil Moisture controls */
  soilMoistureDepth: 'surface' as SoilMoistureDepth,
  setSoilMoistureDepth: (soilMoistureDepth) => set({ soilMoistureDepth }),
  /* NDVI controls */
  ndviOpacity: 0.6,
  setNdviOpacity: (ndviOpacity) => set({ ndviOpacity }),
  /* CAMS Aerosol controls */
  camsAerosolMode: 'dust' as CamsAerosolMode,
  setCamsAerosolMode: (camsAerosolMode) => set({ camsAerosolMode }),
  camsAerosolOpacity: 0.6,
  setCamsAerosolOpacity: (camsAerosolOpacity) => set({ camsAerosolOpacity }),
  /* Land Cover controls */
  landCoverOpacity: 0.5,
  setLandCoverOpacity: (landCoverOpacity) => set({ landCoverOpacity }),
  /* Population Density controls */
  populationDensityOpacity: 0.6,
  setPopulationDensityOpacity: (populationDensityOpacity) => set({ populationDensityOpacity }),
  /* OWM Weather Tiles controls */
  owmWeatherLayer: 'precipitation_new' as OwmWeatherLayer,
  setOwmWeatherLayer: (owmWeatherLayer) => set({ owmWeatherLayer }),
  owmWeatherOpacity: 0.7,
  setOwmWeatherOpacity: (owmWeatherOpacity) => set({ owmWeatherOpacity }),
  /* Fire Spread controls */
  fireSpreadOpacity: 0.8,
  setFireSpreadOpacity: (fireSpreadOpacity) => set({ fireSpreadOpacity }),
  fireSpreadSimPoint: null,
  setFireSpreadSimPoint: (fireSpreadSimPoint) => set({ fireSpreadSimPoint }),
  fireSpreadStatus: 'idle' as FireSpreadStatus,
  setFireSpreadStatus: (fireSpreadStatus) => set({ fireSpreadStatus }),
  /* Terrain controls */
  slopeOpacity: 0.6,
  setSlopeOpacity: (slopeOpacity) => set({ slopeOpacity }),
  hillshadeExaggeration: 0.5,
  setHillshadeExaggeration: (hillshadeExaggeration) => set({ hillshadeExaggeration }),
  /* PAMF/RMA data state */
  pamfRmaHasData: null,
  setPamfRmaHasData: (pamfRmaHasData) => set({ pamfRmaHasData }),
  /* WMS tile availability */
  tileAvailability: {
    effisFwi: true,
    effisBurned: true,
    cams: true,
    worldpop: true,
    landCover: true,
    jrcWater: true,
  },
  setTileAvailable: (key, available) =>
    set((state) => ({
      tileAvailability: { ...state.tileAvailability, [key]: available },
    })),
  resetAllTileAvailability: () =>
    set({
      tileAvailability: {
        effisFwi: true,
        effisBurned: true,
        cams: true,
        worldpop: true,
        landCover: true,
        jrcWater: true,
      },
      tileRetryCount: {},
    }),
  /* Retry counts for exponential backoff */
  tileRetryCount: {},
  incrementTileRetry: (key) =>
    set((state) => ({
      tileRetryCount: { ...state.tileRetryCount, [key]: (state.tileRetryCount[key] || 0) + 1 },
    })),
  resetTileRetry: (key) =>
    set((state) => {
      const next = { ...state.tileRetryCount };
      delete next[key];
      return { tileRetryCount: next };
    }),
  resetAllTileRetries: () => set({ tileRetryCount: {} }),
  /* Raster loading indicators */
  rasterLoading: {},
  setRasterLoading: (key, loading) =>
    set((state) => ({
      rasterLoading: { ...state.rasterLoading, [key]: loading },
    })),
}));
