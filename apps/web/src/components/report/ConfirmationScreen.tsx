'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ReportPdfActions } from '@/components/reports/ReportPdfActions';

interface ConfirmationScreenProps {
  reportId: string;
  referenceNumber: string;
  onReset: () => void;
}

export function ConfirmationScreen({ reportId, referenceNumber, onReset }: ConfirmationScreenProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isRTL = language === 'ar';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Success card */}
      <Card tone="elevated" className="overflow-hidden">
        <div className="border-b border-border/60 bg-success-muted/50 p-6 text-center sm:p-8">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-muted ring-8 ring-success/10">
              <Icon name="check-circle" size={32} className="text-success-foreground" />
            </div>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-foreground">
            {t('reportSubmitted')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {t('reportSubmittedHelper')}
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">{t('referenceNumberLabel')}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 font-mono text-lg font-bold text-foreground transition hover:bg-muted/80"
            >
              <span className="truncate">{referenceNumber}</span>
              <Icon name={copied ? 'check-circle' : 'clipboard'} size={16} aria-hidden className="text-muted-foreground" />
            </button>
            {copied && (
              <p className="text-xs font-semibold text-success-foreground">{t('copied')}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('referenceNumberHelper')}</p>
          </div>

          {reportId && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">{t('reportPdfDownloads')}</p>
              <ReportPdfActions reportId={reportId} />
            </div>
          )}
        </div>
      </Card>

      {/* Emergency reminder */}
      <Card tone="subtle" className="flex items-start gap-3 border-danger/30 bg-danger/5 p-4">
        <Icon name="siren" size={20} className="shrink-0 text-danger" />
        <div>
          <p className="text-sm font-semibold text-danger">
            {t('emergencyReminder')}
          </p>
          <p className="text-lg font-bold text-danger mt-1">
            {t('emergencyNumber')}
          </p>
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="secondary"
          onClick={() => router.push('/reports-list')}
          className="flex-1"
        >
          {t('viewMyReports')}
        </Button>
        <Button
          variant="primary"
          onClick={onReset}
          className="flex-1"
        >
          {t('reportNewFire')}
        </Button>
      </div>
    </div>
  );
}
