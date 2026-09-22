'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/Button';

interface Props {
  recordId: string;
  section: string;
  isLocked: boolean;
  disabled?: boolean;
  onLocked: () => void;
}

export function SectionLockButton({ recordId, section, isLocked, disabled, onLocked }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (isLocked) {
    return (
      <span className="inline-flex items-center text-xs text-green-600 font-medium" data-testid={`lock-${section}`}>
        {t('sectionLocked' as Parameters<typeof t>[0])}
      </span>
    );
  }

  const handleLock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fire-records/${recordId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
      if (res.ok) onLocked();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled || loading}
      onClick={handleLock}
      data-testid={`lock-${section}`}
    >
      {loading ? t('loading') : t('fireRecordLockSection')}
    </Button>
  );
}
