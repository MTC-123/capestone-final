'use client';

import { Icon } from '@/components/ui/Icon';
import { useTranslation } from '@/hooks/useTranslation';
import type { WizardStep } from '@/types/report';
import type { TranslationKey } from '@/i18n/translations';

const STEPS: { key: WizardStep; labelKey: TranslationKey }[] = [
  { key: 'location', labelKey: 'stepLocation' },
  { key: 'details', labelKey: 'stepDetails' },
  { key: 'review', labelKey: 'stepReview' },
];

const STEP_ORDER: WizardStep[] = ['location', 'details', 'review'];

interface ProgressBarProps {
  currentStep: WizardStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const { t } = useTranslation();
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <nav aria-label={t('wizardProgress')} className="mb-6">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              {/* Connector line before step (not for first) */}
              {i > 0 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    i <= currentIndex ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}

              {/* Step circle */}
              <div
                className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${
                  isCompleted
                    ? 'h-8 w-8 bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'h-8 w-8 border-2 border-primary bg-surface text-primary'
                      : 'h-8 w-8 border-2 border-border bg-surface text-muted-foreground'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Icon name="check-circle" aria-hidden size={16} />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span
                className={`hidden sm:block text-sm font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {t(step.labelKey)}
              </span>

              {/* Connector line after step (not for last) */}
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    i < currentIndex ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
