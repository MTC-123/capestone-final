'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface GlassPanelProps {
  children: ReactNode;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  headerActions?: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function GlassPanel({
  children,
  title,
  collapsible = false,
  defaultCollapsed = false,
  className,
  headerActions,
  onCollapsedChange,
}: GlassPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <div
      className={cn(
        'glass rounded-xl shadow-glass overflow-hidden flex flex-col',
        'border border-border/30',
        className
      )}
    >
      {title && (
        <button
          type="button"
          onClick={collapsible ? handleToggle : undefined}
          className={cn(
            'flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-foreground flex-shrink-0',
            collapsible && 'hover:bg-muted/40 transition-colors cursor-pointer'
          )}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          <span className="flex items-center gap-2">
            {title}
            {headerActions}
          </span>
          {collapsible && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="transition-transform duration-200 text-muted-foreground"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
      )}

      <div
        className={cn(
          'transition-all duration-200 overflow-hidden',
          collapsed ? 'max-h-0' : 'max-h-[9999px]'
        )}
      >
        {!collapsed && children}
      </div>
    </div>
  );
}
