'use client';

import { useMemo } from 'react';
import { Map, Marker, NavigationControl, Popup } from 'react-map-gl/maplibre';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { RecordStatusBadge } from './RecordStatusBadge';
import Link from 'next/link';
import { useState } from 'react';
import type { FireEventRecord } from '@/types';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW = {
  longitude: -5.1,
  latitude: 33.4,
  zoom: 8,
};

export function FireRecordMapView() {
  const { t } = useTranslation();
  const { records } = useFireRecordStore();
  const [selected, setSelected] = useState<FireEventRecord | null>(null);

  const markers = useMemo(() => {
    return records
      .map((r) => {
        const loc = r.locationDetail as Record<string, unknown> | null;
        const coords = loc?.coordinates as [number, number] | undefined;
        const centroid = r.burnCentroid as [number, number] | undefined;
        const point = coords ?? centroid;
        if (!point || point.length !== 2) return null;
        return { record: r, lng: point[0], lat: point[1] };
      })
      .filter(Boolean) as { record: FireEventRecord; lng: number; lat: number }[];
  }, [records]);

  if (markers.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground" data-testid="fire-record-map-empty">
        {t('fireRecordNoRecords')}
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden" data-testid="fire-record-map-view">
      <Map
        initialViewState={INITIAL_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle={`https://api.maptiler.com/maps/streets/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY || 'placeholder'}`}
      >
        <NavigationControl position="top-right" />

        {markers.map(({ record, lng, lat }) => (
          <Marker
            key={record.id}
            longitude={lng}
            latitude={lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(record);
            }}
          >
            <div
              className={`h-3 w-3 rounded-full border-2 border-white shadow ${
                record.recordStatus === 'LOCKED' ? 'bg-green-500' :
                record.recordStatus === 'VERIFIED' ? 'bg-blue-500' : 'bg-amber-500'
              }`}
            />
          </Marker>
        ))}

        {selected && (() => {
          const loc = selected.locationDetail as Record<string, unknown> | null;
          const coords = (loc?.coordinates ?? selected.burnCentroid) as [number, number] | undefined;
          if (!coords) return null;
          return (
            <Popup
              longitude={coords[0]}
              latitude={coords[1]}
              anchor="bottom"
              onClose={() => setSelected(null)}
              closeButton
            >
              <div className="space-y-1 p-1 text-xs">
                <RecordStatusBadge status={selected.recordStatus} />
                <p className="font-medium">
                  {(loc?.locationName ?? loc?.commune ?? '') as string}
                </p>
                {selected.burnAreaHa != null && (
                  <p>{selected.burnAreaHa} ha</p>
                )}
                <Link
                  href={`/fire-database/${selected.id}`}
                  className="text-primary hover:underline"
                >
                  {t('fireRecordViewFull')}
                </Link>
              </div>
            </Popup>
          );
        })()}
      </Map>
    </div>
  );
}
