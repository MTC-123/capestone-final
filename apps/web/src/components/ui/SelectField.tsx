import * as React from 'react';
import { cn } from '@/lib/cn';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';

export type SelectFieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectFieldProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'size' | 'className' | 'children'
> & {
  label: string;
  options: SelectFieldOption[];
  helperText?: string;
  errorText?: string;
  leadingIcon?: IconName;
  containerClassName?: string;
  selectClassName?: string;
};

export function SelectField({
  id,
  label,
  options,
  helperText,
  errorText,
  leadingIcon,
  containerClassName,
  selectClassName,
  required,
  disabled,
  ...props
}: SelectFieldProps) {
  const describedByIds = [
    errorText ? `${id}-error` : null,
    helperText ? `${id}-help` : null,
  ].filter(Boolean) as string[];

  return (
    <div className={cn('space-y-2', containerClassName)}>
      <label
        htmlFor={id}
        className={cn('text-sm font-semibold text-foreground', disabled && 'opacity-60')}
      >
        {label}
        {required ? <span className="ms-1 text-danger">*</span> : null}
      </label>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-surface px-3 py-2 shadow-sm transition',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
          disabled && 'opacity-60'
        )}
      >
        {leadingIcon ? (
          <Icon name={leadingIcon} aria-hidden={true} className="text-muted-foreground" size={18} />
        ) : null}

        <select
          id={id}
          className={cn(
            'h-7 w-full bg-transparent text-sm text-foreground outline-none',
            selectClassName
          )}
          aria-invalid={!!errorText || undefined}
          aria-describedby={describedByIds.length ? describedByIds.join(' ') : undefined}
          required={required}
          disabled={disabled}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {errorText ? (
        <div id={`${id}-error`} role="alert" className="text-sm font-semibold text-danger">
          {errorText}
        </div>
      ) : null}

      {helperText ? (
        <div id={`${id}-help`} className="text-xs text-muted-foreground">
          {helperText}
        </div>
      ) : null}
    </div>
  );
}

