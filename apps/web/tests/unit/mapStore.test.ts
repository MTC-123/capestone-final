import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '@/store/useMapStore';

describe('useMapStore', () => {
  beforeEach(() => {
    useMapStore.setState({
      viewState: {
        longitude: -5.1056,
        latitude: 33.5275,
        zoom: 13,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      },
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
      selectedIncidentId: null,
      basemap: 'streets',
      isHeatmapEnabled: false,
      dataErrors: {
        incidents: null,
        resources: null,
        infrastructure: null,
        firmsDetections: null,
        effisDetections: null,
        wind: null,
      },
      incidents: { type: 'FeatureCollection', features: [] },
      lastSuccessfulSync: null,
      windLastUpdate: null,
      ndviOpacity: 0.6,
      pamfRmaHasData: null,
      rasterLoading: {},
    });
  });

  describe('defaults', () => {
    it('has Ifrane coordinates in viewState', () => {
      const { viewState } = useMapStore.getState();
      expect(viewState.longitude).toBe(-5.1056);
      expect(viewState.latitude).toBe(33.5275);
      expect(viewState.zoom).toBe(13);
    });

    it('has all 32 layers with expected defaults', () => {
      const { layers } = useMapStore.getState();
      const values = Object.values(layers);
      expect(values).toHaveLength(33);
      expect(layers.incidents).toBe(true);
      expect(layers.effisFWI).toBe(false);
      expect(layers.effisBurnedAreas).toBe(false);
      expect(layers.infraWatchtowers).toBe(true);
      expect(layers.forestRoads).toBe(false);
      expect(layers.windVectors).toBe(false);
    });

    it('has selectedIncidentId as null', () => {
      expect(useMapStore.getState().selectedIncidentId).toBeNull();
    });

    it('has basemap as streets', () => {
      expect(useMapStore.getState().basemap).toBe('streets');
    });

    it('has empty incidents collection', () => {
      const { incidents } = useMapStore.getState();
      expect(incidents.type).toBe('FeatureCollection');
      expect(incidents.features).toHaveLength(0);
    });

    it('has lastSuccessfulSync as null', () => {
      expect(useMapStore.getState().lastSuccessfulSync).toBeNull();
    });
  });

  describe('toggleLayer', () => {
    it('toggles incidents off', () => {
      useMapStore.getState().toggleLayer('incidents');
      expect(useMapStore.getState().layers.incidents).toBe(false);
    });

    it('toggles incidents back on', () => {
      useMapStore.getState().toggleLayer('incidents');
      useMapStore.getState().toggleLayer('incidents');
      expect(useMapStore.getState().layers.incidents).toBe(true);
    });

    it('does not affect other layers', () => {
      useMapStore.getState().toggleLayer('incidents');
      expect(useMapStore.getState().layers.infrastructure).toBe(true);
      expect(useMapStore.getState().layers.resources).toBe(true);
    });
  });

  describe('EFFIS layer toggles', () => {
    it('toggles effisFWI on', () => {
      expect(useMapStore.getState().layers.effisFWI).toBe(false);
      useMapStore.getState().toggleLayer('effisFWI');
      expect(useMapStore.getState().layers.effisFWI).toBe(true);
    });

    it('toggles effisBurnedAreas on', () => {
      expect(useMapStore.getState().layers.effisBurnedAreas).toBe(false);
      useMapStore.getState().toggleLayer('effisBurnedAreas');
      expect(useMapStore.getState().layers.effisBurnedAreas).toBe(true);
    });

    it('toggling effisFWI does not affect effisBurnedAreas', () => {
      useMapStore.getState().toggleLayer('effisFWI');
      expect(useMapStore.getState().layers.effisFWI).toBe(true);
      expect(useMapStore.getState().layers.effisBurnedAreas).toBe(false);
    });
  });

  describe('setSelectedIncidentId', () => {
    it('sets a string ID', () => {
      useMapStore.getState().setSelectedIncidentId('inc-123');
      expect(useMapStore.getState().selectedIncidentId).toBe('inc-123');
    });

    it('clears to null', () => {
      useMapStore.getState().setSelectedIncidentId('inc-123');
      useMapStore.getState().setSelectedIncidentId(null);
      expect(useMapStore.getState().selectedIncidentId).toBeNull();
    });
  });

  describe('setBasemap', () => {
    it('switches to dark basemap', () => {
      useMapStore.getState().setBasemap('dark');
      expect(useMapStore.getState().basemap).toBe('dark');
    });
  });

  describe('setIsHeatmapEnabled', () => {
    it('enables heatmap', () => {
      useMapStore.getState().setIsHeatmapEnabled(true);
      expect(useMapStore.getState().isHeatmapEnabled).toBe(true);
    });
  });

  describe('setDataError / clearAllErrors', () => {
    it('sets an error on a specific layer', () => {
      useMapStore.getState().setDataError('incidents', 'fetch failed');
      expect(useMapStore.getState().dataErrors.incidents).toBe('fetch failed');
    });

    it('clears a single layer error', () => {
      useMapStore.getState().setDataError('incidents', 'fetch failed');
      useMapStore.getState().setDataError('incidents', null);
      expect(useMapStore.getState().dataErrors.incidents).toBeNull();
    });

    it('sets an error on effisDetections', () => {
      useMapStore.getState().setDataError('effisDetections', 'EFFIS unavailable');
      expect(useMapStore.getState().dataErrors.effisDetections).toBe('EFFIS unavailable');
    });

    it('clearAllErrors resets all to null', () => {
      useMapStore.getState().setDataError('incidents', 'err1');
      useMapStore.getState().setDataError('resources', 'err2');
      useMapStore.getState().clearAllErrors();
      const errors = useMapStore.getState().dataErrors;
      expect(Object.values(errors).every((v) => v === null)).toBe(true);
    });
  });

  describe('setIncidents', () => {
    it('sets incidents collection', () => {
      const collection = {
        type: 'FeatureCollection' as const,
        features: [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [0, 0] }, properties: { id: '1' } }],
      };
      useMapStore.getState().setIncidents(collection as any);
      expect(useMapStore.getState().incidents.features).toHaveLength(1);
    });
  });

  describe('setLastSuccessfulSync', () => {
    it('sets a date', () => {
      const now = new Date();
      useMapStore.getState().setLastSuccessfulSync(now);
      expect(useMapStore.getState().lastSuccessfulSync).toBe(now);
    });
  });

  describe('setViewState', () => {
    it('updates viewState', () => {
      const newVs = {
        longitude: 10,
        latitude: 20,
        zoom: 5,
        pitch: 45,
        bearing: 90,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      };
      useMapStore.getState().setViewState(newVs);
      const vs = useMapStore.getState().viewState;
      expect(vs.longitude).toBe(10);
      expect(vs.latitude).toBe(20);
      expect(vs.pitch).toBe(45);
    });
  });

  describe('wind layer state', () => {
    it('has windLastUpdate as null by default', () => {
      expect(useMapStore.getState().windLastUpdate).toBeNull();
    });

    it('sets windLastUpdate', () => {
      const now = new Date();
      useMapStore.getState().setWindLastUpdate(now);
      expect(useMapStore.getState().windLastUpdate).toBe(now);
    });

    it('clears windLastUpdate to null', () => {
      useMapStore.getState().setWindLastUpdate(new Date());
      useMapStore.getState().setWindLastUpdate(null);
      expect(useMapStore.getState().windLastUpdate).toBeNull();
    });

    it('tracks wind data error', () => {
      useMapStore.getState().setDataError('wind', 'fetch failed');
      expect(useMapStore.getState().dataErrors.wind).toBe('fetch failed');
    });

    it('clearAllErrors clears wind error', () => {
      useMapStore.getState().setDataError('wind', 'err');
      useMapStore.getState().clearAllErrors();
      expect(useMapStore.getState().dataErrors.wind).toBeNull();
    });
  });

  describe('heavy raster mutual exclusivity', () => {
    it('toggling ndvi ON turns off soilMoisture, effisFWI, and camsAerosol', () => {
      // Enable effisFWI (a heavy raster)
      useMapStore.getState().setLayerEnabled('effisFWI', true);
      expect(useMapStore.getState().layers.effisFWI).toBe(true);

      // Toggle ndvi on → effisFWI should turn off
      useMapStore.getState().toggleLayer('ndvi');
      const { layers } = useMapStore.getState();
      expect(layers.ndvi).toBe(true);
      expect(layers.soilMoisture).toBe(false);
      expect(layers.effisFWI).toBe(false);
      expect(layers.camsAerosol).toBe(false);
    });

    it('toggling soilMoisture ON turns off ndvi, effisFWI, and camsAerosol', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().setLayerEnabled('effisFWI', true);

      useMapStore.getState().toggleLayer('soilMoisture');
      const { layers } = useMapStore.getState();
      expect(layers.soilMoisture).toBe(true);
      expect(layers.ndvi).toBe(false);
      expect(layers.effisFWI).toBe(false);
      expect(layers.camsAerosol).toBe(false);
    });

    it('toggling effisFWI ON turns off ndvi, soilMoisture, and camsAerosol', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().setLayerEnabled('soilMoisture', true);

      useMapStore.getState().toggleLayer('effisFWI');
      const { layers } = useMapStore.getState();
      expect(layers.effisFWI).toBe(true);
      expect(layers.ndvi).toBe(false);
      expect(layers.soilMoisture).toBe(false);
      expect(layers.camsAerosol).toBe(false);
    });

    it('toggling camsAerosol ON turns off ndvi, soilMoisture, and effisFWI', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);

      useMapStore.getState().toggleLayer('camsAerosol');
      const { layers } = useMapStore.getState();
      expect(layers.camsAerosol).toBe(true);
      expect(layers.ndvi).toBe(false);
      expect(layers.soilMoisture).toBe(false);
      expect(layers.effisFWI).toBe(false);
    });

    it('toggling a heavy raster OFF does not affect others', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      // ndvi is on, others are off
      useMapStore.getState().toggleLayer('ndvi');
      const { layers } = useMapStore.getState();
      expect(layers.ndvi).toBe(false);
      expect(layers.soilMoisture).toBe(false);
      expect(layers.effisFWI).toBe(false);
      expect(layers.camsAerosol).toBe(false);
    });

    it('setLayerEnabled(ndvi, true) turns off soilMoisture', () => {
      useMapStore.getState().setLayerEnabled('soilMoisture', true);
      useMapStore.getState().setLayerEnabled('ndvi', true);
      expect(useMapStore.getState().layers.ndvi).toBe(true);
      expect(useMapStore.getState().layers.soilMoisture).toBe(false);
    });

    it('toggling non-heavy raster does not affect heavy rasters', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().toggleLayer('windVectors');
      expect(useMapStore.getState().layers.ndvi).toBe(true);
      expect(useMapStore.getState().layers.windVectors).toBe(true);
    });
  });

  describe('ndviOpacity', () => {
    it('defaults to 0.6', () => {
      expect(useMapStore.getState().ndviOpacity).toBe(0.6);
    });

    it('sets opacity', () => {
      useMapStore.getState().setNdviOpacity(0.8);
      expect(useMapStore.getState().ndviOpacity).toBe(0.8);
    });
  });

  describe('hillshade and slope layers', () => {
    it('hillshade defaults to false', () => {
      expect(useMapStore.getState().layers.hillshade).toBe(false);
    });

    it('slope defaults to false', () => {
      expect(useMapStore.getState().layers.slope).toBe(false);
    });

    it('toggles hillshade on and off', () => {
      useMapStore.getState().toggleLayer('hillshade');
      expect(useMapStore.getState().layers.hillshade).toBe(true);
      useMapStore.getState().toggleLayer('hillshade');
      expect(useMapStore.getState().layers.hillshade).toBe(false);
    });

    it('toggles slope on and off', () => {
      useMapStore.getState().toggleLayer('slope');
      expect(useMapStore.getState().layers.slope).toBe(true);
      useMapStore.getState().toggleLayer('slope');
      expect(useMapStore.getState().layers.slope).toBe(false);
    });

    it('hillshade and slope are NOT mutually exclusive with heavy rasters', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().toggleLayer('hillshade');
      useMapStore.getState().toggleLayer('slope');
      const { layers } = useMapStore.getState();
      expect(layers.hillshade).toBe(true);
      expect(layers.slope).toBe(true);
      expect(layers.ndvi).toBe(true);
    });
  });

  describe('slopeOpacity', () => {
    it('defaults to 0.6', () => {
      expect(useMapStore.getState().slopeOpacity).toBe(0.6);
    });

    it('sets opacity', () => {
      useMapStore.getState().setSlopeOpacity(0.9);
      expect(useMapStore.getState().slopeOpacity).toBe(0.9);
    });
  });

  describe('hillshadeExaggeration', () => {
    it('defaults to 0.5', () => {
      expect(useMapStore.getState().hillshadeExaggeration).toBe(0.5);
    });

    it('sets exaggeration', () => {
      useMapStore.getState().setHillshadeExaggeration(0.8);
      expect(useMapStore.getState().hillshadeExaggeration).toBe(0.8);
    });
  });

  describe('pamfRmaHasData', () => {
    it('defaults to null', () => {
      expect(useMapStore.getState().pamfRmaHasData).toBeNull();
    });

    it('sets to true', () => {
      useMapStore.getState().setPamfRmaHasData(true);
      expect(useMapStore.getState().pamfRmaHasData).toBe(true);
    });

    it('sets to false', () => {
      useMapStore.getState().setPamfRmaHasData(false);
      expect(useMapStore.getState().pamfRmaHasData).toBe(false);
    });
  });

  describe('landCover layer', () => {
    it('defaults to false', () => {
      expect(useMapStore.getState().layers.landCover).toBe(false);
    });

    it('toggles landCover on and off', () => {
      useMapStore.getState().toggleLayer('landCover');
      expect(useMapStore.getState().layers.landCover).toBe(true);
      useMapStore.getState().toggleLayer('landCover');
      expect(useMapStore.getState().layers.landCover).toBe(false);
    });

    it('toggling landCover ON turns off ndvi, soilMoisture, effisFWI, and camsAerosol', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().toggleLayer('landCover');
      const { layers } = useMapStore.getState();
      expect(layers.landCover).toBe(true);
      expect(layers.ndvi).toBe(false);
      expect(layers.soilMoisture).toBe(false);
      expect(layers.effisFWI).toBe(false);
      expect(layers.camsAerosol).toBe(false);
    });

    it('toggling ndvi ON turns off landCover', () => {
      useMapStore.getState().setLayerEnabled('landCover', true);
      useMapStore.getState().toggleLayer('ndvi');
      expect(useMapStore.getState().layers.ndvi).toBe(true);
      expect(useMapStore.getState().layers.landCover).toBe(false);
    });
  });

  describe('landCoverOpacity', () => {
    it('defaults to 0.5', () => {
      expect(useMapStore.getState().landCoverOpacity).toBe(0.5);
    });

    it('sets opacity', () => {
      useMapStore.getState().setLandCoverOpacity(0.8);
      expect(useMapStore.getState().landCoverOpacity).toBe(0.8);
    });
  });

  describe('populationDensity layer', () => {
    it('defaults to false', () => {
      expect(useMapStore.getState().layers.populationDensity).toBe(false);
    });

    it('toggles on and off', () => {
      useMapStore.getState().toggleLayer('populationDensity');
      expect(useMapStore.getState().layers.populationDensity).toBe(true);
      useMapStore.getState().toggleLayer('populationDensity');
      expect(useMapStore.getState().layers.populationDensity).toBe(false);
    });

    it('is NOT mutually exclusive with heavy rasters', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().toggleLayer('populationDensity');
      const { layers } = useMapStore.getState();
      expect(layers.populationDensity).toBe(true);
      expect(layers.ndvi).toBe(true);
    });
  });

  describe('populationDensityOpacity', () => {
    it('defaults to 0.6', () => {
      expect(useMapStore.getState().populationDensityOpacity).toBe(0.6);
    });

    it('sets opacity', () => {
      useMapStore.getState().setPopulationDensityOpacity(0.4);
      expect(useMapStore.getState().populationDensityOpacity).toBe(0.4);
    });
  });

  describe('fireSpread layer', () => {
    it('defaults to false', () => {
      expect(useMapStore.getState().layers.fireSpread).toBe(false);
    });

    it('toggles on and off', () => {
      useMapStore.getState().toggleLayer('fireSpread');
      expect(useMapStore.getState().layers.fireSpread).toBe(true);
      useMapStore.getState().toggleLayer('fireSpread');
      expect(useMapStore.getState().layers.fireSpread).toBe(false);
    });

    it('is NOT mutually exclusive with heavy rasters', () => {
      useMapStore.getState().setLayerEnabled('ndvi', true);
      useMapStore.getState().toggleLayer('fireSpread');
      const { layers } = useMapStore.getState();
      expect(layers.fireSpread).toBe(true);
      expect(layers.ndvi).toBe(true);
    });
  });

  describe('fireSpreadOpacity', () => {
    it('defaults to 0.8', () => {
      expect(useMapStore.getState().fireSpreadOpacity).toBe(0.8);
    });

    it('sets opacity', () => {
      useMapStore.getState().setFireSpreadOpacity(0.5);
      expect(useMapStore.getState().fireSpreadOpacity).toBe(0.5);
    });
  });

  describe('rasterLoading', () => {
    it('defaults to empty object', () => {
      expect(useMapStore.getState().rasterLoading).toEqual({});
    });

    it('sets loading state for a key', () => {
      useMapStore.getState().setRasterLoading('ndvi', true);
      expect(useMapStore.getState().rasterLoading.ndvi).toBe(true);
    });

    it('clears loading state', () => {
      useMapStore.getState().setRasterLoading('ndvi', true);
      useMapStore.getState().setRasterLoading('ndvi', false);
      expect(useMapStore.getState().rasterLoading.ndvi).toBe(false);
    });
  });

  describe('resource sub-layer defaults', () => {
    it('rscTrucks defaults to true', () => {
      expect(useMapStore.getState().layers.rscTrucks).toBe(true);
    });

    it('rscAircraft defaults to true', () => {
      expect(useMapStore.getState().layers.rscAircraft).toBe(true);
    });

    it('rscPersonnel defaults to true', () => {
      expect(useMapStore.getState().layers.rscPersonnel).toBe(true);
    });

    it('rscEquipment defaults to true', () => {
      expect(useMapStore.getState().layers.rscEquipment).toBe(true);
    });

    it('all 4 resource sub-layers exist in layer state', () => {
      const { layers } = useMapStore.getState();
      expect('rscTrucks' in layers).toBe(true);
      expect('rscAircraft' in layers).toBe(true);
      expect('rscPersonnel' in layers).toBe(true);
      expect('rscEquipment' in layers).toBe(true);
    });
  });

  describe('resource sub-layer toggles', () => {
    it('toggles rscTrucks off and back on independently', () => {
      useMapStore.getState().toggleLayer('rscTrucks');
      expect(useMapStore.getState().layers.rscTrucks).toBe(false);
      useMapStore.getState().toggleLayer('rscTrucks');
      expect(useMapStore.getState().layers.rscTrucks).toBe(true);
    });

    it('toggles rscAircraft off and back on independently', () => {
      useMapStore.getState().toggleLayer('rscAircraft');
      expect(useMapStore.getState().layers.rscAircraft).toBe(false);
      useMapStore.getState().toggleLayer('rscAircraft');
      expect(useMapStore.getState().layers.rscAircraft).toBe(true);
    });

    it('toggles rscPersonnel off and back on independently', () => {
      useMapStore.getState().toggleLayer('rscPersonnel');
      expect(useMapStore.getState().layers.rscPersonnel).toBe(false);
      useMapStore.getState().toggleLayer('rscPersonnel');
      expect(useMapStore.getState().layers.rscPersonnel).toBe(true);
    });

    it('toggles rscEquipment off and back on independently', () => {
      useMapStore.getState().toggleLayer('rscEquipment');
      expect(useMapStore.getState().layers.rscEquipment).toBe(false);
      useMapStore.getState().toggleLayer('rscEquipment');
      expect(useMapStore.getState().layers.rscEquipment).toBe(true);
    });

    it('toggling rscTrucks does not affect the other 3 resource sub-layers', () => {
      useMapStore.getState().toggleLayer('rscTrucks');
      const { layers } = useMapStore.getState();
      expect(layers.rscTrucks).toBe(false);
      expect(layers.rscAircraft).toBe(true);
      expect(layers.rscPersonnel).toBe(true);
      expect(layers.rscEquipment).toBe(true);
    });

    it('toggling rscAircraft does not affect the other 3 resource sub-layers', () => {
      useMapStore.getState().toggleLayer('rscAircraft');
      const { layers } = useMapStore.getState();
      expect(layers.rscAircraft).toBe(false);
      expect(layers.rscTrucks).toBe(true);
      expect(layers.rscPersonnel).toBe(true);
      expect(layers.rscEquipment).toBe(true);
    });

    it('toggling rscPersonnel does not affect the other 3 resource sub-layers', () => {
      useMapStore.getState().toggleLayer('rscPersonnel');
      const { layers } = useMapStore.getState();
      expect(layers.rscPersonnel).toBe(false);
      expect(layers.rscTrucks).toBe(true);
      expect(layers.rscAircraft).toBe(true);
      expect(layers.rscEquipment).toBe(true);
    });

    it('toggling rscEquipment does not affect the other 3 resource sub-layers', () => {
      useMapStore.getState().toggleLayer('rscEquipment');
      const { layers } = useMapStore.getState();
      expect(layers.rscEquipment).toBe(false);
      expect(layers.rscTrucks).toBe(true);
      expect(layers.rscAircraft).toBe(true);
      expect(layers.rscPersonnel).toBe(true);
    });

    it('each resource sub-layer can be toggled independently in sequence', () => {
      useMapStore.getState().toggleLayer('rscTrucks');
      useMapStore.getState().toggleLayer('rscAircraft');
      const { layers } = useMapStore.getState();
      expect(layers.rscTrucks).toBe(false);
      expect(layers.rscAircraft).toBe(false);
      expect(layers.rscPersonnel).toBe(true);
      expect(layers.rscEquipment).toBe(true);
    });

    it('setLayerEnabled disables rscTrucks without affecting siblings', () => {
      useMapStore.getState().setLayerEnabled('rscTrucks', false);
      const { layers } = useMapStore.getState();
      expect(layers.rscTrucks).toBe(false);
      expect(layers.rscAircraft).toBe(true);
      expect(layers.rscPersonnel).toBe(true);
      expect(layers.rscEquipment).toBe(true);
    });

    it('setLayerEnabled re-enables rscTrucks after it was disabled', () => {
      useMapStore.getState().setLayerEnabled('rscTrucks', false);
      useMapStore.getState().setLayerEnabled('rscTrucks', true);
      expect(useMapStore.getState().layers.rscTrucks).toBe(true);
    });
  });
});
