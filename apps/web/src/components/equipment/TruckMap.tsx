'use client';

import '@/lib/map/maplibreSetup';
import { useState, useCallback, useMemo } from 'react';
import ReactMapGL, { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IFRANE_COORDINATES } from '@/config/constants';
import type { TruckDeployment } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { getMapStyle } from '@/lib/map/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_TRANSLATION_MAP: Record<string, TranslationKey> = {
  'Disponible': 'available',
  'En route': 'enRoute',
  'En intervention': 'onScene',
};

const STATUS_CSS_COLORS: Record<string, string> = {
  'Disponible': 'text-success',
  'En route': 'text-warning',
  'En intervention': 'text-danger',
};

// DOM-rendered marker/legend accents (theme-aware). Distinct from the raw hex
// used in the maplibre GL paint expressions below, which cannot resolve CSS variables.
const STATUS_ACCENT: Record<string, string> = {
  'Disponible': 'hsl(var(--success))',
  'En route': 'hsl(var(--warning))',
  'En intervention': 'hsl(var(--danger))',
};

const truckColor = (status: string) => STATUS_ACCENT[status] ?? 'hsl(var(--danger))';

interface TruckMapProps {
  trucks: TruckDeployment[];
  onDispatch?: (truck: TruckDeployment) => void;
}

export default function TruckMap({ trucks, onDispatch }: TruckMapProps) {
  const [popupTruckId, setPopupTruckId] = useState<string | null>(null);
  const { t } = useTranslation();

  const {
    equipment,
    retardant,
    infrastructure,
    pickingLocation,
    applyPickedLocation,
    stopPicking,
  } = useEquipmentStore();

  const mapStyle = getMapStyle('streets');

  const translateStatus = (status: string) => {
    const key = STATUS_TRANSLATION_MAP[status];
    return key ? t(key) : status;
  };

  // GeoJSON for equipment markers
  const equipmentGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: equipment
        .filter((e) => e.latitude && e.longitude)
        .map((e) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [e.longitude!, e.latitude!],
          },
          properties: {
            id: e.id,
            name: e.name,
            type: e.type,
            status: e.status,
            category: 'equipment',
          },
        })),
    }),
    [equipment],
  );

  // GeoJSON for infrastructure markers
  const infrastructureGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: infrastructure
        .filter((i) => i.latitude && i.longitude)
        .map((i) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [i.longitude!, i.latitude!],
          },
          properties: {
            id: i.id,
            name: i.name,
            type: i.type,
            status: i.status,
            category: 'infrastructure',
          },
        })),
    }),
    [infrastructure],
  );

  // GeoJSON for retardant markers
  const retardantGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: retardant
        .filter((r) => r.storageLat && r.storageLng)
        .map((r) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [r.storageLng!, r.storageLat!],
          },
          properties: {
            id: r.id,
            name: r.name,
            quantity: r.quantity,
            category: 'retardant',
          },
        })),
    }),
    [retardant],
  );

  // Map click handler for picking mode
  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (pickingLocation) {
        applyPickedLocation(e.lngLat.lat, e.lngLat.lng);
      }
    },
    [pickingLocation, applyPickedLocation],
  );

  return (
    <div className="relative">
      {/* Picking mode banner */}
      {pickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-primary text-primary-foreground px-4 py-2 rounded-[10px] shadow-elev-2 text-sm font-semibold flex items-center gap-2">
          <Icon name="mapPin" size={16} aria-hidden />
          {t('pickOnMap' as TranslationKey)}
          <button
            type="button"
            onClick={stopPicking}
            className="ms-2 opacity-80 hover:opacity-100"
          >
            <Icon name="close" size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="h-[300px] sm:h-[400px] md:h-[500px] rounded-2xl shadow-elev-2 overflow-hidden">
        <ReactMapGL
          longitude={IFRANE_COORDINATES.lng}
          latitude={IFRANE_COORDINATES.lat}
          zoom={13}
          mapStyle={mapStyle as string}
          style={{ width: '100%', height: '100%' }}
          cursor={pickingLocation ? 'crosshair' : undefined}
          onClick={handleMapClick}
          interactiveLayerIds={['equipment-layer', 'infrastructure-layer', 'retardant-layer']}
        >
          {/* Truck markers */}
          {trucks.map((truck) => (
            <Marker
              key={truck.id}
              longitude={truck.longitude}
              latitude={truck.latitude}
              anchor="center"
              onClick={() => setPopupTruckId(popupTruckId === truck.id ? null : truck.id)}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  backgroundColor: truckColor(truck.status),
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.9)',
                  }}
                />
              </div>
            </Marker>
          ))}

          {popupTruckId &&
            (() => {
              const truck = trucks.find((t) => t.id === popupTruckId);
              if (!truck) return null;
              return (
                <Popup
                  longitude={truck.longitude}
                  latitude={truck.latitude}
                  anchor="bottom"
                  closeButton={true}
                  onClose={() => setPopupTruckId(null)}
                  offset={[0, -14]}
                >
                  <div className="text-xs">
                    <div className="font-bold text-base mb-2">{truck.truckName}</div>
                    <div className="flex flex-col gap-1.5">
                      <div>
                        <span className="font-semibold">{t('truckNumber')}:</span>{' '}
                        {truck.truckId}
                      </div>
                      <div>
                        <span className="font-semibold">{t('status')}:</span>{' '}
                        <span
                          className="font-extrabold"
                          style={{ color: truckColor(truck.status) }}
                        >
                          {translateStatus(truck.status)}
                        </span>
                      </div>
                      {truck.assignedTo && (
                        <div>
                          <span className="font-semibold">{t('assignedTo')}:</span>{' '}
                          {truck.assignedTo}
                        </div>
                      )}
                      {truck.vehicleType && (
                        <div>
                          <span className="font-semibold">{t('vehicleType')}:</span>{' '}
                          {truck.vehicleType}
                        </div>
                      )}
                      {truck.crewCount != null && (
                        <div>
                          <span className="font-semibold">{t('crewCount')}:</span>{' '}
                          {truck.crewCount}
                        </div>
                      )}
                      <div className="mt-2 text-[11px] opacity-70">
                        {truck.latitude.toFixed(6)}, {truck.longitude.toFixed(6)}
                      </div>
                      {truck.status === 'Disponible' && onDispatch && (
                        <button
                          type="button"
                          onClick={() => onDispatch(truck)}
                          className="mt-2 w-full rounded-[10px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-110"
                        >
                          {t('dispatchToIncident')}
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              );
            })()}

          {/* Equipment markers — color-coded by status */}
          <Source id="equipment-source" type="geojson" data={equipmentGeoJSON as GeoJSON.FeatureCollection}>
            <Layer
              id="equipment-layer"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': [
                  'match',
                  ['get', 'status'],
                  'OPERATIONNEL',
                  '#22c55e',
                  'EN_MAINTENANCE',
                  '#eab308',
                  'EN_PANNE',
                  '#ef4444',
                  'HORS_SERVICE',
                  '#ef4444',
                  '#6b7280',
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </Source>

          {/* Infrastructure markers — color-coded by type */}
          <Source id="infrastructure-source" type="geojson" data={infrastructureGeoJSON as GeoJSON.FeatureCollection}>
            <Layer
              id="infrastructure-layer"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': [
                  'match',
                  ['get', 'type'],
                  'WATER_POINT',
                  '#3b82f6',
                  'FIREBREAK',
                  '#f97316',
                  'WATCHTOWER',
                  '#8b5cf6',
                  'FOREST_ROAD',
                  '#78716c',
                  'HELIPAD',
                  '#06b6d4',
                  'STATION',
                  '#059669',
                  '#6b7280',
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </Source>

          {/* Retardant storage markers */}
          <Source id="retardant-source" type="geojson" data={retardantGeoJSON as GeoJSON.FeatureCollection}>
            <Layer
              id="retardant-layer"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': '#0d9488',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
          </Source>
        </ReactMapGL>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 start-4 z-[1000] max-w-[calc(100%-1.5rem)] rounded-2xl border border-border bg-surface p-3 shadow-elev-2 sm:p-4">
        <div className="mb-3 text-sm font-bold text-foreground">{t('truckStatuses')}</div>
        <div className="space-y-2">
          {(['Disponible', 'En route', 'En intervention'] as const).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <div className={STATUS_CSS_COLORS[status] || 'text-danger'}>
                <Icon name="truck" aria-hidden={true} size={20} />
              </div>
              <span className="text-sm text-foreground">{translateStatus(status)}</span>
            </div>
          ))}
        </div>

        {/* Resource legend */}
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: 'hsl(var(--success))' }} />
            <span className="text-xs text-muted-foreground">{t('tabEquipment')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: 'hsl(var(--info))' }} />
            <span className="text-xs text-muted-foreground">{t('tabInfrastructure')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: '#0d9488' }} />
            <span className="text-xs text-muted-foreground">{t('tabRetardant')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
