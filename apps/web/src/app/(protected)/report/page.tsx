'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { ReportWizard } from '@/components/report/ReportWizard';
import { SyncStatusPill } from '@/components/offline';
import { Icon } from '@/components/ui/Icon';
import { PageContainer, PageHeader } from '@/components/ui/PageHeader';

export default function ReportPage() {
  const { t } = useTranslation();
  const params = useSearchParams();

  return (
    <PageContainer className="max-w-3xl">
      {params.get('request') === 'pending' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-info/25 bg-info-muted px-4 py-3 text-sm text-info-foreground">
          <Icon name="clock" size={17} className="mt-0.5" />
          <p>{t('reportPendingRequest')}</p>
        </div>
      )}
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Icon name="wifiOff" size={13} />
            {t('reportWorksOffline')}
          </span>
        }
        title={t('reportHeroTitle')}
        description={t('reportHeroLead')}
        actions={
          <>
            <SyncStatusPill />
            <Link
              href="/reports-list"
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Icon name="list" size={16} />
              {t('reportsBackToHistory')}
            </Link>
          </>
        }
      />
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-elev-1 sm:p-7">
        <ReportWizard />
      </div>
    </PageContainer>
  );
}
