'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { RecordStatusBadge } from '@/components/fire-records/RecordStatusBadge';
import { FireRecordDetailTabs } from '@/components/fire-records/detail/FireRecordDetailTabs';
import { FireRecordActionBar } from '@/components/fire-records/detail/FireRecordActionBar';
import { LocationTab } from '@/components/fire-records/detail/LocationTab';
import { CauseTab } from '@/components/fire-records/detail/CauseTab';
import { DamageTab } from '@/components/fire-records/detail/DamageTab';
import { ResponseTab } from '@/components/fire-records/detail/ResponseTab';
import { PostFireTab } from '@/components/fire-records/detail/PostFireTab';
import { AuditTrailTab } from '@/components/fire-records/detail/AuditTrailTab';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { RightDrawer } from '@/components/shell/RightDrawer';
import { EquipmentAuditForm } from '@/components/forms/EquipmentAuditForm';
import { DebriefingForm } from '@/components/forms/DebriefingForm';
import type { LocationDetail, CauseDetail, DamageDetail, ResponseDetail, WeatherAtTime, PostFireDetail } from '@/types/fire-record';
import type { AuditEntry } from '@/types';

export default function FireRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { activeRecord, isLoading, fetchRecord } = useFireRecordStore();
  const [activeTab, setActiveTab] = useState('location');
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [debriefDrawerOpen, setDebriefDrawerOpen] = useState(false);
  const [debriefId, setDebriefId] = useState<string | null>(null);
  const [debriefReadOnly, setDebriefReadOnly] = useState(false);
  const [debriefChecked, setDebriefChecked] = useState(false);

  useEffect(() => {
    if (id) fetchRecord(id);
  }, [id, fetchRecord]);

  // Check if debriefing exists for this fire record
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/debriefings?fireRecordId=${id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json.data?.id) {
          setDebriefId(json.data.id);
        }
      } finally {
        if (!cancelled) setDebriefChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleRefresh = useCallback(() => {
    if (id) fetchRecord(id);
  }, [id, fetchRecord]);

  const handleSave = useCallback(async (fields: Record<string, unknown>) => {
    if (!id) return;
    const res = await fetch(`/api/fire-records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (res.ok) handleRefresh();
  }, [id, handleRefresh]);

  if (isLoading || !activeRecord) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const isReadOnly = activeRecord.recordStatus === 'LOCKED' || user?.role !== 'OFFICIAL';
  const locData = activeRecord.locationDetail as LocationDetail | null;
  const displayTitle = buildDisplayTitle(activeRecord, locData);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t('fireDatabase'), href: '/fire-database' },
          { label: displayTitle },
        ]}
      />

      {/* Header */}
      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <RecordStatusBadge status={activeRecord.recordStatus} />
        <span className="text-sm text-muted-foreground">
          {activeRecord.lockedSections.length}/5 {t('fireRecordLockedSections')}
        </span>
        {user?.role === 'OFFICIAL' && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAuditDrawerOpen(true)}
            >
              <Icon name="clipboard" size={16} aria-hidden />
              Audit matériel
            </Button>
            {debriefChecked && (activeRecord.containedAt || activeRecord.extinguishedAt || activeRecord.recordStatus !== 'DRAFT') && (
              debriefId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setDebriefReadOnly(true); setDebriefDrawerOpen(true); }}
                >
                  <Icon name="eye" size={16} aria-hidden />
                  Voir débriefing
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { setDebriefReadOnly(false); setDebriefDrawerOpen(true); }}
                >
                  <Icon name="list" size={16} aria-hidden />
                  Débriefing / REX
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <FireRecordDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lockedSections={activeRecord.lockedSections}
      />

      {/* Tab panels */}
      <div className="mt-4 rounded-lg border border-border bg-surface shadow-sm">
        {activeTab === 'location' && (
          <LocationTab
            recordId={activeRecord.id}
            data={locData}
            burnAreaHa={activeRecord.burnAreaHa ?? null}
            isLocked={activeRecord.lockedSections.includes('location')}
            isReadOnly={isReadOnly}
            onSave={handleSave}
            onLocked={handleRefresh}
          />
        )}
        {activeTab === 'cause' && (
          <CauseTab
            recordId={activeRecord.id}
            data={activeRecord.causeDetail as CauseDetail | null}
            isLocked={activeRecord.lockedSections.includes('cause')}
            isReadOnly={isReadOnly}
            onSave={handleSave}
            onLocked={handleRefresh}
          />
        )}
        {activeTab === 'damage' && (
          <DamageTab
            recordId={activeRecord.id}
            data={activeRecord.damageDetail as DamageDetail | null}
            isLocked={activeRecord.lockedSections.includes('damage')}
            isReadOnly={isReadOnly}
            onSave={handleSave}
            onLocked={handleRefresh}
          />
        )}
        {activeTab === 'response' && (
          <ResponseTab
            recordId={activeRecord.id}
            record={activeRecord}
            responseData={activeRecord.responseDetail as ResponseDetail | null}
            weatherData={activeRecord.weatherAtTime as WeatherAtTime | null}
            isLocked={activeRecord.lockedSections.includes('response')}
            isReadOnly={isReadOnly}
            onSave={handleSave}
            onLocked={handleRefresh}
          />
        )}
        {activeTab === 'postFire' && (
          <PostFireTab
            recordId={activeRecord.id}
            data={activeRecord.postFire as PostFireDetail | null}
            isLocked={activeRecord.lockedSections.includes('postFire')}
            isReadOnly={isReadOnly}
            onSave={handleSave}
            onLocked={handleRefresh}
          />
        )}
        {activeTab === 'audit' && (
          <AuditTrailTab entries={activeRecord.auditTrail as AuditEntry[]} />
        )}
      </div>

      {/* Action bar */}
      {user?.role === 'OFFICIAL' && activeRecord.recordStatus !== 'LOCKED' && (
        <div className="mt-4">
          <FireRecordActionBar
            recordId={activeRecord.id}
            status={activeRecord.recordStatus}
            lockedSections={activeRecord.lockedSections}
            onStatusChange={handleRefresh}
          />
        </div>
      )}

      {/* Equipment Audit Drawer */}
      <RightDrawer
        title="Audit du matériel"
        open={auditDrawerOpen}
        onOpenChange={setAuditDrawerOpen}
        className="sm:w-[560px]"
      >
        <EquipmentAuditForm
          fireRecordId={activeRecord.id}
          defaultLocation={{
            dpeflcd: locData?.dpeflcd ?? '',
          }}
          onSuccess={() => setAuditDrawerOpen(false)}
          onCancel={() => setAuditDrawerOpen(false)}
        />
      </RightDrawer>

      {/* Debriefing Drawer */}
      <RightDrawer
        title={debriefId ? 'Débriefing / REX' : 'Nouveau débriefing'}
        open={debriefDrawerOpen}
        onOpenChange={setDebriefDrawerOpen}
        className="sm:w-[560px]"
      >
        {debriefDrawerOpen && (
          <>
            {debriefReadOnly && debriefId && (
              <div className="px-4 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDebriefReadOnly(false)}
                >
                  Modifier
                </Button>
              </div>
            )}
            <DebriefingForm
              fireRecordId={activeRecord.id}
              existingId={debriefId}
              readOnly={debriefReadOnly}
              defaultValues={{
                superficieIncendiee: activeRecord.burnAreaHa,
              }}
              onSuccess={() => {
                setDebriefDrawerOpen(false);
                // Refresh debriefing ID
                fetch(`/api/debriefings?fireRecordId=${activeRecord.id}`)
                  .then((r) => r.json())
                  .then((json) => { if (json.data?.id) setDebriefId(json.data.id); })
                  .catch(() => {});
              }}
              onCancel={() => setDebriefDrawerOpen(false)}
            />
          </>
        )}
      </RightDrawer>
    </div>
  );
}

function buildDisplayTitle(
  record: { alertReceivedAt?: string | null; createdAt: string; burnAreaHa?: number | null },
  loc: LocationDetail | null
): string {
  const date = record.alertReceivedAt ?? record.createdAt;
  const dateStr = new Date(date).toISOString().slice(0, 10);
  const locName = loc?.locationName ?? loc?.commune ?? '';
  const size = record.burnAreaHa != null ? `${record.burnAreaHa} ha` : '';
  return [dateStr, locName, size].filter(Boolean).join(' — ');
}
