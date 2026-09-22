'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCoordinationStore } from '@/store/useCoordinationStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CoordinationTabs } from '@/components/coordination/CoordinationTabs';
import { AgencyStatusBoard } from '@/components/coordination/AgencyStatusBoard';
import { CommLogTimeline } from '@/components/coordination/CommLogTimeline';
import { POIActivationPanel } from '@/components/coordination/POIActivationPanel';
import { ICSChart } from '@/components/coordination/ICSChart';
import { MutualAidPanel } from '@/components/coordination/MutualAidPanel';
import { PMAWorkflowPanel } from '@/components/coordination/PMAWorkflowPanel';
import { useCoordinationPoller } from '@/hooks/useCoordinationPoller';
import type { CoordinationTab } from '@/types/coordination';

const PANELS: Record<CoordinationTab, React.ComponentType> = {
  agencies: AgencyStatusBoard,
  commLog: CommLogTimeline,
  poi: POIActivationPanel,
  ics: ICSChart,
  mutualAid: MutualAidPanel,
  pma: PMAWorkflowPanel,
};

export default function CoordinationPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeTab = useCoordinationStore((s) => s.activeTab);
  const fetchAgencies = useCoordinationStore((s) => s.fetchAgencies);
  useCoordinationPoller();

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  if (user?.role !== 'OFFICIAL') {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <p className="text-muted-foreground">{t('errorForbidden')}</p>
      </div>
    );
  }

  const ActivePanel = PANELS[activeTab];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
      <div className="mb-6">
        <h1 className="text-fluid-3xl font-bold text-foreground mb-2">
          {t('coordination')}
        </h1>
        <p className="text-muted-foreground">{t('coordinationDesc')}</p>
      </div>

      <CoordinationTabs />

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        <ActivePanel />
      </div>
    </div>
  );
}
