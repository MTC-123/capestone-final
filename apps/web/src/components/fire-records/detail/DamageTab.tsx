'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { TextField } from './FieldEditor';
import { SectionLockButton } from './SectionLockButton';
import { VEGETATION_TYPES } from '@/lib/fire-records/validation';
import type { DamageDetail, VegetationType } from '@/types/fire-record';

interface Props {
  recordId: string;
  data: DamageDetail | null;
  isLocked: boolean;
  isReadOnly: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
  onLocked: () => void;
}

export function DamageTab({ recordId, data, isLocked, isReadOnly, onSave, onLocked }: Props) {
  const { t } = useTranslation();
  const disabled = isLocked || isReadOnly;

  const [form, setForm] = useState<DamageDetail>({
    surfaceBurnedHa: data?.surfaceBurnedHa,
    vegetationTypes: data?.vegetationTypes ?? [],
    forestAreaHa: data?.forestAreaHa,
    infrastructureDamage: data?.infrastructureDamage,
    agricultureDamage: data?.agricultureDamage,
    propertyDamage: data?.propertyDamage,
    otherDamage: data?.otherDamage,
    totalEstimate: data?.totalEstimate,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      surfaceBurnedHa: data?.surfaceBurnedHa,
      vegetationTypes: data?.vegetationTypes ?? [],
      forestAreaHa: data?.forestAreaHa,
      infrastructureDamage: data?.infrastructureDamage,
      agricultureDamage: data?.agricultureDamage,
      propertyDamage: data?.propertyDamage,
      otherDamage: data?.otherDamage,
      totalEstimate: data?.totalEstimate,
    });
  }, [data]);

  const setNum = (field: keyof DamageDetail, val: string) => {
    setForm((f) => ({ ...f, [field]: val ? parseFloat(val) : undefined }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ damageDetail: form });
    } finally {
      setSaving(false);
    }
  };

  const toggleVegetation = (vt: VegetationType) => {
    setForm((f) => {
      const types = f.vegetationTypes ?? [];
      return {
        ...f,
        vegetationTypes: types.includes(vt)
          ? types.filter((v) => v !== vt)
          : [...types, vt],
      };
    });
  };

  return (
    <div className="space-y-4 p-4" data-testid="damage-tab" role="tabpanel" id="panel-damage">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t('tabDamage' as Parameters<typeof t>[0])}</h3>
        <SectionLockButton recordId={recordId} section="damage" isLocked={isLocked} disabled={isReadOnly} onLocked={onLocked} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label={t('surfaceBurnedHa' as Parameters<typeof t>[0])} value={form.surfaceBurnedHa != null ? String(form.surfaceBurnedHa) : ''} onChange={(v) => setNum('surfaceBurnedHa', v)} disabled={disabled} type="number" />
        <TextField label={t('forestAreaHa' as Parameters<typeof t>[0])} value={form.forestAreaHa != null ? String(form.forestAreaHa) : ''} onChange={(v) => setNum('forestAreaHa', v)} disabled={disabled} type="number" />
        <TextField label={t('infrastructureDamage' as Parameters<typeof t>[0])} value={form.infrastructureDamage != null ? String(form.infrastructureDamage) : ''} onChange={(v) => setNum('infrastructureDamage', v)} disabled={disabled} type="number" />
        <TextField label={t('agricultureDamage' as Parameters<typeof t>[0])} value={form.agricultureDamage != null ? String(form.agricultureDamage) : ''} onChange={(v) => setNum('agricultureDamage', v)} disabled={disabled} type="number" />
        <TextField label={t('propertyDamage' as Parameters<typeof t>[0])} value={form.propertyDamage != null ? String(form.propertyDamage) : ''} onChange={(v) => setNum('propertyDamage', v)} disabled={disabled} type="number" />
        <TextField label={t('otherDamage' as Parameters<typeof t>[0])} value={form.otherDamage != null ? String(form.otherDamage) : ''} onChange={(v) => setNum('otherDamage', v)} disabled={disabled} type="number" />
        <TextField label={t('totalEstimate' as Parameters<typeof t>[0])} value={form.totalEstimate != null ? String(form.totalEstimate) : ''} onChange={(v) => setNum('totalEstimate', v)} disabled={disabled} type="number" />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t('vegetationTypes' as Parameters<typeof t>[0])}</p>
        <div className="flex flex-wrap gap-2">
          {VEGETATION_TYPES.map((vt) => (
            <button
              key={vt}
              type="button"
              disabled={disabled}
              onClick={() => toggleVegetation(vt as VegetationType)}
              className={[
                'rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
                (form.vegetationTypes ?? []).includes(vt as VegetationType)
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-primary',
                disabled ? 'opacity-50' : '',
              ].join(' ')}
            >
              {t(`veg${vt}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {!disabled && (
        <button onClick={handleSave} disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {saving ? t('loading') : t('save' as Parameters<typeof t>[0])}
        </button>
      )}
    </div>
  );
}
