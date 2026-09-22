import { useState, useEffect, useRef } from 'react';

interface PopulationGridFeature {
  geometry: { coordinates: [number, number] };
  properties: { pop: number };
}

interface PopulationGrid {
  features: PopulationGridFeature[];
}

let gridCache: PopulationGrid | null = null;
let gridPromise: Promise<PopulationGrid | null> | null = null;

interface SpatialIndex {
  cells: Map<string, PopulationGridFeature[]>;
  cellSize: number;
}

let spatialIndexCache: SpatialIndex | null = null;
const CELL_SIZE = 0.05;
const NEIGHBOR_OFFSETS = [-1, 0, 1];

function buildSpatialIndex(features: PopulationGridFeature[]): SpatialIndex {
  const cells = new Map<string, PopulationGridFeature[]>();
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${Math.floor(lon / CELL_SIZE)},${Math.floor(lat / CELL_SIZE)}`;
    let bucket = cells.get(key);
    if (!bucket) { bucket = []; cells.set(key, bucket); }
    bucket.push(f);
  }
  return { cells, cellSize: CELL_SIZE };
}

function loadGrid(): Promise<PopulationGrid | null> {
  if (gridCache) return Promise.resolve(gridCache);
  if (gridPromise) return gridPromise;

  gridPromise = fetch('/data/ifrane-population-grid.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PopulationGrid | null) => {
      if (data) {
        gridCache = data;
        spatialIndexCache = buildSpatialIndex(data.features);
      }
      return data;
    })
    .catch(() => null);

  return gridPromise;
}

function approxDistKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = lat2 - lat1;
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon) * 111.32;
}

export function usePopulationAtRisk(
  center: [number, number] | null,
  radiusKm = 5,
): { population: number | null; loading: boolean } {
  const [population, setPopulation] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string>('');

  useEffect(() => {
    if (!center) {
      setPopulation(null);
      lastKey.current = '';
      return;
    }

    const key = `${center[0].toFixed(4)},${center[1].toFixed(4)},${radiusKm}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;
    setLoading(true);

    loadGrid().then((grid) => {
      if (cancelled || !grid) {
        if (!cancelled) setLoading(false);
        return;
      }

      let total = 0;
      const idx = spatialIndexCache;

      if (idx) {
        const col = Math.floor(center[0] / idx.cellSize);
        const row = Math.floor(center[1] / idx.cellSize);
        for (const dc of NEIGHBOR_OFFSETS) {
          for (const dr of NEIGHBOR_OFFSETS) {
            const bucket = idx.cells.get(`${col + dc},${row + dr}`);
            if (!bucket) continue;
            for (const f of bucket) {
              const [lon, lat] = f.geometry.coordinates;
              if (approxDistKm(center[0], center[1], lon, lat) <= radiusKm) {
                total += f.properties.pop;
              }
            }
          }
        }
      } else {
        for (const f of grid.features) {
          const [lon, lat] = f.geometry.coordinates;
          if (approxDistKm(center[0], center[1], lon, lat) <= radiusKm) {
            total += f.properties.pop;
          }
        }
      }

      if (!cancelled) {
        setPopulation(total);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [center, radiusKm]);

  return { population, loading };
}
