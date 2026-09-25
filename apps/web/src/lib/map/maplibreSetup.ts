'use client';

import { setWorkerUrl } from 'maplibre-gl';

/**
 * MapLibre 6 spawns an ES-module worker. Bundlers don't reliably emit it, so
 * the worker is served from /maplibre (copied there on install) and every map
 * component imports this module before creating a map.
 */
if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}
