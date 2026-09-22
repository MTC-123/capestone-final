'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useTranslation } from '@/hooks/useTranslation';
import { useOperationsStore } from '@/store/useOperationsStore';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { TaskRow } from './TaskRow';
import { OperationPhasePdfActions } from './OperationPhasePdfActions';
import type { OperationalPhase, PhaseSummary } from '@/types/operations';

const PHASE_LABELS: Record<OperationalPhase, string> = {
  PREPARATION: 'phasePreparation',
  PREPOSITIONNEMENT: 'phasePrepositionnement',
  ALERTE: 'phaseAlerte',
  LUTTE: 'phaseLutte',
  EXTINCTION: 'phaseExtinction',
  POST_CAMPAGNE: 'phasePostCampagne',
};

const PHASE_DESCS: Record<OperationalPhase, string> = {
  PREPARATION: 'phasePreparationDesc',
  PREPOSITIONNEMENT: 'phasePrepositionnementDesc',
  ALERTE: 'phaseAlerteDesc',
  LUTTE: 'phaseLutteDesc',
  EXTINCTION: 'phaseExtinctionDesc',
  POST_CAMPAGNE: 'phasePostCampagneDesc',
};

interface PhaseCardProps {
  phase: OperationalPhase;
  index: number;
  summary: PhaseSummary;
  isActive: boolean;
  isCompleted: boolean;
}

export function PhaseCard({ phase, index, summary, isActive, isCompleted }: PhaseCardProps) {
  const { t } = useTranslation();
  const activeCampaign = useOperationsStore((s) => s.activeCampaign);
  const tasks = useOperationsStore((s) => s.tasks);
  const tasksLoading = useOperationsStore((s) => s.tasksLoading);
  const viewingPhase = useOperationsStore((s) => s.viewingPhase);
  const fetchTasks = useOperationsStore((s) => s.fetchTasks);
  const toggleTask = useOperationsStore((s) => s.toggleTask);
  const addTask = useOperationsStore((s) => s.addTask);
  const deleteTask = useOperationsStore((s) => s.deleteTask);

  const [newTask, setNewTask] = useState('');

  const isViewing = viewingPhase === phase;

  useEffect(() => {
    if (isViewing) {
      fetchTasks(phase);
    }
  }, [isViewing, phase, fetchTasks]);

  const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const progressText = t('phaseProgress')
    .replace('{done}', String(summary.done))
    .replace('{total}', String(summary.total));
  const isPdfAvailable = !!activeCampaign && summary.total > 0 && (summary.done === summary.total || isCompleted);

  const handleAddTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    addTask(phase, trimmed);
    setNewTask('');
  };

  return (
    <AccordionItem
      value={phase}
      className={cn(
        'rounded-xl border transition-all duration-200',
        isActive && 'border-primary/40 shadow-elev-1',
        isCompleted && 'border-success/30',
        !isActive && !isCompleted && 'border-border/50'
      )}
    >
      <AccordionTrigger
        className={cn(
          'px-4 py-3 text-sm font-semibold normal-case tracking-normal',
          isActive && 'text-primary',
          isCompleted && 'text-success-foreground'
        )}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Phase number */}
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              isCompleted && 'bg-success text-white',
              isActive && 'bg-primary text-white',
              !isActive && !isCompleted && 'bg-muted text-muted-foreground'
            )}
          >
            {isCompleted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              index + 1
            )}
          </span>

          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate">{t(PHASE_LABELS[phase] as Parameters<typeof t>[0])}</span>
              <Badge
                tone={isCompleted ? 'success' : isActive ? 'primary' : 'neutral'}
                className="text-[10px] px-2 py-0"
              >
                {progressText}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-normal truncate mt-0.5">
              {t(PHASE_DESCS[phase] as Parameters<typeof t>[0])}
            </p>
          </div>

          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 w-28">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isCompleted ? 'bg-success' : isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono w-8 text-right">{pct}%</span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        {/* Task list */}
        <div className="space-y-0.5 mt-1">
          {tasksLoading && isViewing ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Icon name="loading" size={16} className="animate-spin" aria-hidden={true} />
              {t('loading')}
            </div>
          ) : isViewing ? (
            tasks.map((item) => (
              <TaskRow
                key={item.id}
                item={item}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            ))
          ) : null}
        </div>

        {/* Add task inline */}
        {isViewing && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
            <Icon name="plus" size={16} className="text-muted-foreground shrink-0" aria-hidden={true} />
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
              }}
              placeholder={t('taskPlaceholder')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            {newTask.trim() && (
              <button
                type="button"
                onClick={handleAddTask}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('addTask')}
              </button>
            )}
          </div>
        )}

        {isViewing && isPdfAvailable && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
              <Icon name="check-circle" size={16} aria-hidden={true} />
              {t('operationPdfReady')}
            </div>
            <OperationPhasePdfActions campaignId={activeCampaign.id} phase={phase} compact />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
