'use client';

import '@/lib/map/maplibreSetup';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactMapGL, { AttributionControl, Marker, NavigationControl, type MapMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IFRANE_COORDINATES } from '@/config/constants';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { useDebounce } from '@/hooks/useDebounce';
import { useDismiss } from '@/hooks/useDismiss';
import { getMapStyle } from '@/lib/map/styles';
import { useMapStore } from '@/store/useMapStore';
import { cn } from '@/lib/cn';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number };
  /** When true, map expands to fill more vertical space (wizard mode). */
  expanded?: boolean;
}

type Place = { name: string; label: string; lat: number; lng: number };

/**
 * Map for pinning a report: tap/click to place the pin, search a place name,
 * or use the device position. The camera stays free to pan and zoom.
 */
export default function LocationPicker({ onLocationSelect, selectedLocation, expanded }: LocationPickerProps) {
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const listId = useId();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 400);
  const [results, setResults] = useState<Place[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  /** Name of the place just picked, so writing it into the box doesn't search again. */
  const chosenRef = useRef<string | null>(null);
  const closeList = useCallback(() => setOpen(false), []);
  useDismiss(searchRef, open, closeList);

  const pick = useCallback(
    (lat: number, lng: number, zoom = 15) => {
      onLocationSelect(lat, lng);
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1100 });
    },
    [onLocationSelect]
  );

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2 || q === chosenRef.current) return;
    const controller = new AbortController();
    (async () => {
      setSearchState('loading');
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&lang=${language}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: Place[] };
        setResults(data.results);
        setActive(0);
        setSearchState(data.results.length ? 'idle' : 'empty');
        setOpen(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSearchState('error');
      }
    })();
    return () => controller.abort();
  }, [debounced, language]);

  const choose = (place: Place) => {
    chosenRef.current = place.name;
    setQuery(place.name);
    setOpen(false);
    pick(place.lat, place.lng, 14);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      if (event.lngLat) onLocationSelect(event.lngLat.lat, event.lngLat.lng);
    },
    [onLocationSelect]
  );

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pick(pos.coords.latitude, pos.coords.longitude, 15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [pick]);

  const storeBasemap = useMapStore((s) => s.basemap);
  const mapStyle = getMapStyle(storeBasemap || 'streets');
  const height = isMobile ? 'clamp(340px, 55dvh, 620px)' : expanded ? 'clamp(320px, 60vh, 900px)' : 'clamp(320px, 60vh, 520px)';

  return (
    <div className="space-y-3">
      {/* Place search */}
      <div ref={searchRef} className="relative">
        <label htmlFor={`${listId}-input`} className="mb-1.5 block text-[13px] font-medium">
          {t('placeSearchLabel')}
        </label>
        <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-input bg-surface px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <Icon name={searchState === 'loading' ? 'loading' : 'search'} size={17} className={cn('text-muted-foreground', searchState === 'loading' && 'animate-spin')} />
          <input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-opt-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) {
                setOpen(false);
                setSearchState('idle');
              }
            }}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={t('placeSearchPlaceholder')}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground sm:text-sm"
          />
        </div>
        {open && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-elev-3"
          >
            {searchState === 'empty' && <li className="px-3 py-2.5 text-sm text-muted-foreground">{t('placeSearchNoResults')}</li>}
            {results.map((place, i) => (
              <li
                key={`${place.lat},${place.lng},${i}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(place)}
                onKeyDown={(e) => e.key === 'Enter' && choose(place)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-sm', i === active && 'bg-primary/10')}
              >
                <Icon name="mapPin" size={16} className="mt-0.5 text-muted-foreground" />
                <span className="min-w-0">
                  <bdi className="block truncate font-medium">{place.name}</bdi>
                  <bdi className="block truncate text-xs text-muted-foreground">{place.label}</bdi>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">{searchState === 'error' ? t('placeSearchError') : t('placeSearchHint')}</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border" data-map-ready={mapReady ? 'true' : undefined}>
        <ReactMapGL
          ref={mapRef}
          initialViewState={{
            longitude: selectedLocation?.lng ?? IFRANE_COORDINATES.lng,
            latitude: selectedLocation?.lat ?? IFRANE_COORDINATES.lat,
            zoom: selectedLocation ? 14 : 11,
          }}
          mapStyle={mapStyle as string}
          onClick={handleClick}
          cursor="crosshair"
          style={{ width: '100%', height }}
          onLoad={(e) => {
            // MapLibre opens the compact credit on load; on this small map it
            // would cover the top. Collapse it; the (i) button still opens it.
            e.target.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
            setMapReady(true);
          }}
          attributionControl={false}
        >
          {/* Top corners keep controls clear of the phone tab bar and the GPS button. */}
          <AttributionControl position="top-left" compact />
          <NavigationControl position="top-right" showCompass={false} />
          {selectedLocation && (
            <Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="bottom">
              <span className="relative flex flex-col items-center" aria-hidden>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-fire text-on-accent-fire shadow-glow-fire ring-4 ring-background">
                  <Icon name="fire" size={18} strokeWidth={2.2} />
                </span>
                <span className="h-2 w-0.5 bg-accent-fire" />
              </span>
            </Marker>
          )}
        </ReactMapGL>

        <button
          type="button"
          onClick={handleGeolocate}
          disabled={locating}
          className="absolute bottom-10 start-3 z-[1000] flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-surface/95 px-3 py-2 text-sm font-medium shadow-elev-2 backdrop-blur transition hover:bg-surface-2 disabled:opacity-60"
        >
          <Icon name={locating ? 'loading' : 'navigation'} size={18} className={cn('text-primary', locating && 'animate-spin')} />
          <span>{locating ? t('locatingYou') : t('useMyLocation')}</span>
        </button>
      </div>
    </div>
  );
}
