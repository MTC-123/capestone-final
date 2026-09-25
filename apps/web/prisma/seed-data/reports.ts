import type { SeedRng } from './rng';
import { jitter } from './rng';
import { FOREST_ZONES } from './geo';
import { FIRE_CAUSE_KEYS } from '../../src/config/constants';
import type { FireCharacteristics } from '../../src/types/report';

export interface ReportSeed {
  civilianIndex: number; // index into users.CIVILIANS
  lat: number;
  lng: number;
  description: string;
  lang: 'fr' | 'ar';
  cause: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  anonymous: boolean;
  contactPhone?: string;
  characteristics: FireCharacteristics;
  createdAt: string;
  /** Index into INCIDENTS (seed-data/incidents.ts) this report is the
   * origin of — mirrors IncidentSeed.originReportIndex. */
  originForIncidentIndex?: number;
  /** Index into INCIDENTS this report merely corroborates (a second
   * civilian confirming an incident that already exists), without being
   * its origin. */
  linkedIncidentIndex?: number;
}

// The first 10 reports are hand-written "origin" reports: the citizen
// report that triggered an incident (INCIDENTS[i].originReportIndex === its
// own index here). Order matches the originReportIndex values in
// incidents.ts (0..9).
export const ORIGIN_REPORTS: ReportSeed[] = [
  {
    civilianIndex: 1,
    lat: 33.449, lng: -5.199,
    description: "Je viens de voir un feu de camp abandonné qui fume encore en lisière de la forêt d'Ajdir, près du sentier principal. Personne sur place.",
    lang: 'fr', cause: 'CAMPFIRE_UNATTENDED', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212661234567',
    characteristics: { fireSize: 'small', smokeLevel: 'light', fireType: 'ground', windCondition: 'calm', nearbyThreats: ['forest'] },
    createdAt: '2026-06-03T10:02:00Z',
    originForIncidentIndex: 0,
  },
  {
    civilianIndex: 2,
    lat: 33.311, lng: -5.329,
    description: "Fumée épaisse au-dessus des champs près d'Aïn Leuh, le feu de brûlage semble avoir dépassé la parcelle agricole et se rapproche des arbres.",
    lang: 'fr', cause: 'AGRICULTURAL_BURNING', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212662345678',
    characteristics: { fireSize: 'medium', smokeLevel: 'moderate', fireType: 'surface', windCondition: 'moderate', nearbyThreats: ['forest', 'roads'] },
    createdAt: '2026-06-12T12:18:00Z',
    originForIncidentIndex: 2,
  },
  {
    civilianIndex: 3,
    lat: 33.419, lng: -5.171,
    description: "Un campement de randonneurs a laissé un feu allumé dans la cédraie de Gouraud, les flammes commencent à prendre dans les aiguilles de cèdre au sol.",
    lang: 'fr', cause: 'CAMPFIRE_UNATTENDED', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212663456789',
    characteristics: { fireSize: 'medium', smokeLevel: 'moderate', fireType: 'surface', windCondition: 'light', nearbyThreats: ['forest'] },
    createdAt: '2026-06-28T13:08:00Z',
    originForIncidentIndex: 5,
  },
  {
    civilianIndex: 4,
    lat: 33.399, lng: -5.101,
    description: "Plusieurs départs de feu en même temps sur le versant du Michlifen, ça ne peut pas être naturel, j'ai vu quelqu'un s'enfuir en scooter.",
    lang: 'fr', cause: 'ARSON', status: 'COMPLETED', anonymous: true,
    characteristics: { fireSize: 'large', smokeLevel: 'heavy', fireType: 'surface', windCondition: 'strong', nearbyThreats: ['forest', 'roads', 'people'] },
    createdAt: '2026-07-09T20:02:00Z',
    originForIncidentIndex: 8,
  },
  {
    civilianIndex: 5,
    lat: 33.431, lng: -5.207,
    description: "Le brûlage de chaume à Tighboula est en train de déborder vers les arbres, il y a déjà de grandes flammes visibles depuis la route.",
    lang: 'fr', cause: 'AGRICULTURAL_BURNING', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212665678901',
    characteristics: { fireSize: 'medium', smokeLevel: 'moderate', fireType: 'surface', windCondition: 'moderate', nearbyThreats: ['forest', 'roads'] },
    createdAt: '2026-07-22T13:33:00Z',
    originForIncidentIndex: 11,
  },
  {
    civilianIndex: 6,
    lat: 33.454, lng: -5.136,
    description: "Des vacanciers ont laissé un barbecue allumé dans le parc, le vent du soir est en train de raviver les braises vers les buissons secs.",
    lang: 'fr', cause: 'CAMPFIRE_UNATTENDED', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212666789012',
    characteristics: { fireSize: 'medium', smokeLevel: 'moderate', fireType: 'surface', windCondition: 'moderate', nearbyThreats: ['forest', 'people'] },
    createdAt: '2026-08-11T18:47:00Z',
    originForIncidentIndex: 16,
  },
  {
    civilianIndex: 0,
    lat: 33.447, lng: -5.2,
    description: "Petit foyer de fumée près d'un champ à Ajdir, probablement un brûlage non déclaré. À surveiller.",
    lang: 'fr', cause: 'AGRICULTURAL_BURNING', status: 'COMPLETED', anonymous: false,
    contactPhone: '+212612345678',
    characteristics: { fireSize: 'small', smokeLevel: 'light', fireType: 'surface', windCondition: 'calm', nearbyThreats: ['forest'] },
    createdAt: '2026-08-21T11:12:00Z',
    originForIncidentIndex: 19,
  },
  {
    civilianIndex: 1,
    lat: 33.404, lng: -5.107,
    description: "L'application m'a envoyé une alerte satellite pour un point chaud sur le Michlifen, je confirme voir un très léger filet de fumée depuis le belvédère.",
    lang: 'fr', cause: 'EQUIPMENT_MALFUNCTION', status: 'IN_PROGRESS', anonymous: false,
    contactPhone: '+212661234567',
    characteristics: { fireSize: 'small', smokeLevel: 'light', fireType: 'ground', windCondition: 'calm', nearbyThreats: ['forest'] },
    createdAt: '2026-09-01T06:20:00Z',
    originForIncidentIndex: 21,
  },
  {
    civilianIndex: 2,
    lat: 33.309, lng: -5.331,
    description: "Odeur de brûlé assez forte près du sentier d'Aïn Leuh, pas de flammes visibles mais la fumée devient plus dense depuis 20 minutes.",
    lang: 'fr', cause: 'OTHER', status: 'IN_PROGRESS', anonymous: false,
    contactPhone: '+212662345678',
    characteristics: { fireSize: 'small', smokeLevel: 'moderate', fireType: 'unknown', windCondition: 'light', nearbyThreats: ['forest'] },
    createdAt: '2026-09-06T16:03:00Z',
    originForIncidentIndex: 22,
  },
  {
    civilianIndex: 3,
    lat: 33.456, lng: -5.134,
    description: "Grand feu de camp qui s'est complètement échappé au centre du parc, les flammes montent déjà à plusieurs mètres, il faut envoyer du monde immédiatement !",
    lang: 'fr', cause: 'CAMPFIRE_UNATTENDED', status: 'IN_PROGRESS', anonymous: false,
    contactPhone: '+212663456789',
    characteristics: { fireSize: 'large', smokeLevel: 'heavy', fireType: 'crown', windCondition: 'strong', nearbyThreats: ['forest', 'people', 'roads'] },
    createdAt: '2026-09-23T13:58:00Z',
    originForIncidentIndex: 23,
  },
];

// ── Extra citizen reports (not tied to a confirmed incident, or filed as
// a second/third confirmation of one) — generated with the seeded RNG so
// the run stays deterministic while giving 30 more varied entries. ────────
const FR_TEMPLATES = [
  (zone: string) => `Je vois de la fumée qui monte du côté de ${zone}, difficile de dire si c'est un feu ou juste de la poussière.`,
  (zone: string) => `Odeur de brûlé très nette en passant près de ${zone} ce matin, pas de flammes visibles pour l'instant.`,
  (zone: string) => `Léger nuage de fumée grise au-dessus de ${zone}, ça ne bouge pas beaucoup, peut-être déjà maîtrisé.`,
  (zone: string) => `Un randonneur m'a signalé un départ de feu vers ${zone}, je transmets l'information par précaution.`,
  (zone: string) => `Vu depuis la route, un panache de fumée assez visible en direction de ${zone}, semble s'intensifier.`,
  (zone: string) => `Fumée blanche persistante repérée près de ${zone}, aucune odeur de brûlé perceptible à cette distance.`,
];
const AR_TEMPLATES = [
  (zone: string) => `ألاحظ دخانا يتصاعد بالقرب من ${zone}، لا أعرف إن كان حريقا أو مجرد غبار.`,
  (zone: string) => `رائحة احتراق واضحة بجوار ${zone} هذا الصباح، لا ألسنة لهب ظاهرة حتى الآن.`,
  (zone: string) => `سحابة دخان خفيفة فوق ${zone}، تبدو مستقرة وربما تم التحكم فيها.`,
];

const CAUSES = FIRE_CAUSE_KEYS as readonly string[];

export function buildAdditionalReports(r: SeedRng, count: number): ReportSeed[] {
  const out: ReportSeed[] = [];
  const zones = FOREST_ZONES;
  const monthDays: Array<[number, number]> = [
    [6, 30], [7, 31], [8, 31], [9, 24],
  ];

  for (let i = 0; i < count; i++) {
    const zone = r.pick(zones);
    const [lat, lng] = jitter(r, zone.lat, zone.lng, zone.radius);
    const useAr = r.bool(0.15);
    const zoneName = useAr ? zone.nameAr : zone.name;
    const description = useAr ? r.pick(AR_TEMPLATES)(zoneName) : r.pick(FR_TEMPLATES)(zoneName);
    const [month, maxDay] = r.pick(monthDays);
    const day = r.int(1, maxDay);
    const hour = r.int(6, 21);
    const minute = r.int(0, 59);
    const createdAt = new Date(Date.UTC(2026, month - 1, day, hour, minute)).toISOString();
    const anonymous = r.bool(0.3);
    const civilianIndex = r.int(0, 6);
    const status = r.pickWeighted([
      { value: 'PENDING' as const, weight: 5 },
      { value: 'IN_PROGRESS' as const, weight: 2 },
      { value: 'COMPLETED' as const, weight: 3 },
    ]);

    out.push({
      civilianIndex,
      lat,
      lng,
      description,
      lang: useAr ? 'ar' : 'fr',
      cause: r.pick(CAUSES),
      status,
      anonymous,
      contactPhone: anonymous ? undefined : `+21266${String(r.int(1000000, 9999999))}`,
      characteristics: {
        fireSize: r.pick(['small', 'small', 'medium', 'large', 'very_large'] as const),
        smokeLevel: r.pick(['none', 'light', 'light', 'moderate', 'heavy'] as const),
        fireType: r.pick(['ground', 'surface', 'crown', 'unknown'] as const),
        windCondition: r.pick(['calm', 'light', 'moderate', 'strong'] as const),
        nearbyThreats: r.pickN(['structures', 'roads', 'powerlines', 'forest', 'people'] as const, r.int(0, 2)),
      },
      createdAt,
    });
  }
  return out;
}
