'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

const PROVINCES = ['Ifrane', 'Fes', 'Meknes', 'Khenifra', 'Sefrou', 'Boulemane', 'El Hajeb'];

interface MutualAidFormProps {
  incidentId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function MutualAidForm({ incidentId, onClose, onSaved }: MutualAidFormProps) {
  const { t } = useTranslation();
  const [targetProvince, setTargetProvince] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetProvince || !resourceType || !justification.trim()) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/coordination/mutual-aid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId,
          requestingProvince: 'Ifrane',
          targetProvince,
          resourceType,
          justification: justification.trim(),
        }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <h3 className="font-bold text-sm">{t('mutualAidRequest')}</h3>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('targetProvince')}</label>
        <select
          value={targetProvince}
          onChange={(e) => setTargetProvince(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          required
        >
          <option value="">—</option>
          {PROVINCES.filter((p) => p !== 'Ifrane').map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('resourceType')}</label>
        <input
          type="text"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          placeholder={t('resourceType')}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('justification')}</label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          required
        />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? t('saving') : t('submit')}
        </Button>
        <Button variant="secondary" type="button" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
