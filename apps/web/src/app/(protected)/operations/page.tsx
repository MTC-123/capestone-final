'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useOperationsStore } from '@/store/useOperationsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CampaignHeader } from '@/components/operations/CampaignHeader';
import { PhaseTracker } from '@/components/operations/PhaseTracker';
import { Icon } from '@/components/ui/Icon';

export default function OperationsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const activeCampaign = useOperationsStore((s) => s.activeCampaign);
  const campaignsLoading = useOperationsStore((s) => s.campaignsLoading);
  const fetchCampaigns = useOperationsStore((s) => s.fetchCampaigns);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (user?.role !== 'OFFICIAL') {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <p className="text-muted-foreground">{t('errorForbidden')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 page-enter">
      <header className="mb-6">
        <h1 className="text-fluid-3xl font-bold text-foreground mb-2">
          {t('operationsTitle')}
        </h1>
        <p className="text-muted-foreground">{t('operationsDesc')}</p>
      </header>

      <CampaignHeader />

      {campaignsLoading && !activeCampaign && (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Icon name="loading" size={20} className="animate-spin" aria-hidden={true} />
          {t('loading')}
        </div>
      )}

      {activeCampaign && <PhaseTracker />}

      {!activeCampaign && !campaignsLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="layers" size={48} className="text-muted-foreground/30 mb-4" aria-hidden={true} />
          <p className="text-muted-foreground">{t('noCampaign')}</p>
        </div>
      )}
    </div>
  );
}
