'use client';

import { useTranslation } from '@/hooks/useTranslation';
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
    <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" data-testid="detail-tabs">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isLocked = tab.id !== 'audit' && lockedSections.includes(tab.id);
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={[
              'whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {t(tab.labelKey as Parameters<typeof t>[0])}
            {isLocked && <span className="ml-1 text-green-500" aria-label="locked">&#x1F512;</span>}
          </button>
        );
      })}
    </div>
  );
}
