'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-surface-2/50 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Branding */}
          <div className="col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <Logo variant="badge" size="md" className="rounded-md shadow-elev-1" />
              <div>
                <div className="text-sm font-bold">{t('brandTitle')}</div>
                <div className="text-[11px] text-muted-foreground">{t('brandSubtitle')}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('footerDescription')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('footerNavigation')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/map"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('footerFireMap')}
                </Link>
              </li>
              <li>
                <Link
                  href="/analytics"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('footerAnalytics')}
                </Link>
              </li>
              <li>
                <Link
                  href="/report"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('footerReportFire')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Emergency */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('footerEmergency')}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Icon name="phone" size={14} className="text-danger shrink-0" />
                <span>{t('footerCivilProtection')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon name="phone" size={14} className="text-danger shrink-0" />
                <span>{t('footerWaterForests')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/30 pt-5 text-center text-[11px] text-muted-foreground/70">
          &copy; {currentYear} RICER Ifrane. {t('footerAllRightsReserved')}.
        </div>
      </div>
    </footer>
  );
}
