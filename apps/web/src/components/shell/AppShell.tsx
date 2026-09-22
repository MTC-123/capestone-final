import * as React from 'react';
import { cn } from '@/lib/cn';

export type AppShellProps = {
  topbar: React.ReactNode;
  sidebar: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
};

export function AppShell({ topbar, sidebar, rightPanel, children, className, mainClassName }: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-background text-foreground', className)}>
      {topbar}
      <div className="relative flex min-h-[calc(100dvh-var(--topbar-height))] w-full overflow-hidden">
        <div className="hidden md:block">{sidebar}</div>
        <main
          id="main"
          className={cn(
            'relative flex-1 overflow-auto pb-[var(--mobile-tabbar-height)] md:pb-0',
            mainClassName
          )}
        >
          {children}
        </main>
        {rightPanel}
      </div>
    </div>
  );
}
