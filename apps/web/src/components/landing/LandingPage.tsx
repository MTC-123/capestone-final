'use client';

import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Icon, type IconName } from '@/components/ui/Icon';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandMark } from '@/components/shell/BrandMark';
import { ReliefBackdrop } from '@/components/brand/ReliefBackdrop';

function Feature({ icon, title, body, tone }: { icon: IconName; title: string; body: string; tone: 'fire' | 'primary' | 'info' | 'warning' }) {
  const toneClass = {
    fire: 'bg-accent-fire-muted text-accent-fire',
    primary: 'bg-primary-muted text-primary',
    info: 'bg-info-muted text-info',
    warning: 'bg-warning-muted text-warning',
  }[tone];
  return (
    <div className="group rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-elev-2">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass}`}>
        <Icon name={icon} size={20} />
      </span>
      <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function LandingPage({ signedInHref }: { signedInHref: string | null }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <BrandMark href="/" subtitle={t('shellProvince')} />
          <div className="ms-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <LanguageSwitcher size="sm" />
            </div>
            <ThemeToggle />
            {signedInHref ? (
              <Link href={signedInHref} className="ms-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                {t('shellOpsLabel')}
                <Icon name="arrowRight" size={15} className="rtl:rotate-180" />
              </Link>
            ) : (
              <>
                <Link href="/signin" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
                  {t('landingNavSignin')}
                </Link>
                <Link href="/signup" className="ms-1 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold hover:border-foreground/25">
                  {t('landingNavSignup')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="animate-slide-up-fade">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-fire" />
                {t('authHeroEyebrow')}
              </p>
              <h1 className="mt-6 text-balance text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                {t('landingTitle')}
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{t('landingLead')}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={signedInHref ? '/report' : '/signup'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-fire px-6 text-[15px] font-semibold text-white shadow-glow-fire transition hover:brightness-110"
                >
                  <Icon name="fire" size={18} />
                  {t('landingCtaReport')}
                </Link>
                <Link
                  href={signedInHref ?? '/signin'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 text-[15px] font-semibold transition hover:border-foreground/25"
                >
                  <Icon name="shieldCheck" size={18} className="text-primary" />
                  {t('landingCtaOfficial')}
                </Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm text-danger">
                <Icon name="phone" size={15} />
                {t('emergencyStrip')}
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="relative rounded-[28px] border border-border bg-surface/70 p-4 shadow-elev-3 backdrop-blur">
                <ReliefBackdrop className="w-full" />
                <div className="absolute start-6 top-6 w-56 rounded-xl border border-border bg-surface/95 p-3 shadow-elev-2 backdrop-blur">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-accent-fire" />
                    INC-2026-0417 · ALERTE
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground">Forêt de cèdres, Azrou — 3 signalements</p>
                </div>
                <div className="absolute bottom-6 end-6 w-52 rounded-xl border border-border bg-surface/95 p-3 shadow-elev-2 backdrop-blur">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Icon name="truck" size={14} className="text-primary" />
                      FT-IFR-02
                    </span>
                    <span className="font-mono text-primary">ETA 11 min</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-3/5 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon="camera" tone="fire" title={t('landingFeature1Title')} body={t('landingFeature1Body')} />
            <Feature icon="layers" tone="primary" title={t('landingFeature2Title')} body={t('landingFeature2Body')} />
            <Feature icon="route" tone="info" title={t('landingFeature3Title')} body={t('landingFeature3Body')} />
            <Feature icon="cpu" tone="warning" title={t('landingFeature4Title')} body={t('landingFeature4Body')} />
          </div>

          <div className="mt-6 grid items-center gap-6 rounded-2xl border border-border bg-surface-2/60 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t('landingTrustTitle')}</h2>
              <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{t('landingTrustBody')}</p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {['OWASP ASVS 5.0', 'WCAG 2.2 AA', 'Loi 09-08', 'ar · fr · en', 'Offline-first'].map((label) => (
                <li key={label} className="rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t('landingFooter')}</p>
          <p>{t('landingDisclaimer')}</p>
        </div>
      </footer>
    </div>
  );
}
