'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TextField, SelectField } from './FieldEditor';
import { SectionLockButton } from './SectionLockButton';
import { CAUSE_CERTAINTIES, CAUSE_CATEGORIES } from '@/lib/fire-records/validation';
import type { CauseDetail } from '@/types/fire-record';

interface Props {
  recordId: string;
  data: CauseDetail | null;
  isLocked: boolean;
  isReadOnly: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onLocked: () => void;
}

export function CauseTab({ recordId, data, isLocked, isReadOnly, onSave, onLocked }: Props) {
  const { t } = useTranslation();
  const disabled = isLocked || isReadOnly;

  const [form, setForm] = useState<CauseDetail>({
    investigatedCause: data?.investigatedCause ?? '',
    certainty: data?.certainty,
    category: data?.category,
    notes: data?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      investigatedCause: data?.investigatedCause ?? '',
      certainty: data?.certainty,
      category: data?.category,
      notes: data?.notes ?? '',
    });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ causeDetail: form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4" data-testid="cause-tab" role="tabpanel" id="panel-cause">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t('tabCause' as Parameters<typeof t>[0])}</h3>
        <SectionLockButton
          recordId={recordId}
          section="cause"
          isLocked={isLocked}
          disabled={isReadOnly}
          onLocked={onLocked}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label={t('causeCategory' as Parameters<typeof t>[0])}
          value={form.category ?? ''}
          options={CAUSE_CATEGORIES.map((c) => ({ value: c, label: t(`cause${c}` as Parameters<typeof t>[0]) }))}
          onChange={(v) => setForm((f) => ({ ...f, category: v as CauseDetail['category'] }))}
          disabled={disabled}
        />
        <SelectField
          label={t('causeCertainty' as Parameters<typeof t>[0])}
          value={form.certainty ?? ''}
          options={CAUSE_CERTAINTIES.map((c) => ({ value: c, label: t(`certainty${c}` as Parameters<typeof t>[0]) }))}
          onChange={(v) => setForm((f) => ({ ...f, certainty: v as CauseDetail['certainty'] }))}
          disabled={disabled}
        />
        <TextField
          label={t('investigatedCause' as Parameters<typeof t>[0])}
          value={form.investigatedCause ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, investigatedCause: v }))}
          disabled={disabled}
        />
        <TextField
          label={t('notes' as Parameters<typeof t>[0])}
          value={form.notes ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          disabled={disabled}
          type="textarea"
        />
      </div>

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
