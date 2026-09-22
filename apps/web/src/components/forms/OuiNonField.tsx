'use client';

import { cn } from '@/lib/cn';

interface OuiNonFieldProps {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  withExplanation?: boolean;
  explanationValue?: string;
  onExplanationChange?: (value: string) => void;
  explanationPlaceholder?: string;
  disabled?: boolean;
  id?: string;
}

export function OuiNonField({
  label,
  value,
  onChange,
  withExplanation,
  explanationValue,
  onExplanationChange,
  explanationPlaceholder = 'Précisez...',
  disabled,
  id,
}: OuiNonFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold text-foreground">{label}</legend>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={fieldId}
            checked={value === true}
            onChange={() => onChange(true)}
            className={cn(
              'h-4 w-4 accent-primary',
              disabled && 'opacity-60'
            )}
          />
          <span className="text-sm text-foreground">Oui</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={fieldId}
            checked={value === false}
            onChange={() => onChange(false)}
            className={cn(
              'h-4 w-4 accent-primary',
              disabled && 'opacity-60'
            )}
          />
          <span className="text-sm text-foreground">Non</span>
        </label>
      </div>

      {withExplanation && value != null && (
        <textarea
          className={cn(
            'w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none transition',
            'placeholder:text-muted-foreground',
            'focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            disabled && 'opacity-60'
          )}
          rows={2}
          placeholder={explanationPlaceholder}
          value={explanationValue ?? ''}
          onChange={(e) => onExplanationChange?.(e.target.value)}
        />
      )}
    </fieldset>
  );
}
