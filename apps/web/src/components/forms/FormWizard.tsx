'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface WizardStep {
  title: string;
  component: ReactNode;
  validate?: () => boolean | string;
}

interface FormWizardProps {
  steps: WizardStep[];
  onSubmit: () => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function FormWizard({
  steps,
  onSubmit,
  isSubmitting,
  submitLabel = 'Soumettre',
}: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const isLast = currentStep === steps.length - 1;

  function goNext() {
    setStepError(null);
    const step = steps[currentStep];
    if (step.validate) {
      const result = step.validate();
      if (result !== true) {
        setStepError(typeof result === 'string' ? result : 'Veuillez compléter cette étape.');
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function goBack() {
    setStepError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    setStepError(null);
    const step = steps[currentStep];
    if (step.validate) {
      const result = step.validate();
      if (result !== true) {
        setStepError(typeof result === 'string' ? result : 'Veuillez compléter cette étape.');
        return;
      }
    }
    await onSubmit();
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <nav aria-label="Progression du formulaire">
        <ol className="flex items-center gap-1">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;

            return (
              <li key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      'h-1.5 w-full rounded-full transition-colors',
                      isCompleted ? 'bg-primary' : isActive ? 'bg-primary/50' : 'bg-muted'
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs truncate max-w-full text-center',
                    isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div>{steps[currentStep].component}</div>

      {/* Error */}
      {stepError && (
        <div role="alert" className="text-sm font-semibold text-danger">
          {stepError}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          disabled={currentStep === 0 || isSubmitting}
        >
          Précédent
        </Button>

        {isLast ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {submitLabel}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={goNext}>
            Suivant
          </Button>
        )}
      </div>
    </div>
  );
}
