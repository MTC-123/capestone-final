'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { ReportWizard } from '@/components/report/ReportWizard';
import { Icon } from '@/components/ui/Icon';

export default function ReportPage() {
  const { t, language } = useTranslation();
  const isRTL = language === 'ar';
  const textAlign = isRTL ? 'text-right' : 'text-left';

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 md:p-6 page-enter">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className={textAlign}>
          <Link
            href="/reports-list"
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2 px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Icon name={isRTL ? 'chevronRight' : 'list'} size={16} aria-hidden />
            {t('reportsBackToHistory')}
          </Link>
          <p className="mb-2 text-xs font-bold uppercase text-primary">
            {t('reportHeroKicker')}
          </p>
          <h1 className="text-fluid-4xl font-bold text-foreground">
            {t('reportFireTitle')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t('reportFireDesc')}
          </p>
        </div>
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger sm:px-4 sm:py-3">
          <span className="font-bold">{t('emergencyNumber')}</span>
          <span className="mx-2">-</span>
          {t('emergencyReminderShort')}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface p-3 shadow-elev-2 sm:p-6">
        <ReportWizard />
      </div>
    </div>
  );
}
