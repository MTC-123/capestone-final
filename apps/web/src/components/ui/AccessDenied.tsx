'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon } from '@/components/ui/Icon';

/** Shown when a signed-in resident reaches an official-only screen. */
export function AccessDenied() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warning-muted text-warning">
        <Icon name="lock" size={26} />
      </span>
      <h1 className="mt-6 text-xl font-semibold tracking-tight">{t('accessDeniedTitle')}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{t('accessDeniedBody')}</p>
      <Link href="/map" className="mt-8 inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110">
        <Icon name="arrowLeft" size={16} className="rtl:rotate-180" />
        {t('accessDeniedBack')}
      </Link>
    </div>
  );
}
