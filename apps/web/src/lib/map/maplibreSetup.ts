'use client';

import { addProtocol, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

/**
 * MapLibre 6 spawns an ES-module worker. Bundlers don't reliably emit it, so
 * the worker is served from /maplibre (copied there on install) and every map
 * component imports this module before creating a map.
 */
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
  const globalWithPmtiles = window as typeof window & { __ricerPmtilesRegistered?: boolean };
  if (!globalWithPmtiles.__ricerPmtilesRegistered) {
    addProtocol('pmtiles', new Protocol().tile);
    globalWithPmtiles.__ricerPmtilesRegistered = true;
  }
}
