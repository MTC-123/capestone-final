'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { CommLogCategory, MoroccanAgency, CommLogEntry } from '@/types/coordination';

const CATEGORIES: CommLogCategory[] = [
  'GENERAL', 'ALERT_SENT', 'ORDER_GIVEN', 'STATUS_UPDATE',
  'RESOURCE_REQUEST', 'ESCALATION', 'DE_ESCALATION', 'AVIATION_REQUEST', 'MUTUAL_AID',
];

const AGENCIES: MoroccanAgency[] = [
  'DEF', 'PROTECTION_CIVILE', 'GENDARMERIE_ROYALE', 'FORCES_AUXILIAIRES',
  'FORCES_ROYALES_AIR', 'FAR', 'AUTORITES_LOCALES',
];

export function CommLogForm() {
  const { t } = useTranslation();
  const prependEntry = useCoordinationStore((s) => s.prependCommLogEntry);
  const selectedIncidentId = useCoordinationStore((s) => s.selectedIncidentId);
  const [category, setCategory] = useState<CommLogCategory>('GENERAL');
  const [fromAgency, setFromAgency] = useState<string>('');
  const [toAgency, setToAgency] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetchWithAuth('/api/coordination/comm-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          fromAgency: fromAgency || undefined,
          toAgency: toAgency || undefined,
          incidentId: selectedIncidentId || undefined,
          message: message.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        prependEntry(data.entry as CommLogEntry);
        setMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('messageCategory')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CommLogCategory)}
            className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('fromAgency')}</label>
          <select
            value={fromAgency}
            onChange={(e) => setFromAgency(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {AGENCIES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">{t('toAgency')}</label>
          <select
            value={toAgency}
            onChange={(e) => setToAgency(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {AGENCIES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('sendMessage')}
        rows={2}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
      <Button variant="primary" type="submit" disabled={sending || !message.trim()}>
        {sending ? t('sending') : t('sendMessage')}
      </Button>
    </form>
  );
}
