'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TextField } from './FieldEditor';
import { SectionLockButton } from './SectionLockButton';
import type { LocationDetail } from '@/types/fire-record';

interface Props {
  recordId: string;
  data: LocationDetail | null;
  burnAreaHa: number | null;
  isLocked: boolean;
  isReadOnly: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onLocked: () => void;
}

export function LocationTab({ recordId, data, burnAreaHa, isLocked, isReadOnly, onSave, onLocked }: Props) {
  const { t } = useTranslation();
  const disabled = isLocked || isReadOnly;

  const [form, setForm] = useState<LocationDetail>({
    commune: data?.commune ?? '',
    dpeflcd: data?.dpeflcd ?? '',
    district: data?.district ?? '',
    triage: data?.triage ?? '',
    locationName: data?.locationName ?? '',
    coordinates: data?.coordinates,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      commune: data?.commune ?? '',
      dpeflcd: data?.dpeflcd ?? '',
      district: data?.district ?? '',
      triage: data?.triage ?? '',
      locationName: data?.locationName ?? '',
      coordinates: data?.coordinates,
    });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ locationDetail: form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4" data-testid="location-tab" role="tabpanel" id="panel-location">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t('tabLocation' as Parameters<typeof t>[0])}</h3>
        <SectionLockButton
          recordId={recordId}
          section="location"
          isLocked={isLocked}
          disabled={isReadOnly}
          onLocked={onLocked}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          label={t('locationName' as Parameters<typeof t>[0])}
          value={form.locationName ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, locationName: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('commune' as Parameters<typeof t>[0])}
          value={form.commune ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, commune: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('dpeflcd' as Parameters<typeof t>[0])}
          value={form.dpeflcd ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, dpeflcd: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('district' as Parameters<typeof t>[0])}
          value={form.district ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, district: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('triage' as Parameters<typeof t>[0])}
          value={form.triage ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, triage: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('fireRecordBurnArea')}
          value={burnAreaHa != null ? String(burnAreaHa) : ''}
          onChange={() => {}}
          disabled
          type="number"
        />
      </div>

      {form.coordinates && (
        <p className="text-xs text-muted-foreground">
          {t('coordinates' as Parameters<typeof t>[0])}: {form.coordinates[1].toFixed(5)}, {form.coordinates[0].toFixed(5)}
        </p>
      )}

      {!disabled && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t('loading') : t('save' as Parameters<typeof t>[0])}
        </button>
      )}
    </div>
  );
}
