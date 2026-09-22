'use client';

import { useEffect } from 'react';
import { useAnalyticsStore } from '@/store/useAnalyticsStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { AnalyticsTab } from '@/types/analytics';
import type { TranslationKey } from '@/i18n/translations';
import { OverviewPanel } from './panels/OverviewPanel';
import { TemporalPanel } from './panels/TemporalPanel';
import { CausesPanel } from './panels/CausesPanel';
import { ResponsePanel } from './panels/ResponsePanel';
import { EnvironmentPanel } from './panels/EnvironmentPanel';
import { RexSummaryPanel } from './panels/RexSummaryPanel';

const TABS: { id: AnalyticsTab; labelKey: TranslationKey }[] = [
  { id: 'overview', labelKey: 'tabOverview' },
  { id: 'temporal', labelKey: 'tabTemporal' },
  { id: 'causes', labelKey: 'tabCauses' },
  { id: 'response', labelKey: 'tabResponse' },
  { id: 'environment', labelKey: 'tabEnvironment' },
  { id: 'rex', labelKey: 'tabRex' },
];

const PANELS: Record<AnalyticsTab, React.ComponentType> = {
  overview: OverviewPanel,
  temporal: TemporalPanel,
  causes: CausesPanel,
  response: ResponsePanel,
  environment: EnvironmentPanel,
  rex: RexSummaryPanel,
};

export function AnalyticsTabs() {
  const { t } = useTranslation();
  const activeTab = useAnalyticsStore((s) => s.activeTab);
  const setActiveTab = useAnalyticsStore((s) => s.setActiveTab);
  const fetchData = useAnalyticsStore((s) => s.fetchData);
  const dateRange = useAnalyticsStore((s) => s.dateRange);
  const customFrom = useAnalyticsStore((s) => s.customFrom);
  const customTo = useAnalyticsStore((s) => s.customTo);
  const loading = useAnalyticsStore((s) => s.loading);

  useEffect(() => {
    fetchData();
  }, [fetchData, dateRange, customFrom, customTo]);

  const ActivePanel = PANELS[activeTab];

  return (
    <div>
      <div
        role="tablist"
        aria-label={t('tabOverview')}
        className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface-2 p-1 md:flex-wrap md:overflow-visible"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            } shrink-0`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        aria-busy={loading}
      >
        <ActivePanel />
      </div>
    </div>
  );
}
