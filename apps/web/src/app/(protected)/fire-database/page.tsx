'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { PageContainer, PageHeader } from '@/components/ui/PageHeader';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { FireDatabaseKpis } from '@/components/fire-records/FireDatabaseKpis';
import { FireRecordFiltersV2 } from '@/components/fire-records/FireRecordFiltersV2';
import { FireRecordTableV2 } from '@/components/fire-records/FireRecordTableV2';
import dynamic from 'next/dynamic';

// OpenLayers is only loaded when the historical map is chosen.
const FireRecordMapView = dynamic(() => import('@/components/fire-records/FireRecordMapView'), {
  ssr: false,
  loading: () => <SkeletonBox className="h-[500px] w-full rounded-2xl" />,
});
import { ComparisonBar } from '@/components/fire-records/ComparisonBar';
import { ComparisonView } from '@/components/fire-records/ComparisonView';
import { ImportFirmsDialog } from '@/components/fire-records/ImportFirmsDialog';

export default function FireDatabasePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { fetchRecords, reset, viewMode, setViewMode, comparisonRecords } = useFireRecordStore();
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const isOfficial = user?.role === 'OFFICIAL';

  useEffect(() => {
    if (!isOfficial) return;
    fetchRecords();
    return () => reset();
  }, [fetchRecords, reset, isOfficial]);

  const handleExport = async (format: 'csv' | 'geojson') => {
    const res = await fetch(`/api/fire-records/export?format=${format}`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire-records.${format === 'geojson' ? 'geojson' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOfficial) return <AccessDenied />;

  return (
    <PageContainer wide className="pb-10 page-enter">
      <PageHeader
        title={t('fireDatabaseTitle')}
        description={t('fireDatabaseDesc')}
        actions={viewMode === 'table' ?
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
            <ImportFirmsDialog />
            <Button
              variant="secondary"
              onClick={() => handleExport('csv')}
              data-testid="export-csv"
            >
              <Icon name="download" size={16} aria-hidden />
              {t('fireRecordExportCSV')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExport('geojson')}
              data-testid="export-geojson"
            >
              <Icon name="download" size={16} aria-hidden />
              {t('fireRecordExportGeoJSON')}
            </Button>
          </div>
        : null}
      />

      <div className="space-y-4">
        {viewMode === 'table' ? <FireDatabaseKpis /> : <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground">Historical map · Ifrane Province</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setMapFiltersOpen(!mapFiltersOpen)}>{mapFiltersOpen ? 'Hide filters' : 'Filter records'}</Button><Button variant="secondary" onClick={() => setViewMode('table')}>Table view</Button></div>
        </div>}

        {(viewMode === 'table' || mapFiltersOpen) && <FireRecordFiltersV2 />}

        {/* Comparison bar */}
        <ComparisonBar />

        {/* Comparison view (when loaded) */}
        {comparisonRecords.length > 0 && <ComparisonView />}

        {/* Main content area */}
        {viewMode === 'table' ? <div className="rounded-2xl border border-border/60 bg-surface shadow-elev-1"><FireRecordTableV2 /></div> : <FireRecordMapView />}
      </div>
    </PageContainer>
  );
}
