'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';
import type { RecordStatus } from '@/types';

interface Props {
  recordId: string;
  status: RecordStatus;
  lockedSections: string[];
  onStatusChange: () => void;
}

export function FireRecordActionBar({ recordId, status, lockedSections, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const canVerify = status === 'DRAFT';
  const canFinalize = status === 'VERIFIED' && lockedSections.length === 5;

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fire-records/${recordId}/verify`, { method: 'POST' });
      if (res.ok) onStatusChange();
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fire-records/${recordId}/approve`, { method: 'POST' });
      if (res.ok) onStatusChange();
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    const res = await fetch(`/api/fire-records/export?format=pdf&id=${recordId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire-record-${recordId.slice(-8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4" data-testid="action-bar">
      {canVerify && (
        <Button
          variant="primary"
          size="sm"
          disabled={loading}
          onClick={handleVerify}
        >
          {t('verifyRecord' as Parameters<typeof t>[0])}
        </Button>
      )}

      {canFinalize && (
        <Button
          variant="primary"
          size="sm"
          disabled={loading}
          onClick={handleFinalize}
        >
          {t('finalizeRecord' as Parameters<typeof t>[0])}
        </Button>
      )}

      {status === 'VERIFIED' && !canFinalize && (
        <span className="text-xs text-muted-foreground">
          {t('lockAllSectionsFirst' as Parameters<typeof t>[0])} ({lockedSections.length}/5)
        </span>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={handleExportPdf}
        className="ml-auto"
      >
        {t('exportPdf' as Parameters<typeof t>[0])}
      </Button>
    </div>
  );
}
