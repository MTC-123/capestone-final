'use client';

import { useCallback, useRef, useState } from 'react';
import ReactMapGL, { Marker, type MapMouseEvent, type MapRef } from 'react-map-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IFRANE_COORDINATES } from '@/config/constants';
import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { getMapStyle } from '@/lib/map/styles';
import { useMapStore } from '@/store/useMapStore';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number };
  /** When true, map expands to fill more vertical space (wizard mode). */
  expanded?: boolean;
}

export default function LocationPicker({ onLocationSelect, selectedLocation, expanded }: LocationPickerProps) {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const isMobile = useIsMobile();
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapRef>(null);

  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      if (event.lngLat) {
        onLocationSelect(event.lngLat.lat, event.lngLat.lng);
      }
    },
    [onLocationSelect]
  );

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onLocationSelect(latitude, longitude);
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 15, duration: 1200 });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onLocationSelect]);

  // Match basemap from main fire map store, fallback to streets
  const storeBasemap = useMapStore((s) => s.basemap);
  const mapStyle = getMapStyle(storeBasemap || 'streets');

  const height = isMobile
    ? 'clamp(320px, 52dvh, 620px)'
    : expanded
      ? 'clamp(300px, 60vh, 900px)'
      : 'clamp(300px, 60vh, 500px)';

  return (
    <div className="relative" data-map-ready={mapReady ? 'true' : undefined}>
      <ReactMapGL
        ref={mapRef}
        longitude={selectedLocation?.lng ?? IFRANE_COORDINATES.lng}
        latitude={selectedLocation?.lat ?? IFRANE_COORDINATES.lat}
        zoom={13}
        mapStyle={mapStyle as string}
        onClick={handleClick}
        style={{ width: '100%', height, borderRadius: '0.5rem', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
        onLoad={() => setMapReady(true)}
      >
        {selectedLocation && (
          <Marker longitude={selectedLocation.lng} latitude={selectedLocation.lat} anchor="center">
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '999px',
                background: 'white',
                border: '3px solid #0ea5e9',
                boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
              }}
            />
          </Marker>
        )}
      </ReactMapGL>

      {/* Instruction overlay */}
      <div
        className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} z-[1000] max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs shadow-elev-1 backdrop-blur sm:top-4 sm:text-sm ${isRTL ? 'sm:right-4' : 'sm:left-4'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className={`mb-1 flex items-center gap-2 font-bold ${isRTL ? 'justify-end text-right' : 'justify-start text-left'}`}>
          <Icon name="pin" aria-hidden={true} size={18} className="text-muted-foreground" />
          <span>{isMobile ? t('tapTheMap') : t('clickTheMap')}</span>
        </div>
        <div className={isRTL ? 'text-right text-muted-foreground' : 'text-left text-muted-foreground'}>
          {t('locationPickerSubtitle')}
        </div>
      </div>

      {/* GPS button */}
      <button
        type="button"
        onClick={handleGeolocate}
        disabled={locating}
        className={`absolute bottom-3 ${isRTL ? 'left-3' : 'right-3'} z-[1000] flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 text-sm font-medium shadow-elev-2 backdrop-blur transition hover:bg-surface-2 disabled:opacity-60 sm:bottom-4 ${isRTL ? 'sm:left-4' : 'sm:right-4'}`}
      >
        {locating ? (
          <Icon name="loading" aria-hidden={true} size={18} className="animate-spin text-primary" />
        ) : (
          <Icon name="navigation" aria-hidden={true} size={18} className="text-primary" />
        )}
        <span>{locating ? t('locatingYou') : t('useMyLocation')}</span>
      </button>
    </div>
  );
}
