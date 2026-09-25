'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import type { LockableSection } from '@/types';

const TABS: { id: LockableSection | 'audit'; labelKey: string }[] = [
  { id: 'location', labelKey: 'tabLocation' },
  { id: 'cause', labelKey: 'tabCause' },
  { id: 'damage', labelKey: 'tabDamage' },
  { id: 'response', labelKey: 'tabResponse' },
  { id: 'postFire', labelKey: 'tabPostFire' },
  { id: 'audit', labelKey: 'tabAuditTrail' },
];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  lockedSections: string[];
}

export function FireRecordDetailTabs({ activeTab, onTabChange, lockedSections }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-[10px] border border-border bg-surface-2 p-1"
      role="tablist"
      data-testid="detail-tabs"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isLocked = tab.id !== 'audit' && lockedSections.includes(tab.id);
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-elev-1'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t(tab.labelKey as Parameters<typeof t>[0])}
            {isLocked && <span className={cn('ms-1', isActive ? 'text-primary-foreground' : 'text-success')} aria-label="locked">&#x1F512;</span>}
          </button>
        );
      })}
    </div>
  );
}
