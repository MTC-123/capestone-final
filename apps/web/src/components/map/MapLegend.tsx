'use client';
import { useState, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useMapStore } from '@/store/useMapStore';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Icon } from '@/components/ui/Icon';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { TranslationKey } from '@/i18n/translations';
import { INCIDENT_STATUS_COLORS, RESOURCE_TYPE_COLORS, INFRASTRUCTURE_TYPE_COLORS, RETARDANT_COLOR, FIRMS_CONFIDENCE_COLORS, EFFIS_FWI_COLORS, EFFIS_BURNED_AREA_COLOR, SOIL_MOISTURE_COLORS, NDVI_COLORS, RESERVOIR_COLORS, PAMF_COLORS, RMA_COLORS, CAMS_AEROSOL_COLORS, SLOPE_COLORS_HEX, LAND_COVER_COLORS, POPULATION_DENSITY_COLORS, FIRE_SPREAD_COLORS } from '@/lib/map/colors';
import { cn } from '@/lib/cn';

const WIND_SPEED_ITEMS = [
  { label: '0–10 km/h', color: '#22c55e', desc: 'Calm' },
  { label: '10–25 km/h', color: '#f97316', desc: 'Moderate' },
  { label: '25+ km/h', color: '#ef4444', desc: 'Strong' },
];

const INCIDENT_COLORS = [
  { key: 'VIGILANCE', color: INCIDENT_STATUS_COLORS.VIGILANCE, label: 'statusVigilance' },
  { key: 'ALERTE', color: INCIDENT_STATUS_COLORS.ALERTE, label: 'statusAlerte' },
  { key: 'INTERVENTION', color: INCIDENT_STATUS_COLORS.INTERVENTION, label: 'statusIntervention' },
  { key: 'MAITRISE', color: INCIDENT_STATUS_COLORS.MAITRISE, label: 'statusMaitrise' },
  { key: 'ETEINT', color: INCIDENT_STATUS_COLORS.ETEINT, label: 'statusEteint' },
];

const RESOURCE_COLORS: { key: string; color: string; label: string; shape: 'square' | 'diamond' | 'triangle' | 'pentagon' }[] = [
  { key: 'TRUCK', color: RESOURCE_TYPE_COLORS.TRUCK, label: 'resourceTruck', shape: 'square' },
  { key: 'AIRCRAFT', color: RESOURCE_TYPE_COLORS.AIRCRAFT, label: 'resourceAircraft', shape: 'diamond' },
  { key: 'PERSONNEL', color: RESOURCE_TYPE_COLORS.PERSONNEL, label: 'resourcePersonnel', shape: 'triangle' },
  { key: 'EQUIPMENT', color: RESOURCE_TYPE_COLORS.EQUIPMENT, label: 'resourceEquipment', shape: 'pentagon' },
];

const INFRA_LEGEND_COLORS: { key: string; color: string; label: string; shape: 'triangle' | 'droplet' | 'house' | 'diamond' }[] = [
  { key: 'WATCHTOWER', color: INFRASTRUCTURE_TYPE_COLORS.WATCHTOWER, label: 'infraWatchtowers', shape: 'triangle' },
  { key: 'WATER_POINT', color: INFRASTRUCTURE_TYPE_COLORS.WATER_POINT, label: 'infraWaterPoints', shape: 'droplet' },
  { key: 'STATION', color: INFRASTRUCTURE_TYPE_COLORS.STATION, label: 'infraFireStations', shape: 'house' },
  { key: 'HELIPAD', color: INFRASTRUCTURE_TYPE_COLORS.HELIPAD, label: 'infraHelipad', shape: 'diamond' },
];

const VEHICLE_STATUS_COLORS = [
  { key: 'AVAILABLE', color: '#22c55e', label: 'available' },
  { key: 'DISPATCHED', color: '#f59e0b', label: 'dispatching' },
  { key: 'EN_ROUTE', color: '#3b82f6', label: 'enRoute' },
  { key: 'ON_SCENE', color: '#ef4444', label: 'onScene' },
  { key: 'OUT_OF_SERVICE', color: '#6b7280', label: 'unknown' },
];

const FIRMS_CONFIDENCE_ITEMS = [
  { key: 'high', color: FIRMS_CONFIDENCE_COLORS.high, label: 'firmsConfidenceHigh', size: 'h-4 w-4' },
  { key: 'nominal', color: FIRMS_CONFIDENCE_COLORS.nominal, label: 'firmsConfidenceNominal', size: 'h-3 w-3' },
  { key: 'low', color: FIRMS_CONFIDENCE_COLORS.low, label: 'firmsConfidenceLow', size: 'h-2 w-2' },
];

const SOIL_MOISTURE_ITEMS = [
  { key: 'dry', color: SOIL_MOISTURE_COLORS.dry, label: 'soilMoistureDry', range: '<0.1' },
  { key: 'low', color: SOIL_MOISTURE_COLORS.low, label: 'soilMoistureLow', range: '0.1–0.2' },
  { key: 'normal', color: SOIL_MOISTURE_COLORS.normal, label: 'soilMoistureNormal', range: '0.2–0.3' },
  { key: 'wet', color: SOIL_MOISTURE_COLORS.wet, label: 'soilMoistureWet', range: '>0.3' },
];

const LAND_COVER_ITEMS = [
  { value: 10, color: LAND_COVER_COLORS[10], label: 'lcTreeCover' },
  { value: 20, color: LAND_COVER_COLORS[20], label: 'lcShrubland' },
  { value: 30, color: LAND_COVER_COLORS[30], label: 'lcGrassland' },
  { value: 40, color: LAND_COVER_COLORS[40], label: 'lcCropland' },
  { value: 50, color: LAND_COVER_COLORS[50], label: 'lcBuiltUp' },
  { value: 60, color: LAND_COVER_COLORS[60], label: 'lcBareSparse' },
  { value: 80, color: LAND_COVER_COLORS[80], label: 'lcWater' },
  { value: 90, color: LAND_COVER_COLORS[90], label: 'lcWetland' },
  { value: 95, color: LAND_COVER_COLORS[95], label: 'lcMangrove' },
  { value: 100, color: LAND_COVER_COLORS[100], label: 'lcMossLichen' },
];

const LEGEND_SECTIONS_KEY = 'ricer-map-legend-sections';
const SLOPE_ITEMS = [
  { key: 'low', color: SLOPE_COLORS_HEX.low, label: 'slopeLow', range: '<10°' },
  { key: 'moderate', color: SLOPE_COLORS_HEX.moderate, label: 'slopeModerate', range: '10-20°' },
  { key: 'high', color: SLOPE_COLORS_HEX.high, label: 'slopeHigh', range: '20-30°' },
  { key: 'extreme', color: SLOPE_COLORS_HEX.extreme, label: 'slopeExtreme', range: '>30°' },
];

const FIRE_SPREAD_ITEMS = [
  { key: 'low', color: FIRE_SPREAD_COLORS.low, label: 'fireSpreadLow' },
  { key: 'moderate', color: FIRE_SPREAD_COLORS.moderate, label: 'fireSpreadModerate' },
  { key: 'high', color: FIRE_SPREAD_COLORS.high, label: 'fireSpreadHigh' },
  { key: 'extreme', color: FIRE_SPREAD_COLORS.extreme, label: 'fireSpreadExtreme' },
];

const DEFAULT_SECTIONS = ['incidents', 'resources', 'infra', 'firms', 'effis', 'vehicles', 'wind', 'owmWeather', 'soilMoisture', 'ndvi', 'reservoir', 'pamf', 'rma', 'camsAerosol', 'landCover', 'populationDensity', 'slope', 'hillshade', 'fireSpread', 'retardant'];

const OWM_LAYER_LABELS: Record<string, string> = {
  precipitation_new: 'owmWeatherPrecipitation',
  clouds_new: 'owmWeatherClouds',
  wind_new: 'owmWeatherWind',
  temp_new: 'owmWeatherTemp',
  pressure_new: 'owmWeatherPressure',
};

/**
 * Inline SVG shape swatch for legend items
 */
function ShapeSwatch({ shape, color }: { shape: string; color: string }) {
  const size = 12;
  const svgMap: Record<string, React.ReactNode> = {
    circle: <circle cx="6" cy="6" r="5" fill={color} stroke="white" strokeWidth="1" />,
    square: <rect x="1" y="1" width="10" height="10" rx="1.5" fill={color} stroke="white" strokeWidth="1" />,
    diamond: <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" fill={color} stroke="white" strokeWidth="1" />,
    triangle: <polygon points="6,1 11.5,10.5 0.5,10.5" fill={color} stroke="white" strokeWidth="1" />,
    pentagon: <polygon points="6,1 11,4.5 9.5,10.5 2.5,10.5 1,4.5" fill={color} stroke="white" strokeWidth="1" />,
    droplet: <path d="M6,1 C6,1 2,5.5 2,7.5 C2,9.7 3.8,11 6,11 C8.2,11 10,9.7 10,7.5 C10,5.5 6,1 6,1 Z" fill={color} stroke="white" strokeWidth="1" />,
    house: <path d="M6,1 L11,5 L11,10.5 C11,10.8 10.8,11 10.5,11 L1.5,11 C1.2,11 1,10.8 1,10.5 L1,5 Z" fill={color} stroke="white" strokeWidth="1" />,
    hexagon: <polygon points="6,1 10.5,3 10.5,8 6,11 1.5,8 1.5,3" fill={color} stroke="white" strokeWidth="1" />,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="flex-shrink-0">
      {svgMap[shape] ?? svgMap.circle}
    </svg>
  );
}

function readStoredSections(): Set<string> {
  try {
    const raw = localStorage.getItem(LEGEND_SECTIONS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set(DEFAULT_SECTIONS);
}

function SectionCollapsible({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root open={open} onOpenChange={onToggle}>
      <Collapsible.Trigger className="flex w-full items-center justify-between mb-1.5 group">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
          {label}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted-foreground/50 flex-shrink-0 transition-transform duration-150"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slide-up">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

interface MapLegendProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export default function MapLegend({ mobileOpen = false, onMobileOpenChange }: MapLegendProps) {
  const { t } = useTranslation();
  const owmWeatherActive = useMapStore((s) => s.layers.owmWeather);
  const owmWeatherLayer = useMapStore((s) => s.owmWeatherLayer);
  const windLayerActive = useMapStore((s) => s.layers.windVectors);
  const soilMoistureActive = useMapStore((s) => s.layers.soilMoisture);
  const ndviActive = useMapStore((s) => s.layers.ndvi);
  const reservoirsActive = useMapStore((s) => s.layers.reservoirs);
  const pamfActive = useMapStore((s) => s.layers.pamfCommunes);
  const rmaActive = useMapStore((s) => s.layers.rmaCommunes);
  const camsAerosolActive = useMapStore((s) => s.layers.camsAerosol);
  const landCoverActive = useMapStore((s) => s.layers.landCover);
  const hillshadeActive = useMapStore((s) => s.layers.hillshade);
  const populationDensityActive = useMapStore((s) => s.layers.populationDensity);
  const slopeActive = useMapStore((s) => s.layers.slope);
  const fireSpreadActive = useMapStore((s) => s.layers.fireSpread);
  const fireSpreadStatus = useMapStore((s) => s.fireSpreadStatus);
  const effisFwiMode = useMapStore((s) => s.effisFwiMode);
  const tileAvailability = useMapStore((s) => s.tileAvailability);
  const [openSections, setOpenSections] = useState<Set<string>>(readStoredSections);
  const [filterQuery, setFilterQuery] = useState('');

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(LEGEND_SECTIONS_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const matchesFilter = (label: string) => {
    if (!filterQuery.trim()) return true;
    return label.toLowerCase().includes(filterQuery.toLowerCase());
  };

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
        data-testid="map-legend-panel"
        className={cn(
          'z-10 flex-col',
          mobileOpen
            ? 'fixed inset-x-2 bottom-[calc(var(--mobile-tabbar-height)+0.75rem)] z-50 flex md:hidden'
            : 'absolute bottom-4 hidden min-w-[180px] max-h-[45vh] ltr:right-4 rtl:left-4 md:flex sm:max-h-[60vh]'
        )}
      >
      <GlassPanel title={t('mapLegend')} collapsible>
        <div
          className={cn(
            'space-y-3 overflow-auto border-t border-white/10 px-3 pb-3 pt-2.5',
            mobileOpen
              ? 'max-h-[calc(min(72dvh,640px)-3rem)] overscroll-contain'
              : 'max-h-[calc(45vh-3rem)] sm:max-h-[calc(60vh-3rem)]'
          )}
        >
          {/* Filter */}
          <div className="relative">
            <Icon name="search" size={12} className="absolute ltr:left-2 rtl:right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-lg border border-border bg-surface-2/50 py-1.5 ltr:pl-6 rtl:pr-6 ltr:pr-2 rtl:pl-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Incident Status */}
          {matchesFilter(t('incidentStatus')) && (
            <SectionCollapsible label={t('incidentStatus')} open={openSections.has('incidents')} onToggle={() => toggleSection('incidents')}>
              <div className="space-y-1.5">
                {INCIDENT_COLORS.map(({ key, color, label }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {key !== 'ETEINT' ? (
                      <span className="relative flex h-3 w-3 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: color }} />
                        <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                      </span>
                    ) : (
                      <span className="h-3 w-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    )}
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <div className="text-[9px] text-muted-foreground/70 mb-1">{t('severityScale')}</div>
                <div className="flex gap-0.5 items-end">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="rounded-sm flex-1" style={{ height: `${s * 4}px`, backgroundColor: INCIDENT_STATUS_COLORS.INTERVENTION, opacity: 0.4 + s * 0.12 }} />
                  ))}
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* Resource Types */}
          {matchesFilter(t('resources')) && (
            <SectionCollapsible label={t('resources')} open={openSections.has('resources')} onToggle={() => toggleSection('resources')}>
              <div className="space-y-1">
                {RESOURCE_COLORS.map(({ key, color, label, shape }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <ShapeSwatch shape={shape} color={color} />
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
              </div>
            </SectionCollapsible>
          )}

          {/* Infrastructure Types */}
          {matchesFilter(t('infrastructure')) && (
            <SectionCollapsible label={t('infrastructure')} open={openSections.has('infra')} onToggle={() => toggleSection('infra')}>
              <div className="space-y-1">
                {INFRA_LEGEND_COLORS.map(({ key, color, label, shape }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <ShapeSwatch shape={shape} color={color} />
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-0.5 w-3 border-t-2 border-solid flex-shrink-0" style={{ borderColor: INFRASTRUCTURE_TYPE_COLORS.FIREBREAK }} />
                  <span>{t('infraFirebreaks' as TranslationKey)}</span>
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* Retardant Storage */}
          {matchesFilter(t('layerRetardant' as TranslationKey)) && (
            <SectionCollapsible label={t('layerRetardant' as TranslationKey)} open={openSections.has('retardant')} onToggle={() => toggleSection('retardant')}>
              <div className="flex items-center gap-2 text-xs">
                <ShapeSwatch shape="hexagon" color={RETARDANT_COLOR} />
                <span>{t('layerRetardant' as TranslationKey)}</span>
              </div>
            </SectionCollapsible>
          )}

          {/* Vehicles */}
          {matchesFilter(t('layerVehicles')) && (
            <SectionCollapsible label={t('layerVehicles')} open={openSections.has('vehicles')} onToggle={() => toggleSection('vehicles')}>
              <div className="space-y-1">
                {VEHICLE_STATUS_COLORS.map(({ key, color, label }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-sm border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
              </div>
            </SectionCollapsible>
          )}

          {/* FIRMS Detections */}
          {matchesFilter(t('firmsDetections')) && (
            <SectionCollapsible label={t('firmsDetections')} open={openSections.has('firms')} onToggle={() => toggleSection('firms')}>
              <div className="mb-2">
                <div className="text-[9px] text-muted-foreground/70 mb-1">{t('fireRadiativePower')}</div>
                <div className="h-2 w-full rounded-full" style={{ background: 'linear-gradient(to right, #fef3c7, #f59e0b, #dc2626, #991b1b)' }} />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>0 MW</span><span>50</span><span>100</span><span>200+ MW</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {FIRMS_CONFIDENCE_ITEMS.map(({ key, color, label, size }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="flex h-4 w-4 items-center justify-center flex-shrink-0">
                      <div className={`${size} rounded-full border-2 border-white shadow-sm`} style={{ backgroundColor: color }} />
                    </div>
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                <div className="text-[10px] text-muted-foreground leading-relaxed">• {t('firmsLegendSize')}</div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">• {t('firmsLegendRecent')}</div>
              </div>
            </SectionCollapsible>
          )}

          {/* EFFIS / Copernicus */}
          {matchesFilter(t('effisLayers' as TranslationKey)) && (
            <SectionCollapsible label={t('effisLayers' as TranslationKey)} open={openSections.has('effis')} onToggle={() => toggleSection('effis')}>
              <div className="mb-2">
                <div className="text-[9px] text-muted-foreground/70 mb-1">
                  {t('effisFWI' as TranslationKey)} — {effisFwiMode === 'ranking' ? t('fwiModeRanking' as TranslationKey) : t('fwiModeFwi' as TranslationKey)}
                </div>
                <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(to right, ${EFFIS_FWI_COLORS.low}, ${EFFIS_FWI_COLORS.moderate}, ${EFFIS_FWI_COLORS.high}, ${EFFIS_FWI_COLORS.extreme})` }} />
                {effisFwiMode === 'ranking' ? (
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>0th</span><span>25th</span><span>50th</span><span>75th</span><span>100th</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>{t('fwiLow')}</span><span>{t('fwiModerate')}</span><span>{t('fwiHigh')}</span><span>{t('fwiExtreme')}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="h-3 w-8 border border-white/30 rounded-sm flex-shrink-0" style={{ backgroundColor: EFFIS_BURNED_AREA_COLOR, opacity: 0.7 }} />
                <span>{t('effisBurnedAreas' as TranslationKey)}</span>
              </div>
              {(!tileAvailability.effisFwi || !tileAvailability.effisBurned) && (
                <div className="flex items-center gap-1 text-[9px] text-accent-fire mt-1.5">
                  <span>⚠</span>
                  <span>{t('effisFallbackNote' as TranslationKey)}</span>
                </div>
              )}
            </SectionCollapsible>
          )}

          {/* OWM Weather Tiles */}
          {owmWeatherActive && matchesFilter(t('owmWeather' as TranslationKey)) && (
            <SectionCollapsible label={t('owmWeather' as TranslationKey)} open={openSections.has('owmWeather')} onToggle={() => toggleSection('owmWeather')}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: '#3b82f6' }} />
                  <span>{t(OWM_LAYER_LABELS[owmWeatherLayer] as TranslationKey)}</span>
                </div>
                <div className="text-[9px] text-muted-foreground/70">
                  {t('owmWeatherNote' as TranslationKey)}
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* Wind Speed */}
          {windLayerActive && matchesFilter(t('windSpeed')) && (
            <SectionCollapsible label={t('windSpeed')} open={openSections.has('wind')} onToggle={() => toggleSection('wind')}>
              <div className="space-y-1">
                {WIND_SPEED_ITEMS.map(({ label, color, desc }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{label}</span>
                    <span className="text-muted-foreground">({desc})</span>
                  </div>
                ))}
              </div>
            </SectionCollapsible>
          )}

          {/* Soil Moisture */}
          {soilMoistureActive && matchesFilter(t('soilMoisture' as TranslationKey)) && (
            <SectionCollapsible label={t('soilMoisture' as TranslationKey)} open={openSections.has('soilMoisture')} onToggle={() => toggleSection('soilMoisture')}>
              <div className="space-y-1">
                {SOIL_MOISTURE_ITEMS.map(({ key, color, label, range }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{t(label as TranslationKey)}</span>
                    <span className="text-muted-foreground">({range} m&sup3;/m&sup3;)</span>
                  </div>
                ))}
              </div>
            </SectionCollapsible>
          )}

          {/* NDVI */}
          {ndviActive && matchesFilter(t('ndviLayer' as TranslationKey)) && (
            <SectionCollapsible label={t('ndviLayer' as TranslationKey)} open={openSections.has('ndvi')} onToggle={() => toggleSection('ndvi')}>
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${NDVI_COLORS.stressed}, ${NDVI_COLORS.sparse}, ${NDVI_COLORS.moderate}, ${NDVI_COLORS.healthy})` }}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>&lt;0.2</span><span>0.2-0.4</span><span>0.4-0.6</span><span>&gt;0.6</span>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>{t('ndviStressed' as TranslationKey)}</span>
                  <span>{t('ndviHealthy' as TranslationKey)}</span>
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* Water Reservoirs */}
          {reservoirsActive && matchesFilter(t('reservoirs' as TranslationKey)) && (
            <SectionCollapsible label={t('reservoirs' as TranslationKey)} open={openSections.has('reservoir')} onToggle={() => toggleSection('reservoir')}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-full rounded-full" style={{ background: 'linear-gradient(to right, #d1e5f7, #2171b5, #08306b)' }} />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Low</span><span>Water occurrence</span><span>High</span>
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div className="h-3 w-3 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: RESERVOIR_COLORS.marker }} />
                  <span>Dam / Reservoir</span>
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* PAMF */}
          {pamfActive && matchesFilter(t('pamfLayer' as TranslationKey)) && (
            <SectionCollapsible label={t('pamfLayer' as TranslationKey)} open={openSections.has('pamf')} onToggle={() => toggleSection('pamf')}>
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${PAMF_COLORS.low}, ${PAMF_COLORS.moderate}, ${PAMF_COLORS.high}, ${PAMF_COLORS.extreme})` }}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>0</span><span>0.5</span><span>1.5</span><span>3.0+</span>
                </div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5 text-center">
                  {t('pamfFiresPerKm2' as TranslationKey)}
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PAMF_COLORS.noData, opacity: 0.7 }} />
                  <span>{t('insufficientFireData' as TranslationKey)}</span>
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* RMA */}
          {rmaActive && matchesFilter(t('rmaLayer' as TranslationKey)) && (
            <SectionCollapsible label={t('rmaLayer' as TranslationKey)} open={openSections.has('rma')} onToggle={() => toggleSection('rma')}>
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${RMA_COLORS.low}, ${RMA_COLORS.moderate}, ${RMA_COLORS.high}, ${RMA_COLORS.extreme})` }}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>0%</span><span>0.1%</span><span>0.5%</span><span>1%+</span>
                </div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5 text-center">
                  {t('rmaBurnedRatio' as TranslationKey)}
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: RMA_COLORS.noData, opacity: 0.7 }} />
                  <span>{t('insufficientFireData' as TranslationKey)}</span>
                </div>
              </div>
            </SectionCollapsible>
          )}

          {/* CAMS Aerosol */}
          {camsAerosolActive && matchesFilter(t('camsAerosol' as TranslationKey)) && (
            <SectionCollapsible label={t('camsAerosol' as TranslationKey)} open={openSections.has('camsAerosol')} onToggle={() => toggleSection('camsAerosol')}>
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${CAMS_AEROSOL_COLORS.low}, ${CAMS_AEROSOL_COLORS.moderate}, ${CAMS_AEROSOL_COLORS.high})` }}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>0.0</span>
                  <span>1.0</span>
                  <span>2.0</span>
                  <span>3.0+</span>
                </div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5 text-center">
                  AOD @ 550nm
                </div>
                <div className="text-[9px] text-muted-foreground/70 mt-1.5">
                  {t('camsAerosolNote' as TranslationKey)}
                </div>
                {!tileAvailability.cams && (
                  <div className="flex items-center gap-1 text-[9px] text-accent-fire mt-1">
                    <span>⚠</span>
                    <span>{t('camsFallbackNote' as TranslationKey)}</span>
                  </div>
                )}
              </div>
            </SectionCollapsible>
          )}

          {/* Land Cover / Fuel Type */}
          {landCoverActive && matchesFilter(t('layerLandCover' as TranslationKey)) && (
            <SectionCollapsible label={t('layerLandCover' as TranslationKey)} open={openSections.has('landCover')} onToggle={() => toggleSection('landCover')}>
              <div className="space-y-1">
                {LAND_COVER_ITEMS.map(({ value, color, label }) => (
                  <div key={value} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-sm border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{t(label as TranslationKey)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-muted-foreground/70">
                {t('landCoverSource' as TranslationKey)}
              </div>
            </SectionCollapsible>
          )}

          {/* Population Density */}
          {populationDensityActive && matchesFilter(t('populationDensity' as TranslationKey)) && (
            <SectionCollapsible label={t('populationDensity' as TranslationKey)} open={openSections.has('populationDensity')} onToggle={() => toggleSection('populationDensity')}>
              <div>
                <div
                  className="h-2 w-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${POPULATION_DENSITY_COLORS.low}, ${POPULATION_DENSITY_COLORS.moderate}, ${POPULATION_DENSITY_COLORS.high}, ${POPULATION_DENSITY_COLORS.extreme})` }}
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>{t('populationLow' as TranslationKey)}</span>
                  <span>{t('populationModerate' as TranslationKey)}</span>
                  <span>{t('populationHigh' as TranslationKey)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-muted-foreground/70">
                  {t('populationDensitySource' as TranslationKey)}
                </div>
                {!tileAvailability.worldpop && (
                  <div className="flex items-center gap-1 text-[9px] text-accent-fire mt-1">
                    <span>⚠</span>
                    <span>{t('popFallbackNote' as TranslationKey)}</span>
                  </div>
                )}
              </div>
            </SectionCollapsible>
          )}

          {/* Hillshade */}
          {hillshadeActive && matchesFilter(t('layerHillshade' as TranslationKey)) && (
            <SectionCollapsible label={t('layerHillshade' as TranslationKey)} open={openSections.has('hillshade')} onToggle={() => toggleSection('hillshade')}>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                {t('hillshadeDescription' as TranslationKey)}
              </div>
            </SectionCollapsible>
          )}

          {/* Slope */}
          {slopeActive && matchesFilter(t('layerSlope' as TranslationKey)) && (
            <SectionCollapsible label={t('layerSlope' as TranslationKey)} open={openSections.has('slope')} onToggle={() => toggleSection('slope')}>
              <div className="space-y-1">
                {SLOPE_ITEMS.map(({ key, color, label, range }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-sm border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span>{t(label as TranslationKey)}</span>
                    <span className="text-muted-foreground">({range})</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-muted-foreground/70">
                {t('slopeFireNote' as TranslationKey)}
              </div>
            </SectionCollapsible>
          )}

          {/* Fire Spread Prediction */}
          {fireSpreadActive && matchesFilter(t('layerFireSpread' as TranslationKey)) && (
            <SectionCollapsible label={t('layerFireSpread' as TranslationKey)} open={openSections.has('fireSpread')} onToggle={() => toggleSection('fireSpread')}>
              {fireSpreadStatus === 'no-fires' ? (
                <div className="text-[10px] text-muted-foreground leading-relaxed">
                  {t('fireSpreadNoFiresLegend' as TranslationKey)}
                </div>
              ) : (
                <div className="space-y-1">
                  {FIRE_SPREAD_ITEMS.map(({ key, color, label }) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span>{t(label as TranslationKey)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-muted-foreground/70">
                {t('fireSpreadSource' as TranslationKey)}
              </div>
            </SectionCollapsible>
          )}

          {/* Forest Roads */}
          {matchesFilter(t('forestRoads' as TranslationKey)) && (
            <SectionCollapsible label={t('forestRoads' as TranslationKey)} open={openSections.has('forestRoads')} onToggle={() => toggleSection('forestRoads')}>
              <div className="flex items-center gap-2 text-xs">
                <div className="h-0.5 w-8 border-t-2 border-dashed border-amber-700 flex-shrink-0" />
                <span>{t('forestRoads' as TranslationKey)}</span>
              </div>
            </SectionCollapsible>
          )}
        </div>
      </GlassPanel>
      </div>
    </>
  );
}
