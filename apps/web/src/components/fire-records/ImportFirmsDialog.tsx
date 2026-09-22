'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFireRecordStore } from '@/store/useFireRecordStore';
import { Button } from '@/components/ui/Button';

export function ImportFirmsDialog() {
  const { t } = useTranslation();
  const { fetchRecords, fetchStats } = useFireRecordStore();
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Fetch recent FIRMS detections for the region
      const detRes = await fetch('/api/firms/detections');
      if (!detRes.ok) throw new Error('Failed to fetch FIRMS detections');
      const detJson = await detRes.json();

      const features = detJson.features ?? detJson.data ?? [];
      if (features.length === 0) {
        setError(t('noDetectionsToImport' as Parameters<typeof t>[0]));
        setImporting(false);
        return;
      }

      // Map GeoJSON features to detection format
      const detections = features.slice(0, 20).map((f: {
        geometry?: { coordinates?: [number, number] };
        properties?: Record<string, unknown>;
      }) => ({
        latitude: f.geometry?.coordinates?.[1] ?? 0,
        longitude: f.geometry?.coordinates?.[0] ?? 0,
        acq_date: f.properties?.acqDateTime
          ? String(f.properties.acqDateTime).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        acq_time: f.properties?.acqDateTime
          ? String(f.properties.acqDateTime).slice(11, 15).replace(':', '')
          : '0000',
        confidence: f.properties?.confidence ?? 'nominal',
        frp: (f.properties?.frp as number) ?? 0,
        satellite: (f.properties?.satellite as string) ?? '',
      }));

      const res = await fetch('/api/fire-records/import-firms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detections }),
      });

      if (!res.ok) throw new Error('Import failed');
      const json = await res.json();
      setResult({ imported: json.imported });

      // Refresh lists
      fetchRecords(false);
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setImporting(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="min-h-10 w-full"
        onClick={() => setOpen(true)}
        data-testid="import-firms-btn"
      >
        {t('importFirms' as Parameters<typeof t>[0])}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:col-span-3" data-testid="import-firms-dialog">
      <h3 className="text-sm font-bold">{t('importFirmsTitle' as Parameters<typeof t>[0])}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('importFirmsDesc' as Parameters<typeof t>[0])}
      </p>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
      {result && (
        <p className="mt-2 text-xs text-green-600">
          {result.imported} {t('recordsImported' as Parameters<typeof t>[0])}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          disabled={importing}
          onClick={handleImport}
        >
          {importing ? t('loading') : t('importFirmsConfirm' as Parameters<typeof t>[0])}
        </Button>
        <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => { setOpen(false); setResult(null); setError(null); }}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}
