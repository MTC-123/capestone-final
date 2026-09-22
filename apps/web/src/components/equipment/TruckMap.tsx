'use client';

import { useState, useCallback, useMemo } from 'react';
import ReactMapGL, { Marker, Popup, Source, Layer } from 'react-map-gl';
import type { MapLayerMouseEvent } from 'react-map-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IFRANE_COORDINATES } from '@/config/constants';
import type { TruckDeployment } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { getMapStyle } from '@/lib/map/styles';
import { TRUCK_STATUS_COLORS } from '@/lib/map/colors';
import { useTranslation } from '@/hooks/useTranslation';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_TRANSLATION_MAP: Record<string, TranslationKey> = {
  'Disponible': 'available',
  'En route': 'enRoute',
  'En intervention': 'onScene',
};

const STATUS_CSS_COLORS: Record<string, string> = {
  'Disponible': 'text-green-600',
  'En route': 'text-orange-600',
  'En intervention': 'text-red-600',
};

const truckColor = (status: string) => {
  return TRUCK_STATUS_COLORS[status] || '#ef4444';
};

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2">
          <Icon name="mapPin" size={16} aria-hidden />
          {t('pickOnMap' as TranslationKey)}
          <button
            type="button"
            onClick={stopPicking}
            className="ml-2 opacity-80 hover:opacity-100"
          >
            <Icon name="close" size={16} aria-hidden />
          </button>
        </div>
      )}

      <div className="h-[300px] sm:h-[400px] md:h-[500px] rounded-lg shadow-[0_10px_25px_-5px_rgb(0_0_0/0.1)] overflow-hidden">
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
                          className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
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
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white p-3 sm:p-4 shadow-lg max-w-[calc(100%-1.5rem)]">
        <div className="mb-3 text-sm font-bold">{t('truckStatuses')}</div>
        <div className="space-y-2">
          {(['Disponible', 'En route', 'En intervention'] as const).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <div className={STATUS_CSS_COLORS[status] || 'text-red-600'}>
                <Icon name="truck" aria-hidden={true} size={20} />
              </div>
              <span className="text-sm">{translateStatus(status)}</span>
            </div>
          ))}
        </div>

        {/* Resource legend */}
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#22c55e] border border-white shadow-sm" />
            <span className="text-xs text-gray-600">{t('tabEquipment')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#3b82f6] border border-white shadow-sm" />
            <span className="text-xs text-gray-600">{t('tabInfrastructure')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#0d9488] border border-white shadow-sm" />
            <span className="text-xs text-gray-600">{t('tabRetardant')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
