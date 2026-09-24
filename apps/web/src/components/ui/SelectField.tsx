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
    <div className={cn('space-y-1.5', containerClassName)}>
      <label htmlFor={id} className={cn('block text-[13px] font-medium text-foreground', disabled && 'opacity-60')}>
        {label}
        {required ? (
          <span className="ms-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      <div
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-[10px] border bg-surface px-3 transition-[border-color,box-shadow]',
          errorText ? 'border-danger/60' : 'border-input hover:border-foreground/25',
          'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
          disabled && 'opacity-60'
        )}
      >
        {leadingIcon ? (
          <Icon name={leadingIcon} aria-hidden={true} className="text-muted-foreground" size={18} />
        ) : null}

        <select
          id={id}
          className={cn(
            'h-full w-full bg-transparent text-[15px] text-foreground outline-none sm:text-sm',
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
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-danger">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

