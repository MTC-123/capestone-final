/**
 * Deterministic PRNG utilities for seed data.
 *
 * Using a seeded mulberry32 generator means `npm run prisma:seed` produces
 * exactly the same demo dataset (same coordinates, same reference numbers,
 * same counts) on every run — which is what makes the seed idempotent and
 * safe to diff.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good-enough distribution for fixture data. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number) {
  const rng = mulberry32(seed);

  const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const float = (min: number, max: number, decimals = 4) => {
    const v = rng() * (max - min) + min;
    const p = 10 ** decimals;
    return Math.round(v * p) / p;
  };
  const bool = (probability = 0.5) => rng() < probability;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const pickN = <T>(arr: readonly T[], n: number): T[] => {
    const pool = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  };
  const pickWeighted = <T>(items: ReadonlyArray<{ value: T; weight: number }>): T => {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = rng() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  };
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  /** 24 lowercase hex chars — a syntactically valid MongoDB ObjectId that
   * Prisma's Mongo connector will accept as an explicit `id` on create, so
   * cross-collection references can be wired up before anything is
   * inserted. */
  const objectId = (): string => {
    let s = '';
    for (let i = 0; i < 24; i++) s += Math.floor(rng() * 16).toString(16);
    return s;
  };

  /** RFC4122-shaped v4 UUID, deterministic from the seed. Used for
   * clientSubmissionId — it only needs to be unique and UUID-shaped, not
   * cryptographically random. */
  const uuid = (): string => {
    const hex: string[] = [];
    for (let i = 0; i < 16; i++) hex.push(Math.floor(rng() * 256).toString(16).padStart(2, '0'));
    hex[6] = ((parseInt(hex[6], 16) & 0x0f) | 0x40).toString(16).padStart(2, '0');
    hex[8] = ((parseInt(hex[8], 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
    const s = hex.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  return { rng, int, float, bool, pick, pickN, pickWeighted, shuffle, objectId, uuid };
}

export type SeedRng = ReturnType<typeof createRng>;

/** Jitter a [lat, lng] center by up to `radiusDeg` degrees, biased toward
 * the center (sqrt distribution would be uniform-area; we use a simple
 * square jitter which is plenty realistic at this scale). */
export function jitter(r: SeedRng, lat: number, lng: number, radiusDeg: number): [number, number] {
  const dLat = r.float(-radiusDeg, radiusDeg, 5);
  const dLng = r.float(-radiusDeg, radiusDeg, 5);
  return [Math.round((lat + dLat) * 100000) / 100000, Math.round((lng + dLng) * 100000) / 100000];
}

/** Build a small, roughly-realistic closed polygon (GeoJSON ring) around a
 * centroid with a target area in hectares. Used for FireEventRecord burn
 * perimeters. Returns coordinates in [lng, lat] order. */
export function burnPolygon(r: SeedRng, centerLat: number, centerLng: number, targetHa: number): number[][] {
  // Approximate a circle of the target area, then perturb each vertex so it
  // doesn't look perfectly circular. 1 hectare = 10,000 m^2.
  const radiusM = Math.sqrt((targetHa * 10_000) / Math.PI);
  const points = 8 + Math.floor(r.rng() * 5); // 8-12 vertices
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const ring: number[][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = r.float(0.65, 1.25, 3);
    const dist = radiusM * wobble;
    const dLat = (Math.sin(angle) * dist) / metersPerDegLat;
    const dLng = (Math.cos(angle) * dist) / metersPerDegLng;
    ring.push([
      Math.round((centerLng + dLng) * 1_000_000) / 1_000_000,
      Math.round((centerLat + dLat) * 1_000_000) / 1_000_000,
    ]);
  }
  ring.push(ring[0]); // close the ring
  return ring;
}

/**
 * Formats a Report.referenceNumber: RPT-YYYYMMDD-XXXXXX. `seq` must be a
 * globally-unique counter across the whole seed run so the suffix never
 * collides (referenceNumber is a unique index).
 */
export function referenceNumber(date: Date, seq: number): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const suffix = String(seq % 1_000_000).padStart(6, '0');
  return `RPT-${y}${m}${d}-${suffix}`;
}
