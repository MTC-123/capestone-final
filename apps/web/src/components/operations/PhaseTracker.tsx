'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { useOperationsStore } from '@/store/useOperationsStore';
import { Accordion } from '@/components/ui/Accordion';
import { PhaseCard } from './PhaseCard';
import { PHASE_ORDER } from '@/types/operations';
import type { OperationalPhase } from '@/types/operations';

const PHASE_SHORT_LABELS: Record<OperationalPhase, string> = {
  PREPARATION: 'phasePreparation',
  PREPOSITIONNEMENT: 'phasePrepositionnement',
  ALERTE: 'phaseAlerte',
  LUTTE: 'phaseLutte',
  EXTINCTION: 'phaseExtinction',
  POST_CAMPAGNE: 'phasePostCampagne',
};

export function PhaseTracker() {
  const { t } = useTranslation();
  const activeCampaign = useOperationsStore((s) => s.activeCampaign);
  const phaseSummary = useOperationsStore((s) => s.phaseSummary);
  const fetchSummary = useOperationsStore((s) => s.fetchSummary);
  const viewingPhase = useOperationsStore((s) => s.viewingPhase);
  const setViewingPhase = useOperationsStore((s) => s.setViewingPhase);

  useEffect(() => {
    if (activeCampaign) {
      fetchSummary();
    }
  }, [activeCampaign, fetchSummary]);

  if (!activeCampaign) return null;

  const activePhaseIndex = PHASE_ORDER.indexOf(activeCampaign.activePhase);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="rounded-xl border border-border/50 bg-surface p-4 sm:p-6 shadow-elev-1">
        <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[640px] items-center justify-between gap-1 sm:min-w-0 sm:gap-0">
          {PHASE_ORDER.map((phase, i) => {
            const summary = phaseSummary.find((s) => s.phase === phase);
            const isCurrent = i === activePhaseIndex;
            const isCompleted = i < activePhaseIndex;
            const isFuture = i > activePhaseIndex;
            const isViewing = viewingPhase === phase;

            return (
              <div key={phase} className="flex items-center flex-1 last:flex-initial">
                {/* Step circle + label */}
                <button
                  type="button"
                  onClick={() => setViewingPhase(phase)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition-all duration-200',
                      isCompleted && 'bg-success text-white',
                      isCurrent && 'bg-primary text-white ring-4 ring-primary/20',
                      isFuture && 'bg-muted text-muted-foreground',
                      isViewing && !isCurrent && 'ring-2 ring-primary/40'
                    )}
                  >
                    {isCompleted ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={cn(
                    'text-[10px] sm:text-xs font-medium text-center leading-tight max-w-[60px] sm:max-w-[80px] truncate',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-success-foreground',
                    isFuture && 'text-muted-foreground'
                  )}>
                    {t(PHASE_SHORT_LABELS[phase] as Parameters<typeof t>[0])}
                  </span>
                  {summary && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">
                      {summary.done}/{summary.total}
                    </span>
                  )}
                </button>

                {/* Connector line */}
                {i < PHASE_ORDER.length - 1 && (
                  <div className="flex-1 mx-1 sm:mx-2">
                    <div className={cn(
                      'h-0.5 rounded-full transition-colors duration-300',
                      i < activePhaseIndex ? 'bg-success' : 'bg-border'
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Phase cards */}
      <Accordion defaultValue={[viewingPhase]}>
        {PHASE_ORDER.map((phase, i) => {
          const summary = phaseSummary.find((s) => s.phase === phase) ?? {
            phase,
            total: 0,
            done: 0,
          };
          return (
            <PhaseCard
              key={phase}
              phase={phase}
              index={i}
              summary={summary}
              isActive={i === activePhaseIndex}
              isCompleted={i < activePhaseIndex}
            />
          );
        })}
      </Accordion>
    </div>
  );
}
