'use client';

import * as React from 'react';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

export type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isRTL: boolean;
};

export function AuthShell({ title, subtitle, children, footer, isRTL }: AuthShellProps) {
  return (
    <div className="relative isolate min-h-[100dvh] overflow-x-clip overflow-y-auto bg-background bg-dot-grid">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 border-b border-border/40 bg-gradient-to-b from-surface/90 to-transparent" />
      <div className="absolute end-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-20 sm:p-6">
        <Card tone="elevated" className="p-5 shadow-elev-3 animate-scale-in sm:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="mb-6 text-center">
            <Logo variant="badge" size="xl" priority className="mx-auto mb-5 rounded-xl shadow-elev-2" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>

          {children}

          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </Card>
      </div>
    </div>
  );
}
