/**
 * Real Ifrane Province geography used to place demo records.
 *
 * Coordinates are [lat, lng] in this file (matching how humans read them);
 * conversion to GeoJSON [lng, lat] happens at the call site via `point()`.
 */

export function point(lat: number, lng: number) {
  return { type: 'Point' as const, coordinates: [lng, lat] as [number, number] };
}

/** Bounding box of Ifrane Province, used by the load-test seed to scatter
 * synthetic incidents/reports without leaving the province. */
export const PROVINCE_BBOX = {
  minLat: 33.2,
  maxLat: 33.7,
  minLng: -5.4,
  maxLng: -4.95,
};

// ── Towns (stations & bases live here — never used for incident placement) ─
export const TOWNS = {
  ifrane: { name: 'Ifrane', lat: 33.527, lng: -5.107 },
  azrou: { name: 'Azrou', lat: 33.434, lng: -5.221 },
  ainLeuh: { name: 'Aïn Leuh', lat: 33.29, lng: -5.34 },
  timahdite: { name: 'Timahdite', lat: 33.24, lng: -5.06 },
  benSmim: { name: 'Ben Smim', lat: 33.43, lng: -5.2 },
} as const;

// ── Named natural features (referenced in descriptions / infrastructure) ──
export const FEATURES = {
  michlifen: { name: 'Michlifen', lat: 33.4, lng: -5.1 },
  dayetAoua: { name: 'Dayet Aoua', lat: 33.65, lng: -5.03 },
  tizguitValley: { name: 'Vallée du Tizguit', lat: 33.475, lng: -5.158 },
  ainVittel: { name: 'Aïn Vittel', lat: 33.548, lng: -5.086 },
  cedreGouraud: { name: 'Forêt de Cèdres Gouraud', lat: 33.42, lng: -5.17 },
  parcNationalIfrane: { name: "Parc National d'Ifrane", lat: 33.43, lng: -5.15 },
  jbelHebri: { name: 'Jbel Hebri', lat: 33.58, lng: -5.05 },
  tighboula: { name: 'Tighboula', lat: 33.43, lng: -5.2 },
} as const;

/** Forest zones — the only places incidents/fires are placed. Each has a
 * jitter radius (degrees) that stays clear of town centres and the Dayet
 * Aoua lake shoreline. */
export const FOREST_ZONES = [
  { key: 'cedreGouraud', name: 'Forêt de Cèdres Gouraud', nameAr: 'غابة أرز غورو', lat: 33.42, lng: -5.17, radius: 0.018 },
  { key: 'michlifenSlopes', name: 'Versants forestiers du Michlifen', nameAr: 'منحدرات ميشليفن الغابوية', lat: 33.405, lng: -5.108, radius: 0.015 },
  { key: 'parcCentral', name: "Parc National d'Ifrane — secteur central", nameAr: 'الحديقة الوطنية لإفران - القطاع المركزي', lat: 33.455, lng: -5.135, radius: 0.02 },
  { key: 'tizguit', name: 'Vallée du Tizguit', nameAr: 'وادي تيزكيت', lat: 33.478, lng: -5.162, radius: 0.014 },
  { key: 'jbelHebri', name: 'Forêt de Jbel Hebri', nameAr: 'غابة جبل هبري', lat: 33.578, lng: -5.048, radius: 0.018 },
  { key: 'ainLeuhForest', name: "Forêt d'Aïn Leuh", nameAr: 'غابة عين اللوح', lat: 33.312, lng: -5.328, radius: 0.02 },
  { key: 'timahditeForest', name: 'Forêt de Timahdite', nameAr: 'غابة تيمحضيت', lat: 33.258, lng: -5.078, radius: 0.02 },
  { key: 'tighboula', name: 'Forêt de Tighboula (Ben Smim)', nameAr: 'غابة تيغبولة (بن سميم)', lat: 33.432, lng: -5.208, radius: 0.016 },
  { key: 'ainVittelForest', name: "Forêt d'Aïn Vittel", nameAr: 'غابة عين فيتال', lat: 33.552, lng: -5.093, radius: 0.013 },
  { key: 'ajdirAzrou', name: 'Forêt Ajdir (Azrou)', nameAr: 'غابة أجدير (أزرو)', lat: 33.448, lng: -5.198, radius: 0.017 },
] as const;

export type ForestZoneKey = (typeof FOREST_ZONES)[number]['key'];

export function zoneByKey(key: ForestZoneKey) {
  const z = FOREST_ZONES.find((f) => f.key === key);
  if (!z) throw new Error(`Unknown forest zone: ${key}`);
  return z;
}

// ── Stations / bases (towns) ────────────────────────────────────────────
export const STATIONS = {
  pcIfrane: { name: 'Caserne Protection Civile Ifrane', type: 'STATION', lat: 33.5232, lng: -5.1112 },
  pcAzrou: { name: 'Caserne Protection Civile Azrou', type: 'STATION', lat: 33.4352, lng: -5.2198 },
  cedefoAzrou: { name: 'CEDEFO Azrou (DPEFLCD)', type: 'STATION', lat: 33.4368, lng: -5.2245 },
  posteAinLeuh: { name: 'Poste Forestier Aïn Leuh', type: 'STATION', lat: 33.2915, lng: -5.3378 },
  helipadIfrane: { name: 'Héliport Ifrane', type: 'HELIPAD', lat: 33.513, lng: -5.108 },
} as const;

// ── Lookout towers (postes vigies) — placed on real high points ─────────
export const WATCHTOWERS = [
  { name: 'Poste Vigie Jbel Hebri', lat: 33.585, lng: -5.043 },
  { name: 'Poste Vigie Tighboula', lat: 33.428, lng: -5.212 },
  { name: 'Poste Vigie Michlifen', lat: 33.397, lng: -5.098 },
  { name: "Poste Vigie Aïn Leuh — Jbel Abad", lat: 33.305, lng: -5.352 },
] as const;

// ── Water points (points d'eau) ──────────────────────────────────────────
export const WATER_POINTS = [
  { name: "Point d'eau Dayet Aoua", lat: 33.649, lng: -5.032, capacity: 50000 },
  { name: "Point d'eau Aïn Vittel", lat: 33.549, lng: -5.087, capacity: 15000 },
  { name: "Point d'eau Vallée du Tizguit", lat: 33.476, lng: -5.159, capacity: 20000 },
  { name: "Bassin de rétention Cèdre Gouraud", lat: 33.418, lng: -5.173, capacity: 30000 },
  { name: "Point d'eau Ajdir", lat: 33.446, lng: -5.201, capacity: 18000 },
] as const;

// ── Forest tracks / firebreaks ───────────────────────────────────────────
export const FOREST_ROADS = [
  { name: 'Piste Forestière Aïn Leuh–Azrou', lat: 33.365, lng: -5.28, km: 22 },
  { name: 'Piste Forestière Michlifen–Dayet Aoua', lat: 33.52, lng: -5.06, km: 14 },
  { name: 'Piste Forestière Tighboula', lat: 33.435, lng: -5.205, km: 9 },
] as const;

export const FIREBREAKS = [
  { name: 'Tranchée Pare-Feu Cèdre Gouraud', lat: 33.415, lng: -5.165, km: 12 },
  { name: 'Tranchée Pare-Feu Jbel Hebri', lat: 33.582, lng: -5.052, km: 8 },
  { name: 'Tranchée Pare-Feu Ajdir', lat: 33.45, lng: -5.195, km: 6 },
] as const;
