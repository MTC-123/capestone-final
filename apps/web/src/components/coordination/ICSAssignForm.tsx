'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { ICSRoleType, MoroccanAgency } from '@/types/coordination';

const AGENCIES: MoroccanAgency[] = [
  'DEF', 'PROTECTION_CIVILE', 'GENDARMERIE_ROYALE', 'FORCES_AUXILIAIRES',
  'FORCES_ROYALES_AIR', 'FAR', 'AUTORITES_LOCALES',
];

interface ICSAssignFormProps {
  incidentId: string;
  role: ICSRoleType;
  onClose: () => void;
  onSaved: () => void;
}

export function ICSAssignForm({ incidentId, role, onClose, onSaved }: ICSAssignFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [agency, setAgency] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/coordination/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId,
          role,
          assigneeName: name.trim(),
          assigneeAgency: agency || undefined,
          assigneePhone: phone || undefined,
          notes: notes || undefined,
        }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg space-y-3"
      >
        <h3 className="text-lg font-bold">{t('assign')} — {role.replace(/_/g, ' ')}</h3>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('agency')}</label>
          <select
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {AGENCIES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('phone')}</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? t('saving') : t('assign')}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
}
