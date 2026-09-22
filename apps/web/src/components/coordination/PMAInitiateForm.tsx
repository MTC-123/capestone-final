'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';

interface PMAInitiateFormProps {
  incidentId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PMAInitiateForm({ incidentId, onClose, onSaved }: PMAInitiateFormProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/coordination/pma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, notes: notes || undefined }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <h3 className="font-bold text-sm">{t('pmaInitiate')}</h3>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">{t('notes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? t('saving') : t('pmaInitiate')}
        </Button>
        <Button variant="secondary" type="button" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
