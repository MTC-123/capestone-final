'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import dynamic from 'next/dynamic';
import type { TruckDeployment } from '@/types';
import { Card } from '@/components/ui/Card';
import { PageContainer, PageHeader } from '@/components/ui/PageHeader';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import DispatchTruckDialog from '@/components/equipment/DispatchTruckDialog';
import { EquipmentSection } from '@/components/equipment/EquipmentSection';
import { RetardantSection } from '@/components/equipment/RetardantSection';
import { InfrastructureSection } from '@/components/equipment/InfrastructureSection';

function TruckMapLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl bg-surface-2 md:h-[400px]">
      <SkeletonBox className="h-full w-full" />
      <span className="sr-only">{t('loadingMap')}</span>
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

const STATUS_TONE_CLASSES = {
  available: 'bg-success',
  enRoute: 'bg-warning',
  onScene: 'bg-danger',
} as const;

export default function EquipmentPage() {
  const user = useAuthStore((state) => state.user);
  const { t } = useTranslation();
  const {
    fetchEquipment,
    fetchRetardant,
    fetchInfrastructure,
  } = useEquipmentStore();

  const [truckDeployments, setTruckDeployments] = useState<TruckDeployment[]>([]);
  const [trucksLoading, setTrucksLoading] = useState(true);
  const [dispatchTruck, setDispatchTruck] = useState<TruckDeployment | null>(null);

  const isOfficial = user?.role === 'OFFICIAL';

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
    if (!isOfficial) return;
    fetchEquipment();
    fetchRetardant();
    fetchInfrastructure();
    loadTrucks();
  }, [fetchEquipment, fetchRetardant, fetchInfrastructure, loadTrucks, isOfficial]);

  if (!isOfficial) return <AccessDenied />;

  return (
    <PageContainer wide className="space-y-6 pb-10 page-enter md:space-y-8">
      <PageHeader title={t('equipmentTitle')} description={t('equipmentDesc')} />

      {/* Truck Status Summary */}
      {!trucksLoading && truckDeployments.length > 0 && (() => {
        const counts = truckDeployments.reduce<Record<string, number>>((acc, truck) => {
          acc[truck.status] = (acc[truck.status] || 0) + 1;
          return acc;
        }, {});
        const statusItems = [
          { status: 'Disponible', key: 'available' as const },
          { status: 'En route', key: 'enRoute' as const },
          { status: 'En intervention', key: 'onScene' as const },
        ];
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 sm:gap-4">
            {statusItems.map(({ status, key }) => (
              <div key={status} className="flex items-center gap-2 text-sm">
                <span className={`h-3 w-3 shrink-0 rounded-full ${STATUS_TONE_CLASSES[key]}`} />
                <span className="font-mono font-semibold tabular">{counts[status] || 0}</span>
                <span className="text-muted-foreground">{t(key)}</span>
              </div>
            ))}
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="font-mono tabular">{truckDeployments.length}</span>
              <span className="text-muted-foreground">{t('totalLabel')}</span>
            </div>
          </div>
        );
      })()}

      {/* Truck Deployment Map */}
      {!trucksLoading && truckDeployments.length > 0 && (
        <Card tone="elevated" className="p-4 sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-start">{t('truckDeploymentMap')}</h2>
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
    </PageContainer>
  );
}
