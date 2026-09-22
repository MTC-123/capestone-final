'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import dynamic from 'next/dynamic';
import type { TruckDeployment } from '@/types';
import { Card } from '@/components/ui/Card';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { TRUCK_STATUS_COLORS } from '@/lib/map/colors';
import DispatchTruckDialog from '@/components/equipment/DispatchTruckDialog';
import { EquipmentSection } from '@/components/equipment/EquipmentSection';
import { RetardantSection } from '@/components/equipment/RetardantSection';
import { InfrastructureSection } from '@/components/equipment/InfrastructureSection';

function TruckMapLoading() {
  const { t } = useTranslation();
  return (
    <div className="h-[300px] md:h-[400px] flex items-center justify-center bg-muted rounded-lg">
      {t('loadingMap')}
    </div>
  );
}

const TruckMap = dynamic(
  () => import('@/components/equipment/TruckMap'),
  {
    ssr: false,
    loading: () => <TruckMapLoading />,
  }
);

export default function EquipmentPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { t, language } = useTranslation();
  const {
    fetchEquipment,
    fetchRetardant,
    fetchInfrastructure,
  } = useEquipmentStore();

  const [truckDeployments, setTruckDeployments] = useState<TruckDeployment[]>([]);
  const [trucksLoading, setTrucksLoading] = useState(true);
  const [dispatchTruck, setDispatchTruck] = useState<TruckDeployment | null>(null);

  const isRTL = language === 'ar';
  const textAlign = isRTL ? 'text-right' : 'text-left';

  // Fetch trucks separately (not part of the new CRUD overhaul)
  const loadTrucks = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/equipment?type=trucks');
      if (res.ok) {
        const result = await res.json();
        setTruckDeployments(result.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setTrucksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'OFFICIAL') {
      router.push('/map');
      return;
    }
    fetchEquipment();
    fetchRetardant();
    fetchInfrastructure();
    loadTrucks();
  }, [fetchEquipment, fetchRetardant, fetchInfrastructure, loadTrucks, router, user?.role]);

  if (user?.role !== 'OFFICIAL') return null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8 page-enter">
      <div>
        <h1 className={`text-fluid-3xl font-bold text-foreground mb-1 ${textAlign}`}>
          {t('equipmentTitle')}
        </h1>
        <p className={`text-sm text-muted-foreground ${textAlign}`}>{t('equipmentDesc')}</p>
      </div>

      {/* Truck Status Summary */}
      {!trucksLoading && truckDeployments.length > 0 && (() => {
        const counts = truckDeployments.reduce<Record<string, number>>((acc, truck) => {
          acc[truck.status] = (acc[truck.status] || 0) + 1;
          return acc;
        }, {});
        const statusItems = [
          { status: 'Disponible', key: 'available' as const, color: TRUCK_STATUS_COLORS['Disponible'] || '#22c55e' },
          { status: 'En route', key: 'enRoute' as const, color: TRUCK_STATUS_COLORS['En route'] || '#f59e0b' },
          { status: 'En intervention', key: 'onScene' as const, color: TRUCK_STATUS_COLORS['En intervention'] || '#ef4444' },
        ];
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 sm:gap-4">
            {statusItems.map(({ status, key, color }) => (
              <div key={status} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-semibold">{counts[status] || 0}</span>
                <span className="text-muted-foreground">{t(key)}</span>
              </div>
            ))}
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2 text-sm font-bold">
              <span>{truckDeployments.length}</span>
              <span className="text-muted-foreground">{t('totalLabel')}</span>
            </div>
          </div>
        );
      })()}

      {/* Truck Deployment Map */}
      {!trucksLoading && truckDeployments.length > 0 && (
        <Card tone="elevated" className="p-4 sm:p-6">
          <h2 className={`text-2xl font-bold mb-4 ${textAlign}`}>{t('truckDeploymentMap')}</h2>
          <TruckMap trucks={truckDeployments} onDispatch={setDispatchTruck} />
        </Card>
      )}

      {dispatchTruck && (
        <DispatchTruckDialog
          truck={dispatchTruck}
          open={!!dispatchTruck}
          onClose={() => setDispatchTruck(null)}
        />
      )}

      {/* CRUD sections */}
      <EquipmentSection />
      <RetardantSection />
      <InfrastructureSection />
    </div>
  );
}
