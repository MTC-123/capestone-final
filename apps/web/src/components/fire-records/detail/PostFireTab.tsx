'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TextField, SelectField } from './FieldEditor';
import { SectionLockButton } from './SectionLockButton';
import { SEVERITY_ASSESSMENTS, RECOVERY_STATUSES } from '@/lib/fire-records/validation';
import type { PostFireDetail } from '@/types/fire-record';

interface Props {
  recordId: string;
  data: PostFireDetail | null;
  isLocked: boolean;
  isReadOnly: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onLocked: () => void;
}

export function PostFireTab({ recordId, data, isLocked, isReadOnly, onSave, onLocked }: Props) {
  const { t } = useTranslation();
  const disabled = isLocked || isReadOnly;

  const [form, setForm] = useState<PostFireDetail>({
    severityAssessment: data?.severityAssessment,
    rehabilitationPlan: data?.rehabilitationPlan ?? '',
    recoveryStatus: data?.recoveryStatus,
    notes: data?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      severityAssessment: data?.severityAssessment,
      rehabilitationPlan: data?.rehabilitationPlan ?? '',
      recoveryStatus: data?.recoveryStatus,
      notes: data?.notes ?? '',
    });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ postFire: form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4" data-testid="postfire-tab" role="tabpanel" id="panel-postFire">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t('tabPostFire' as Parameters<typeof t>[0])}</h3>
        <SectionLockButton recordId={recordId} section="postFire" isLocked={isLocked} disabled={isReadOnly} onLocked={onLocked} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label={t('severityAssessment' as Parameters<typeof t>[0])}
          value={form.severityAssessment ?? ''}
          options={SEVERITY_ASSESSMENTS.map((s) => ({ value: s, label: t(`severity${s}` as Parameters<typeof t>[0]) }))}
          onChange={(v) => setForm((f) => ({ ...f, severityAssessment: v as PostFireDetail['severityAssessment'] }))}
          disabled={disabled}
        />
        <SelectField
          label={t('recoveryStatus' as Parameters<typeof t>[0])}
          value={form.recoveryStatus ?? ''}
          options={RECOVERY_STATUSES.map((s) => ({ value: s, label: t(`recovery${s}` as Parameters<typeof t>[0]) }))}
          onChange={(v) => setForm((f) => ({ ...f, recoveryStatus: v as PostFireDetail['recoveryStatus'] }))}
          disabled={disabled}
        />
        <TextField
          label={t('rehabilitationPlan' as Parameters<typeof t>[0])}
          value={form.rehabilitationPlan ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, rehabilitationPlan: v }))}
          disabled={disabled}
          type="textarea"
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
        <button onClick={handleSave} disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {saving ? t('loading') : t('save' as Parameters<typeof t>[0])}
        </button>
      )}
    </div>
  );
}
