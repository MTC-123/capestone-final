'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import { PMTilesVectorSource } from 'ol-pmtiles';
import TileWMS from 'ol/source/TileWMS.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import { getRenderPixel } from 'ol/render.js';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import type { FireEventRecord } from '@/types';
import { OfflineMapDownload } from '@/components/map/OfflineMapDownload';
import 'ol/ol.css';

type CatalogLayer = { id: string; title: string; description: string; group: string; timeDomain: string | null; recommended: boolean };
const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
const STARTER: CatalogLayer = { id: 'VIIRS_NOAA21_CorrectedReflectance_TrueColor', title: 'VIIRS NOAA-21 true color', description: '', group: 'Satellite imagery', timeDomain: null, recommended: true };
const GROUP_ORDER = ['Detection', 'Satellite imagery', 'Fuels and vegetation', 'Dryness and rain', 'Smoke and air'];
const GROUP_TONE: Record<string, string> = {
  Detection: 'bg-orange-500', 'Satellite imagery': 'bg-sky-500', 'Fuels and vegetation': 'bg-emerald-500',
  'Dryness and rain': 'bg-blue-500', 'Smoke and air': 'bg-violet-500',
};

function readableLayer(layer: CatalogLayer): string {
  return layer.title === layer.id ? layer.title.replaceAll('_', ' ') : layer.title;
}

function availableTime(domain: string | null): string {
  if (!domain) return 'Default scene';
  const first = domain.split(',')[0]?.split('/')[0] ?? '';
  const last = domain.split(',').at(-1)?.split('/').at(-2) ?? '';
  return first && last && first !== last ? `${first.slice(0, 10)} → ${last.slice(0, 10)}` : 'Dated imagery';
}

function shift(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function pointFor(record: FireEventRecord): [number, number] | null {
  const point = record.locationDetail?.coordinates ?? record.burnCentroid;
  return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) ? point as [number, number] : null;
}

function imagery(id: string, date: string): TileWMS {
  return new TileWMS({ url: GIBS, params: { LAYERS: id, TIME: date, FORMAT: 'image/png', TRANSPARENT: true, VERSION: '1.3.0' }, crossOrigin: 'anonymous', attributions: 'NASA GIBS' });
}

function localBasemap() {
  return new VectorTileLayer({
    declutter: true,
    source: new PMTilesVectorSource({ url: '/maps/ifrane.pmtiles', attributions: ['© OpenStreetMap contributors · Protomaps'] }),
    style: (feature) => {
      const layer = String(feature.get('layer') ?? '');
      const kind = String(feature.get('kind') ?? '');
      const name = String(feature.get('name') ?? '');
      const geometry = feature.getGeometry()?.getType() ?? '';
      if (layer === 'water' || /water|river|lake/.test(kind)) return new Style({ fill: new Fill({ color: '#bbd9e4' }), stroke: new Stroke({ color: '#8fbdcf', width: 1 }) });
      if (layer === 'landcover' || layer === 'landuse') return new Style({ fill: new Fill({ color: /forest|wood/.test(kind) ? '#d4e5d4' : '#e7e9dc' }) });
      if (layer === 'roads' || /road|highway|street/.test(layer)) return new Style({ stroke: new Stroke({ color: /major|primary|trunk/.test(kind) ? '#d49f6f' : '#f5f1e9', width: /major|primary|trunk/.test(kind) ? 2.5 : 1.5 }) });
      if (layer === 'boundaries') return new Style({ stroke: new Stroke({ color: '#9d9d93', width: 1 }) });
      if (layer === 'places' && name) return new Style({ text: new Text({ text: name, font: '12px sans-serif', fill: new Fill({ color: '#24303a' }), stroke: new Stroke({ color: '#fff', width: 3 }) }) });
      if (layer === 'buildings') return new Style({ fill: new Fill({ color: '#dedbd1' }), stroke: new Stroke({ color: '#d0cdc1', width: 0.5 }) });
      if (/Polygon/.test(geometry)) return new Style({ fill: new Fill({ color: '#f4f3e9' }) });
      if (/Line/.test(geometry)) return new Style({ stroke: new Stroke({ color: '#d7d7ce', width: 1 }) });
      return undefined;
    },
  });
}

export default function FireRecordMapView() {
  const filters = useFireRecordStore((s) => s.filters);
  const target = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const before = useRef<TileLayer<TileWMS> | null>(null);
  const after = useRef<TileLayer<TileWMS> | null>(null);
  const extras = useRef<TileLayer<TileWMS>[]>([]);
  const vectors = useRef(new VectorSource());
  const swipeValue = useRef(50);
  const recordsRef = useRef<FireEventRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogLayer[]>([STARTER]);
  const [catalogError, setCatalogError] = useState(false);
  const [records, setRecords] = useState<FireEventRecord[]>([]);
  const [selected, setSelected] = useState<FireEventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layerId, setLayerId] = useState(STARTER.id);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [swipe, setSwipe] = useState(50);
  const [visibleRecords, setVisibleRecords] = useState(100);
  const [beforeDate, setBeforeDate] = useState(() => shift(new Date().toISOString().slice(0, 10), -30));
  const [afterDate, setAfterDate] = useState(() => shift(new Date().toISOString().slice(0, 10), -2));

  useEffect(() => {
    fetch('/api/map/gibs-catalog').then(async (response) => {
      if (!response.ok) throw new Error('NASA catalogue unavailable');
      const body = await response.json() as { layers: CatalogLayer[] };
      if (body.layers.length) setCatalog(body.layers);
    }).catch(() => setCatalogError(true));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true); setError('');
      try {
        const found: FireEventRecord[] = [];
        let cursor: string | null = null;
        do {
          const params = new URLSearchParams({ limit: '100', verifiedOnly: 'true', sortBy: 'ignitionAt', sortOrder: 'desc' });
          if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
          if (filters.dateTo) params.set('dateTo', filters.dateTo);
          if (filters.alertSource) params.set('alertSource', filters.alertSource);
          if (filters.commune) params.set('commune', filters.commune);
          if (filters.search) params.set('search', filters.search);
          if (cursor) params.set('cursor', cursor);
          const response = await fetch(`/api/fire-records?${params}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Archive unavailable');
          const body = await response.json() as { data: FireEventRecord[]; pagination: { cursor: string | null; hasMore: boolean } };
          found.push(...body.data);
          cursor = body.pagination.hasMore ? body.pagination.cursor : null;
        } while (cursor && !controller.signal.aborted);
        if (!controller.signal.aborted) { recordsRef.current = found; setRecords(found); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Archive unavailable');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void run();
    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.alertSource, filters.commune, filters.search]);

  useEffect(() => {
    if (!target.current) return;
    const first = new TileLayer({ source: imagery(layerId, beforeDate), opacity: 0.9 });
    const second = new TileLayer({ source: imagery(layerId, afterDate), opacity: 0.9 });
    const recordLayer = new VectorLayer({ source: vectors.current, style: new Style({
      fill: new Fill({ color: 'rgba(220,69,28,.2)' }), stroke: new Stroke({ color: '#d8461c', width: 2.5 }),
      image: new Circle({ radius: 7, fill: new Fill({ color: '#d8461c' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
    }) });
    const instance = new Map({ target: target.current,
      layers: [localBasemap(), first, second, recordLayer],
      view: new View({ center: fromLonLat([-5.15, 33.46]), zoom: 9, minZoom: 3, maxZoom: 18 }),
    });
    map.current = instance; before.current = first; after.current = second;
    second.on('prerender', (event) => {
      const ctx = event.context as CanvasRenderingContext2D;
      const size = instance.getSize();
      if (!ctx || !size) return;
      const x = size[0] * swipeValue.current / 100;
      const a = getRenderPixel(event, [x, 0]); const b = getRenderPixel(event, [x, size[1]]);
      const c = getRenderPixel(event, size); const d = getRenderPixel(event, [size[0], 0]);
      ctx.save(); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.clip();
    });
    second.on('postrender', (event) => (event.context as CanvasRenderingContext2D)?.restore());
    instance.on('singleclick', (event) => {
      const feature = instance.forEachFeatureAtPixel(event.pixel, (item) => item);
      const id = feature?.get('recordId') as string | undefined;
      if (id) setSelected(recordsRef.current.find((item) => item.id === id) ?? null);
    });
    return () => { instance.setTarget(undefined); instance.dispose(); map.current = null; };
  // The map instance is created once; the next effect updates its imagery sources.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    vectors.current.clear();
    const reader = new GeoJSON();
    for (const record of records) {
      if (record.burnPerimeter) try {
        const parsed = reader.readFeature({ type: 'Feature', geometry: record.burnPerimeter, properties: {} }, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        for (const feature of Array.isArray(parsed) ? parsed : [parsed]) { feature.set('recordId', record.id); vectors.current.addFeature(feature); }
      } catch { /* Malformed legacy geometry must not hide other fires. */ }
      const point = pointFor(record);
      if (point) vectors.current.addFeature(new Feature({ geometry: new Point(fromLonLat(point)), recordId: record.id }));
    }
  }, [records]);

  useEffect(() => { before.current?.setSource(imagery(layerId, beforeDate)); after.current?.setSource(imagery(layerId, afterDate)); }, [layerId, beforeDate, afterDate]);
  useEffect(() => {
    if (!map.current) return;
    for (const layer of extras.current) map.current.removeLayer(layer);
    extras.current = extraIds.map((id) => new TileLayer({ source: imagery(id, afterDate), opacity: 0.55 }));
    for (const layer of extras.current) map.current.getLayers().insertAt(3, layer);
  }, [extraIds, afterDate]);

  const visibleCatalog = useMemo(() => (showAll ? catalog : catalog.filter((item) => item.recommended))
    .toSorted((a, b) => (GROUP_ORDER.indexOf(a.group) < 0 ? 99 : GROUP_ORDER.indexOf(a.group)) - (GROUP_ORDER.indexOf(b.group) < 0 ? 99 : GROUP_ORDER.indexOf(b.group)) || a.title.localeCompare(b.title)), [catalog, showAll]);
  const groups = useMemo(() => ['All', ...new Set(visibleCatalog.map((item) => item.group))], [visibleCatalog]);
  const matching = useMemo(() => visibleCatalog.filter((item) => (group === 'All' || item.group === group) && `${item.id} ${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [visibleCatalog, group, query]);
  const selectRecord = (record: FireEventRecord) => {
    setSelected(record);
    const point = pointFor(record);
    if (point) map.current?.getView().animate({ center: fromLonLat(point), zoom: 12, duration: 500 });
    const day = record.ignitionAt?.slice(0, 10) || record.alertReceivedAt?.slice(0, 10);
    if (day) { setBeforeDate(shift(day, -14)); setAfterDate(shift(day, 7)); }
  };
  const activeLayer = catalog.find((item) => item.id === layerId) ?? STARTER;

  return <div className="rounded-2xl border border-border bg-surface/70 shadow-elev-1" data-testid="fire-record-map-view">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Ifrane · investigation workspace</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Explore the fire record in time</h2>
        <p className="mt-1 text-xs text-muted-foreground">Official perimeters over dated NASA imagery. Select a fire to center the comparison.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
        <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-orange-600 dark:text-orange-300">● {records.length} verified fires</span>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-600 dark:text-sky-300">NASA GIBS · {catalog.length} layers</span>
      </div>
    </div>
    <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-4">
      <div className="min-w-0 space-y-3">
        <div className="grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_1fr]">
          <label className="text-xs font-semibold text-muted-foreground">BEFORE · SCENE DATE
            <input type="date" value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">AFTER · SCENE DATE
            <input type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-foreground sm:col-span-2">Compare scenes · {swipe}%
            <input type="range" min="0" max="100" value={swipe} onChange={(e) => { const value = Number(e.target.value); setSwipe(value); swipeValue.current = value; map.current?.render(); }} className="mt-2 block w-full accent-orange-500" aria-label="Before / after swipe" />
          </label>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-border bg-[#e8eadf] shadow-elev-1">
          <div ref={target} className="h-[55dvh] min-h-[360px] sm:h-[65dvh]" aria-label="Historical fire map" />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-2 text-[11px] font-bold text-white">
            <span className="rounded-lg bg-slate-950/80 px-3 py-2 shadow-lg backdrop-blur">BEFORE · {beforeDate}</span>
            <span className="rounded-lg bg-slate-950/80 px-3 py-2 shadow-lg backdrop-blur">AFTER · {afterDate}</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_#111]" style={{ left: `${swipe}%` }} aria-hidden="true">
            <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-slate-950/85 text-sm font-bold text-white shadow-xl">↔</span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-slate-950/85 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur">● Official fire records · {records.length}</div>
        </div>
        <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">Showing requested GIBS scene dates. Cloud cover or missing imagery may obscure the ground. Orange points and outlines are verified official records; satellite thermal pixels are observations, not confirmed incidents.</p>
        {loading && <p role="status" className="text-sm">Loading all verified records…</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {selected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-300">Selected official record</p><p className="mt-1 font-semibold">{selected.locationDetail?.locationName || selected.locationDetail?.commune || 'Fire record'}</p><p className="text-sm text-muted-foreground">Ignition {selected.ignitionAt?.slice(0, 10) || 'unknown'} · {selected.burnAreaHa ?? '—'} ha · {selected.recordStatus}</p></div>
          <Link href={`/fire-database/${selected.id}`} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Open record ↗</Link>
        </div>}
      </div>
      <aside className="min-w-0 space-y-4">
        <section className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Layer catalogue</p><h3 className="mt-0.5 font-bold">Fire intelligence</h3></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">{catalog.filter((item) => item.recommended).length} curated</span></div>
          <p className="mt-2 text-xs text-muted-foreground">Active imagery: <span className="font-medium text-foreground">{readableLayer(activeLayer)}</span></p>
          <p className="mt-1 text-[11px] text-muted-foreground">Available: {availableTime(activeLayer.timeDomain)}</p>
          {catalogError && <p className="mt-2 text-xs text-warning">Live catalogue unavailable; showing a starter layer.</p>}
          <input aria-label="Search NASA layers" placeholder="Search thermal, smoke, fuels…" value={query} onChange={(e) => setQuery(e.target.value)} className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <select aria-label="NASA layer category" value={group} onChange={(e) => setGroup(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">{groups.map((item) => <option key={item}>{item}</option>)}</select>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setGroup('All'); }} /> Explore all {catalog.length} NASA layers</label>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">{matching.slice(0, 100).map((item) => <div key={item.id} className={`rounded-xl border p-3 text-sm transition-colors ${layerId === item.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
            <button type="button" onClick={() => setLayerId(item.id)} aria-pressed={layerId === item.id} className="w-full text-start font-semibold leading-tight text-foreground">{readableLayer(item)}</button>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${GROUP_TONE[item.group] || 'bg-slate-400'}`} />{item.group} · {item.timeDomain ? 'Dated' : 'Default'} · NASA GIBS</p>
            <button type="button" onClick={() => setExtraIds((prior) => prior.includes(item.id) ? prior.filter((id) => id !== item.id) : [...prior.slice(-2), item.id])} className="mt-2 text-[11px] font-semibold text-primary underline">{extraIds.includes(item.id) ? 'Remove context overlay' : 'Add context overlay'}</button>
          </div>)}</div>
          {matching.length > 100 && <p className="mt-2 text-xs text-muted-foreground">Showing 100 of {matching.length}. Refine the search to see more.</p>}
        </section>
        <section className="rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">Official fire records</h3><span className="text-xs text-muted-foreground">{records.length} mapped</span></div><div className="mt-2 max-h-64 space-y-1 overflow-auto">{records.slice(0, visibleRecords).map((record) => <button key={record.id} onClick={() => selectRecord(record)} className={`block w-full rounded-lg border px-3 py-2 text-start text-sm ${selected?.id === record.id ? 'border-orange-500 bg-orange-500/10' : 'border-transparent hover:border-border hover:bg-muted'}`}><span className="block font-medium">{record.locationDetail?.locationName || record.locationDetail?.commune || 'Fire'}</span><span className="text-[11px] text-muted-foreground">{record.ignitionAt?.slice(0, 10) || 'Date unknown'} · {record.burnAreaHa ?? '—'} ha</span></button>)}</div>{visibleRecords < records.length && <button type="button" onClick={() => setVisibleRecords((count) => count + 100)} className="mt-2 text-xs font-semibold text-primary underline">Show more records ({visibleRecords} of {records.length})</button>}</section>
        <OfflineMapDownload />
      </aside>
    </div>
  </div>;
}
