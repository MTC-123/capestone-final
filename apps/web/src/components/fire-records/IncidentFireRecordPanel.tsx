'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { RecordStatusBadge } from './RecordStatusBadge';
import { Button } from '@/components/ui/Button';
import type { FireEventRecord } from '@/types';

interface Props {
  incidentId: string;
}

export function IncidentFireRecordPanel({ incidentId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [record, setRecord] = useState<FireEventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/fire-records?search=${incidentId}&limit=1`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.length > 0) {
        setRecord(json.data[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/fire-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId }),
      });
      if (res.ok) {
        const created = await res.json();
        setRecord(created);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="p-3 text-xs text-muted-foreground">{t('loading')}</div>;
  }

  if (!record) {
    if (user?.role !== 'OFFICIAL') return null;

    return (
      <div className="border-t border-border p-3" data-testid="fire-record-panel">
        <Button variant="primary" className="w-full" onClick={handleCreate} disabled={creating} isLoading={creating}>
          {creating ? t('creating') : t('fireRecordCreateFromIncident')}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-3 space-y-2" data-testid="fire-record-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{t('fireDatabase')}</span>
        <RecordStatusBadge status={record.recordStatus} />
      </div>

      {record.burnAreaHa != null && (
        <div className="text-xs">
          <span className="text-muted-foreground">{t('fireRecordBurnArea')}:</span>{' '}
          <span className="font-medium">{record.burnAreaHa} ha</span>
        </div>
      )}

      <div className="text-xs">
        <span className="text-muted-foreground">{t('fireRecordLockedSections')}:</span>{' '}
        <span className="font-medium">{record.lockedSections.length} / 5</span>
      </div>

      <Link
        href={`/fire-database/${record.id}`}
        className="block text-center text-xs font-medium text-primary hover:underline"
      >
        {t('fireRecordViewFull')}
      </Link>
    </div>
  );
}
