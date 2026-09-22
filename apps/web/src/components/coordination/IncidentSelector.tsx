'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useCoordinationStore } from '@/store/useCoordinationStore';

interface Incident {
  id: string;
  status: string;
  cause: string;
  createdAt: string;
}

interface IncidentSelectorProps {
  value: string;
  onChange: (id: string) => void;
}

export function IncidentSelector({ value, onChange }: IncidentSelectorProps) {
  const { t } = useTranslation();
  const setSelectedIncidentId = useCoordinationStore((s) => s.setSelectedIncidentId);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth('/api/incidents?status=active&limit=50');
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents ?? data.data ?? []);
        }
      } catch {
        // silently ignore
      }
    }
    load();
  }, []);

  function handleChange(id: string) {
    onChange(id);
    setSelectedIncidentId(id || null);
  }

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{t('filterByIncident')}</label>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      >
        <option value="">{t('all')}</option>
        {incidents.map((inc) => (
          <option key={inc.id} value={inc.id}>
            {inc.cause} — {inc.status} ({new Date(inc.createdAt).toLocaleDateString()})
          </option>
        ))}
      </select>
    </div>
  );
}
