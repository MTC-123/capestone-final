'use client';

import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOperationsStore } from '@/store/useOperationsStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PHASE_ORDER } from '@/types/operations';

const STATUS_TONE = {
  PLANNING: 'warning',
  ACTIVE: 'success',
  CLOSED: 'neutral',
} as const;

const STATUS_LABEL = {
  PLANNING: 'campaignPlanning',
  ACTIVE: 'campaignActive',
  CLOSED: 'campaignClosed',
} as const;

export function CampaignHeader() {
  const { t } = useTranslation();
  const activeCampaign = useOperationsStore((s) => s.activeCampaign);
  const campaigns = useOperationsStore((s) => s.campaigns);
  const createCampaign = useOperationsStore((s) => s.createCampaign);
  const advancePhase = useOperationsStore((s) => s.advancePhase);
  const setActiveCampaign = useOperationsStore((s) => s.setActiveCampaign);

  const [showForm, setShowForm] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    try {
      await createCampaign(year, label.trim());
      setShowForm(false);
      setLabel('');
    } finally {
      setCreating(false);
    }
  };

  const canAdvance = activeCampaign &&
    PHASE_ORDER.indexOf(activeCampaign.activePhase) < PHASE_ORDER.length - 1;

  return (
    <Card tone="subtle" className="p-4 mb-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* Campaign info */}
        {activeCampaign ? (
          <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
            <Icon name="layers" size={20} className="text-primary shrink-0" aria-hidden={true} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold truncate">
                  {activeCampaign.label} ({activeCampaign.year})
                </h2>
                <Badge tone={STATUS_TONE[activeCampaign.status]}>
                  {t(STATUS_LABEL[activeCampaign.status] as Parameters<typeof t>[0])}
                </Badge>
              </div>
            </div>

            {/* Campaign selector dropdown (if multiple) */}
            {campaigns.length > 1 && (
              <select
                value={activeCampaign.id}
                onChange={(e) => {
                  const c = campaigns.find((c) => c.id === e.target.value);
                  if (c) setActiveCampaign(c);
                }}
                className="min-h-10 w-full rounded-md border border-border/60 bg-transparent px-2 py-1 text-xs outline-none sm:w-auto"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.year})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex-1 text-sm text-muted-foreground">
            {t('noCampaign')}
          </div>
        )}

        {/* Actions */}
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center">
          {canAdvance && (
            <Button variant="primary" onClick={advancePhase} className="w-full gap-1.5 text-xs sm:w-auto">
              <Icon name="chevronRight" size={14} aria-hidden={true} />
              {t('advancePhase')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowForm(!showForm)} className="w-full gap-1.5 text-xs sm:w-auto">
            <Icon name="plus" size={14} aria-hidden={true} />
            {t('newCampaign')}
          </Button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="mt-4 flex flex-col items-end gap-2 border-t border-border/30 pt-3 sm:flex-row">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="campaign-year" className="text-[11px] font-medium text-muted-foreground mb-1 block">
              {t('campaignYear')}
            </label>
            <input
              id="campaign-year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full sm:w-24 rounded-md border border-border/60 bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex-[2] w-full sm:w-auto">
            <label htmlFor="campaign-label" className="text-[11px] font-medium text-muted-foreground mb-1 block">
              Label
            </label>
            <input
              id="campaign-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="Campagne 2026"
              className="w-full rounded-md border border-border/60 bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !label.trim()}
            className="w-full text-xs sm:w-auto"
          >
            {creating ? t('loading') : t('newCampaign')}
          </Button>
        </div>
      )}
    </Card>
  );
}
