'use client';

import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandMark } from '@/components/shell/BrandMark';
import { ReliefBackdrop } from '@/components/brand/ReliefBackdrop';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Split authentication layout: the form on one side, and on large screens a
 * dark "control room" panel with the province's real relief and key facts.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const stats = [
    { value: '78 500', label: t('authStatForest') },
    { value: '7', label: t('authStatAgencies') },
    { value: '3', label: t('authStatLanguages') },
  ];

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <BrandMark href="/" subtitle={t('shellProvince')} />
          <div className="flex items-center gap-1">
            <LanguageSwitcher size="sm" />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-10 pt-4 sm:px-8">
          <div className="w-full max-w-[26rem] animate-slide-up-fade">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-[11.5px] text-muted-foreground sm:px-8">
          <p>{t('authPrivacy')}</p>
          <p className="mt-1">{t('landingDisclaimer')}</p>
        </footer>
      </div>

      <aside className="dark relative hidden overflow-hidden border-s border-border bg-background text-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -end-24 top-1/2 w-[125%] -translate-y-1/2 opacity-90">
          <ReliefBackdrop />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="relative mt-auto p-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{t('authHeroEyebrow')}</p>
          <h2 className="mt-4 max-w-lg text-balance text-[2rem] font-semibold leading-[1.15] tracking-tight">{t('authHeroTitle')}</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">{t('authHeroBody')}</p>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="whitespace-nowrap font-mono text-2xl font-medium tabular">{s.value}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}
