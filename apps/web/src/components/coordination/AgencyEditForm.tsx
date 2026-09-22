'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { AgencyStatusRecord, AgencyPresenceStatus } from '@/types/coordination';

const STATUS_OPTIONS: AgencyPresenceStatus[] = ['ONLINE', 'OFFLINE', 'STANDBY'];

interface AgencyEditFormProps {
  agency: AgencyStatusRecord;
  onClose: () => void;
}

export function AgencyEditForm({ agency, onClose }: AgencyEditFormProps) {
  const { t } = useTranslation();
  const fetchAgencies = useCoordinationStore((s) => s.fetchAgencies);
  const [status, setStatus] = useState(agency.status);
  const [unitsAvailable, setUnitsAvailable] = useState(agency.unitsAvailable);
  const [unitsDeployed, setUnitsDeployed] = useState(agency.unitsDeployed);
  const [notes, setNotes] = useState(agency.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/coordination/agencies/${agency.agency}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, unitsAvailable, unitsDeployed, notes: notes || undefined }),
      });
      if (res.ok) {
        await fetchAgencies();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('status')}</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AgencyPresenceStatus)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('unitsAvailable')}</label>
          <input
            type="number"
            min={0}
            value={unitsAvailable}
            onChange={(e) => setUnitsAvailable(parseInt(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('unitsDeployed')}</label>
          <input
            type="number"
            min={0}
            value={unitsDeployed}
            onChange={(e) => setUnitsDeployed(parseInt(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('notes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
