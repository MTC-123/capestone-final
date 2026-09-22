'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useMapStore } from '@/store/useMapStore';
import { formatTimeAgo } from '@/lib/utils/time';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Switch } from '@/components/ui/Switch';
import { Slider } from '@/components/ui/Slider';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { Basemap } from '@/lib/map/styles';
import type { TranslationKey } from '@/i18n/translations';
import type { EffisFwiMode, EffisBurnedAreaMode, SoilMoistureDepth, CamsAerosolMode, OwmWeatherLayer } from '@/store/useMapStore';
import { useToastStore } from '@/store/useToastStore';

const RESOURCE_SUB_LAYERS = [
  { key: 'rscTrucks', labelKey: 'rscTrucks', icon: 'truck' as const },
  { key: 'rscAircraft', labelKey: 'rscAircraft', icon: 'navigation' as const },
  { key: 'rscPersonnel', labelKey: 'rscPersonnel', icon: 'users' as const },
  { key: 'rscEquipment', labelKey: 'rscEquipment', icon: 'wrench' as const },
] as const;

const INFRA_SUB_LAYERS = [
  { key: 'infraWatchtowers', labelKey: 'infraWatchtowers', icon: 'eye' as const },
  { key: 'infraWaterPoints', labelKey: 'infraWaterPoints', icon: 'droplet' as const },
  { key: 'infraFireStations', labelKey: 'infraFireStations', icon: 'fire' as const },
  { key: 'infraFirebreaks', labelKey: 'infraFirebreaks', icon: 'shield' as const },
] as const;

const LAYER_KEY_MAP: Record<string, string> = {
  incidents: 'layerIncidents',
  firmsDetections: 'layerFirmsDetections',
  routes: 'layerRoutes',
  activeTeams: 'layerActiveTeams',
  isochrones: 'layerIsochrones',
  vehicles: 'layerVehicles',
  effisFWI: 'layerEffisFWI',
  effisBurnedAreas: 'layerEffisBurnedAreas',
  forestRoads: 'forestRoads',
  windVectors: 'windVectors',
  ndvi: 'ndviLayer',
  soilMoisture: 'soilMoisture',
  reservoirs: 'reservoirs',
  pamfCommunes: 'pamfLayer',
  rmaCommunes: 'rmaLayer',
  camsAerosol: 'camsAerosol',
  landCover: 'layerLandCover',
  populationDensity: 'populationDensity',
  fireSpread: 'layerFireSpread',
  resources: 'layerResources',
  rscTrucks: 'rscTrucks',
  rscAircraft: 'rscAircraft',
  rscPersonnel: 'rscPersonnel',
  rscEquipment: 'rscEquipment',
  retardant: 'layerRetardant',
  hillshade: 'layerHillshade',
  slope: 'layerSlope',
  owmWeather: 'owmWeather',
};

const LAYER_ICONS: Record<string, string> = {
  incidents: 'fire',
  firmsDetections: 'navigation',
  routes: 'route',
  activeTeams: 'users',
  isochrones: 'timer',
  vehicles: 'truck',
  effisFWI: 'thermostat',
  effisBurnedAreas: 'map',
  forestRoads: 'leaf',
  windVectors: 'air',
  ndvi: 'leaf',
  soilMoisture: 'droplet',
  reservoirs: 'waves',
  pamfCommunes: 'analytics',
  rmaCommunes: 'trending_up',
  camsAerosol: 'cloud',
  landCover: 'leaf',
  populationDensity: 'users',
  fireSpread: 'navigation',
  resources: 'truck',
  rscTrucks: 'truck',
  rscAircraft: 'navigation',
  rscPersonnel: 'users',
  rscEquipment: 'wrench',
  retardant: 'droplet',
  hillshade: 'mountain',
  slope: 'mountain',
  owmWeather: 'cloud',
};

const UNAVAILABLE_LAYERS = new Set([
  'forestRoads',
]);

/** Maps layer toggle keys to tile availability store keys */
const LAYER_TILE_KEY: Partial<Record<string, keyof ReturnType<typeof useMapStore.getState>['tileAvailability']>> = {
  effisFWI: 'effisFwi',
  effisBurnedAreas: 'effisBurned',
  camsAerosol: 'cams',
  populationDensity: 'worldpop',
  landCover: 'landCover',
  reservoirs: 'jrcWater',
};

const BASEMAPS: { value: Basemap; labelKey: string; dot: string }[] = [
  { value: 'streets', labelKey: 'basemapStreets', dot: '#6b7280' },
  { value: 'light', labelKey: 'basemapLight', dot: '#f3f4f6' },
  { value: 'dark', labelKey: 'basemapDark', dot: '#1f2937' },
  { value: 'satellite', labelKey: 'basemapSatellite', dot: '#166534' },
];

const FWI_DAYS = [
  { value: 0, labelKey: 'fwiToday' },
  { value: 1, label: '+1' },
  { value: 2, label: '+2' },
  { value: 3, label: '+3' },
  { value: 4, label: '+4' },
  { value: 5, label: '+5' },
] as const;

const FWI_MODES: { value: EffisFwiMode; labelKey: string }[] = [
  { value: 'fwi', labelKey: 'fwiModeFwi' },
  { value: 'ranking', labelKey: 'fwiModeRanking' },
];

const BURNED_AREA_MODES: { value: EffisBurnedAreaMode; labelKey: string }[] = [
  { value: 'recent', labelKey: 'burnedAreaRecent' },
  { value: 'season', labelKey: 'burnedAreaSeason' },
];

const SOIL_DEPTHS: { value: SoilMoistureDepth; labelKey: string }[] = [
  { value: 'surface', labelKey: 'soilMoistureSurface' },
  { value: 'root', labelKey: 'soilMoistureRoot' },
  { value: 'deep', labelKey: 'soilMoistureDeep' },
];

const ALL_LAYER_KEYS = Object.keys(LAYER_KEY_MAP);

function WindLayerRow() {
  const { t } = useTranslation();
  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const windLastUpdate = useMapStore((s) => s.windLastUpdate);

  return (
    <div className="flex items-center justify-between min-h-[36px]">
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          <Icon name="air" size={14} className="text-muted-foreground" aria-hidden />
          {t('windVectors')}
        </span>
        {layers.windVectors && windLastUpdate && (
          <span className="text-[9px] text-muted-foreground pl-5">
            {t('updated')}: {formatTimeAgo(windLastUpdate)}
          </span>
        )}
      </span>
      <Switch
        checked={layers.windVectors}
        onCheckedChange={() => toggleLayer('windVectors')}
        label={t('windVectors')}
      />
    </div>
  );
}

type LayerKey = keyof typeof LAYER_KEY_MAP;

function LayerRow({ layerKey, indent }: { layerKey: LayerKey; indent?: boolean }) {
  const { t } = useTranslation();
  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const tileAvailability = useMapStore((s) => s.tileAvailability);
  const lk = LAYER_KEY_MAP[layerKey];
  const icon = LAYER_ICONS[layerKey];
  const isUnavailable = UNAVAILABLE_LAYERS.has(layerKey);
  const tileKey = LAYER_TILE_KEY[layerKey];
  const tilesDown = tileKey ? !tileAvailability[tileKey] : false;

  return (
    <div className={`flex items-center justify-between min-h-[36px] ${indent ? 'pl-4' : ''} ${isUnavailable ? 'opacity-50' : ''}`}>
      <span className="flex items-center gap-1.5 text-xs text-foreground">
        {icon && <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={14} className="text-muted-foreground" aria-hidden />}
        {t(lk as TranslationKey)}
        {isUnavailable && (
          <span className="text-[9px] text-muted-foreground">({t('comingSoon')})</span>
        )}
        {tilesDown && (
          <span className="text-accent-fire" title={t('serviceDown' as TranslationKey)}>
            <Icon name="warning" size={12} aria-hidden />
          </span>
        )}
      </span>
      <Switch
        checked={layers[layerKey as keyof typeof layers] ?? false}
        onCheckedChange={() => toggleLayer(layerKey as Parameters<typeof toggleLayer>[0])}
        label={t(lk as TranslationKey)}
        disabled={isUnavailable}
      />
    </div>
  );
}

/* ─── EFFIS FWI sub-controls (day selector + opacity slider) ─── */

function EffisFwiControls() {
  const { t } = useTranslation();
  const effisFwiDay = useMapStore((s) => s.effisFwiDay);
  const setEffisFwiDay = useMapStore((s) => s.setEffisFwiDay);
  const effisFwiOpacity = useMapStore((s) => s.effisFwiOpacity);
  const setEffisFwiOpacity = useMapStore((s) => s.setEffisFwiOpacity);
  const effisFwiMode = useMapStore((s) => s.effisFwiMode);
  const setEffisFwiMode = useMapStore((s) => s.setEffisFwiMode);

  return (
    <div className="pl-5 space-y-2 mt-1">
      {/* Mode selector (FWI / Percentile) */}
      <div>
        <div className="text-[9px] text-muted-foreground mb-1">{t('fwiModeLabel' as TranslationKey)}</div>
        <div className="flex gap-1">
          {FWI_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setEffisFwiMode(m.value)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
                ${effisFwiMode === m.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
                }`}
            >
              {t(m.labelKey as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      {/* Day selector */}
      <div>
        <div className="text-[9px] text-muted-foreground mb-1">{t('effisFwiDayLabel' as TranslationKey)}</div>
        <div className="flex flex-wrap gap-1">
          {FWI_DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setEffisFwiDay(d.value)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
                ${effisFwiDay === d.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
                }`}
            >
              {'labelKey' in d ? t(d.labelKey as TranslationKey) : d.label}
            </button>
          ))}
        </div>
      </div>
      {/* Opacity slider */}
      <div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>{t('effisFwiOpacityLabel' as TranslationKey)}</span>
          <span>{Math.round(effisFwiOpacity * 100)}%</span>
        </div>
        <Slider
          value={Math.round(effisFwiOpacity * 100)}
          onValueChange={(v) => setEffisFwiOpacity(v / 100)}
          min={30}
          max={100}
          label={t('effisFwiOpacityLabel' as TranslationKey)}
        />
      </div>
    </div>
  );
}

/* ─── EFFIS Burned Areas sub-controls (radio: recent / season) ─── */

function EffisBurnedAreasControls() {
  const { t } = useTranslation();
  const mode = useMapStore((s) => s.effisBurnedAreaMode);
  const setMode = useMapStore((s) => s.setEffisBurnedAreaMode);

  return (
    <div className="pl-5 mt-1">
      <div className="flex gap-1">
        {BURNED_AREA_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
              ${mode === m.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
              }`}
          >
            {t(m.labelKey as TranslationKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Soil Moisture sub-controls (depth selector) ─── */

function SoilMoistureControls() {
  const { t } = useTranslation();
  const depth = useMapStore((s) => s.soilMoistureDepth);
  const setDepth = useMapStore((s) => s.setSoilMoistureDepth);

  return (
    <div className="pl-5 mt-1">
      <div className="text-[9px] text-muted-foreground mb-1">{t('soilMoistureDepthLabel' as TranslationKey)}</div>
      <div className="flex flex-wrap gap-1">
        {SOIL_DEPTHS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDepth(d.value)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
              ${depth === d.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
              }`}
          >
            {t(d.labelKey as TranslationKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── NDVI sub-controls (opacity slider) ─── */

function NdviControls() {
  const { t } = useTranslation();
  const ndviOpacity = useMapStore((s) => s.ndviOpacity);
  const setNdviOpacity = useMapStore((s) => s.setNdviOpacity);

  return (
    <div className="pl-5 mt-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>{t('ndviOpacityLabel' as TranslationKey)}</span>
        <span>{Math.round(ndviOpacity * 100)}%</span>
      </div>
      <Slider
        value={Math.round(ndviOpacity * 100)}
        onValueChange={(v) => setNdviOpacity(v / 100)}
        min={20}
        max={100}
        label={t('ndviOpacityLabel' as TranslationKey)}
      />
    </div>
  );
}

/* ─── Hillshade sub-controls (exaggeration slider) ─── */

function HillshadeControls() {
  const { t } = useTranslation();
  const hillshadeExaggeration = useMapStore((s) => s.hillshadeExaggeration);
  const setHillshadeExaggeration = useMapStore((s) => s.setHillshadeExaggeration);

  return (
    <div className="pl-5 mt-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>{t('hillshadeIntensity' as TranslationKey)}</span>
        <span>{Math.round(hillshadeExaggeration * 100)}%</span>
      </div>
      <Slider
        value={Math.round(hillshadeExaggeration * 100)}
        onValueChange={(v) => setHillshadeExaggeration(v / 100)}
        min={10}
        max={100}
        label={t('hillshadeIntensity' as TranslationKey)}
      />
    </div>
  );
}

/* ─── Slope sub-controls (opacity slider) ─── */

function SlopeControls() {
  const { t } = useTranslation();
  const slopeOpacity = useMapStore((s) => s.slopeOpacity);
  const setSlopeOpacity = useMapStore((s) => s.setSlopeOpacity);

  return (
    <div className="pl-5 mt-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>{t('slopeOpacityLabel' as TranslationKey)}</span>
        <span>{Math.round(slopeOpacity * 100)}%</span>
      </div>
      <Slider
        value={Math.round(slopeOpacity * 100)}
        onValueChange={(v) => setSlopeOpacity(v / 100)}
        min={20}
        max={100}
        label={t('slopeOpacityLabel' as TranslationKey)}
      />
    </div>
  );
}

/* ─── Fire Spread sub-controls (opacity slider + status + simulation) ─── */

function FireSpreadControls() {
  const { t } = useTranslation();
  const opacity = useMapStore((s) => s.fireSpreadOpacity);
  const setOpacity = useMapStore((s) => s.setFireSpreadOpacity);
  const status = useMapStore((s) => s.fireSpreadStatus);
  const simPoint = useMapStore((s) => s.fireSpreadSimPoint);
  const setSimPoint = useMapStore((s) => s.setFireSpreadSimPoint);

  return (
    <div className="pl-5 mt-1 space-y-2">
      {/* Status indicator */}
      {status === 'loading' && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
          {t('fireSpreadLoading' as TranslationKey)}
        </div>
      )}
      {status === 'has-vectors' && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-500">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {t('fireSpreadActive' as TranslationKey)}
        </div>
      )}
      {status === 'no-fires' && !simPoint && (
        <div className="rounded-md border border-border bg-surface-2/50 p-2 space-y-1.5">
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Icon name="info" size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
            <span>{t('fireSpreadNoFires' as TranslationKey)}</span>
          </div>
          <div className="text-[9px] text-muted-foreground/70">
            {t('fireSpreadSimHint' as TranslationKey)}
          </div>
        </div>
      )}

      {/* Simulation clear button */}
      {simPoint && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-accent-fire flex items-center gap-1">
            <Icon name="navigation" size={11} aria-hidden />
            {t('fireSpreadSimActive' as TranslationKey)}
          </span>
          <button
            type="button"
            onClick={() => setSimPoint(null)}
            className="rounded-full px-2 py-0.5 text-[9px] font-medium border border-border bg-surface-2/50 text-foreground hover:border-accent-fire/50 transition-all"
          >
            {t('fireSpreadSimClear' as TranslationKey)}
          </button>
        </div>
      )}

      {/* Opacity slider */}
      <div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>{t('fireSpreadOpacityLabel' as TranslationKey)}</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <Slider
          value={Math.round(opacity * 100)}
          onValueChange={(v) => setOpacity(v / 100)}
          min={20}
          max={100}
          label={t('fireSpreadOpacityLabel' as TranslationKey)}
        />
      </div>
    </div>
  );
}

/* ─── CAMS Aerosol sub-controls (mode selector + opacity slider) ─── */

const CAMS_AEROSOL_MODES: { value: CamsAerosolMode; labelKey: string }[] = [
  { value: 'aod', labelKey: 'camsAerosolAod' },
  { value: 'dust', labelKey: 'camsAerosolDust' },
  { value: 'smoke', labelKey: 'camsAerosolSmoke' },
];

function CamsAerosolControls() {
  const { t } = useTranslation();
  const mode = useMapStore((s) => s.camsAerosolMode);
  const setMode = useMapStore((s) => s.setCamsAerosolMode);
  const opacity = useMapStore((s) => s.camsAerosolOpacity);
  const setOpacity = useMapStore((s) => s.setCamsAerosolOpacity);

  return (
    <div className="pl-5 space-y-2 mt-1">
      {/* Mode selector */}
      <div>
        <div className="text-[9px] text-muted-foreground mb-1">{t('camsAerosolModeLabel' as TranslationKey)}</div>
        <div className="flex flex-wrap gap-1">
          {CAMS_AEROSOL_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
                ${mode === m.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
                }`}
            >
              {t(m.labelKey as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      {/* Opacity slider */}
      <div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>{t('camsAerosolOpacity' as TranslationKey)}</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <Slider
          value={Math.round(opacity * 100)}
          onValueChange={(v) => setOpacity(v / 100)}
          min={20}
          max={100}
          label={t('camsAerosolOpacity' as TranslationKey)}
        />
      </div>
    </div>
  );
}

/* ─── OWM Weather Tiles sub-controls (layer selector + opacity slider) ─── */

const OWM_WEATHER_LAYERS: { value: OwmWeatherLayer; labelKey: string }[] = [
  { value: 'precipitation_new', labelKey: 'owmWeatherPrecipitation' },
  { value: 'clouds_new', labelKey: 'owmWeatherClouds' },
  { value: 'wind_new', labelKey: 'owmWeatherWind' },
  { value: 'temp_new', labelKey: 'owmWeatherTemp' },
  { value: 'pressure_new', labelKey: 'owmWeatherPressure' },
];

function OwmWeatherControls() {
  const { t } = useTranslation();
  const owmLayer = useMapStore((s) => s.owmWeatherLayer);
  const setOwmLayer = useMapStore((s) => s.setOwmWeatherLayer);
  const opacity = useMapStore((s) => s.owmWeatherOpacity);
  const setOpacity = useMapStore((s) => s.setOwmWeatherOpacity);

  return (
    <div className="pl-5 space-y-2 mt-1">
      {/* Layer selector */}
      <div>
        <div className="text-[9px] text-muted-foreground mb-1">{t('owmWeatherModeLabel' as TranslationKey)}</div>
        <div className="flex flex-wrap gap-1">
          {OWM_WEATHER_LAYERS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setOwmLayer(m.value)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-all
                ${owmLayer === m.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
                }`}
            >
              {t(m.labelKey as TranslationKey)}
            </button>
          ))}
        </div>
      </div>
      {/* Opacity slider */}
      <div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
          <span>{t('owmWeatherOpacity' as TranslationKey)}</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <Slider
          value={Math.round(opacity * 100)}
          onValueChange={(v) => setOpacity(v / 100)}
          min={20}
          max={100}
          label={t('owmWeatherOpacity' as TranslationKey)}
        />
      </div>
    </div>
  );
}

/* ─── Population Density sub-controls (opacity slider) ─── */

function PopulationDensityControls() {
  const { t } = useTranslation();
  const opacity = useMapStore((s) => s.populationDensityOpacity);
  const setOpacity = useMapStore((s) => s.setPopulationDensityOpacity);

  return (
    <div className="pl-5 mt-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>{t('populationDensityOpacity' as TranslationKey)}</span>
        <span>{Math.round(opacity * 100)}%</span>
      </div>
      <Slider
        value={Math.round(opacity * 100)}
        onValueChange={(v) => setOpacity(v / 100)}
        min={20}
        max={100}
        label={t('populationDensityOpacity' as TranslationKey)}
      />
    </div>
  );
}

/* ─── Land Cover sub-controls (opacity slider) ─── */

function LandCoverControls() {
  const { t } = useTranslation();
  const landCoverOpacity = useMapStore((s) => s.landCoverOpacity);
  const setLandCoverOpacity = useMapStore((s) => s.setLandCoverOpacity);

  return (
    <div className="pl-5 mt-1">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
        <span>{t('landCoverOpacityLabel' as TranslationKey)}</span>
        <span>{Math.round(landCoverOpacity * 100)}%</span>
      </div>
      <Slider
        value={Math.round(landCoverOpacity * 100)}
        onValueChange={(v) => setLandCoverOpacity(v / 100)}
        min={20}
        max={100}
        label={t('landCoverOpacityLabel' as TranslationKey)}
      />
    </div>
  );
}

/* ─── Search filter for layers ─── */

function useLayerSearch(query: string) {
  const { t } = useTranslation();
  return useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return new Set(
      ALL_LAYER_KEYS.filter((key) => {
        const labelKey = LAYER_KEY_MAP[key];
        const label = t(labelKey as TranslationKey).toLowerCase();
        return label.includes(q) || key.toLowerCase().includes(q);
      })
    );
  }, [query, t]);
}

interface MapControlsProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export default function MapControls({ mobileOpen = false, onMobileOpenChange }: MapControlsProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredLayers = useLayerSearch(searchQuery);
  const addToast = useToastStore((s) => s.addToast);

  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const setLayerEnabled = useMapStore((s) => s.setLayerEnabled);
  const basemap = useMapStore((s) => s.basemap);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const isHeatmapEnabled = useMapStore((s) => s.isHeatmapEnabled);
  const setIsHeatmapEnabled = useMapStore((s) => s.setIsHeatmapEnabled);
  const pamfRmaHasData = useMapStore((s) => s.pamfRmaHasData);
  const tileAvailability = useMapStore((s) => s.tileAvailability);
  const resetAllTileAvailability = useMapStore((s) => s.resetAllTileAvailability);

  const anyTileDown = !tileAvailability.effisFwi || !tileAvailability.effisBurned || !tileAvailability.cams || !tileAvailability.worldpop || !tileAvailability.landCover || !tileAvailability.jrcWater;

  const handleRetryAll = useCallback(() => {
    resetAllTileAvailability();
    addToast(t('retryingExternalServices' as TranslationKey), 'info');
  }, [resetAllTileAvailability, addToast, t]);

  const allRscOn = layers.rscTrucks && layers.rscAircraft && layers.rscPersonnel && layers.rscEquipment;
  const someRscOn = layers.rscTrucks || layers.rscAircraft || layers.rscPersonnel || layers.rscEquipment;

  const toggleAllResources = useCallback(() => {
    const newVal = !allRscOn;
    setLayerEnabled('rscTrucks', newVal);
    setLayerEnabled('rscAircraft', newVal);
    setLayerEnabled('rscPersonnel', newVal);
    setLayerEnabled('rscEquipment', newVal);
    setLayerEnabled('resources', newVal);
  }, [allRscOn, setLayerEnabled]);

  const allInfraOn = layers.infraWatchtowers && layers.infraWaterPoints && layers.infraFireStations && layers.infraFirebreaks;
  const someInfraOn = layers.infraWatchtowers || layers.infraWaterPoints || layers.infraFireStations || layers.infraFirebreaks;

  const toggleAllInfra = useCallback(() => {
    const newVal = !allInfraOn;
    setLayerEnabled('infraWatchtowers', newVal);
    setLayerEnabled('infraWaterPoints', newVal);
    setLayerEnabled('infraFireStations', newVal);
    setLayerEnabled('infraFirebreaks', newVal);
    setLayerEnabled('infrastructure', newVal);
  }, [allInfraOn, setLayerEnabled]);

  const anyHeavyRasterActive = layers.ndvi || layers.soilMoisture || layers.effisFWI || layers.camsAerosol || layers.landCover;

  // Count active layers
  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of ALL_LAYER_KEYS) {
      if (layers[key as keyof typeof layers]) count++;
    }
    if (isHeatmapEnabled) count++;
    return count;
  }, [layers, isHeatmapEnabled]);

  const totalCount = ALL_LAYER_KEYS.length + 1; // +1 for heatmap

  // Check if a layer should be visible after search filter
  const isVisible = (key: string) => !filteredLayers || filteredLayers.has(key);

  // Default open sections
  const defaultSections = ['basemap', 'visualization', 'incidents', 'resources', 'dispatch', 'infra', 'environment', 'effis'];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onPointerDown={() => onMobileOpenChange?.(false)}
        />
      )}
      <div
        data-testid="map-layers-panel"
        className={cn(
          'z-10 flex-col gap-2',
          mobileOpen
            ? 'fixed inset-x-2 bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] z-50 flex md:hidden'
            : 'absolute top-3 hidden max-w-[calc(100vw-1.5rem)] ltr:left-3 rtl:right-3 md:flex md:max-w-xs'
        )}
      >
      <GlassPanel
        title={t('layersPanel')}
        collapsible
        headerActions={
          <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
            {activeCount}/{totalCount}
          </span>
        }
        className={cn(
          mobileOpen
            ? 'max-h-[min(72dvh,640px)] rounded-xl'
            : 'max-h-[50vh] sm:max-h-[70vh]'
        )}
      >
        <div
          className={cn(
            'space-y-1 overflow-auto border-t border-white/10 px-3 pb-3 pt-2.5',
            mobileOpen
              ? 'max-h-[calc(min(72dvh,640px)-3rem)] overscroll-contain'
              : 'max-h-[calc(50vh-3rem)] sm:max-h-[calc(70vh-3rem)]'
          )}
        >
          {/* Search */}
          <div className="relative mb-2">
            <Icon name="search" size={14} className="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-lg border border-border bg-surface-2/50 py-1.5 ltr:pl-7 rtl:pr-7 ltr:pr-2 rtl:pl-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Accordion defaultValue={defaultSections}>
            {/* 1. Basemap */}
            <AccordionItem value="basemap">
              <AccordionTrigger>{t('basemapSection')}</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1.5">
                  {BASEMAPS.map(({ value, labelKey, dot }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBasemap(value)}
                      aria-pressed={basemap === value}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border
                        ${basemap === value
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-border bg-surface-2/50 text-foreground hover:border-primary/50'
                        }`}
                    >
                      <span className="h-2 w-2 rounded-full border border-white/30 flex-shrink-0" style={{ backgroundColor: dot }} />
                      {t(labelKey as TranslationKey)}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Visualization */}
            <AccordionItem value="visualization">
              <AccordionTrigger>{t('visualizationSection')}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[36px]">
                    <span className="text-xs text-foreground">{t('layerHeatmap' as TranslationKey)}</span>
                    <Switch checked={isHeatmapEnabled} onCheckedChange={() => setIsHeatmapEnabled(!isHeatmapEnabled)} label={t('layerHeatmap' as TranslationKey)} />
                  </div>
                  {isVisible('hillshade') && <LayerRow layerKey="hillshade" />}
                  {layers.hillshade && <HillshadeControls />}
                  {isVisible('slope') && <LayerRow layerKey="slope" />}
                  {layers.slope && <SlopeControls />}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Incidents & Detection */}
            <AccordionItem value="incidents">
              <AccordionTrigger>{t('incidentStatus')}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5">
                  {isVisible('incidents') && <LayerRow layerKey="incidents" />}
                  {isVisible('firmsDetections') && <LayerRow layerKey="firmsDetections" />}
                  {isVisible('fireSpread') && <LayerRow layerKey="fireSpread" />}
                  {layers.fireSpread && <FireSpreadControls />}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Resources */}
            <AccordionItem value="resources">
              <AccordionTrigger>{t('layerResources')}</AccordionTrigger>
              <AccordionContent>
                {/* Master toggle */}
                <div className="flex items-center justify-between min-h-[36px]">
                  <span className="flex items-center gap-1.5 text-xs text-foreground">
                    <Icon name="truck" size={14} className="text-muted-foreground" aria-hidden />
                    {t('layerResources')}
                  </span>
                  <Switch
                    checked={someRscOn}
                    onCheckedChange={toggleAllResources}
                    label={t('layerResources')}
                  />
                </div>
                <div className="space-y-1.5 mt-1">
                  {RESOURCE_SUB_LAYERS.map(({ key, labelKey, icon }) => (
                    <div key={key} className="flex items-center justify-between min-h-[32px] pl-4">
                      <span className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <Icon name={icon} size={13} className="text-muted-foreground" aria-hidden />
                        {t(labelKey as TranslationKey)}
                      </span>
                      <Switch
                        checked={layers[key as keyof typeof layers] ?? false}
                        onCheckedChange={() => toggleLayer(key as Parameters<typeof toggleLayer>[0])}
                        label={t(labelKey as TranslationKey)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Dispatch */}
            <AccordionItem value="dispatch">
              <AccordionTrigger>{t('dispatchSection')}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5">
                  {isVisible('routes') && <LayerRow layerKey="routes" />}
                  {isVisible('activeTeams') && <LayerRow layerKey="activeTeams" />}
                  {isVisible('isochrones') && <LayerRow layerKey="isochrones" />}
                  {isVisible('vehicles') && <LayerRow layerKey="vehicles" />}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 6. Infrastructure */}
            <AccordionItem value="infra">
              <AccordionTrigger>{t('infrastructure')}</AccordionTrigger>
              <AccordionContent>
                {/* Master toggle */}
                <div className="flex items-center justify-between min-h-[36px]">
                  <span className="flex items-center gap-1.5 text-xs text-foreground">
                    <Icon name="wrench" size={14} className="text-muted-foreground" aria-hidden />
                    {t('layerInfrastructure')}
                  </span>
                  <Switch
                    checked={someInfraOn}
                    onCheckedChange={toggleAllInfra}
                    label={t('layerInfrastructure')}
                  />
                </div>
                <div className="space-y-1.5 mt-1">
                  {INFRA_SUB_LAYERS.map(({ key, labelKey, icon }) => (
                    <div key={key} className="flex items-center justify-between min-h-[32px] pl-4">
                      <span className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <Icon name={icon} size={13} className="text-muted-foreground" aria-hidden />
                        {t(labelKey as TranslationKey)}
                      </span>
                      <Switch
                        checked={layers[key] ?? false}
                        onCheckedChange={() => toggleLayer(key)}
                        label={t(labelKey as TranslationKey)}
                      />
                    </div>
                  ))}
                  {isVisible('forestRoads') && <LayerRow layerKey="forestRoads" indent />}
                  {isVisible('retardant') && <LayerRow layerKey="retardant" indent />}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 7. Environment */}
            <AccordionItem value="environment">
              <AccordionTrigger>{t('environment' as TranslationKey)}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5">
                  {isVisible('owmWeather') && <LayerRow layerKey="owmWeather" />}
                  {layers.owmWeather && <OwmWeatherControls />}
                  {isVisible('windVectors') && <WindLayerRow />}
                  {isVisible('ndvi') && <LayerRow layerKey="ndvi" />}
                  {layers.ndvi && <NdviControls />}
                  {isVisible('soilMoisture') && <LayerRow layerKey="soilMoisture" />}
                  {layers.soilMoisture && <SoilMoistureControls />}
                  {isVisible('reservoirs') && <LayerRow layerKey="reservoirs" />}
                  {isVisible('populationDensity') && <LayerRow layerKey="populationDensity" />}
                  {layers.populationDensity && <PopulationDensityControls />}
                  {isVisible('landCover') && <LayerRow layerKey="landCover" />}
                  {layers.landCover && <LandCoverControls />}
                  {anyHeavyRasterActive && (
                    <div className="text-[9px] text-accent-fire pl-0.5 mt-1 flex items-center gap-1">
                      <Icon name="warning" size={11} className="text-accent-fire" aria-hidden />
                      {t('heavyRasterWarning' as TranslationKey)}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 8. EFFIS / External */}
            <AccordionItem value="effis">
              <AccordionTrigger>{t('effisLayers' as TranslationKey)}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5">
                  {isVisible('effisFWI') && <LayerRow layerKey="effisFWI" />}
                  {layers.effisFWI && <EffisFwiControls />}
                  {isVisible('effisBurnedAreas') && <LayerRow layerKey="effisBurnedAreas" />}
                  {layers.effisBurnedAreas && <EffisBurnedAreasControls />}
                  {isVisible('pamfCommunes') && <LayerRow layerKey="pamfCommunes" />}
                  {isVisible('rmaCommunes') && <LayerRow layerKey="rmaCommunes" />}
                  {isVisible('camsAerosol') && <LayerRow layerKey="camsAerosol" />}
                  {layers.camsAerosol && <CamsAerosolControls />}
                  {pamfRmaHasData === false && (layers.pamfCommunes || layers.rmaCommunes) && (
                    <div className="text-[9px] text-muted-foreground pl-5">
                      {t('insufficientFireData' as TranslationKey)}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Retry button — visible only when any external tile service is down */}
          {anyTileDown && (
            <button
              type="button"
              onClick={handleRetryAll}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-accent-fire/30 bg-accent-fire/10 px-3 py-1.5 text-[11px] font-medium text-accent-fire hover:bg-accent-fire/20 transition-colors"
            >
              <Icon name="refresh" size={13} aria-hidden />
              {t('retryExternalServices' as TranslationKey)}
            </button>
          )}
        </div>
      </GlassPanel>
      </div>
    </>
  );
}
