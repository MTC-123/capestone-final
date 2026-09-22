'use client';

import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { CoordinationTab } from '@/types/coordination';
import type { TranslationKey } from '@/i18n/translations';

const TABS: { id: CoordinationTab; labelKey: TranslationKey }[] = [
  { id: 'agencies', labelKey: 'agencyBoard' },
  { id: 'commLog', labelKey: 'commLog' },
  { id: 'poi', labelKey: 'poiActivation' },
  { id: 'ics', labelKey: 'icsStructure' },
  { id: 'mutualAid', labelKey: 'mutualAid' },
  { id: 'pma', labelKey: 'pmaWorkflow' },
];

export function CoordinationTabs() {
  const { t } = useTranslation();
  const activeTab = useCoordinationStore((s) => s.activeTab);
  const setActiveTab = useCoordinationStore((s) => s.setActiveTab);

  return (
    <div
      role="tablist"
      aria-label={t('coordination')}
      className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-y border-border bg-surface-2 px-4 py-2 sm:mx-0 sm:flex-wrap sm:rounded-lg sm:border sm:p-1"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => setActiveTab(tab.id)}
          className={`min-h-10 shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab.id
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}
