'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { useMapStore } from '@/store/useMapStore';

const PRESETS = {
  incident: ['incidents', 'resources', 'infrastructure', 'routes', 'activeTeams', 'vehicles', 'rscTrucks', 'rscAircraft', 'rscPersonnel', 'rscEquipment', 'infraWatchtowers', 'infraWaterPoints', 'infraFireStations', 'infraFirebreaks', 'forestRoads'],
  weather: ['incidents', 'effisFWI', 'windVectors', 'fireSpread', 'riskModel'],
  satellite: ['incidents', 'firmsDetections', 'effisBurnedAreas', 'hillshade'],
} as const;
type Preset = keyof typeof PRESETS;

const labels = {
  en: { incident: 'Active incident', weather: 'Weather & spread', satellite: 'Satellite context' },
  fr: { incident: 'Incident actif', weather: 'Météo et propagation', satellite: 'Contexte satellite' },
  ar: { incident: 'الحريق النشط', weather: 'الطقس والانتشار', satellite: 'صور الأقمار' },
};

export function MapTaskPresets() {
  const { language } = useTranslation();
  const layers = useMapStore((s) => s.layers);
  const basemap = useMapStore((s) => s.basemap);
  const selected = (Object.keys(PRESETS) as Preset[]).find((name) => {
    const enabled = new Set<string>(PRESETS[name]);
    return basemap === (name === 'satellite' ? 'satellite' : 'streets')
      && Object.entries(layers).every(([key, value]) => value === enabled.has(key));
  }) ?? null;
  const names = labels[language as keyof typeof labels] ?? labels.en;
  const apply = (name: Preset) => {
    const current = useMapStore.getState().layers;
    const enabled = new Set<string>(PRESETS[name]);
    const layers = Object.fromEntries(Object.keys(current).map((key) => [key, enabled.has(key)])) as typeof current;
    useMapStore.setState({ layers, basemap: name === 'satellite' ? 'satellite' : 'streets' });
  };
  return <nav aria-label="Map task presets" className="absolute left-1/2 top-14 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-xl border border-border bg-surface/95 p-1 shadow-elev-2 backdrop-blur md:top-3">
    {(Object.keys(PRESETS) as Preset[]).map((name) => <button key={name} type="button" aria-pressed={selected === name} onClick={() => apply(name)}
      className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold sm:text-sm ${selected === name ? 'bg-primary text-white' : 'text-foreground hover:bg-muted'}`}>{names[name]}</button>)}
  </nav>;
}
